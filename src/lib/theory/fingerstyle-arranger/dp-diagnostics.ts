import type { DPCandidate, DPHandState, FingerstyleTechnique, SkillLevel } from "./dp-types";

export const FINGERSTYLE_DIAGNOSTIC_SCHEMA_VERSION = "1.0.0" as const;

export type FingerstyleDiagnosticOutcome =
  | "accepted"
  | "accepted-with-unresolved-events"
  | "no-effective-dp-change"
  | "rolled-back"
  | "failed";

export type DPCandidateOrigin = "generated" | "rest" | "fallback-noop";

export const DP_CANDIDATE_REJECTION_REASONS = [
  "melody-below-open-string",
  "melody-above-max-fret",
  "bass-below-open-string",
  "bass-above-max-fret",
  "melody-pitch-verification",
  "bass-pitch-verification",
  "melody-bass-string-collision",
  "fixed-string-collision",
  "fret-span-exceeded",
  "barre-not-allowed",
  "skill-max-fret-exceeded",
  "skill-technique-forbidden",
] as const;

export type DPCandidateRejectionReason = typeof DP_CANDIDATE_REJECTION_REASONS[number];

export type DPDiagnosticPhase =
  | "configuration"
  | "extraction"
  | "candidate-generation"
  | "establish-grips"
  | "grip-memory"
  | "apply-grip-preferences"
  | "capo-sweep"
  | "backtrack"
  | "writeback"
  | "validation"
  | "rollback"
  | "summary";

export interface FingerstyleDiagnosticScope {
  songSlug?: string;
  lineIndex?: number;
  measureIndexes?: number[];
  sourceFingerprint?: string;
}

export interface TransitionMovementDiagnostic {
  fromPosition: number;
  toPosition: number;
  distance: number;
  movementSteps: number;
  availableSeconds: number;
  estimatedJumpSeconds: number;
  beatsAvailable: number;
  jumpPerBeat: number;
  jumpPerBeatLimit: number;
  classification: "stationary" | "insufficient-time" | "over-skill-limit" | "normal";
  cost: number;
}

export interface TransitionShapeDiagnostic {
  classification: "identical" | "guide-finger" | "slide-guide" | "full-change";
  guideFinger: boolean;
  slideGuide: { stringIndex: number; fromFret: number; toFret: number } | null;
  cost: number;
}

export interface TransitionCostBreakdown {
  technique: FingerstyleTechnique;
  movement: TransitionMovementDiagnostic;
  shape: TransitionShapeDiagnostic;
  sustain: {
    currentStep: number;
    interruptedStringIndexes: number[];
    costPerString: number;
    cost: number;
  };
  techniqueCost: number;
  barre: {
    usesBarre: boolean;
    consecutiveMeasures: number;
    cost: number;
  };
  placement: {
    melodyFretted: boolean;
    bassFretted: boolean;
    costPerFrettedNote: number;
    cost: number;
  };
  skill: {
    level: SkillLevel;
    allowed: boolean;
    maxFretUsed: number;
    maxFretAllowed: number;
    forbiddenTechnique: boolean;
    multiplier: number;
  };
  recurringShape: {
    preferredShape: string | null;
    candidateShape: string;
    preferredShapeFeasible: boolean;
    matchesPreferredShape: boolean;
    penalty: number;
  };
  baseCost: number;
  totalCost: number;
}

export interface DPCandidateDiagnosticSnapshot {
  origin: DPCandidateOrigin;
  melodyString: number | null;
  melodyFret: number;
  bassString: number | null;
  bassFret: number;
  shapeFrets: (number | null)[];
  handPosition: number;
  usesBarre: boolean;
  technique: FingerstyleTechnique;
}

interface DiagnosticEventBase {
  type: string;
  phase: DPDiagnosticPhase;
  sequence: number;
  timestamp: string;
  severity?: "info" | "warning" | "error";
}

