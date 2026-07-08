import { generateAccompanimentStage } from "./accompaniment-stage";
import { buildAbcDurationContext, formatAbcDuration, normalizeAbcMeasureDuration, type AbcDurationContext } from "./abc-duration";
import {
  extractMelodyMeasures,
  extractMelodyMeasureTimeline,
  noteNameToAbc,
  resolveProgression,
  type MelodyNoteEvent,
} from "./arranger-utils";
import {
  FingerstyleCompressionOptions,
  FingerstyleDownwardCompression,
  FingerstylePhysicalHandEvent,
  GuitarStringNumber,
  compressFingerstyleArrangement,
} from "./fingerstyle-compressor";
import { generateFullTrackExpansionStage } from "./full-track-expansion-stage";
import { generateHarmonizationStage } from "./harmonizer";
import type { ChordInfo } from "./chords";
import type {
  FingerstyleAccompanimentSourceLayer,
  FingerstyleArrangement,
  FingerstyleBasslineSourceLayer,
  FingerstyleCounterMelodySourceLayer,
  FingerstyleFailedConstraint,
  FingerstyleFormPlan,
  FingerstyleFormSection,
  FingerstyleGeneratedArtifacts,
  FingerstyleHarmonizationSourceLayer,
  FingerstyleMeasure,
  FingerstyleMelodySourceLayer,
  FingerstyleNoteMarkerEvent,
  FingerstyleOutputContract,
  FingerstylePlayabilityMeasureReport,
  FingerstylePlayabilityReport,
  FingerstyleProfileMetadata,
  FingerstyleRhythmPercussionSourceLayer,
  FingerstyleRhythmicEvent,
  FingerstyleTablatureMeasure,
  FingerstyleUpwardConstructionContext,
} from "./fingerstyle-arranger/types";
import { scientificPitchForStringFret } from "./guitar-playability";
import type { GuitarTabEvent, GuitarTabValidationResult } from "./guitar-tab-validation";
import {
  buildFingerstyleEventMatrix,
  canonicalEventsToTabEvents,
  renderCanonicalMeasureAbc,
  type FingerstyleEventMatrix,
} from "./fingerstyle-arranger/event-matrix";
export type * from "./fingerstyle-arranger/types";



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
  if (measure.profile.id === "folk-travis" && !compression.validation.thumbClockContinuous) failures.push("thumb-clock");
  if (measure.profile.id === "folk-travis" && !compression.validation.stringSlapsOnBackbeat) failures.push("string-slap");

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
  const pickingAssignments: FingerstyleProfileMetadata["pickingAssignments"] = profile.id === "folk-travis"
    ? {
      6: ["p"],
      5: ["p"],
      4: ["p"],
      3: ["i", "m"],
      2: ["i", "m"],
      1: ["i", "m"],
    }
    : {
      6: ["p"],
      5: ["p"],
      4: ["p"],
      3: ["i"],
      2: ["m"],
      1: ["a"],
    };

  return {
    id: profile.id,
    posture: profile.posture,
    pickingAssignments,
  };
}

function isStringedEvent(event: FingerstylePhysicalHandEvent): event is FingerstylePhysicalHandEvent & { string: GuitarStringNumber } {
  return event.string !== null;
}

function buildFingerstyleFormPlan(bodyMeasureCount: number): FingerstyleFormPlan {
  const interludeIndex = Math.max(1, Math.ceil(bodyMeasureCount / 2));
  const sections: FingerstyleFormSection[] = [
    {
      kind: "intro",
      label: "Intro",
      startMeasureIndex: 0,
      measureCount: 1,
      source: "tonic-to-dominant arpeggio motive from the opening chord area",
      placement: "before the melody body",
    },
    {
      kind: "body",
      label: "Melody Body",
      startMeasureIndex: 1,
      measureCount: bodyMeasureCount,
      source: "source melody compressed onto guitar with chord-derived bass",
      placement: "main song body",
    },
    {
      kind: "interlude",
      label: "Interlude",
      startMeasureIndex: 1 + interludeIndex,
      measureCount: 1,
      source: "phrase-boundary chord turnaround using the current bass strategy",
      placement: `after body measure ${interludeIndex}`,
    },
    {
      kind: "outro",
      label: "Outro",
      startMeasureIndex: bodyMeasureCount + 2,
      measureCount: 1,
      source: "final tonic cadence arpeggio ending with stable root bass",
      placement: "after the melody body",
    },
  ];

  return { sections };
}

function guitarTabRolePriority(role: string): number {
  if (role === "melody") return 3;
  if (role === "bass") return 2;
  return 1;
}

