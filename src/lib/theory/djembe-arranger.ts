import { AccompanimentStage } from "./accompaniment-stage";
import { getBeatsPerMeasure } from "./arranger-utils";
import { EnsembleIntegrationHandshake, generateEnsembleIntegrationHandshake } from "./ensemble-expander";

export type DjembeStroke = "bass" | "mid-tone" | "slap";
export type DjembeEventSource = "layer2-bass-transient" | "unused-subdivision" | "backbeat";

export interface DjembeArrangementOptions {
  accompaniment: AccompanimentStage;
  handshake?: EnsembleIntegrationHandshake;
}

export interface DjembeEvent {
  measureIndex: number;
  beat: number;
  startMs: number;
  durationMs: number;
  stroke: DjembeStroke;
  velocity: number;
  source: DjembeEventSource;
}

export interface DjembeTransientConflict {
  measureIndex: number;
  beat: number;
  startMs: number;
  skippedStroke: DjembeStroke;
  reason: string;
}

export interface DjembeArrangement {
  eventMap: DjembeEvent[];
  transientConflictReport: DjembeTransientConflict[];
  validation: {
    bassStrokesFollowLayer2Bass: boolean;
    velocityMetadataAssigned: boolean;
    transientConflictsAvoided: boolean;
  };
  abc: string;
}

const STROKE_DURATION_MS = 125;
const BASS_VELOCITY = 96;
const MID_TONE_VELOCITY = 58;
const SLAP_VELOCITY = 88;

function transientKey(event: Pick<DjembeEvent, "measureIndex" | "startMs">): string {
  return `${event.measureIndex}:${event.startMs}`;
}

function buildBassEvent(event: EnsembleIntegrationHandshake["bassMap"][number]): DjembeEvent {
  return {
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: STROKE_DURATION_MS,
    stroke: "bass",
    velocity: BASS_VELOCITY,
    source: "layer2-bass-transient",
  };
}

function pushIfTransientIsFree(
  eventMap: DjembeEvent[],
  transientConflictReport: DjembeTransientConflict[],
  event: DjembeEvent
): void {
  const existing = eventMap.find((candidate) => transientKey(candidate) === transientKey(event));

  if (existing) {
    transientConflictReport.push({
      measureIndex: event.measureIndex,
      beat: event.beat,
      startMs: event.startMs,
      skippedStroke: event.stroke,
      reason: `Skipped ${event.stroke} because a ${existing.stroke} stroke already owns this transient`,
    });
    return;
  }

  eventMap.push(event);
}

function buildMidToneEvents(handshake: EnsembleIntegrationHandshake, beatCount: number): DjembeEvent[] {
  return handshake.rhythmicDensityGrid.flatMap((slice) => {
    const offBeat = slice.beat + 0.5;
    if (offBeat > beatCount) return [];

    return [{
      measureIndex: slice.measureIndex,
      beat: offBeat,
      startMs: slice.startMs + Math.round(slice.durationMs / 2),
      durationMs: STROKE_DURATION_MS,
      stroke: "mid-tone" as const,
      velocity: MID_TONE_VELOCITY,
      source: "unused-subdivision" as const,
    }];
  });
}

function buildSlapEvents(handshake: EnsembleIntegrationHandshake): DjembeEvent[] {
  return handshake.rhythmicDensityGrid
    .filter((slice) => slice.beat === 2 || slice.beat === 4)
    .map((slice) => ({
      measureIndex: slice.measureIndex,
      beat: slice.beat,
      startMs: slice.startMs,
      durationMs: STROKE_DURATION_MS,
      stroke: "slap" as const,
      velocity: SLAP_VELOCITY,
      source: "backbeat" as const,
    }));
}

function eventSort(a: DjembeEvent, b: DjembeEvent): number {
  return a.measureIndex - b.measureIndex || a.startMs - b.startMs;
}

export function generateDjembeArrangement(
  melodyAbc: string,
  options: DjembeArrangementOptions
): DjembeArrangement {
  const { accompaniment } = options;
  const handshake = options.handshake ?? generateEnsembleIntegrationHandshake(melodyAbc, { accompaniment });
  const beatCount = getBeatsPerMeasure(accompaniment.timeSignature);
  const eventMap: DjembeEvent[] = handshake.bassMap.map(buildBassEvent);
  const transientConflictReport: DjembeTransientConflict[] = [];

  for (const event of buildMidToneEvents(handshake, beatCount)) {
    pushIfTransientIsFree(eventMap, transientConflictReport, event);
  }

  for (const event of buildSlapEvents(handshake)) {
    pushIfTransientIsFree(eventMap, transientConflictReport, event);
  }

  eventMap.sort(eventSort);
  const transientKeys = eventMap.map(transientKey);

  return {
    eventMap,
    transientConflictReport,
    validation: {
      bassStrokesFollowLayer2Bass: eventMap
        .filter((event) => event.stroke === "bass")
        .every((event) =>
          handshake.bassMap.some((bass) =>
            bass.measureIndex === event.measureIndex &&
            bass.beat === event.beat &&
            bass.startMs === event.startMs
          )
        ),
      velocityMetadataAssigned: eventMap.every((event) => event.velocity > 0),
      transientConflictsAvoided: new Set(transientKeys).size === transientKeys.length,
    },
    abc: `V:Djembe perc name="Layer 3 Djembe Interlock"\n| ${accompaniment.measures.map(() => "B m S m").join(" | ")} |`,
  };
}
