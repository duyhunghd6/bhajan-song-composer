import { Chord, Note } from "@tonaljs/tonal";
import { midiForStringFret, parseScientificPitch } from "../guitar-playability";
import type { SkillLevel } from "./fingerstyle-constraints";
import { SKILL_LEVEL_CONSTRAINTS } from "./fingerstyle-constraints";
import type { TimeSliceMeasure } from "./time-slice";
import { melodyDurationSteps } from "./time-slice-abc-renderer";

export interface BassPosition {
  id: string;
  measure: number;
  step: number;
  chord: string;
  weight: "⬤" | "●" | "*";
}

export interface BassPositionAnalysis {
  setId: string;
  sourceFingerprint: string;
  positions: BassPosition[];
}

export interface BassPositionSelection {
  setId: string;
  sourceFingerprint: string;
  decisions: Array<{ positionId: string; decision: "use" | "skip"; reason: string }>;
}

export interface BassPitchCandidate {
  id: string;
  positionId: string;
  pitch: string;
  role: "bass" | "root" | "fifth";
  score: number;
  string: 4 | 5 | 6;
  fret: number;
}

export interface BassPitchAnalysis {
  setId: string;
  sourceFingerprint: string;
  positionSetId: string;
  candidates: BassPitchCandidate[];
}

export interface BassPitchSelection {
  setId: string;
  sourceFingerprint: string;
  candidateIds: string[];
}

function hash(value: string): string {
  let result = 5381;
  for (const char of value) result = (result * 33) ^ char.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function setId(prefix: string, sourceFingerprint: string, body: string): string {
  return `${prefix}-${hash(`${sourceFingerprint}|${body}`)}`;
}

export function analyzeBassPositions(input: {
  measures: TimeSliceMeasure[];
  sourceFingerprint: string;
  reservedFillSlotIds: string[];
}): BassPositionAnalysis {
  const reserved = new Set(input.reservedFillSlotIds);
  const positions = input.measures.flatMap(measure => measure.grid.flatMap(step => {
    const slotId = `fr-m${measure.measure}-s${step.step}`;
    if (measure.pickupDurationUnits || step.weight === null || reserved.has(slotId)) return [];
    return [{
      id: `bp-m${measure.measure}-s${step.step}`,
      measure: measure.measure,
      step: step.step,
      chord: step.chord,
      weight: step.weight,
    }];
  }));
  return {
    setId: setId("bps", input.sourceFingerprint, positions.map(position => position.id).join("|")),
    sourceFingerprint: input.sourceFingerprint,
    positions,
  };
}

export function formatBassPositions(analysis: BassPositionAnalysis): string {
  return [
    "bass-positions:v1",
    `set,${analysis.setId}`,
    `source,${analysis.sourceFingerprint}`,
    "rows: [B,id,measure,step,chord,weight]",
    ...analysis.positions.map(position => `B,${position.id},${position.measure},${position.step},${position.chord},${position.weight}`),
  ].join("\n");
}

export function parseBassPositionSelection(value: string): { valid: boolean; value?: BassPositionSelection; errors: string[] } {
  const lines = value.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.shift() !== "bass-position-selection:v1") errors.push("Expected bass-position-selection:v1 header.");
  const set = lines.shift()?.split(",");
  const source = lines.shift()?.split(",");
  if (set?.[0] !== "set" || !set[1]) errors.push("Missing bass position set binding.");
  if (source?.[0] !== "source" || !source[1]) errors.push("Missing source binding.");
  const decisions = lines.flatMap((line, index) => {
    if (line.startsWith("decisions:")) return [];
    const [tag, positionId, decision, ...reason] = line.split(",");
    if (tag !== "D" || !positionId || (decision !== "use" && decision !== "skip") || !reason.join(",").trim()) {
      errors.push(`Invalid bass position decision row ${index + 1}.`);
      return [];
    }
    return [{ positionId, decision: decision as "use" | "skip", reason: reason.join(",").trim() }];
  });
  return errors.length || !set?.[1] || !source?.[1]
    ? { valid: false, errors }
    : { valid: true, value: { setId: set[1], sourceFingerprint: source[1], decisions }, errors: [] };
}