function buildGuitarTabEvents(compression: FingerstyleDownwardCompression, _formPlan: FingerstyleFormPlan): GuitarTabEvent[] {
  const rawEvents = compression.physicalHandMapping.flatMap((measure) =>
    measure.events.filter(isStringedEvent).flatMap((event) => {
      if (!event.note || event.role === "percussion") return [];
      return [{
        measureIndex: measure.measureIndex,
        beat: event.beat,
        subdivision: Number.isInteger(event.beat) ? undefined : event.beat,
        simultaneousGroupId: `${measure.measureIndex}:${event.beat}`,
        note: scientificPitchForStringFret(event.string, event.fret),
        sourceEventId: `${measure.measureIndex}:${event.beat}:${event.role}:${event.note}`,
        string: event.string,
        fret: event.fret,
        role: event.role,
      }];
    })
  );

  const byGroupString = new Map<string, GuitarTabEvent>();
  for (const event of rawEvents) {
    const key = `${event.measureIndex}:${event.beat}:${event.subdivision ?? "0"}:${event.simultaneousGroupId ?? ""}:${event.string}`;
    const existing = byGroupString.get(key);
    if (!existing || guitarTabRolePriority(event.role) > guitarTabRolePriority(existing.role)) {
      byGroupString.set(key, event);
    }
  }
  return Array.from(byGroupString.values());
}

function firstBodyMeasure(measures: FingerstyleMeasure[]): FingerstyleMeasure | null {
  return measures[0] ?? null;
}

function lastBodyMeasure(measures: FingerstyleMeasure[]): FingerstyleMeasure | null {
  return measures.at(-1) ?? null;
}

function normalizeFingerstyleMeasure(measure: string, durationContext: AbcDurationContext): string {
  return normalizeAbcMeasureDuration(measure, durationContext.fullMeasureUnits);
}

function buildIntroMeasure(measures: FingerstyleMeasure[], durationContext: AbcDurationContext): string {
  const first = firstBodyMeasure(measures);
  if (!first) return `z${formatAbcDuration(durationContext.fullMeasureUnits)}`;
  const bass = first.bassNotes[0] ?? "E,";
  const fifth = first.bassNotes[1] ?? bass;
  const melody = first.melodyNotes[0] ? noteNameToAbc(first.melodyNotes[0]) : "E";
  return normalizeFingerstyleMeasure(`${bass}2 ${fifth}2 ${melody}2 ${fifth}2`, durationContext);
}

function buildInterludeMeasure(measures: FingerstyleMeasure[], durationContext: AbcDurationContext): string {
  const pivot = measures[Math.max(0, Math.floor(measures.length / 2) - 1)] ?? firstBodyMeasure(measures);
  if (!pivot) return `z${formatAbcDuration(durationContext.fullMeasureUnits)}`;
  const bass = pivot.bassNotes[0] ?? "E,";
  const fifth = pivot.bassNotes[1] ?? bass;
  const melody = pivot.melodyNotes.at(-1) ? noteNameToAbc(pivot.melodyNotes.at(-1)!) : "G";
  return normalizeFingerstyleMeasure(`${bass}2 ${melody}2 ${fifth}2 ${melody}2`, durationContext);
}

function buildOutroMeasure(measures: FingerstyleMeasure[], durationContext: AbcDurationContext): string {
  const last = lastBodyMeasure(measures);
  if (!last) return `z${formatAbcDuration(durationContext.fullMeasureUnits)}`;
  const bass = last.bassNotes[0] ?? "E,";
  const melody = last.melodyNotes.at(-1) ? noteNameToAbc(last.melodyNotes.at(-1)!) : "E";
  return normalizeFingerstyleMeasure(`${bass}2 ${melody}2 ${bass}4`, durationContext);
}

function buildFingerstyleAbc(measures: FingerstyleMeasure[], durationContext: AbcDurationContext): string {
  const interludeAfter = Math.max(1, Math.ceil(measures.length / 2));
  const beforeInterlude = measures.slice(0, interludeAfter).map((measure) => measure.abc);
  const afterInterlude = measures.slice(interludeAfter).map((measure) => measure.abc);
  const lines = [
    'V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"',
    "%%MIDI program 24",
    "% @fingerstyle-section intro",
    `| ${buildIntroMeasure(measures, durationContext)} |`,
    "% @fingerstyle-section body",
    `| ${beforeInterlude.join(" | ")} |`,
    "% @fingerstyle-section interlude",
    `| ${buildInterludeMeasure(measures, durationContext)} |`,
  ];

  if (afterInterlude.length > 0) {
    lines.push("% @fingerstyle-section body", `| ${afterInterlude.join(" | ")} |`);
  }

  lines.push("% @fingerstyle-section outro", `| ${buildOutroMeasure(measures, durationContext)} |`);
  return lines.join("\n");
}

interface TimedFingerstyleToken {
  at: number;
  token: string;
  role: "melody" | "bass";
}

