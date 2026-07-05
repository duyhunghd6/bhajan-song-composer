import { AccompanimentStage } from "./accompaniment-stage";
import { getBeatsPerMeasure } from "./arranger-utils";
import { EnsembleIntegrationHandshake, generateEnsembleIntegrationHandshake } from "./ensemble-expander";
import type { EnsembleGenerationPlan } from "./ensemble-workflow";

export type DjembeStroke = "bass" | "mid-tone" | "slap";
export type DjembeEventSource = "layer2-bass-transient" | "unused-subdivision" | "backbeat";

export interface DjembeArrangementOptions {
  accompaniment: AccompanimentStage;
  handshake?: EnsembleIntegrationHandshake;
  plan?: EnsembleGenerationPlan["djembe"];
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

function buildMidToneEvents(
  handshake: EnsembleIntegrationHandshake,
  beatCount: number,
  plan?: EnsembleGenerationPlan["djembe"]
): DjembeEvent[] {
  if (plan?.density === "minimal" || plan?.fillPolicy === "none" || plan?.grooveProfile === "sparse") return [];

  return handshake.rhythmicDensityGrid.flatMap((slice) => {
    const offBeat = slice.beat + 0.5;
    if (offBeat > beatCount) return [];
    if (plan?.fillPolicy === "gap-only" && slice.layer1Active) return [];
    if (plan?.fillPolicy === "cadence-only" && slice.beat !== beatCount) return [];
    if (plan?.density === "moderate" && slice.beat % 2 === 0) return [];

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

function buildSlapEvents(handshake: EnsembleIntegrationHandshake, plan?: EnsembleGenerationPlan["djembe"]): DjembeEvent[] {
  if (plan?.backbeatSlaps === false || plan?.density === "minimal" || plan?.grooveProfile === "sparse") return [];

  return handshake.rhythmicDensityGrid
    .filter((slice) => slice.beat === 2 || slice.beat === 4)
    .filter((slice) => plan?.fillPolicy !== "gap-only" || !slice.layer1Active)
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

function strokeToAbc(stroke: DjembeStroke): string {
  if (stroke === "bass") return "C,";
  if (stroke === "slap") return "c";
  return "G";
}

function buildDjembeAbc(eventMap: DjembeEvent[], measureCount: number, beatCount: number): string {
  const subdivisions = beatCount * 2;
  const measures = Array.from({ length: measureCount }, (_, measureIndex) => {
    const tokens = Array.from({ length: subdivisions }, () => "z");
    for (const event of eventMap.filter((candidate) => candidate.measureIndex === measureIndex)) {
      const subdivisionIndex = Math.max(0, Math.min(subdivisions - 1, Math.round((event.beat - 1) * 2)));
      tokens[subdivisionIndex] = strokeToAbc(event.stroke);
    }
    return tokens.join(" ");
  });

  return `V:Djembe clef=perc name="Layer 3 Djembe Interlock"\n| ${measures.join(" | ")} |`;
}

export function generateDjembeArrangement(
  melodyAbc: string,
  options: DjembeArrangementOptions
): DjembeArrangement {
  const { accompaniment } = options;
  const plan = options.plan;
  const handshake = options.handshake ?? generateEnsembleIntegrationHandshake(melodyAbc, { accompaniment });
  const beatCount = getBeatsPerMeasure(accompaniment.timeSignature);
  const eventMap: DjembeEvent[] = plan?.bassSync === false ? [] : handshake.bassMap.map(buildBassEvent);
  const transientConflictReport: DjembeTransientConflict[] = [];

  for (const event of buildMidToneEvents(handshake, beatCount, plan)) {
    pushIfTransientIsFree(eventMap, transientConflictReport, event);
  }

  for (const event of buildSlapEvents(handshake, plan)) {
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
    abc: buildDjembeAbc(eventMap, accompaniment.measures.length, beatCount),
  };
}
