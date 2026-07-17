import { AccompanimentStage, AccompanimentMeasure } from "./accompaniment-stage";
import { getBeatsPerMeasure } from "./arranger-utils";
import { normalizeAbcNote, parseNoteDuration } from "./melody-analyzer";

export interface BassMapEvent {
  beat: number;
  note: string;
}

export interface BassKickAlignment {
  beat: number;
  bassNote: string;
  kick: boolean;
}

export interface DrumGuidance {
  kickBeats: number[];
  snareBeats: number[];
  bassKickAlignment: BassKickAlignment[];
}

export interface MelodicGap {
  beat: number;
  type: "rest" | "sustain";
  duration: number;
}

export interface CounterMelodyEvent {
  beat: number;
  instrument: "strings";
  role: "rest-fill" | "sustain-fill";
  notes: string[];
  source: "melody-rest" | "melody-sustain";
}

export interface FullTrackExpansionMeasure {
  measureIndex: number;
  chord: string;
  bassMap: BassMapEvent[];
  drums: DrumGuidance;
  melodicGaps: MelodicGap[];
  counterMelodies: CounterMelodyEvent[];
}

export interface FrequencyRangeAssignment {
  family: "bass" | "accompaniment" | "melody" | "counter-melody" | "cymbals";
  range: "low" | "mid" | "high-mid" | "upper-mid" | "high";
  role: string;
}

export interface FullTrackExpansionStage {
  layer: {
    number: 3;
    name: "Drums & Additional Instruments";
    instrument: "full-track-expansion";
  };
  key: string;
  timeSignature: string;
  measures: FullTrackExpansionMeasure[];
  frequencyPlan: FrequencyRangeAssignment[];
  validation: {
    bassKickAligned: boolean;
    frequencyRangesAssigned: boolean;
    counterMelodiesUseGaps: boolean;
  };
  abc: string;
}

export interface FullTrackExpansionOptions {
  accompaniment: AccompanimentStage;
}

function buildBassMap(note: string): BassMapEvent[] {
  return [{ beat: 1, note }];
}

function buildDrums(bassMap: BassMapEvent[], beatCount: number): DrumGuidance {
  const kickBeats = beatCount >= 3 ? [1, 3] : [1];
  const snareBeats = beatCount >= 4 ? [2, 4] : [2].filter((beat) => beat <= beatCount);

  return {
    kickBeats,
    snareBeats,
    bassKickAlignment: bassMap.map((event) => ({
      beat: event.beat,
      bassNote: event.note,
      kick: kickBeats.includes(event.beat),
    })),
  };
}

function buildFrequencyPlan(accompaniment: AccompanimentStage): FrequencyRangeAssignment[] {
  const accompanimentName = accompaniment.layer.instrument === "piano" ? "Piano" : "Rhythm guitar";

  return [
    { family: "bass", range: "low", role: "Layer 2 bass anchors and kick drum fundamentals" },
    { family: "accompaniment", range: "mid", role: `${accompanimentName} chord body` },
    { family: "melody", range: "high-mid", role: "Primary vocal or lead melody" },
    { family: "counter-melody", range: "upper-mid", role: "Secondary fills during melodic gaps" },
    { family: "cymbals", range: "high", role: "Hi-hat and cymbal timekeeping above the melody" },
  ];
}

interface MelodySymbol {
  kind: "note" | "rest";
  beat: number;
  duration: number;
}

function extractMelodySymbolsByMeasure(abcString: string): MelodySymbol[][] {
  const body = abcString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Z]:/.test(line))
    .join(" ");
  const rawMeasures = body.split(/[|\]]/);
  const measures: MelodySymbol[][] = [];
  const symbolRegex = /([_^=]*[A-Ga-gz][,']*)([0-9]*\/?[0-9]*)/g;

  for (const rawMeasure of rawMeasures) {
    const trimmed = rawMeasure.trim().replace(/^[:\s]+|[:\s]+$/g, "");
    if (!trimmed || trimmed === ":" || trimmed === "::") continue;

    const symbols: MelodySymbol[] = [];
    let beat = 1;
    let match: RegExpExecArray | null;
    symbolRegex.lastIndex = 0;

    while ((match = symbolRegex.exec(trimmed)) !== null) {
      const duration = parseNoteDuration(match[2]) / 2;
      const kind = normalizeAbcNote(match[1]) === "Z" ? "rest" : "note";
      symbols.push({ kind, beat, duration });
      beat += duration;
    }

    if (symbols.length > 0) measures.push(symbols);
  }

  return measures;
}

function findMelodicGaps(symbols: MelodySymbol[] = []): MelodicGap[] {
  return symbols.flatMap<MelodicGap>((symbol) => {
    if (symbol.kind === "rest") {
      return [{ beat: symbol.beat, type: "rest", duration: symbol.duration }];
    }

    if (symbol.duration > 1) {
      return [{ beat: symbol.beat + 1, type: "sustain", duration: symbol.duration - 1 }];
    }

    return [];
  });
}

function buildCounterMelodies(measure: AccompanimentMeasure, gaps: MelodicGap[]): CounterMelodyEvent[] {
  const fillNotes = measure.notes.slice(1);

  return gaps.map((gap) => ({
    beat: gap.beat,
    instrument: "strings",
    role: gap.type === "rest" ? "rest-fill" : "sustain-fill",
    notes: fillNotes,
    source: gap.type === "rest" ? "melody-rest" : "melody-sustain",
  }));
}

export function generateFullTrackExpansionStage(
  abcString: string,
  options: FullTrackExpansionOptions
): FullTrackExpansionStage {
  const { accompaniment } = options;
  const beatCount = getBeatsPerMeasure(accompaniment.timeSignature);
  const melodySymbolsByMeasure = extractMelodySymbolsByMeasure(abcString);

  const measures = accompaniment.measures.map((measure) => {
    const bassMap = buildBassMap(measure.bassNote);
    const melodicGaps = findMelodicGaps(melodySymbolsByMeasure[measure.measureIndex]);
    return {
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      bassMap,
      drums: buildDrums(bassMap, beatCount),
      melodicGaps,
      counterMelodies: buildCounterMelodies(measure, melodicGaps),
    };
  });
  const frequencyPlan = buildFrequencyPlan(accompaniment);

  return {
    layer: {
      number: 3,
      name: "Drums & Additional Instruments",
      instrument: "full-track-expansion",
    },
    key: accompaniment.key,
    timeSignature: accompaniment.timeSignature,
    measures,
    frequencyPlan,
    validation: {
      bassKickAligned: measures.every((measure) =>
        measure.drums.bassKickAlignment.every((alignment) => alignment.kick)
      ),
      frequencyRangesAssigned: frequencyPlan.length === 5,
      counterMelodiesUseGaps: measures.every((measure) =>
        measure.counterMelodies.every((event) => measure.melodicGaps.some((gap) => gap.beat === event.beat))
      ),
    },
    abc: `V:Drums perc name="Layer 3 Drum Guidance"\n| ${measures.map(() => "K z S z").join(" | ")} |`,
  };
}