function uniqueSortedOffsets(offsets: number[], fullMeasureUnits: number): number[] {
  return [...new Set(offsets
    .filter((offset) => offset >= 0 && offset < fullMeasureUnits)
    .map((offset) => Number(offset.toFixed(6))))]
    .sort((left, right) => left - right);
}

function bassAnchorOffsets(durationContext: AbcDurationContext): number[] {
  const { meter, unitsPerBeat, fullMeasureUnits } = durationContext;
  let secondaryOffset = Math.floor(meter.numerator / 2) * unitsPerBeat;

  if (meter.numerator === 3 && meter.denominator === 4) {
    secondaryOffset = 2 * unitsPerBeat;
  } else if (meter.numerator === 6 && meter.denominator === 8) {
    secondaryOffset = 3 * unitsPerBeat;
  }

  return uniqueSortedOffsets([0, secondaryOffset], fullMeasureUnits);
}

function buildMergedFingerstyleMeasure(
  melody: MelodyNoteEvent[],
  chord: ChordInfo,
  durationContext: AbcDurationContext
): { abc: string; melodyNotes: string[]; bassNotes: string[] } {
  const bassNotes = [
    noteNameToAbc(chord.notes[0] ?? chord.chordName, ","),
    noteNameToAbc(chord.notes[2] ?? chord.notes[0] ?? chord.chordName, ","),
  ];
  const tokens: TimedFingerstyleToken[] = [];
  const boundaries = new Set<number>([0, durationContext.fullMeasureUnits]);
  let elapsed = 0;

  for (const event of melody) {
    const at = Math.min(elapsed, durationContext.fullMeasureUnits);
    const duration = Math.min(event.duration, durationContext.fullMeasureUnits - at);
    if (duration > 0) {
      tokens.push({ at, token: event.note, role: "melody" });
      boundaries.add(at);
      boundaries.add(at + duration);
    }
    elapsed += event.duration;
  }

  for (const [index, offset] of bassAnchorOffsets(durationContext).entries()) {
    tokens.push({ at: offset, token: bassNotes[index % bassNotes.length], role: "bass" });
    boundaries.add(offset);
  }

  const sortedBoundaries = Array.from(boundaries)
    .filter((offset) => offset >= 0 && offset <= durationContext.fullMeasureUnits)
    .sort((left, right) => left - right);
  const rendered: string[] = [];

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const at = sortedBoundaries[index];
    const next = sortedBoundaries[index + 1];
    const duration = next - at;
    if (duration <= 0) continue;

    const sounding = tokens.filter((token) => Math.abs(token.at - at) < 1e-6);
    const melodyTokens = sounding.filter((token) => token.role === "melody").map((token) => token.token);
    const bassTokens = sounding.filter((token) => token.role === "bass").map((token) => token.token);
    const durationSuffix = formatAbcDuration(duration);

    if (melodyTokens.length > 0 && bassTokens.length > 0) {
      rendered.push(`[${[...bassTokens, ...melodyTokens].join("")}]${durationSuffix}`);
    } else if (bassTokens.length > 0) {
      rendered.push(`${bassTokens[0]}${durationSuffix}`);
    } else if (melodyTokens.length > 0) {
      rendered.push(`${melodyTokens[0]}${durationSuffix}`);
    } else {
      rendered.push(`z${durationSuffix}`);
    }
  }

  return {
    abc: normalizeFingerstyleMeasure(rendered.join(" "), durationContext),
    melodyNotes: melody.map((event) => event.note),
    bassNotes,
  };
}

