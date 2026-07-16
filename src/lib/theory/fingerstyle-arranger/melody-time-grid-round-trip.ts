import { buildAbcDurationContext } from "../abc-duration";
import { getKeyAccidentalsFromAbc } from "../abc-key-signature";
import { STANDARD_TUNING_OPEN_MIDI, parseScientificPitch } from "../guitar-playability";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  validateGuitarAbcAgainstAsciiGuitarTab,
  type AbcAsciiGuitarTabValidationResult,
} from "./abc-ascii-guitartab-validation";
import { buildGeneratedGuitarAbc, buildStandaloneGeneratedGuitarAbc } from "./guitar-abc-output";
import { importAbcNotationToTimeGrid } from "./abc-timegrid-import";
import { validateFingerstylePhysicsDetailed, type FingerstylePhysicsValidationResult } from "./physics-validation";
import { convertAbcToTimeSliceGrid, type TimeSliceMeasure } from "./time-slice";
import {
  formatImportedTimeGridDocumentCompact,
  formatImportedTimeGridDocumentCompactPresentation,
  type ImportedTimeGridDocument,
} from "./timegrid-document-codec";

const FINGER_BY_STRING = { 1: "a", 2: "m", 3: "i", 4: "p", 5: "p", 6: "p" } as const;
const MAX_DIAGNOSTIC_FRET = 20;

export interface MelodyTabMapping {
  measure: number;
  stepIndex: number;
  pitch: string;
  string: GuitarStringNumber;
  fret: number;
  durationSteps: number;
}

export interface UnmappableMelodyAttack {
  measure: number;
  stepIndex: number;
  pitch: string;
}

export type { ImportedTimeGridDocument } from "./timegrid-document-codec";

export interface SourceTimeGridConversionDiagnostic {
  document: ImportedTimeGridDocument;
  timeGridDocument: string;
  reEmittedSourceAbc: string;
  sourceExactMatch: boolean;
  mappings: MelodyTabMapping[];
  unmappableAttacks: UnmappableMelodyAttack[];
  physicsValidation: FingerstylePhysicsValidationResult[];
  generatedGuitarAbc: string;
  standaloneGeneratedGuitarAbc: string;
  generatedGuitarValidation: AbcAsciiGuitarTabValidationResult;
}

function cloneMeasures(measures: TimeSliceMeasure[]): TimeSliceMeasure[] {
  return JSON.parse(JSON.stringify(measures)) as TimeSliceMeasure[];
}

function melodyDurationSteps(measure: TimeSliceMeasure, startIndex: number): number {
  const pitch = measure.grid[startIndex].melody.pitch;
  let durationSteps = 1;
  for (let index = startIndex + 1; index < measure.grid.length; index++) {
    const melody = measure.grid[index].melody;
    if (melody.state !== "sustain" || melody.pitch !== pitch) break;
    durationSteps++;
  }
  return durationSteps;
}

function routeMelodyPitch(pitch: string): { string: GuitarStringNumber; fret: number } | null {
  const parsed = parseScientificPitch(pitch);
  if (!parsed) return null;

  const candidates = (Object.entries(STANDARD_TUNING_OPEN_MIDI) as Array<[string, number]>)
    .map(([stringText, openMidi]) => ({
      string: Number(stringText) as GuitarStringNumber,
      fret: parsed.midi - openMidi,
    }))
    .filter(candidate => candidate.fret >= 0 && candidate.fret <= MAX_DIAGNOSTIC_FRET)
    .sort((left, right) => left.fret - right.fret || left.string - right.string);

  return candidates[0] ?? null;
}

function attachMelodyTablature(measures: TimeSliceMeasure[]): {
  measures: TimeSliceMeasure[];
  mappings: MelodyTabMapping[];
  unmappableAttacks: UnmappableMelodyAttack[];
} {
  const adaptedMeasures = cloneMeasures(measures);
  const mappings: MelodyTabMapping[] = [];
  const unmappableAttacks: UnmappableMelodyAttack[] = [];

  for (const measure of adaptedMeasures) {
    for (const [stepIndex, step] of measure.grid.entries()) {
      if (step.melody.state !== "attack" || !step.melody.pitch) continue;
      const route = routeMelodyPitch(step.melody.pitch);
      if (!route) {
        unmappableAttacks.push({ measure: measure.measure, stepIndex, pitch: step.melody.pitch });
        continue;
      }

      const durationSteps = melodyDurationSteps(measure, stepIndex);
      step.tablature = [{
        string: route.string,
        fret: route.fret,
        finger: FINGER_BY_STRING[route.string],
        role: "melody",
        durationSteps,
      }];
      mappings.push({
        measure: measure.measure,
        stepIndex,
        pitch: step.melody.pitch,
        string: route.string,
        fret: route.fret,
        durationSteps,
      });
    }
  }

  return { measures: adaptedMeasures, mappings, unmappableAttacks };
}

/**
 * Compiles imported ABC into the guide's canonical TimeGrid document. The raw
 * source is intentionally retained verbatim: TimeSliceMeasure[] is an editable
 * guitar-arrangement model, not a lossless ABC concrete-syntax tree.
 */
export function runSourceTimeGridConversionDiagnostic(sourceAbc: string): SourceTimeGridConversionDiagnostic {
  const hasImportableForcedGuitar = /(?:^V:Guitar\b|^\[V:Guitar\])/m.test(sourceAbc)
    && /![1-6]!/.test(sourceAbc);
  const imported = hasImportableForcedGuitar ? importAbcNotationToTimeGrid(sourceAbc) : undefined;
  const sourceMeasures = convertAbcToTimeSliceGrid(sourceAbc, []);
  // Keep Melody routing as a diagnostic trace even when the source includes an
  // authoritative forced-string Guitar voice, whose physical events take
  // precedence in the imported document.
  const attached = attachMelodyTablature(sourceMeasures);
  const document: ImportedTimeGridDocument = imported?.document ?? {
    version: 1,
    source: { rawAbc: sourceAbc },
    measures: attached.measures,
  };
  const timeGridDocument = formatImportedTimeGridDocumentCompact(document);
  const durationContext = buildAbcDurationContext(sourceAbc);
  const keyAccidentals = getKeyAccidentalsFromAbc(sourceAbc);
  const generatedGuitarAbc = buildGeneratedGuitarAbc(document.measures, sourceAbc);
  // The validator consumes guitar music, not the `V:Guitar` declaration's
  // clef/name attributes. Give it an explicit inline voice plus generated body.
  const generatedGuitarBody = generatedGuitarAbc.split("\n").slice(2).join("\n");

  return {
    document,
    timeGridDocument,
    reEmittedSourceAbc: document.source.rawAbc,
    sourceExactMatch: document.source.rawAbc === sourceAbc,
    mappings: attached.mappings,
    unmappableAttacks: attached.unmappableAttacks,
    physicsValidation: document.measures.map(measure => validateFingerstylePhysicsDetailed(measure.grid, {
      skillLevel: "beginner",
      maxMelodyFret: MAX_DIAGNOSTIC_FRET,
      fillDensity: measure.style_profile.fill_density,
    })),
    generatedGuitarAbc,
    standaloneGeneratedGuitarAbc: buildStandaloneGeneratedGuitarAbc(document.measures, sourceAbc),
    generatedGuitarValidation: validateGuitarAbcAgainstAsciiGuitarTab({
      abc: `[V:Guitar] ${generatedGuitarBody}`,
      measures: document.measures,
      durationContext,
      keyAccidentals,
    }),
  };
}
