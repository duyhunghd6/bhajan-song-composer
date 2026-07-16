import { Chord, Note, Scale } from "@tonaljs/tonal";

import type { GuitarStringNumber } from "../../fingerstyle-compressor";
import {
  STANDARD_TUNING_OPEN_MIDI,
  scientificPitchForStringFret,
} from "../../guitar-playability";
import { SKILL_LEVEL_CONSTRAINTS, type SkillLevel } from "../fingerstyle-constraints";
import type { TimeSliceGridStep } from "../time-slice";
import type {
  FillAtomicCandidate,
  FillHarmonicRole,
  FillRejectionReason,
} from "./types";

interface PitchPoolEntry {
  pitchClass: string;
  role: FillHarmonicRole;
  conditions: string[];
}

export interface CandidateEnumerationInput {
  windowId: string;
  measure: number;
  step: TimeSliceGridStep;
  endStep: number;
  key: string;
  nextChord?: string;
  skillLevel: SkillLevel;
  protectedStrings: GuitarStringNumber[];
  occupiedStrings: GuitarStringNumber[];
  melodyCeilingMidi: number | null;
  previousHandPosition: number;
  nextHandPosition: number;
  movementStepsFromPrevious: number;
  movementStepsToNext: number;
  foundationFrets: number[];
}

export interface CandidateEnumerationResult {
  candidates: FillAtomicCandidate[];
  evaluatedPlacementCount: number;
  rejectionCounts: Partial<Record<FillRejectionReason, number>>;
}

function normalizePitchClass(value: string): string {
  return Note.enharmonic(Note.pitchClass(value) || value) || value;
}

