import { generateAccompanimentStage } from "./accompaniment-stage";
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
import { generateFullTrackExpansionStage } from "./full-track-expansion-stage";
import { generateHarmonizationStage } from "./harmonizer";
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
import type { GuitarTabEvent } from "./guitar-tab-validation";
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

function buildIntroMeasure(measures: FingerstyleMeasure[]): string {
  const first = firstBodyMeasure(measures);
  if (!first) return "z8";
  const bass = first.bassNotes[0] ?? "E,";
  const fifth = first.bassNotes[1] ?? bass;
  const melody = first.melodyNotes[0] ? noteNameToAbc(first.melodyNotes[0]) : "E";
  return `${bass}2 ${fifth}2 ${melody}2 ${fifth}2`;
}

function buildInterludeMeasure(measures: FingerstyleMeasure[]): string {
  const pivot = measures[Math.max(0, Math.floor(measures.length / 2) - 1)] ?? firstBodyMeasure(measures);
  if (!pivot) return "z8";
  const bass = pivot.bassNotes[0] ?? "E,";
  const fifth = pivot.bassNotes[1] ?? bass;
  const melody = pivot.melodyNotes.at(-1) ? noteNameToAbc(pivot.melodyNotes.at(-1)!) : "G";
  return `${bass}2 ${melody}2 ${fifth}2 ${melody}2`;
}

function buildOutroMeasure(measures: FingerstyleMeasure[]): string {
  const last = lastBodyMeasure(measures);
  if (!last) return "z8";
  const bass = last.bassNotes[0] ?? "E,";
  const melody = last.melodyNotes.at(-1) ? noteNameToAbc(last.melodyNotes.at(-1)!) : "E";
  return `${bass}2 ${melody}2 ${bass}4`;
}

function buildFingerstyleAbc(measures: FingerstyleMeasure[]): string {
  const interludeAfter = Math.max(1, Math.ceil(measures.length / 2));
  const beforeInterlude = measures.slice(0, interludeAfter).map((measure) => measure.abc);
  const afterInterlude = measures.slice(interludeAfter).map((measure) => measure.abc);
  const lines = [
    'V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"',
    "%%MIDI program 24",
    "% @fingerstyle-section intro",
    `| ${buildIntroMeasure(measures)} |`,
    "% @fingerstyle-section body",
    `| ${beforeInterlude.join(" | ")} |`,
    "% @fingerstyle-section interlude",
    `| ${buildInterludeMeasure(measures)} |`,
  ];

  if (afterInterlude.length > 0) {
    lines.push("% @fingerstyle-section body", `| ${afterInterlude.join(" | ")} |`);
  }

  lines.push("% @fingerstyle-section outro", `| ${buildOutroMeasure(measures)} |`);
  return lines.join("\n");
}

function buildGeneratedArtifacts(compression: FingerstyleDownwardCompression, finalAbc: string, formPlan: FingerstyleFormPlan): FingerstyleGeneratedArtifacts {
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
  const noteMarkerEvents = compression.physicalHandMapping.flatMap((measure): FingerstyleNoteMarkerEvent[] =>
    measure.events.flatMap((event) => {
      const pickingFingerNumbers: Record<FingerstylePhysicalHandEvent["pickingFinger"], 1 | 2 | 3 | 4> = {
        p: 1,
        i: 2,
        m: 3,
        a: 4,
      };
      const pickingEvent: FingerstyleNoteMarkerEvent = {
        measureIndex: measure.measureIndex,
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
          measureIndex: measure.measureIndex,
          beat: event.beat,
          hand: "left",
          sourceHand: "fretting",
          fingerNumber: event.frettingFinger,
          technique: event.technique,
          string: event.string,
          fret: event.fret,
        },
      ];
    })
  );

  return {
    finalAbc,
    formPlan,
    guitarTabEvents: buildGuitarTabEvents(compression, formPlan),
    tablature: { measures: tablatureMeasures },
    fretboardHighlightEvents,
    noteMarkerEvents,
  };
}

function buildOutputContract(
  upwardConstruction: FingerstyleUpwardConstructionContext,
  downwardCompression: FingerstyleDownwardCompression,
  finalAbc: string,
  formPlan: FingerstyleFormPlan
): FingerstyleOutputContract {
  return {
    sourceLayers: upwardConstruction.layers,
    outerVoiceMap: downwardCompression.outerVoiceMap,
    playabilityReport: buildPlayabilityReport(downwardCompression),
    fallbackSuggestions: downwardCompression.fallbackSuggestions,
    innerVoiceReduction: downwardCompression.innerVoiceReduction,
    rhythmicEventMap: buildRhythmicEventMap(downwardCompression),
    profileMetadata: buildProfileMetadata(downwardCompression),
    artifacts: buildGeneratedArtifacts(downwardCompression, finalAbc, formPlan),
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
  const formPlan = buildFingerstyleFormPlan(measures.length);
  const abc = buildFingerstyleAbc(measures);

  return {
    key: resolved.key,
    timeSignature: resolved.timeSignature,
    upwardConstruction,
    downwardCompression,
    outputContract: buildOutputContract(upwardConstruction, downwardCompression, abc, formPlan),
    measures,
    abc,
  };
}

export function generateFingerstyleLine(abcString: string, progression?: string[]): string {
  return generateFingerstyleArrangement(abcString, progression).abc;
}