export type FingerstyleDiagnosticEvent =
  | (DiagnosticEventBase & {
      type: "configuration";
      values: Record<string, unknown>;
      provenance: Record<string, "supplied" | "defaulted" | "derived" | "constant" | "unused">;
    })
  | (DiagnosticEventBase & {
      type: "input-extraction";
      source: "event-matrix" | "time-slice";
      measureCount: number;
      inputEventCount: number;
      extractedEventCount: number;
    })
  | (DiagnosticEventBase & {
      type: "input-binding";
      eventIndex: number;
      measureIndex: number;
      stepIndex: number;
      absoluteOnsetStep: number;
      durationSteps: number;
      movementSteps: number;
      movementSeconds: number;
      chord: string;
      normalizedChord: string;
      melodyTabIndex: number | null;
      bassTabIndex: number | null;
      authoritativeMelodyMidi: number | null;
      submittedMelodyMidi: number | null;
      effectiveMelodyMidi: number | null;
      bassMidi: number | null;
      bassPitchSource: "submitted-tab" | "none";
      fixedFrets: (number | null)[];
    })
  | (DiagnosticEventBase & {
      type: "input-anomaly";
      code: "unparseable-melody-pitch" | "missing-movable-tab" | "invalid-physical-position" | "duplicate-fixed-string-occupancy";
      eventIndex?: number;
      measureIndex?: number;
      stepIndex?: number;
      details: Record<string, unknown>;
    })
  | (DiagnosticEventBase & {
      type: "candidate-generation";
      pass: "establish-grips" | "apply-grip-preferences";
      eventIndex: number;
      capo: number;
      melodyPositionsTested: number;
      melodyPositionsAccepted: number;
      bassPositionsTested: number;
      bassPositionsAccepted: number;
      cartesianCombinationCount: number;
      rejectionCounts: Record<DPCandidateRejectionReason, number>;
      acceptedBeforeCap: number;
      candidateCap: number;
      retainedCount: number;
      prunedByCapCount: number;
      sortKeys: string[];
      retainedCandidates: DPCandidateDiagnosticSnapshot[];
    })
  | (DiagnosticEventBase & {
      type: "viterbi-pass-started";
      pass: "establish-grips" | "apply-grip-preferences";
      eventCount: number;
      skillLevel: SkillLevel;
      capo: number;
    })
  | (DiagnosticEventBase & {
      type: "transition-evaluated";
      pass: "establish-grips" | "apply-grip-preferences";
      eventIndex: number;
      predecessorIndex: number;
      candidateIndex: number;
      predecessorCost: number;
      transition: TransitionCostBreakdown;
      cumulativeCost: number;
      selectedForCandidate: boolean;
      tieWithCurrentBest: boolean;
    })
  | (DiagnosticEventBase & {
      type: "trellis-column";
      pass: "establish-grips" | "apply-grip-preferences";
      eventIndex: number;
      predecessorCount: number;
      candidateCount: number;
      transitionCount: number;
      selectedPredecessors: number[];
    })
  | (DiagnosticEventBase & {
      type: "recurring-shape";
      action: "established" | "evaluated";
      pass: "establish-grips" | "apply-grip-preferences";
      eventIndex: number;
      chord: string;
      preferredShape: string;
      candidateShape?: string;
      feasible?: boolean;
      matches?: boolean;
      penalty?: number;
    })
  | (DiagnosticEventBase & {
      type: "fallback-noop";
      pass: "establish-grips" | "apply-grip-preferences";
      eventIndex: number;
      predecessorIndex: number;
      preservedState: DPHandState;
      reason: "no-feasible-candidates";
    })
  | (DiagnosticEventBase & {
      type: "backtrack-step";
      pass: "establish-grips" | "apply-grip-preferences";
      eventIndex: number;
      candidateIndex: number;
      predecessorIndex: number;
      candidate: DPCandidateDiagnosticSnapshot;
      cumulativeCost: number;
    })
  | (DiagnosticEventBase & {
      type: "pass-summary";
      pass: "establish-grips" | "apply-grip-preferences";
      totalCost: number;
      pathLength: number;
      unresolvedEventCount: number;
      totalMovement: number;
      techniqueDistribution: Record<string, number>;
      elapsedMs: number;
    })
  | (DiagnosticEventBase & {
      type: "capo-tested";
      capo: number;
      transpositions: { eventIndex: number; melodyFrom: number | null; melodyTo: number | null; bassFrom: number | null; bassTo: number | null }[];
      totalCost: number;
      pathLength: number;
      unresolvedEventCount: number;
      selected: boolean;
    })
  | (DiagnosticEventBase & {
      type: "capo-selected";
      capo: number;
      totalCost: number;
      testedCount: number;
    })
  | (DiagnosticEventBase & {
      type: "writeback";
      eventIndex: number;
      measureIndex: number;
      stepIndex: number;
      role: "melody" | "bass";
      tabIndex: number;
      submitted: { string: number; fret: number; midi: number };
      selected: { string: number | null; fret: number; midi: number | null; origin: DPCandidateOrigin };
      requestedMidi: number | null;
      pitchInvariant: boolean;
      result: "changed" | "unchanged" | "unresolved" | "rejected";
    })
  | (DiagnosticEventBase & {
      type: "fixed-entry-check";
      measureIndex: number;
      stepIndex: number;
      tabIndex: number;
      role: string;
      unchanged: boolean;
    })
  | (DiagnosticEventBase & {
      type: "validation";
      measureIndex: number;
      beforeIssueCodes: string[];
      afterIssueCodes: string[];
      resolvedIssueCodes: string[];
      retainedIssueCodes: string[];
      introducedIssueCodes: string[];
      rollbackTriggered: boolean;
    })
  | (DiagnosticEventBase & {
      type: "rollback";
      reason: "path-binding-count-mismatch" | "pitch-invariant-failed" | "new-physics-issue";
      measureIndex?: number;
      eventIndex?: number;
      details: Record<string, unknown>;
    })
  | (DiagnosticEventBase & {
      type: "phase-timing";
      name: string;
      elapsedMs: number;
    })
  | (DiagnosticEventBase & {
      type: "run-summary";
      outcome: FingerstyleDiagnosticOutcome;
      inputEventCount: number;
      resolvedEventCount: number;
      unresolvedEventCount: number;
      changedEventCount: number;
      unchangedEventCount: number;
      totalCost: number;
      elapsedMs: number;
    })
  | (DiagnosticEventBase & {
      type: "truncation";
      omittedEventCount: number;
      reason: "event-budget" | "byte-budget";
    });

