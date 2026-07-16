import { buildAbcDurationContext } from "../abc-duration";
import { getKeyAccidentalsFromAbc } from "../abc-key-signature";
import { midiForStringFret, parseScientificPitch } from "../guitar-playability";
import { prepareGuitarStringForcingForAbcjs } from "../guitar-string-forcing";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  convertAbcToTimeSliceGrid,
  convertTimeSliceMeasureToAbc,
  joinMeasureAbcWithBarlines,
  type TimeSliceGridStep,
  type TimeSliceMeasure,
} from "./time-slice";
import {
  validateGuitarAbcAgainstAsciiGuitarTab,
  type AbcAsciiGuitarTabValidationResult,
  type ExpectedAsciiGuitarTabEvent,
} from "./abc-ascii-guitartab-validation";
import { renderCombinedAsciiGuitarTab } from "./toon-utils";

const STRING_BY_LINE = { e: 1, B: 2, G: 3, D: 4, A: 5, E: 6 } as const;
const FINGER_BY_STRING = { 1: "a", 2: "m", 3: "i", 4: "p", 5: "p", 6: "p" } as const;
const GRID_STEPS_PER_MEASURE = 16;
const ASCII_CELL_WIDTH = 3;
const ASCII_MEASURE_WIDTH = 49;

type ParsedAsciiMeasure = Array<{ string: GuitarStringNumber; fret: number; stepIndex: number }>;

export interface ParsedAsciiGuitarTab {
  measures: ParsedAsciiMeasure[];
  normalized: string;
}

export interface AsciiGuitarTabConversionInput {
  sourceAbc: string;
  asciiGuitarTab: string;
  chords: string[];
}

export interface SourceMelodyAlignmentMismatch {
  measure: number;
  stepIndex: number;
  sourcePitch: string;
  candidatePitches: string[];
  kind: "missing-physical-melody" | "ambiguous-physical-melody";
}

export interface SourceMelodyAlignmentResult {
  aligned: boolean;
  matchedAttackCount: number;
  mismatchCount: number;
  mismatches: SourceMelodyAlignmentMismatch[];
}

export interface SourceMelodyDurationTransfer {
  measure: number;
  stepIndex: number;
  sourcePitch: string;
  string: GuitarStringNumber;
  requestedDurationSteps: number;
  appliedDurationSteps: number;
  blockedByStepIndices: number[];
}

export interface SourceMelodyDurationTransferResult {
  preservedCount: number;
  blockedCount: number;
  transfers: SourceMelodyDurationTransfer[];
}

export interface AsciiGuitarTabConversionResult {
  measures: TimeSliceMeasure[];
  forcedGuitarBody: string;
  /** Self-contained ABCJS-ready Guitar-only conversion output. */
  forcedAbc: string;
  roundTripAscii: string;
  normalizedInputAscii: string;
  validation: AbcAsciiGuitarTabValidationResult;
  sourceMelodyAlignment: SourceMelodyAlignmentResult;
  sourceMelodyDurationTransfer: SourceMelodyDurationTransferResult;
}

function cloneMeasures(measures: TimeSliceMeasure[]): TimeSliceMeasure[] {
  return JSON.parse(JSON.stringify(measures)) as TimeSliceMeasure[];
}

function continuousAsciiGuitarTab(ascii: string): string {
  const blocks = ascii.trim().split(/\n\s*\n/).map(block => block.split("\n").slice(1));
  if (blocks.length === 0 || !blocks[0]) return "";
  return blocks[0].map((_, index) => blocks.map((block, blockIndex) => {
    const line = block[index];
    return blockIndex === 0 ? line : line.slice(2);
  }).join("")).join("\n");
}

function parseFretCell(cell: string, line: string, measureIndex: number, stepIndex: number): number | null {
  const fretText = cell.replaceAll("-", "");
  if (!fretText) return null;
  if (!/^\d{1,2}$/.test(fretText)) {
    throw new Error(`Invalid fret '${fretText}' on ${line} measure ${measureIndex + 1}, step ${stepIndex + 1}.`);
  }
  const fret = Number(fretText);
  if (fret > 30) {
    throw new Error(`Unsupported fret '${fret}' on ${line} measure ${measureIndex + 1}, step ${stepIndex + 1}.`);
  }
  return fret;
}