function parseKeyScale(key: string): string[] {
  const match = key.trim().match(/^([A-Ga-g](?:#|b)?)(.*)$/);
  if (!match) return [];
  const tonic = match[1][0].toUpperCase() + match[1].slice(1);
  const suffix = match[2].toLowerCase();
  const mode = suffix.startsWith("m") || suffix.includes("minor") ? "minor" : "major";
  return Scale.get(`${tonic} ${mode}`).notes.map(normalizePitchClass);
}

function pitchPoolForStep(
  chordSymbol: string,
  key: string,
  weight: TimeSliceGridStep["weight"],
  nextChord?: string,
): PitchPoolEntry[] {
  const parsed = Chord.get(chordSymbol);
  const chordNotes = parsed.empty ? [] : parsed.notes.map(normalizePitchClass);
  const nextNotes = nextChord ? Chord.get(nextChord).notes.map(normalizePitchClass) : [];
  const result = new Map<string, PitchPoolEntry>();

  chordNotes.forEach((pitchClass, index) => {
    const role: FillHarmonicRole = index === 0
      ? "root"
      : index === 1
        ? "third"
        : index === 2
          ? "fifth"
          : index === 3
            ? "seventh"
            : "extension";
    const conditions = nextNotes.includes(pitchClass) ? ["common-tone-next-chord"] : [];
    result.set(pitchClass, { pitchClass, role, conditions });
  });

  if (weight === null || weight === "*") {
    for (const pitchClass of parseKeyScale(key)) {
      if (!result.has(pitchClass)) {
        result.set(pitchClass, {
          pitchClass,
          role: "scale-approach",
          conditions: ["weak-placement", "resolve-by-window-end"],
        });
      }
    }
  }

  return [...result.values()];
}

function handPositionForFret(fret: number, fallback: number): number {
  return fret === 0 ? fallback : fret;
}

function suggestedFingerForString(string: GuitarStringNumber): "i" | "m" | "a" {
  if (string === 1) return "a";
  if (string === 2) return "m";
  return "i";
}

function candidateScore(
  role: FillHarmonicRole,
  totalHandCost: number,
  fret: number,
  conditions: string[],
): number {
  const roleBonus = role === "third"
    ? 18
    : role === "root" || role === "fifth"
      ? 14
      : role === "seventh" || role === "extension"
        ? 10
        : 4;
  const commonToneBonus = conditions.includes("common-tone-next-chord") ? 10 : 0;
  const openStringBonus = fret === 0 ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(78 + roleBonus + commonToneBonus + openStringBonus - totalHandCost * 8)));
}

export function enumerateFillCandidates(input: CandidateEnumerationInput): CandidateEnumerationResult {
  const constraints = SKILL_LEVEL_CONSTRAINTS[input.skillLevel];
  const protectedStrings = new Set(input.protectedStrings);
  const occupiedStrings = new Set(input.occupiedStrings);
  const pitchPool = pitchPoolForStep(input.step.chord, input.key, input.step.weight, input.nextChord);
  const pitchPoolByClass = new Map(pitchPool.map(entry => [entry.pitchClass, entry]));
  const candidates: FillAtomicCandidate[] = [];
  const rejectionCounts: Partial<Record<FillRejectionReason, number>> = {};
  let evaluatedPlacementCount = 0;

  const reject = (reason: FillRejectionReason) => {
    rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
  };

  if (pitchPool.length === 0) {
    reject("no-legal-pitch");
    return { candidates, evaluatedPlacementCount, rejectionCounts };
  }

  for (const string of [4, 3, 2, 1] as GuitarStringNumber[]) {
    for (let fret = 0; fret <= constraints.maxFret; fret++) {
      evaluatedPlacementCount++;
      if (protectedStrings.has(string)) {
        reject("protected-melody-string");
        continue;
      }
      if (occupiedStrings.has(string)) {
        reject("occupied-string");
        continue;
      }

      const midi = STANDARD_TUNING_OPEN_MIDI[string] + fret;
      const pitch = scientificPitchForStringFret(string, fret);
      const pitchClass = normalizePitchClass(pitch);
      const poolEntry = pitchPoolByClass.get(pitchClass);
      if (!poolEntry) {
        reject("no-legal-pitch");
        continue;
      }
      if (input.melodyCeilingMidi !== null && midi >= input.melodyCeilingMidi) {
        reject("register-collision");
        continue;
      }

      const soundingFrets = [...input.foundationFrets.filter(value => value > 0), ...(fret > 0 ? [fret] : [])];
      if (soundingFrets.length >= 2 && Math.max(...soundingFrets) - Math.min(...soundingFrets) > constraints.maxFretSpan) {
        reject("fret-span");
        continue;
      }

      const candidateHandPosition = handPositionForFret(fret, input.previousHandPosition);
      const incomingHandCost = Math.abs(candidateHandPosition - input.previousHandPosition);
      const outgoingHandCost = Math.abs(candidateHandPosition - input.nextHandPosition);
      const incomingAllowance = Math.max(1, constraints.maxHandJumpPerBeat * Math.max(0.25, input.movementStepsFromPrevious / 4));
      const outgoingAllowance = Math.max(1, constraints.maxHandJumpPerBeat * Math.max(0.25, input.movementStepsToNext / 4));
      if (incomingHandCost > incomingAllowance || outgoingHandCost > outgoingAllowance) {
        reject("hand-jump");
        continue;
      }

      const totalHandCost = incomingHandCost + outgoingHandCost;
      const conditions = [...poolEntry.conditions];
      const idPitch = pitch.replace(/[^A-Za-z0-9#b-]/g, "");
      candidates.push({
        id: `c-m${input.measure}-s${input.step.step}-${idPitch}-str${string}f${fret}`,
        windowId: input.windowId,
        measure: input.measure,
        step: input.step.step,
        pitch,
        midi,
        harmonicRole: poolEntry.role,
        string,
        fret,
        suggestedFinger: suggestedFingerForString(string),
        maxDurationSteps: Math.max(1, input.endStep - input.step.step + 1),
        incomingHandCost,
        outgoingHandCost,
        totalHandCost,
        score: candidateScore(poolEntry.role, totalHandCost, fret, conditions),
        conditions,
      });
    }
  }

  candidates.sort((left, right) => (
    right.score - left.score
    || left.totalHandCost - right.totalHandCost
    || left.midi - right.midi
    || left.string - right.string
    || left.fret - right.fret
  ));

  return { candidates, evaluatedPlacementCount, rejectionCounts };
}
