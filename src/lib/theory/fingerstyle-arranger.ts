import { generateAccompanimentStage, AccompanimentStage } from "./accompaniment-stage";
import {
  extractMelodyMeasures,
  getBeatsPerMeasure,
  melodyNoteToQuarterAbc,
  noteNameToAbc,
  resolveProgression,
} from "./arranger-utils";
import {
  FingerstyleCompressionOptions,
  FingerstyleDownwardCompression,
  FingerstylePhysicalHandEvent,
  GuitarStringNumber,
  compressFingerstyleArrangement,
} from "./fingerstyle-compressor";
import { FullTrackExpansionStage, generateFullTrackExpansionStage } from "./full-track-expansion-stage";
import { CadenceRole, generateHarmonizationStage } from "./harmonizer";

export interface FingerstyleMeasure {
  measureIndex: number;
  chord: string;
  bassNotes: string[];
  melodyNotes: string[];
  abc: string;
}

export type FingerstyleUpwardConstructionLayerId =
  | "melody"
  | "harmonization"
  | "accompaniment"
  | "bassline"
  | "rhythm-percussion"
  | "counter-melody";

export interface FingerstyleMelodySourceLayer {
  id: "melody";
  layer: {
    number: 1;
    name: "Melody";
    instrument: "voice";
  };
  measures: Array<{
    measureIndex: number;
    notes: string[];
  }>;
}

export interface FingerstyleHarmonizationSourceLayer {
  id: "harmonization";
  progression: string[];
  measures: Array<{
    measureIndex: number;
    chord: string;
    cadenceRole: CadenceRole;
  }>;
}

export interface FingerstyleAccompanimentSourceLayer {
  id: "accompaniment";
  layer: AccompanimentStage["layer"];
  measures: AccompanimentStage["measures"];
}

export interface FingerstyleBasslineSourceLayer {
  id: "bassline";
  measures: Array<{
    measureIndex: number;
    chord: string;
    bassMap: FullTrackExpansionStage["measures"][number]["bassMap"];
  }>;
}

export interface FingerstyleRhythmPercussionSourceLayer {
  id: "rhythm-percussion";
  measures: Array<{
    measureIndex: number;
    chord: string;
    drums: FullTrackExpansionStage["measures"][number]["drums"];
  }>;
}

export interface FingerstyleCounterMelodySourceLayer {
  id: "counter-melody";
  measures: Array<{
    measureIndex: number;
    chord: string;
    melodicGaps: FullTrackExpansionStage["measures"][number]["melodicGaps"];
    counterMelodies: FullTrackExpansionStage["measures"][number]["counterMelodies"];
  }>;
}

export type FingerstyleUpwardConstructionLayer =
  | FingerstyleMelodySourceLayer
  | FingerstyleHarmonizationSourceLayer
  | FingerstyleAccompanimentSourceLayer
  | FingerstyleBasslineSourceLayer
  | FingerstyleRhythmPercussionSourceLayer
  | FingerstyleCounterMelodySourceLayer;

export interface FingerstyleUpwardConstructionContext {
  layers: FingerstyleUpwardConstructionLayer[];
  validation: {
    melodyReady: boolean;
    harmonizationReady: boolean;
    accompanimentReady: boolean;
    basslineReady: boolean;
    rhythmPercussionReady: boolean;
    counterMelodyUsesMelodicGaps: boolean;
  };
}

export type FingerstyleFailedConstraint =
  | "fret-span"
  | "fretting-assignments"
  | "picking-assignments"
  | "strict-pima"
  | "thumb-clock"
  | "string-slap";

export interface FingerstylePlayabilityMeasureReport {
  measureIndex: number;
  chord: string;
  fretSpan: number;
  maxFretSpan: number;
  simultaneousMelodyBassFeasible: boolean;
  frettingFingerCount: number;
  pickingFingerCount: number;
  failedConstraints: FingerstyleFailedConstraint[];
}

export interface FingerstylePlayabilityReport {
  valid: boolean;
  measures: FingerstylePlayabilityMeasureReport[];
}

export interface FingerstyleRhythmicEvent {
  measureIndex: number;
  chord: string;
  beat: number;
  role: FingerstylePhysicalHandEvent["role"];
  technique: FingerstylePhysicalHandEvent["technique"];
  pickingFinger: FingerstylePhysicalHandEvent["pickingFinger"];
  string: GuitarStringNumber | null;
  fret: number;
}

