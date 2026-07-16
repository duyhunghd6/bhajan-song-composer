import { parseScientificPitch, midiForStringFret, type GuitarPlayabilityStringNumber } from "../guitar-playability";
import { validateFingerstylePhysicsDetailed } from "./physics-validation";
import { SKILL_LEVEL_CONSTRAINTS, type SkillLevel } from "./fingerstyle-constraints";
import type { TimeSliceMeasure, TimeSliceGridStep } from "./time-slice";

export interface FingerstyleFoundationPlacementOptions {
  skillLevel?: SkillLevel;
  maxMelodyFret?: number;
  bpm?: number;
}

export type FingerstyleFoundationPlacementOutcome =
  | "accepted"
  | "accepted-with-unresolved-events"
  | "no-effective-change";

export interface FingerstyleFoundationPlacementDiagnostic {
  outcome: FingerstyleFoundationPlacementOutcome;
  inputEventCount: number;
  resolvedEventCount: number;
  unresolvedEventCount: number;
  changedEventCount: number;
  elapsedMs: number;
}

export interface FingerstyleFoundationPlacementResult {
  measures: TimeSliceMeasure[];
  logs: string[];
  diagnostics: FingerstyleFoundationPlacementDiagnostic;
  changedEventCount: number;
  unresolvedEventCount: number;
}

const TREBLE_STRINGS: GuitarPlayabilityStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarPlayabilityStringNumber[] = [6, 5, 4];
type TabEvent = NonNullable<TimeSliceGridStep["tablature"]>[number];

function cloneMeasures(measures: TimeSliceMeasure[]): TimeSliceMeasure[] {
  return JSON.parse(JSON.stringify(measures)) as TimeSliceMeasure[];
}

function choosePosition(
  midi: number,
  strings: GuitarPlayabilityStringNumber[],
  preferredString: GuitarPlayabilityStringNumber | null,
  maxFret: number,
  occupied: Set<number>,
): { string: GuitarPlayabilityStringNumber; fret: number } | null {
  const candidates: Array<{ string: GuitarPlayabilityStringNumber; fret: number }> = [];
  for (const string of strings) {
    if (occupied.has(string)) continue;
    const fret = midi - midiForStringFret(string, 0);
    if (fret < 0 || fret > maxFret || midiForStringFret(string, fret) !== midi) continue;
    candidates.push({ string, fret });
  }
  candidates.sort((left, right) => (
    Number(left.fret !== 0) - Number(right.fret !== 0)
    || left.fret - right.fret
    || Number(right.string !== preferredString) - Number(left.string !== preferredString)
    || left.string - right.string
  ));
  return candidates[0] ?? null;
}

function replaceTabPosition(tab: TabEvent, position: { string: GuitarPlayabilityStringNumber; fret: number }): boolean {
  const changed = tab.string !== position.string || tab.fret !== position.fret;
  tab.string = position.string;
  tab.fret = position.fret;
  return changed;
}

/**
 * Deterministically places the submitted non-fill foundation on the canonical
 * TimeGrid. It repairs only physical positions; source melody facts stay pinned.
 */
export function placeFingerstyleFoundationOnTimeGrid(
  measures: TimeSliceMeasure[],
  options: FingerstyleFoundationPlacementOptions = {},
): FingerstyleFoundationPlacementResult {
  const startedAt = Date.now();
  const skillLevel = options.skillLevel ?? "beginner";
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const maxMelodyFret = options.maxMelodyFret ?? constraints.maxFret;
  const copy = cloneMeasures(measures);
  const logs = [
    "=== FINGERSTYLE FOUNDATION PLACEMENT (TIMEGRID) ===",
    `  Skill level: ${skillLevel}`,
    `  BPM: ${options.bpm ?? 120}`,
    "  Source melody is anchored to exact pitches on available treble strings.",
  ];
  let changed = 0;
  let unresolved = 0;
  let previousMelodyString: GuitarPlayabilityStringNumber | null = null;

  for (const measure of copy) {
    for (const step of measure.grid) {
      const tabs = step.tablature ?? [];
      const melody = tabs.find(tab => tab.role === "melody");
      const authoritative = step.melody.state === "attack"
        ? parseScientificPitch(step.melody.pitch ?? "")
        : null;
      if (authoritative && melody) {
        const position = choosePosition(
          authoritative.midi,
          TREBLE_STRINGS,
          TREBLE_STRINGS.includes(melody.string) ? melody.string : previousMelodyString,
          Math.max(constraints.maxFret, maxMelodyFret),
          new Set(tabs.filter(tab => tab !== melody).map(tab => tab.string)),
        );
        if (!position) {
          unresolved++;
          logs.push(`  M${measure.measure}/s${step.step}: no available treble position for ${step.melody.pitch}.`);
        } else {
          if (replaceTabPosition(melody, position)) changed++;
          previousMelodyString = position.string;
        }
      }

      const bass = tabs.find(tab => tab.role === "bass");
      if (bass) {
        const position = choosePosition(
          midiForStringFret(bass.string, bass.fret),
          BASS_STRINGS,
          bass.string,
          constraints.maxFret,
          new Set(tabs.filter(tab => tab !== bass).map(tab => tab.string)),
        );
        if (!position) {
          unresolved++;
          logs.push(`  M${measure.measure}/s${step.step}: bass remains at s${bass.string}/f${bass.fret}.`);
        } else if (replaceTabPosition(bass, position)) {
          changed++;
        }
      }
    }
    const validation = validateFingerstylePhysicsDetailed(measure.grid, {
      fillDensity: "none",
      skillLevel,
      maxMelodyFret,
    });
    if (!validation.valid) logs.push(`  M${measure.measure}: ${validation.message}`);
  }

  const inputEventCount = measures.reduce((count, measure) => count + measure.grid.length, 0);
  const outcome: FingerstyleFoundationPlacementOutcome = unresolved > 0
    ? "accepted-with-unresolved-events"
    : changed === 0 ? "no-effective-change" : "accepted";
  const diagnostics = {
    outcome,
    inputEventCount,
    resolvedEventCount: inputEventCount - unresolved,
    unresolvedEventCount: unresolved,
    changedEventCount: changed,
    elapsedMs: Date.now() - startedAt,
  };
  logs.push(`  Outcome: ${outcome}; ${changed} position(s) updated, ${unresolved} unresolved.`);
  return { measures: copy, logs, diagnostics, changedEventCount: changed, unresolvedEventCount: unresolved };
}