export function validateBassPositionSelection(analysis: BassPositionAnalysis, selection: BassPositionSelection): { valid: boolean; errors: string[]; selectedPositionIds: string[] } {
  const errors: string[] = [];
  if (analysis.setId !== selection.setId) errors.push("Bass position set is stale.");
  if (analysis.sourceFingerprint !== selection.sourceFingerprint) errors.push("Bass position source fingerprint does not match.");
  const expected = new Set(analysis.positions.map(position => position.id));
  const seen = new Set<string>();
  for (const decision of selection.decisions) {
    if (!expected.has(decision.positionId)) errors.push(`Unknown bass position ${decision.positionId}.`);
    if (seen.has(decision.positionId)) errors.push(`Duplicate bass position ${decision.positionId}.`);
    seen.add(decision.positionId);
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`Missing bass position decision for ${id}.`);
  return { valid: errors.length === 0, errors, selectedPositionIds: selection.decisions.filter(row => row.decision === "use").map(row => row.positionId) };
}

function physicalPositionsForPitch(pitch: string, skillLevel: SkillLevel): Array<{ string: 4 | 5 | 6; fret: number }> {
  const midi = Note.midi(pitch);
  const maxFret = SKILL_LEVEL_CONSTRAINTS[skillLevel].maxFret;
  if (midi == null) return [];
  return ([6, 5, 4] as const).flatMap(string => {
    const fret = midi - midiForStringFret(string, 0);
    return fret >= 0 && fret <= maxFret ? [{ string, fret }] : [];
  });
}

function pitchesForTone(tone: string): string[] {
  const pitchClass = Note.pitchClass(tone);
  if (!pitchClass) return [];
  return [2, 3, 4].map(octave => `${pitchClass}${octave}`);
}

export function analyzeBassPitchCandidates(input: {
  positions: BassPosition[];
  positionSetId: string;
  sourceFingerprint: string;
  skillLevel: SkillLevel;
}): BassPitchAnalysis {
  const candidates = input.positions.flatMap(position => {
    const chord = Chord.get(position.chord);
    const root = chord.tonic;
    if (!root) return [];
    const tones = [
      { pitchClass: root, role: "root" as const, priority: 100 },
      ...(chord.notes.length > 2 ? [{ pitchClass: chord.notes[2] ?? root, role: "fifth" as const, priority: 80 }] : []),
    ];
    return tones.flatMap(tone => pitchesForTone(tone.pitchClass).flatMap(pitch => physicalPositionsForPitch(pitch, input.skillLevel).map(physical => ({
      id: `bc-${position.id}-${pitch}-str${physical.string}f${physical.fret}`,
      positionId: position.id,
      pitch,
      role: tone.role,
      score: tone.priority + (physical.fret === 0 ? 10 : 0) - physical.fret,
      ...physical,
    }))));
  }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return {
    setId: setId("bpc", input.sourceFingerprint, candidates.map(candidate => candidate.id).join("|")),
    sourceFingerprint: input.sourceFingerprint,
    positionSetId: input.positionSetId,
    candidates,
  };
}

export function formatBassPitchCandidates(analysis: BassPitchAnalysis): string {
  return [
    "bass-pitch-candidates:v1",
    `set,${analysis.setId}`,
    `source,${analysis.sourceFingerprint}`,
    `positionSet,${analysis.positionSetId}`,
    "rows: [C,id,position,pitch,role,score,string,fret]",
    ...analysis.candidates.map(candidate => `C,${candidate.id},${candidate.positionId},${candidate.pitch},${candidate.role},${candidate.score},${candidate.string},${candidate.fret}`),
  ].join("\n");
}

export function parseBassPitchSelection(value: string): { valid: boolean; value?: BassPitchSelection; errors: string[] } {
  const lines = value.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.shift() !== "bass-pitch-selection:v1") errors.push("Expected bass-pitch-selection:v1 header.");
  const set = lines.shift()?.split(",");
  const source = lines.shift()?.split(",");
  if (set?.[0] !== "set" || !set[1]) errors.push("Missing bass pitch set binding.");
  if (source?.[0] !== "source" || !source[1]) errors.push("Missing source binding.");
  const candidateIds = lines.flatMap((line, index) => {
    if (line.startsWith("choices:")) return [];
    const [tag, candidateId] = line.split(",");
    if (tag !== "C" || !candidateId) { errors.push(`Invalid bass pitch choice row ${index + 1}.`); return []; }
    return [candidateId];
  });
  return errors.length || !set?.[1] || !source?.[1] ? { valid: false, errors } : { valid: true, value: { setId: set[1], sourceFingerprint: source[1], candidateIds }, errors: [] };
}