export interface FingerstyleProfileMetadata {
  id: FingerstyleDownwardCompression["physicalHandMapping"][number]["profile"]["id"];
  posture: FingerstyleDownwardCompression["physicalHandMapping"][number]["profile"]["posture"];
  pickingAssignments: Record<GuitarStringNumber, FingerstylePhysicalHandEvent["pickingFinger"]>;
}

export interface FingerstyleTablaturePosition {
  note: string | null;
  string: GuitarStringNumber;
  fret: number;
  beat: number;
  role: FingerstylePhysicalHandEvent["role"];
  technique: FingerstylePhysicalHandEvent["technique"];
}

export interface FingerstyleTablatureMeasure {
  measureIndex: number;
  positions: FingerstyleTablaturePosition[];
}

export type FingerstyleFretboardHighlightEvent = FingerstyleTablaturePosition & {
  measureIndex: number;
};

export type FingerstyleHandOverlayEvent = {
  measureIndex: number;
  beat: number;
  hand: "picking";
  finger: FingerstylePhysicalHandEvent["pickingFinger"];
  technique: FingerstylePhysicalHandEvent["technique"];
  string: GuitarStringNumber | null;
  fret: number;
} | {
  measureIndex: number;
  beat: number;
  hand: "fretting";
  finger: NonNullable<FingerstylePhysicalHandEvent["frettingFinger"]>;
  technique: FingerstylePhysicalHandEvent["technique"];
  string: GuitarStringNumber | null;
  fret: number;
};

export interface FingerstyleGeneratedArtifacts {
  finalAbc: string;
  tablature: {
    measures: FingerstyleTablatureMeasure[];
  };
  fretboardHighlightEvents: FingerstyleFretboardHighlightEvent[];
  handOverlayEvents: FingerstyleHandOverlayEvent[];
}

export interface FingerstyleOutputContract {
  sourceLayers: FingerstyleUpwardConstructionLayer[];
  outerVoiceMap: FingerstyleDownwardCompression["outerVoiceMap"];
  playabilityReport: FingerstylePlayabilityReport;
  fallbackSuggestions: FingerstyleDownwardCompression["fallbackSuggestions"];
  innerVoiceReduction: FingerstyleDownwardCompression["innerVoiceReduction"];
  rhythmicEventMap: FingerstyleRhythmicEvent[];
  profileMetadata: FingerstyleProfileMetadata;
  artifacts: FingerstyleGeneratedArtifacts;
}

export interface FingerstyleArrangement {
  key: string;
  timeSignature: string;
  upwardConstruction: FingerstyleUpwardConstructionContext;
  downwardCompression: FingerstyleDownwardCompression;
  outputContract: FingerstyleOutputContract;
  measures: FingerstyleMeasure[];
  abc: string;
}

function buildMelodySourceLayer(melodyMeasures: ReturnType<typeof extractMelodyMeasures>): FingerstyleMelodySourceLayer {
  return {
    id: "melody",
    layer: { number: 1, name: "Melody", instrument: "voice" },
    measures: melodyMeasures.map((measure, measureIndex) => ({
      measureIndex,
      notes: measure.map((event) => event.note),
    })),
  };
}

function buildHarmonizationSourceLayer(
  abcString: string,
  progression: string[]
): FingerstyleHarmonizationSourceLayer {
  const harmonization = generateHarmonizationStage(abcString);

  return {
    id: "harmonization",
    progression,
    measures: progression.map((chord, measureIndex) => ({
      measureIndex,
      chord,
      cadenceRole: harmonization.measures[measureIndex]?.cadenceRole ?? "continuation",
    })),
  };
}

