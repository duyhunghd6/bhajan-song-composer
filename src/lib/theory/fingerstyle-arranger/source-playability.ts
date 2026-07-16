import {
  GUITAR_PLAYABILITY_PROFILES,
  STANDARD_TUNING_OPEN_MIDI,
  parseScientificPitch,
  type GuitarPlayabilityStringNumber,
} from "../guitar-playability";
import { SKILL_LEVEL_CONSTRAINTS, type SkillLevel } from "./fingerstyle-constraints";
import type { TimeSliceMeasure } from "./time-slice";

export interface AuthoritativeMelodyPosition {
  string: GuitarPlayabilityStringNumber;
  fret: number;
}

export interface AuthoritativeMelodyAnchor {
  measure: number;
  step: number;
  pitch: string;
  midi: number;
  preferredPosition: AuthoritativeMelodyPosition;
  positions: AuthoritativeMelodyPosition[];
  exceedsSkillLimit: boolean;
}

export interface AuthoritativeMelodyPlayabilityIssue {
  measure: number;
  step: number;
  pitch: string;
  message: string;
}

export interface AuthoritativeMelodyPlayabilityAnalysis {
  skillLevel: SkillLevel;
  accompanimentMaxFret: number;
  melodyMaxFret: number;
  anchors: AuthoritativeMelodyAnchor[];
  exceptions: AuthoritativeMelodyAnchor[];
  issues: AuthoritativeMelodyPlayabilityIssue[];
  playable: boolean;
}

function positionsForMidi(midi: number): AuthoritativeMelodyPosition[] {
  const maxFret = GUITAR_PLAYABILITY_PROFILES["guitar-classic"].maxFret;
  return ([1, 2, 3, 4, 5, 6] as GuitarPlayabilityStringNumber[])
    .map(string => ({ string, fret: midi - STANDARD_TUNING_OPEN_MIDI[string] }))
    .filter(position => position.fret >= 0 && position.fret <= maxFret)
    .sort((left, right) => left.fret - right.fret || left.string - right.string);
}

export function analyzeAuthoritativeMelodyPlayability(
  measures: TimeSliceMeasure[],
  skillLevel: SkillLevel,
): AuthoritativeMelodyPlayabilityAnalysis {
  const accompanimentMaxFret = SKILL_LEVEL_CONSTRAINTS[skillLevel].maxFret;
  const anchors: AuthoritativeMelodyAnchor[] = [];
  const issues: AuthoritativeMelodyPlayabilityIssue[] = [];

  for (const measure of measures) {
    for (const step of measure.grid) {
      if (step.melody.state !== "attack" || !step.melody.pitch) continue;
      const parsed = parseScientificPitch(step.melody.pitch);
      if (!parsed) {
        issues.push({
          measure: measure.measure,
          step: step.step,
          pitch: step.melody.pitch,
          message: `Measure ${measure.measure} step ${step.step}: Melody pitch ${step.melody.pitch} is not valid scientific pitch notation.`,
        });
        continue;
      }
      const positions = positionsForMidi(parsed.midi);
      if (positions.length === 0) {
        issues.push({
          measure: measure.measure,
          step: step.step,
          pitch: step.melody.pitch,
          message: `Measure ${measure.measure} step ${step.step}: Melody pitch ${step.melody.pitch} is outside the classical guitar range.`,
        });
        continue;
      }
      const preferredPosition = positions[0];
      anchors.push({
        measure: measure.measure,
        step: step.step,
        pitch: step.melody.pitch,
        midi: parsed.midi,
        preferredPosition,
        positions,
        exceedsSkillLimit: preferredPosition.fret > accompanimentMaxFret,
      });
    }
  }

  const exceptions = anchors.filter(anchor => anchor.exceedsSkillLimit);
  return {
    skillLevel,
    accompanimentMaxFret,
    melodyMaxFret: Math.max(accompanimentMaxFret, ...anchors.map(anchor => anchor.preferredPosition.fret)),
    anchors,
    exceptions,
    issues,
    playable: issues.length === 0,
  };
}

export function formatAuthoritativeMelodyExceptions(
  analysis: AuthoritativeMelodyPlayabilityAnalysis,
): string[] {
  return analysis.exceptions.map(anchor =>
    `M${anchor.measure}/S${anchor.step} ${anchor.pitch}=string ${anchor.preferredPosition.string} fret ${anchor.preferredPosition.fret}`
  );
}