export function parseAsciiGuitarTab(ascii: string): ParsedAsciiGuitarTab {
  const blocks = ascii.trim().split(/\n\s*\n/).filter(Boolean);
  if (blocks.length === 0) throw new Error("ASCII-GuitarTab input is empty.");

  const parsedMeasures: ParsedAsciiMeasure[] = [];
  for (const [blockIndex, block] of blocks.entries()) {
    const lines = block.split(/\r?\n/).map(line => line.trimEnd());
    if (lines.length !== 7 || !/^Measures\s+/i.test(lines[0])) {
      throw new Error(`ASCII block ${blockIndex + 1} must contain a Measures label and six string rows.`);
    }

    const rows = lines.slice(1).map(line => {
      const label = line[0] as keyof typeof STRING_BY_LINE;
      const string = STRING_BY_LINE[label];
      if (!string || line[1] !== "|") throw new Error(`Invalid guitar string row '${line}'.`);
      const segments = line.split("|").slice(1, -1);
      if (segments.length === 0) throw new Error(`String row '${label}' has no measure segments.`);
      return { label, string, segments };
    });

    const labels = rows.map(row => row.label).join("");
    if (labels !== "eBGDAE") {
      throw new Error(`ASCII rows must be ordered e, B, G, D, A, E; received ${labels}.`);
    }

    const measureCount = rows[0].segments.length;
    for (const row of rows) {
      if (row.segments.length !== measureCount) {
        throw new Error(`String row '${row.label}' has ${row.segments.length} measures; expected ${measureCount}.`);
      }
      for (const segment of row.segments) {
        if (segment.length !== ASCII_MEASURE_WIDTH) {
          throw new Error(`ASCII measure on string '${row.label}' must be ${ASCII_MEASURE_WIDTH} characters wide; received ${segment.length}.`);
        }
      }
    }

    for (let localMeasure = 0; localMeasure < measureCount; localMeasure++) {
      const events: ParsedAsciiMeasure = [];
      for (const row of rows) {
        const segment = row.segments[localMeasure];
        for (let stepIndex = 0; stepIndex < GRID_STEPS_PER_MEASURE; stepIndex++) {
          const cellStart = 1 + stepIndex * ASCII_CELL_WIDTH;
          const fret = parseFretCell(segment.slice(cellStart, cellStart + 2), row.label, localMeasure, stepIndex);
          if (fret !== null) events.push({ string: row.string, fret, stepIndex });
        }
      }
      parsedMeasures.push(events);
    }
  }

  return { measures: parsedMeasures, normalized: continuousAsciiGuitarTab(ascii) };
}

function sourceMelodyDurationSteps(measure: TimeSliceMeasure, startIndex: number): number {
  const pitch = measure.grid[startIndex].melody.pitch;
  let durationSteps = 1;
  for (let index = startIndex + 1; index < measure.grid.length; index++) {
    const melody = measure.grid[index].melody;
    if (melody.state !== "sustain" || melody.pitch !== pitch) break;
    durationSteps += 1;
  }
  return durationSteps;
}

function attachParsedEvents(sourceMeasures: TimeSliceMeasure[], parsed: ParsedAsciiGuitarTab): {
  measures: TimeSliceMeasure[];
  expectedPhysicalEvents: ExpectedAsciiGuitarTabEvent[];
  sourceMelodyAlignment: SourceMelodyAlignmentResult;
  sourceMelodyDurationTransfer: SourceMelodyDurationTransferResult;
} {
  if (sourceMeasures.length !== parsed.measures.length) {
    throw new Error(`ASCII contains ${parsed.measures.length} measures but source ABC contains ${sourceMeasures.length}.`);
  }

  const measures = cloneMeasures(sourceMeasures);
  const expectedPhysicalEvents: ExpectedAsciiGuitarTabEvent[] = [];
  const mismatches: SourceMelodyAlignmentMismatch[] = [];
  const durationTransfers: SourceMelodyDurationTransfer[] = [];
  let matchedAttackCount = 0;

  for (const [measureIndex, events] of parsed.measures.entries()) {
    const measure = measures[measureIndex];
    if (measure.grid.length !== GRID_STEPS_PER_MEASURE) {
      throw new Error(`Source measure ${measure.measure} must contain ${GRID_STEPS_PER_MEASURE} grid steps.`);
    }

    for (const step of measure.grid) step.tablature = [];
    for (const event of events) {
      measure.grid[event.stepIndex].tablature!.push({
        string: event.string,
        fret: event.fret,
        finger: FINGER_BY_STRING[event.string],
        role: "fill",
        // ASCII cells establish attacks, not unambiguous note ends.
        durationSteps: 1,
      });
    }

    for (const [stepIndex, step] of measure.grid.entries()) {
      if (step.melody.state !== "attack" || !step.melody.pitch) continue;
      const sourceMidi = parseScientificPitch(step.melody.pitch)?.midi;
      if (sourceMidi === undefined) continue;
      const matchingTabs = (step.tablature ?? []).filter(tab => midiForStringFret(tab.string, tab.fret) === sourceMidi);
      if (matchingTabs.length === 1) {
        const matchedTab = matchingTabs[0];
        const requestedDurationSteps = sourceMelodyDurationSteps(measure, stepIndex);
        const blockedByStepIndices = events
          .filter(event => (
            event.string === matchedTab.string
            && event.stepIndex > stepIndex
            && event.stepIndex < stepIndex + requestedDurationSteps
          ))
          .map(event => event.stepIndex);
        const appliedDurationSteps = requestedDurationSteps > 1 && blockedByStepIndices.length === 0
          ? requestedDurationSteps
          : 1;

        matchedTab.role = "melody";
        matchedTab.durationSteps = appliedDurationSteps;
        if (requestedDurationSteps > 1) {
          durationTransfers.push({
            measure: measure.measure,
            stepIndex,
            sourcePitch: step.melody.pitch,
            string: matchedTab.string,
            requestedDurationSteps,
            appliedDurationSteps,
            blockedByStepIndices,
          });
        }
        matchedAttackCount += 1;
        continue;
      }
      mismatches.push({
        measure: measure.measure,
        stepIndex,
        sourcePitch: step.melody.pitch,
        candidatePitches: (step.tablature ?? []).map(tab => `${tab.string}:${tab.fret}`),
        kind: matchingTabs.length === 0 ? "missing-physical-melody" : "ambiguous-physical-melody",
      });
    }

    for (const [stepIndex, step] of measure.grid.entries()) {
      for (const tab of step.tablature ?? []) {
        expectedPhysicalEvents.push({
          measure: measure.measure,
          stepIndex,
          durationSteps: tab.durationSteps ?? 1,
          string: tab.string,
          fret: tab.fret,
        });
      }
    }
  }

  return {
    measures,
    expectedPhysicalEvents,
    sourceMelodyAlignment: {
      aligned: mismatches.length === 0,
      matchedAttackCount,
      mismatchCount: mismatches.length,
      mismatches,
    },
    sourceMelodyDurationTransfer: {
      preservedCount: durationTransfers.filter(transfer => transfer.appliedDurationSteps > 1).length,
      blockedCount: durationTransfers.filter(transfer => transfer.blockedByStepIndices.length > 0).length,
      transfers: durationTransfers,
    },
  };
}