function buildGeneratedArtifacts(matrix: FingerstyleEventMatrix, finalAbc: string, formPlan: FingerstyleFormPlan): FingerstyleGeneratedArtifacts {
  const matrixEvents = matrix.measures.flatMap((measure) => measure.events);
  const tablatureMeasures = matrix.measures.map((measure): FingerstyleTablatureMeasure => ({
    measureIndex: measure.measureIndex,
    positions: measure.events.map((event) => ({
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
  const pickingFingerNumbers: Record<FingerstylePhysicalHandEvent["pickingFinger"], 1 | 2 | 3 | 4> = {
    p: 1,
    i: 2,
    m: 3,
    a: 4,
  };
  const noteMarkerEvents = matrixEvents.flatMap((event): FingerstyleNoteMarkerEvent[] => {
    const pickingEvent: FingerstyleNoteMarkerEvent = {
      measureIndex: event.measureIndex,
      beat: event.beat,
      hand: "right",
      sourceHand: "picking",
      fingerNumber: pickingFingerNumbers[event.pickingFinger],
      musicalFingering: event.pickingFinger,
      technique: event.technique,
      string: event.string,
      fret: event.fret,
    };

    if (event.frettingFinger === null) return [pickingEvent];

    return [
      pickingEvent,
      {
        measureIndex: event.measureIndex,
        beat: event.beat,
        hand: "left",
        sourceHand: "fretting",
        fingerNumber: event.frettingFinger,
        technique: event.technique,
        string: event.string,
        fret: event.fret,
      },
    ];
  });

  return {
    finalAbc,
    formPlan,
    guitarTabEvents: matrix.tabEvents,
    tablature: { measures: tablatureMeasures },
    fretboardHighlightEvents,
    noteMarkerEvents,
    appliedWorkflowOption: matrix.appliedWorkflowOption,
  };
}

function buildMatrixPlayabilityReport(matrix: FingerstyleEventMatrix): FingerstylePlayabilityReport {
  return {
    valid: matrix.validation.valid,
    measures: matrix.measures.map((measure): FingerstylePlayabilityMeasureReport => {
      const groups = matrix.validation.validatedGroups.filter((group) => group.measureIndex === measure.measureIndex);
      const issues = matrix.validation.issues.filter((issue) => issue.measureIndex === measure.measureIndex);
      const failedConstraints: FingerstyleFailedConstraint[] = issues.some((issue) => issue.code === "fret-span")
        ? ["fret-span"]
        : issues.length > 0
          ? ["fretting-assignments"]
          : [];
      return {
        measureIndex: measure.measureIndex,
        chord: measure.chord,
        fretSpan: Math.max(0, ...groups.map((group) => group.fretSpan)),
        maxFretSpan: 5,
        simultaneousMelodyBassFeasible: failedConstraints.length === 0,
        frettingFingerCount: Math.max(0, ...groups.map((group) => group.frettingFingerCount)),
        pickingFingerCount: new Set(measure.events.map((event) => event.pickingFinger)).size,
        failedConstraints,
      };
    }),
  };
}

function buildOutputContract(
  upwardConstruction: FingerstyleUpwardConstructionContext,
  downwardCompression: FingerstyleDownwardCompression,
  matrix: FingerstyleEventMatrix,
  finalAbc: string,
  formPlan: FingerstyleFormPlan
): FingerstyleOutputContract {
  return {
    sourceLayers: upwardConstruction.layers,
    outerVoiceMap: downwardCompression.outerVoiceMap,
    playabilityReport: buildMatrixPlayabilityReport(matrix),
    fallbackSuggestions: downwardCompression.fallbackSuggestions,
    innerVoiceReduction: downwardCompression.innerVoiceReduction,
    rhythmicEventMap: matrix.measures.flatMap((measure) => measure.events.map((event) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      beat: event.beat,
      role: event.role,
      technique: event.technique,
      pickingFinger: event.pickingFinger,
      string: event.string,
      fret: event.fret,
    }))),
    profileMetadata: buildProfileMetadata(downwardCompression),
    artifacts: buildGeneratedArtifacts(matrix, finalAbc, formPlan),
  };
}

export function generateFingerstyleArrangement(
  abcString: string,
  progression?: string[],
  options: FingerstyleCompressionOptions = {}
): FingerstyleArrangement {
  const resolved = resolveProgression(abcString, progression);
  const melodyTimelines = extractMelodyMeasureTimeline(abcString);
  const melodyMeasures = extractMelodyMeasures(abcString);
  const resolvedProgression = resolved.chords.map((chord) => chord.chordName);
  const matrix = buildFingerstyleEventMatrix({ abcString, timelines: melodyTimelines, chords: resolved.chords, options });

  const measures = matrix.measures.map((measure): FingerstyleMeasure => ({
    measureIndex: measure.measureIndex,
    chord: measure.chord,
    bassNotes: measure.events.filter((event) => event.role === "bass" || event.role === "fifth").map((event) => event.abcToken),
    melodyNotes: measure.events.filter((event) => event.role === "melody").map((event) => event.abcToken),
    abc: renderCanonicalMeasureAbc(measure, matrix.durationContext),
  }));

  const upwardConstruction = buildUpwardConstructionContext(abcString, resolvedProgression, melodyMeasures);
  const downwardCompression = compressFingerstyleArrangement(resolved.chords, melodyMeasures, options);
  const formPlan = buildFingerstyleFormPlan(measures.length);
  const abc = buildFingerstyleAbc(measures, matrix.durationContext);

  return {
    key: resolved.key,
    timeSignature: resolved.timeSignature,
    upwardConstruction,
    downwardCompression,
    outputContract: buildOutputContract(upwardConstruction, downwardCompression, matrix, abc, formPlan),
    measures,
    abc,
  };
}

export function generateFingerstyleLine(abcString: string, progression?: string[]): string {
  return generateFingerstyleArrangement(abcString, progression).abc;
}