function buildUpwardConstructionContext(
  abcString: string,
  progression: string[],
  melodyMeasures: ReturnType<typeof extractMelodyMeasures>
): FingerstyleUpwardConstructionContext {
  const accompaniment = generateAccompanimentStage(abcString, { progression });
  const fullTrackExpansion = generateFullTrackExpansionStage(abcString, { accompaniment });

  const melodyLayer = buildMelodySourceLayer(melodyMeasures);
  const harmonizationLayer = buildHarmonizationSourceLayer(abcString, progression);
  const accompanimentLayer: FingerstyleAccompanimentSourceLayer = {
    id: "accompaniment",
    layer: accompaniment.layer,
    measures: accompaniment.measures,
  };
  const basslineLayer: FingerstyleBasslineSourceLayer = {
    id: "bassline",
    measures: fullTrackExpansion.measures.map((measure) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      bassMap: measure.bassMap,
    })),
  };
  const rhythmPercussionLayer: FingerstyleRhythmPercussionSourceLayer = {
    id: "rhythm-percussion",
    measures: fullTrackExpansion.measures.map((measure) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      drums: measure.drums,
    })),
  };
  const counterMelodyLayer: FingerstyleCounterMelodySourceLayer = {
    id: "counter-melody",
    measures: fullTrackExpansion.measures.map((measure) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      melodicGaps: measure.melodicGaps,
      counterMelodies: measure.counterMelodies,
    })),
  };

  return {
    layers: [
      melodyLayer,
      harmonizationLayer,
      accompanimentLayer,
      basslineLayer,
      rhythmPercussionLayer,
      counterMelodyLayer,
    ],
    validation: {
      melodyReady: melodyLayer.measures.length > 0,
      harmonizationReady: harmonizationLayer.progression.length > 0,
      accompanimentReady: accompanimentLayer.measures.length > 0,
      basslineReady: basslineLayer.measures.every((measure) => measure.bassMap.length > 0),
      rhythmPercussionReady: rhythmPercussionLayer.measures.every((measure) => measure.drums.kickBeats.length > 0),
      counterMelodyUsesMelodicGaps: fullTrackExpansion.validation.counterMelodiesUseGaps,
    },
  };
}

function countMaxSimultaneous<T>(events: FingerstylePhysicalHandEvent[], pickValue: (event: FingerstylePhysicalHandEvent) => T | null): number {
  const valuesByBeat = new Map<number, Set<T>>();

  for (const event of events) {
    const value = pickValue(event);
    if (value === null) continue;

    const values = valuesByBeat.get(event.beat) ?? new Set<T>();
    values.add(value);
    valuesByBeat.set(event.beat, values);
  }

  return Math.max(0, ...Array.from(valuesByBeat.values(), (values) => values.size));
}

function failedConstraintsFor(
  compression: FingerstyleDownwardCompression,
  measure: FingerstyleDownwardCompression["physicalHandMapping"][number]
): FingerstyleFailedConstraint[] {
  const failures: FingerstyleFailedConstraint[] = [];
  const outerVoice = compression.outerVoiceMap[measure.measureIndex];

  if (!outerVoice.beatOnePairing.valid) failures.push("fret-span");
  if (!measure.validation.frettingPlayable) failures.push("fretting-assignments");
  if (!measure.validation.pickingPlayable) failures.push("picking-assignments");
  if (!compression.validation.strictPimaPicking && measure.profile.id === "strict-pima") failures.push("strict-pima");
  if (!compression.validation.thumbClockContinuous) failures.push("thumb-clock");
  if (!compression.validation.stringSlapsOnBackbeat) failures.push("string-slap");

  return failures;
}

function buildPlayabilityReport(compression: FingerstyleDownwardCompression): FingerstylePlayabilityReport {
  const measures = compression.physicalHandMapping.map((measure): FingerstylePlayabilityMeasureReport => {
    const outerVoice = compression.outerVoiceMap[measure.measureIndex];
    const failedConstraints = failedConstraintsFor(compression, measure);

    return {
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      fretSpan: outerVoice.beatOnePairing.fretStretch,
      maxFretSpan: outerVoice.beatOnePairing.maxFretStretch,
      simultaneousMelodyBassFeasible: outerVoice.beatOnePairing.valid,
      frettingFingerCount: countMaxSimultaneous(measure.events, (event) => event.frettingFinger),
      pickingFingerCount: countMaxSimultaneous(measure.events, (event) => event.pickingFinger),
      failedConstraints,
    };
  });

  return {
    valid: measures.every((measure) => measure.failedConstraints.length === 0),
    measures,
  };
}

function buildRhythmicEventMap(compression: FingerstyleDownwardCompression): FingerstyleRhythmicEvent[] {
  return compression.physicalHandMapping.flatMap((measure) =>
    measure.events.map((event) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      beat: event.beat,
      role: event.role,
      technique: event.technique,
      pickingFinger: event.pickingFinger,
      string: event.string,
      fret: event.fret,
    }))
  );
}

function buildProfileMetadata(compression: FingerstyleDownwardCompression): FingerstyleProfileMetadata {
  const profile = compression.physicalHandMapping[0]?.profile ?? { id: "strict-pima", posture: "floating" };

  return {
    id: profile.id,
    posture: profile.posture,
    pickingAssignments: {
      6: "p",
      5: "p",
      4: "p",
      3: "i",
      2: "m",
      1: "a",
    },
  };
}

function isStringedEvent(event: FingerstylePhysicalHandEvent): event is FingerstylePhysicalHandEvent & { string: GuitarStringNumber } {
  return event.string !== null;
}

