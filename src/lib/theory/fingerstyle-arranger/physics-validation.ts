import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  validateGuitarTab,
  type GuitarTabEvent,
  type GuitarTabValidationIssue,
} from "../guitar-tab-validation";
import { scientificPitchForStringFret } from "../guitar-playability";
import { SKILL_LEVEL_CONSTRAINTS, type SkillLevel } from "./fingerstyle-constraints";
import type { TimeSliceGridStep } from "./time-slice";

export interface FingerstylePhysicsOptions {
  /** Fill density from the style profile or normalized generation policy. */
  fillDensity?: string;
  /** Physical left-hand limits. Legacy callers default to intermediate; new generation passes its explicit policy. */
  skillLevel?: SkillLevel;
  /** Exact authoritative melody may exceed the discretionary skill fret ceiling up to this fret. */
  maxMelodyFret?: number;
}

export type FingerstylePhysicsIssueCode =
  | "string-count-exceeded"
  | "picking-finger-budget-exceeded"
  | "fret-limit-exceeded"
  | "fret-span-exceeded"
  | "duplicate-string"
  | "sounding-string-collision"
  | "duration-out-of-range"
  | "melody-pitch-mismatch"
  | `guitar-tab-${GuitarTabValidationIssue["code"]}`
  | "fill-interrupts-melody-sustain"
  | "accompaniment-interrupts-melody-sustain"
  | "discretionary-attack-during-melody-sustain"
  | "discretionary-duration-during-melody-sustain"
  | "bass-on-unweighted-step"
  | "fill-density-none-exceeded"
  | "fill-density-few-exceeded";

export interface FingerstylePhysicsIssue {
  code: FingerstylePhysicsIssueCode;
  message: string;
  stepIndex?: number;
  step?: number;
  severity: "error";
  details: Record<string, unknown>;
}

export interface FingerstylePhysicsValidationResult {
  valid: boolean;
  message: string;
  issues: FingerstylePhysicsIssue[];
}

function issue(
  issues: FingerstylePhysicsIssue[],
  code: FingerstylePhysicsIssueCode,
  message: string,
  input: { stepIndex?: number; step?: number; details?: Record<string, unknown> } = {}
): void {
  issues.push({
    code,
    message,
    stepIndex: input.stepIndex,
    step: input.step,
    severity: "error",
    details: input.details ?? {},
  });
}