const REQUIRED_ABC_HEADERS = ["X", "T", "L", "M", "Q", "K"] as const;

function extractRequiredAbcHeaders(sourceAbc: string): string[] {
  const sourceLines = sourceAbc.split(/\r?\n/).map(line => line.trim());
  return REQUIRED_ABC_HEADERS.map(field => {
    const header = sourceLines.find(line => line.startsWith(`${field}:`));
    if (!header) throw new Error(`ASCII-GuitarTab conversion requires a ${field}: header.`);
    return header;
  });
}

function buildGuitarOnlyAbc(sourceAbc: string, forcedGuitarBody: string): string {
  return prepareGuitarStringForcingForAbcjs([
    ...extractRequiredAbcHeaders(sourceAbc),
    "%%score (Guitar)",
    'V:Guitar clef=treble-8 name="Guitar" stem=down',
    "%%MIDI program 24",
    `[V:Guitar] ${forcedGuitarBody}`,
  ].join("\n"));
}

export function convertAsciiGuitarTabToForcedAbc(
  input: AsciiGuitarTabConversionInput,
): AsciiGuitarTabConversionResult {
  const durationContext = buildAbcDurationContext(input.sourceAbc);
  const keyAccidentals = getKeyAccidentalsFromAbc(input.sourceAbc);
  const sourceMeasures = convertAbcToTimeSliceGrid(input.sourceAbc, input.chords);
  const parsed = parseAsciiGuitarTab(input.asciiGuitarTab);
  const attached = attachParsedEvents(sourceMeasures, parsed);
  const forcedGuitarBody = joinMeasureAbcWithBarlines(
    attached.measures.map(measure => convertTimeSliceMeasureToAbc(measure, durationContext, keyAccidentals, true)),
    attached.measures,
  );
  const forcedAbc = buildGuitarOnlyAbc(input.sourceAbc, forcedGuitarBody);
  const roundTripAscii = renderCombinedAsciiGuitarTab(attached.measures);
  const validation = validateGuitarAbcAgainstAsciiGuitarTab({
    abc: forcedGuitarBody,
    measures: attached.measures,
    durationContext,
    keyAccidentals,
    expectedPhysicalEvents: attached.expectedPhysicalEvents,
  });

  return {
    measures: attached.measures,
    forcedGuitarBody,
    forcedAbc,
    roundTripAscii,
    normalizedInputAscii: parsed.normalized,
    validation,
    sourceMelodyAlignment: attached.sourceMelodyAlignment,
    sourceMelodyDurationTransfer: attached.sourceMelodyDurationTransfer,
  };
}

export function getAsciiGuitarTabFingerForString(string: GuitarStringNumber): "p" | "i" | "m" | "a" {
  return FINGER_BY_STRING[string];
}

export function isTimeSliceTabEvent(value: unknown): value is NonNullable<TimeSliceGridStep["tablature"]>[number] {
  return !!value && typeof value === "object" && "string" in value && "fret" in value;
}
