import { DjembeArrangement, DjembeEvent } from "./djembe-arranger";
import { EnsembleIntegrationHandshake } from "./ensemble-expander";
import {
  OrchestralSupportArrangement,
  OrchestralSupportEvent,
} from "./orchestral-arranger";

export type EnsembleConflictAction =
  | "flattened-flute-run"
  | "flattened-violin-run"
  | "removed-djembe-fill";

export interface EnsembleConflictResolutionInput {
  handshake: EnsembleIntegrationHandshake;
  djembe: DjembeArrangement;
  orchestral: OrchestralSupportArrangement;
}

export interface EnsembleConflictReportEntry {
  measureIndex: number;
  beat: number;
  startMs: number;
  layer1Preserved: boolean;
  actions: EnsembleConflictAction[];
  overloadResolved: boolean;
}

export interface EnsembleConflictResolution {
  djembe: DjembeArrangement;
  orchestral: OrchestralSupportArrangement;
  report: EnsembleConflictReportEntry[];
}

const BACKGROUND_VELOCITY = 64;
const OVERLOAD_LAYER_LIMIT = 4;

function eventKey(event: Pick<OrchestralSupportEvent | DjembeEvent, "measureIndex" | "startMs">): string {
  return `${event.measureIndex}:${event.startMs}`;
}

function flattenRun(event: OrchestralSupportEvent): OrchestralSupportEvent {
  return {
    ...event,
    mode: "background",
    source: "layer1-active",
    velocity: Math.min(event.velocity, BACKGROUND_VELOCITY),
  };
}

function isDjembeFill(event: DjembeEvent): boolean {
  return event.source === "unused-subdivision" || event.source === "backbeat";
}

function activeCountAt(
  key: string,
  orchestral: OrchestralSupportArrangement,
  djembeEvents: DjembeEvent[]
): number {
  const fluteActive = orchestral.fluteSupportMap.some((event) => eventKey(event) === key && event.mode === "fill");
  const violinActive = orchestral.violinSupportMap.some((event) => eventKey(event) === key && event.mode === "fill");
  const djembeActive = djembeEvents.some((event) => eventKey(event) === key && isDjembeFill(event));

  return Number(fluteActive) + Number(violinActive) + Number(djembeActive);
}

export function resolveEnsembleConflicts(input: EnsembleConflictResolutionInput): EnsembleConflictResolution {
  const orchestral: OrchestralSupportArrangement = {
    ...input.orchestral,
    fluteSupportMap: [...input.orchestral.fluteSupportMap],
    violinSupportMap: [...input.orchestral.violinSupportMap],
    fluteBreathMap: [...input.orchestral.fluteBreathMap],
    violinExpressionMap: [...input.orchestral.violinExpressionMap],
    yieldDecisions: [...input.orchestral.yieldDecisions],
  };
  let djembeEventMap = [...input.djembe.eventMap];
  const report: EnsembleConflictReportEntry[] = [];

  for (const slice of input.handshake.rhythmicDensityGrid) {
    if (!slice.layer1Active) continue;

    const key = eventKey(slice);
    const fluteIndexes = orchestral.fluteSupportMap
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => eventKey(event) === key && event.mode === "fill")
      .map(({ index }) => index);
    const violinIndexes = orchestral.violinSupportMap
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => eventKey(event) === key && event.mode === "fill")
      .map(({ index }) => index);
    const hasDjembe = djembeEventMap.some((event) => eventKey(event) === key && isDjembeFill(event));
    const overloaded = slice.activeLayerCount + Number(fluteIndexes.length > 0) + Number(violinIndexes.length > 0) + Number(hasDjembe) >= OVERLOAD_LAYER_LIMIT;

    if (!overloaded) continue;

    const actions: EnsembleConflictAction[] = [];

    for (const index of fluteIndexes) {
      orchestral.fluteSupportMap[index] = flattenRun(orchestral.fluteSupportMap[index]);
      actions.push("flattened-flute-run");
    }

    for (const index of violinIndexes) {
      orchestral.violinSupportMap[index] = flattenRun(orchestral.violinSupportMap[index]);
      actions.push("flattened-violin-run");
    }

    if (actions.includes("flattened-flute-run") || actions.includes("flattened-violin-run")) {
      orchestral.yieldDecisions = orchestral.yieldDecisions.map((decision) => {
        if (eventKey(decision) !== key) return decision;

        return {
          ...decision,
          layer1Active: true,
          fluteMode: actions.includes("flattened-flute-run") ? "background" : decision.fluteMode,
          violinMode: actions.includes("flattened-violin-run") ? "background" : decision.violinMode,
          reason: "Density overload during Layer 1 melody; Flute and Violin yields were flattened to sustained background tones",
        };
      });
    }

    const remainingActiveCount = slice.activeLayerCount + activeCountAt(key, orchestral, djembeEventMap);

    if (remainingActiveCount > OVERLOAD_LAYER_LIMIT) {
      const beforeCount = djembeEventMap.length;
      djembeEventMap = djembeEventMap.filter((event) => eventKey(event) !== key || !isDjembeFill(event));
      if (djembeEventMap.length < beforeCount) actions.push("removed-djembe-fill");
    }

    report.push({
      measureIndex: slice.measureIndex,
      beat: slice.beat,
      startMs: slice.startMs,
      layer1Preserved: true,
      actions,
      overloadResolved: slice.activeLayerCount + activeCountAt(key, orchestral, djembeEventMap) <= OVERLOAD_LAYER_LIMIT,
    });
  }

  return {
    djembe: {
      ...input.djembe,
      eventMap: djembeEventMap,
    },
    orchestral,
    report,
  };
}