export function validateFingerstylePhysicsDetailed(
  grid: TimeSliceGridStep[],
  options?: FingerstylePhysicsOptions
): FingerstylePhysicsValidationResult {
  const issues: FingerstylePhysicsIssue[] = [];
  const tabEvents: GuitarTabEvent[] = [];
  const skillLevel = options?.skillLevel ?? "intermediate";
  const skillConstraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const protectedMelodyStrings: Array<GuitarStringNumber | null> = [];
  let protectedMelodyString: GuitarStringNumber | null = null;
  for (const step of grid) {
    if (step.melody.state === "attack") {
      protectedMelodyString = step.tablature?.find(tab => tab.role === "melody")?.string ?? protectedMelodyString;
    } else if (step.melody.state === "rest") {
      protectedMelodyString = null;
    }
    protectedMelodyStrings.push(step.melody.state === "sustain" ? protectedMelodyString : null);
  }

  for (let stepIndex = 0; stepIndex < grid.length; stepIndex++) {
    const step = grid[stepIndex];
    const tablature = step.tablature ?? [];
    if (tablature.length === 0) continue;

    if (step.melody.state === "sustain") {
      for (const tab of tablature) {
        if (tab.role !== "fill" && tab.role !== "harmony") continue;
        issue(
          issues,
          "discretionary-attack-during-melody-sustain",
          `Step ${step.step}: ${tab.role === "fill" ? "Fill" : "Harmony"} attacks are not allowed while the melody is sustaining.`,
          { stepIndex, step: step.step, details: { role: tab.role, string: tab.string, fret: tab.fret } },
        );
      }
    }

    if (tablature.length > 6) {
      issue(issues, "string-count-exceeded", `Step ${step.step}: Exceeds physical guitar limit of 6 strings. Got ${tablature.length} notes.`, {
        stepIndex,
        step: step.step,
        details: { noteCount: tablature.length, limit: 6 },
      });
    } else if (tablature.length > 4) {
      const thumbCount = tablature.filter(tab => tab.finger === "p").length;
      if (thumbCount < 2) {
        issue(issues, "picking-finger-budget-exceeded", `Step ${step.step}: Exceeds picking finger budget. A guitarist can pinch up to 4 strings simultaneously (P, I, M, A) unless it is a strum/roll. Got ${tablature.length} notes.`, {
          stepIndex,
          step: step.step,
          details: { noteCount: tablature.length, thumbCount, pinchLimit: 4 },
        });
      }
    }

    const frettedNotes = tablature.filter(tab => typeof tab.fret === "number" && tab.fret > 0);
    if (frettedNotes.length >= 2) {
      const frets = frettedNotes.map(tab => tab.fret);
      const minFret = Math.min(...frets);
      const maxFret = Math.max(...frets);
      const fretSpan = maxFret - minFret;
      const maxAllowedFretSpan = options?.skillLevel ? skillConstraints.maxFretSpan : 3;
      if (fretSpan > maxAllowedFretSpan) {
        issue(issues, "fret-span-exceeded", `Step ${step.step}: Left-hand fret span ${fretSpan} (frets ${minFret}–${maxFret}) exceeds playable limit of ${maxAllowedFretSpan} frets. Notes: ${frettedNotes.map(tab => `Str${tab.string}/Fr${tab.fret}`).join(", ")}.`, {
          stepIndex,
          step: step.step,
          details: { fretSpan, minFret, maxFret, maxAllowedFretSpan, notes: frettedNotes },
        });
      }
    }

    const stringsInUse = new Set<number>();
    for (const tab of tablature) {
      const maxFret = tab.role === "melody"
        ? Math.max(skillConstraints.maxFret, options?.maxMelodyFret ?? skillConstraints.maxFret)
        : skillConstraints.maxFret;
      if (options?.skillLevel && tab.fret > maxFret) {
        const roleLabel = tab.role === "melody" && maxFret > skillConstraints.maxFret ? "melody exception" : skillLevel;
        issue(issues, "fret-limit-exceeded", `Step ${step.step}: Fret ${tab.fret} exceeds the ${roleLabel} limit of ${maxFret}.`, {
          stepIndex,
          step: step.step,
          details: { fret: tab.fret, role: tab.role, skillLevel, maxFret, accompanimentMaxFret: skillConstraints.maxFret },
        });
      }
      if (stringsInUse.has(tab.string)) {
        issue(issues, "duplicate-string", `Step ${step.step}: Multiple notes assigned to string ${tab.string}.`, {
          stepIndex,
          step: step.step,
          details: { string: tab.string },
        });
      }
      stringsInUse.add(tab.string);
      const notePitch = scientificPitchForStringFret(tab.string, tab.fret);
      if (tab.role === "melody" && step.melody.pitch && notePitch !== step.melody.pitch) {
        issue(issues, "melody-pitch-mismatch", `Step ${step.step}: Melody pitch mismatch. Expected ${step.melody.pitch}, got ${notePitch} on string ${tab.string} fret ${tab.fret}.`, {
          stepIndex,
          step: step.step,
          details: { expected: step.melody.pitch, actual: notePitch, string: tab.string, fret: tab.fret },
        });
      }
      tabEvents.push({
        measureIndex: 0,
        beat: step.step,
        note: notePitch,
        string: tab.string,
        fret: tab.fret,
        role: tab.role,
      });
    }
  }

  for (let stepIndex = 0; stepIndex < grid.length; stepIndex++) {
    const step = grid[stepIndex];
    for (const tab of step.tablature ?? []) {
      const durationSteps = tab.durationSteps ?? 1;
      if (!Number.isSafeInteger(durationSteps) || durationSteps < 1 || stepIndex + durationSteps > grid.length) {
        issue(issues, "duration-out-of-range", `Step ${step.step}: durationSteps ${durationSteps} sounds outside the measure grid.`, {
          stepIndex,
          step: step.step,
          details: { durationSteps, remainingSteps: grid.length - stepIndex },
        });
        continue;
      }
      for (let offset = 1; offset < durationSteps; offset++) {
        const soundingStep = grid[stepIndex + offset];
        if (
          (tab.role === "fill" || tab.role === "harmony")
          && soundingStep.melody.state !== "rest"
        ) {
          issue(
            issues,
            "discretionary-duration-during-melody-sustain",
            `Step ${step.step}: ${tab.role === "fill" ? "Fill" : "Harmony"} duration reaches active melody at step ${soundingStep.step}.`,
            {
              stepIndex,
              step: step.step,
              details: { role: tab.role, string: tab.string, durationSteps, protectedStep: soundingStep.step },
            },
          );
          break;
        }
        const conflictingAttack = soundingStep.tablature?.find(event => event.string === tab.string);
        if (conflictingAttack) {
          issue(issues, "sounding-string-collision", `Step ${step.step}: String ${tab.string} sustains into the attack at step ${soundingStep.step}.`, {
            stepIndex,
            step: step.step,
            details: { string: tab.string, durationSteps, conflictingStep: soundingStep.step },
          });
          break;
        }
        if (tab.role === "fill" && protectedMelodyStrings[stepIndex + offset] === tab.string) {
          issue(issues, "fill-interrupts-melody-sustain", `Step ${step.step}: Fill sustain occupies melody string ${tab.string} at step ${soundingStep.step}.`, {
            stepIndex,
            step: step.step,
            details: { string: tab.string, durationSteps, protectedStep: soundingStep.step },
          });
          break;
        }
      }
    }
  }

  const playability = validateGuitarTab(tabEvents, {
    guitarProfile: "guitar-classic",
    requireScientificPitch: true,
  });
  for (const playabilityIssue of playability.issues) {
    issue(issues, `guitar-tab-${playabilityIssue.code}`, `Step ${playabilityIssue.beat}: ${playabilityIssue.message}`, {
      step: playabilityIssue.beat,
      details: { ...playabilityIssue },
    });
  }

  const isFillRole = (role: string) => role === "fill";
  const isBassFoundationRole = (role: string) => (
    role === "bass" || role === "root" || role === "fifth"
  );

  let melodyString: GuitarStringNumber | null = null;
  for (let stepIndex = 0; stepIndex < grid.length; stepIndex++) {
    const step = grid[stepIndex];
    if (step.melody.state === "attack") {
      melodyString = step.tablature?.find(tab => tab.role === "melody")?.string ?? melodyString;
    }
    if (step.melody.state === "sustain" && melodyString !== null) {
      const accompaniment = step.tablature?.find(tab => tab.string === melodyString && tab.role !== "melody");
      if (accompaniment) {
        const fill = isFillRole(accompaniment.role);
        issue(
          issues,
          fill ? "fill-interrupts-melody-sustain" : "accompaniment-interrupts-melody-sustain",
          `Step ${step.step}: ${fill ? "Fill" : "Accompaniment"} played on string ${melodyString} which is currently sustaining the melody note.`,
          {
            stepIndex,
            step: step.step,
            details: { melodyString, accompaniment },
          },
        );
      }
    }
    if (step.melody.state === "rest") melodyString = null;
  }

  for (let stepIndex = 0; stepIndex < grid.length; stepIndex++) {
    const step = grid[stepIndex];
    if (step.tablature?.some(tab => isBassFoundationRole(tab.role)) && !step.weight) {
      issue(issues, "bass-on-unweighted-step", `Step ${step.step}: Bass note on unweighted step. Bass should only play on strong (⬤), medium (●), or weak (*) beat positions.`, {
        stepIndex,
        step: step.step,
        details: { weight: step.weight },
      });
    }
  }

  const fillDensity = options?.fillDensity ?? "few";
  const totalFills = grid.reduce((count, step) =>
    count + (step.tablature?.filter(tab => isFillRole(tab.role)).length ?? 0), 0);
  if (fillDensity === "none" && totalFills > 0) {
    issue(issues, "fill-density-none-exceeded", `Fill density violation: ${totalFills} fill attack(s) found but fill_density "none" allows 0.`, {
      details: { fillDensity, totalFills, limit: 0 },
    });
  } else if (fillDensity === "few" && totalFills > 4) {
    issue(issues, "fill-density-few-exceeded", `Fill density violation: ${totalFills} fill attacks found but fill_density "few" allows at most 4.`, {
      details: { fillDensity, totalFills, limit: 4 },
    });
  }

  return {
    valid: issues.length === 0,
    message: issues.length === 0 ? "Valid." : issues.map(value => value.message).join(" "),
    issues,
  };
}

/** Compatibility wrapper retaining the historical `{ valid, message }` contract. */
export function validateFingerstylePhysics(
  grid: TimeSliceGridStep[],
  options?: FingerstylePhysicsOptions
): { valid: boolean; message: string } {
  const result = validateFingerstylePhysicsDetailed(grid, options);
  return { valid: result.valid, message: result.message };
}