function buildGeneratedArtifacts(compression: FingerstyleDownwardCompression, finalAbc: string): FingerstyleGeneratedArtifacts {
  const tablatureMeasures = compression.physicalHandMapping.map((measure): FingerstyleTablatureMeasure => ({
    measureIndex: measure.measureIndex,
    positions: measure.events.filter(isStringedEvent).map((event) => ({
      note: event.note,
      string: event.string,
      fret: event.fret,
      beat: event.beat,
      role: event.role,
      technique: event.technique,
    })),
  }));
  const fretboardHighlightEvents = tablatureMeasures.flatMap((measure) =>
    measure.positions.map((position) => ({ ...position, measureIndex: measure.measureIndex }))
  );
  const handOverlayEvents = compression.physicalHandMapping.flatMap((measure): FingerstyleHandOverlayEvent[] =>
    measure.events.flatMap((event) => {
      const pickingEvent: FingerstyleHandOverlayEvent = {
        measureIndex: measure.measureIndex,
        beat: event.beat,
        hand: "picking",
        finger: event.pickingFinger,
        technique: event.technique,
        string: event.string,
        fret: event.fret,
      };

      if (event.frettingFinger === null) return [pickingEvent];

      return [
        pickingEvent,
        {
          measureIndex: measure.measureIndex,
          beat: event.beat,
          hand: "fretting",
          finger: event.frettingFinger,
          technique: event.technique,
          string: event.string,
          fret: event.fret,
        },
      ];
    })
  );

  return {
    finalAbc,
    tablature: { measures: tablatureMeasures },
    fretboardHighlightEvents,
    handOverlayEvents,
  };
}

function buildOutputContract(
  upwardConstruction: FingerstyleUpwardConstructionContext,
  downwardCompression: FingerstyleDownwardCompression,
  finalAbc: string
): FingerstyleOutputContract {
  return {
    sourceLayers: upwardConstruction.layers,
    outerVoiceMap: downwardCompression.outerVoiceMap,
    playabilityReport: buildPlayabilityReport(downwardCompression),
    fallbackSuggestions: downwardCompression.fallbackSuggestions,
    innerVoiceReduction: downwardCompression.innerVoiceReduction,
    rhythmicEventMap: buildRhythmicEventMap(downwardCompression),
    profileMetadata: buildProfileMetadata(downwardCompression),
    artifacts: buildGeneratedArtifacts(downwardCompression, finalAbc),
  };
}

export function generateFingerstyleArrangement(
  abcString: string,
  progression?: string[],
  options: FingerstyleCompressionOptions = {}
): FingerstyleArrangement {
  const resolved = resolveProgression(abcString, progression);
  const melodyMeasures = extractMelodyMeasures(abcString);
  const beatCount = getBeatsPerMeasure(resolved.timeSignature);
  const resolvedProgression = resolved.chords.map((chord) => chord.chordName);

  const measures = resolved.chords.map((chord, measureIndex) => {
    const melody = melodyMeasures[measureIndex] ?? [];
    const bassNotes = [noteNameToAbc(chord.notes[0], ","), noteNameToAbc(chord.notes[2], ",")];
    const tokens: string[] = [];
    const melodyNotes: string[] = [];

    for (let beat = 0; beat < beatCount; beat++) {
      if (beat % 2 === 0) {
        const bass = bassNotes[(beat / 2) % bassNotes.length];
        tokens.push(`${bass}2`);
      } else {
        const melodyEvent = melody[(beat - 1) / 2];
        tokens.push(melodyNoteToQuarterAbc(melodyEvent));
        if (melodyEvent) melodyNotes.push(melodyEvent.note);
      }
    }

    return {
      measureIndex,
      chord: chord.chordName,
      bassNotes,
      melodyNotes,
      abc: tokens.join(" "),
    };
  });

  const upwardConstruction = buildUpwardConstructionContext(abcString, resolvedProgression, melodyMeasures);
  const downwardCompression = compressFingerstyleArrangement(resolved.chords, melodyMeasures, options);
  const abc = `V:Guitar clef=treble-8\n| ${measures.map((measure) => measure.abc).join(" | ")} |`;

  return {
    key: resolved.key,
    timeSignature: resolved.timeSignature,
    upwardConstruction,
    downwardCompression,
    outputContract: buildOutputContract(upwardConstruction, downwardCompression, abc),
    measures,
    abc,
  };
}

export function generateFingerstyleLine(abcString: string, progression?: string[]): string {
  return generateFingerstyleArrangement(abcString, progression).abc;
}