export type FingerstyleDiagnosticEventInput = FingerstyleDiagnosticEvent extends infer Event
  ? Event extends FingerstyleDiagnosticEvent
    ? Omit<Event, "sequence" | "timestamp">
    : never
  : never;

export interface FingerstyleDiagnosticRun {
  schemaVersion: typeof FINGERSTYLE_DIAGNOSTIC_SCHEMA_VERSION;
  runId: string;
  startedAt: string;
  completedAt?: string;
  scope: FingerstyleDiagnosticScope;
  outcome?: FingerstyleDiagnosticOutcome;
  events: FingerstyleDiagnosticEvent[];
}

export interface DiagnosticProjectionOptions {
  maxEvents?: number;
  maxBytes?: number;
}

const PROJECTION_REQUIRED_TYPES = new Set<FingerstyleDiagnosticEvent["type"]>([
  "configuration",
  "input-anomaly",
  "fallback-noop",
  "capo-selected",
  "writeback",
  "fixed-entry-check",
  "validation",
  "rollback",
  "run-summary",
]);

let fallbackRunSequence = 0;

export function createFingerstyleDiagnosticRunId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  fallbackRunSequence += 1;
  return `dp-${Date.now().toString(36)}-${fallbackRunSequence.toString(36)}`;
}

export function snapshotCandidate(candidate: DPCandidate): DPCandidateDiagnosticSnapshot {
  return {
    origin: candidate.origin ?? "generated",
    melodyString: candidate.melodyString,
    melodyFret: candidate.melodyFret,
    bassString: candidate.bassString,
    bassFret: candidate.bassFret,
    shapeFrets: [...candidate.shapeFrets],
    handPosition: candidate.handPosition,
    usesBarre: candidate.usesBarre,
    technique: candidate.melodyTechnique,
  };
}