export function validateBassPitchSelection(analysis: BassPitchAnalysis, selectedPositionIds: string[], selection: BassPitchSelection): { valid: boolean; errors: string[]; selected: BassPitchCandidate[] } {
  const errors: string[] = [];
  if (analysis.setId !== selection.setId) errors.push("Bass pitch candidate set is stale.");
  if (analysis.sourceFingerprint !== selection.sourceFingerprint) errors.push("Bass pitch source fingerprint does not match.");
  const byId = new Map(analysis.candidates.map(candidate => [candidate.id, candidate]));
  const selected = selection.candidateIds.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
  if (selected.length !== selection.candidateIds.length) errors.push("Bass pitch selection contains an unknown candidate.");
  if (new Set(selection.candidateIds).size !== selection.candidateIds.length) errors.push("Bass pitch selection contains duplicate candidates.");
  const selectedPositions = new Set(selected.map(candidate => candidate.positionId));
  for (const id of selectedPositionIds) if (!selectedPositions.has(id)) errors.push(`Missing bass pitch selection for ${id}.`);
  if (selectedPositions.size !== selected.length) errors.push("Choose exactly one bass pitch per selected bass position.");
  return { valid: errors.length === 0, errors, selected };
}

export function materializeBassFoundation(
  source: TimeSliceMeasure[],
  bassCandidates: BassPitchCandidate[],
  skillLevel: SkillLevel,
  maxMelodyFret: number,
): TimeSliceMeasure[] {
  const bassByLocation = new Map(bassCandidates.map(candidate => [`${candidate.positionId.replace(/^bp-/, "")}`, candidate]));
  let priorMelodyString: 1 | 2 | 3 | null = null;
  return source.map(measure => ({
    ...measure,
    grid: measure.grid.map((step, stepIndex) => {
      const tab: NonNullable<typeof step.tablature> = [];
      if (step.melody.state === "attack" && step.melody.pitch) {
        const melodyMidi = parseScientificPitch(step.melody.pitch)?.midi;
        const strings = [1, 2, 3] as const;
        const position = melodyMidi == null ? null : strings
          .map(string => ({ string, fret: melodyMidi - midiForStringFret(string, 0) }))
          .filter(item => item.fret >= 0 && item.fret <= Math.max(SKILL_LEVEL_CONSTRAINTS[skillLevel].maxFret, maxMelodyFret))
          .sort((left, right) => Number(left.string !== priorMelodyString) - Number(right.string !== priorMelodyString) || left.fret - right.fret)[0];
        if (position) {
          priorMelodyString = position.string;
          tab.push({ ...position, finger: "a", role: "melody", durationSteps: melodyDurationSteps(measure, stepIndex) });
        }
      }
      const candidate = bassByLocation.get(`m${measure.measure}-s${step.step}`);
      if (candidate) {
        // A bass note that begins with a melody attack supports the source token;
        // isolated bass positions remain one-step transient attacks.
        const durationSteps = step.melody.state === "attack"
          ? melodyDurationSteps(measure, stepIndex)
          : 1;
        tab.push({ string: candidate.string, fret: candidate.fret, finger: "p", role: candidate.role, durationSteps });
      }
      // Regeneration starts from the pinned source melody plus the chosen bass foundation.
      // Never carry prior fills (or prior accompaniment) into this pre-fill validation stage.
      return { ...step, tablature: tab };
    }),
  }));
}
