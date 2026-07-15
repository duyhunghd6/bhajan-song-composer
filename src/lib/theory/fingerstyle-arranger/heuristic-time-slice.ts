import { parseScientificPitch, midiForStringFret, type GuitarPlayabilityStringNumber } from "../guitar-playability";
import { getGuitarVoicings } from "../guitar-voicings";
import { validateFingerstylePhysicsDetailed } from "./physics-validation";
import { DPDiagnosticLogger, SKILL_LEVEL_CONSTRAINTS, type SkillLevel } from "./dp-types";
import type { TimeSliceMeasure, TimeSliceGridStep } from "./time-slice";
import type { FingerstyleDiagnosticRun } from "./dp-diagnostics";

export interface HeuristicTimeSliceOptions {
  skillLevel?: SkillLevel;
  maxMelodyFret?: number;
  bpm?: number;
}

export interface HeuristicTimeSliceResult {
  measures: TimeSliceMeasure[];
  logs: string[];
  diagnostics: FingerstyleDiagnosticRun;
  changedEventCount: number;
  unresolvedEventCount: number;
}

const TREBLE_STRINGS: GuitarPlayabilityStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarPlayabilityStringNumber[] = [6, 5, 4];

type TabEvent = NonNullable<TimeSliceGridStep["tablature"]>[number];

function cloneMeasures(measures: TimeSliceMeasure[]): TimeSliceMeasure[] {
  return JSON.parse(JSON.stringify(measures)) as TimeSliceMeasure[];
}

function normalizedChord(chord: string): string {
  return chord.trim().replace(/\s+/g, "").toLowerCase();
}

function shapeKey(frets: (number | "X")[]): string {
  return frets.join(":");
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
    const openMidi = midiForStringFret(string, 0);
    const fret = midi - openMidi;
    if (fret < 0 || fret > maxFret) continue;
    if (midiForStringFret(string, fret) !== midi) continue;
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

function preserveChordShapePreference(
  measures: TimeSliceMeasure[],
  logger: DPDiagnosticLogger,
): Map<string, string> {
  const established = new Map<string, string>();
  for (const measure of measures) {
    for (const step of measure.grid) {
      const chord = normalizedChord(step.chord);
      if (!chord || established.has(chord)) continue;
      const voicing = getGuitarVoicings(step.chord)[0];
      if (voicing) established.set(chord, shapeKey(voicing.frets));
    }
  }
  logger.entry("Chord shapes established", established.size);
  return established;
}

function applyMelodyAndBass(
  measures: TimeSliceMeasure[],
  options: Required<Pick<HeuristicTimeSliceOptions, "skillLevel" | "maxMelodyFret">>,
  logger: DPDiagnosticLogger,
): { changed: number; unresolved: number } {
  const maxFret = SKILL_LEVEL_CONSTRAINTS[options.skillLevel].maxFret;
  let changed = 0;
  let unresolved = 0;
  let previousMelodyString: GuitarPlayabilityStringNumber | null = null;

  for (const measure of measures) {
    for (const step of measure.grid) {
      const tabs = step.tablature ?? [];
      const melody = tabs.find(tab => tab.role === "melody");
      const sourcePitch = step.melody.state === "attack" ? parseScientificPitch(step.melody.pitch ?? "") : null;
      const occupied = new Set(tabs.filter(tab => tab !== melody).map(tab => tab.string));

      if (sourcePitch && melody) {
        const position = choosePosition(
          sourcePitch.midi,
          TREBLE_STRINGS,
          melody.string === 1 || melody.string === 2 || melody.string === 3
            ? melody.string
            : previousMelodyString,
          Math.max(maxFret, options.maxMelodyFret),
          occupied,
        );
        if (!position) {
          unresolved++;
          logger.log(`  M${measure.measure}/s${step.step}: no treble position for authoritative ${step.melody.pitch}`);
        } else {
          if (replaceTabPosition(melody, position)) changed++;
          previousMelodyString = position.string;
        }
      }

      const bass = tabs.find(tab => tab.role === "bass");
      if (bass) {
        const bassMidi = midiForStringFret(bass.string, bass.fret);
        const bassPosition = choosePosition(bassMidi, BASS_STRINGS, bass.string, maxFret, new Set(tabs.filter(tab => tab !== bass).map(tab => tab.string)));
        if (bassPosition) {
          if (replaceTabPosition(bass, bassPosition)) changed++;
        } else {
          unresolved++;
          logger.log(`  M${measure.measure}/s${step.step}: bass retained at s${bass.string}/f${bass.fret}`);
        }
      }
    }
  }
  return { changed, unresolved };
}

export function applyHeuristicToTimeSliceMeasures(
  measures: TimeSliceMeasure[],
  options: HeuristicTimeSliceOptions = {},
): HeuristicTimeSliceResult {
  const skillLevel = options.skillLevel ?? "beginner";
  const maxMelodyFret = options.maxMelodyFret ?? SKILL_LEVEL_CONSTRAINTS[skillLevel].maxFret;
  const logger = new DPDiagnosticLogger();
  logger.section("HEURISTIC FINGERSTYLE OPTIMIZATION (TIME-SLICE)");
  logger.entry("Skill level", skillLevel);
  logger.entry("BPM", options.bpm ?? 120);
  logger.entry("Strategy", "heuristic");
  logger.event({
    type: "configuration",
    phase: "configuration",
    values: { skillLevel, bpm: options.bpm ?? 120, arrangementOptimization: "heuristic", maxMelodyFret },
    provenance: { skillLevel: options.skillLevel ? "supplied" : "defaulted", bpm: options.bpm ? "supplied" : "defaulted", arrangementOptimization: "constant", maxMelodyFret: options.maxMelodyFret ? "supplied" : "derived" },
  });
  logger.log("Stage 1: authoritative melody anchored on strings 1–3.");
  logger.log("Stage 2: deterministic chord-shape preference established from available voicings.");
  const copy = cloneMeasures(measures);
  preserveChordShapePreference(copy, logger);
  logger.log("Stage 3: existing bass events routed to low strings without displacing melody.");
  const counts = applyMelodyAndBass(copy, { skillLevel, maxMelodyFret }, logger);
  logger.log("Stage 4: fill opportunities remain delegated to the shared staged fill pipeline.");

  for (const measure of copy) {
    const validation = validateFingerstylePhysicsDetailed(measure.grid, {
      fillDensity: "none",
      skillLevel,
      maxMelodyFret,
    });
    if (!validation.valid) logger.log(`  M${measure.measure}: heuristic foundation retains validation issue: ${validation.message}`);
  }

  const outcome = counts.unresolved > 0 ? "accepted-with-unresolved-events" : counts.changed === 0 ? "no-effective-dp-change" : "accepted";
  logger.entry("Events updated", counts.changed);
  logger.entry("Events unresolved", counts.unresolved);
  logger.entry("Outcome", outcome);
  logger.event({
    type: "run-summary",
    phase: "summary",
    outcome,
    inputEventCount: measures.reduce((count, measure) => count + measure.grid.length, 0),
    resolvedEventCount: Math.max(0, measures.reduce((count, measure) => count + measure.grid.length, 0) - counts.unresolved),
    unresolvedEventCount: counts.unresolved,
    changedEventCount: counts.changed,
    unchangedEventCount: 0,
    totalCost: 0,
    elapsedMs: 0,
  });
  logger.collector.complete(outcome);
  return {
    measures: copy,
    logs: logger.getLines(),
    diagnostics: logger.getDiagnostics(),
    changedEventCount: counts.changed,
    unresolvedEventCount: counts.unresolved,
  };
}