export class FingerstyleDiagnosticCollector {
  private readonly run: FingerstyleDiagnosticRun;

  constructor(input: { runId?: string; scope?: FingerstyleDiagnosticScope; startedAt?: string } = {}) {
    this.run = {
      schemaVersion: FINGERSTYLE_DIAGNOSTIC_SCHEMA_VERSION,
      runId: input.runId ?? createFingerstyleDiagnosticRunId(),
      startedAt: input.startedAt ?? new Date().toISOString(),
      scope: { ...(input.scope ?? {}) },
      events: [],
    };
  }

  emit(input: FingerstyleDiagnosticEventInput): FingerstyleDiagnosticEvent {
    const event = {
      ...input,
      sequence: this.run.events.length,
      timestamp: new Date().toISOString(),
    } as FingerstyleDiagnosticEvent;
    this.run.events.push(event);
    return event;
  }

  complete(outcome: FingerstyleDiagnosticOutcome): FingerstyleDiagnosticRun {
    this.run.outcome = outcome;
    this.run.completedAt = new Date().toISOString();
    return this.getRun();
  }

  getRun(): FingerstyleDiagnosticRun {
    return {
      ...this.run,
      scope: { ...this.run.scope },
      events: [...this.run.events],
    };
  }

  project(options: DiagnosticProjectionOptions = {}): FingerstyleDiagnosticRun {
    const maxEvents = options.maxEvents ?? 500;
    const maxBytes = options.maxBytes ?? 256_000;
    const required = this.run.events.filter(event => PROJECTION_REQUIRED_TYPES.has(event.type));
    const optional = this.run.events.filter(event => !PROJECTION_REQUIRED_TYPES.has(event.type));
    const selected = [...required];
    let bytes = JSON.stringify({ ...this.run, events: selected }).length;

    for (let index = optional.length - 1; index >= 0 && selected.length < maxEvents; index--) {
      const event = optional[index];
      const eventBytes = JSON.stringify(event).length;
      if (bytes + eventBytes > maxBytes) continue;
      selected.push(event);
      bytes += eventBytes;
    }

    selected.sort((left, right) => left.sequence - right.sequence);
    const omittedEventCount = this.run.events.length - selected.length;
    if (omittedEventCount > 0) {
      selected.push({
        type: "truncation",
        phase: "summary",
        severity: "warning",
        sequence: this.run.events.length,
        timestamp: new Date().toISOString(),
        omittedEventCount,
        reason: selected.length >= maxEvents ? "event-budget" : "byte-budget",
      });
    }

    return { ...this.getRun(), events: selected };
  }
}

export function renderLegacyDiagnosticEvents(events: readonly FingerstyleDiagnosticEvent[]): string[] {
  return events.map(event => {
    switch (event.type) {
      case "fallback-noop":
        return `  ⚠ Event ${event.eventIndex}: no feasible candidates — preserving predecessor hand state`;
      case "capo-tested":
        return `  [${event.capo}] capo ${event.capo} → totalCost=${event.totalCost.toFixed(2)}`;
      case "rollback":
        return `  ⚠ DP rollback: ${event.reason}`;
      case "run-summary":
        return `  Outcome: ${event.outcome}; resolved=${event.resolvedEventCount}; unresolved=${event.unresolvedEventCount}; changed=${event.changedEventCount}`;
      default:
        return `  [diagnostic:${event.type}]`;
    }
  });
}
