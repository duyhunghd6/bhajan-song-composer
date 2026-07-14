import type { DPCandidate, DPHandState, DPNoteEvent, DPResult, SkillLevel } from "./dp-types";
import { DPDiagnosticLogger, initialHandState, midiToNoteName } from "./dp-types";
import { snapshotCandidate, type TransitionCostBreakdown } from "./dp-diagnostics";
import { generateCandidatesDetailed } from "./dp-candidates";
import { transitionCostDetailed, applyCandidate } from "./dp-cost";
interface TrellisCell {
  candidate: DPCandidate;
  cumulativeCost: number;
  predecessorIndex: number;
  state: DPHandState;
  candidateIndex: number;
}
type ViterbiPass = "establish-grips" | "apply-grip-preferences";
export const RECURRING_SHAPE_MISMATCH_COST = 200;
function normalizeChord(chord: string): string {
  return chord.trim().replace(/\s+/g, "").toLowerCase();
}

function shapeKey(candidate: DPCandidate): string {
  return candidate.shapeFrets.map(fret => fret ?? "x").join(":");
}

interface RecurringShapeEvaluation {
  preferredShape: string | null;
  preferredShapeFeasible: boolean;
  matchesPreferredShape: boolean;
  penalty: number;
}

function recurringShapeEvaluation(
  event: DPNoteEvent,
  candidate: DPCandidate,
  candidates: DPCandidate[],
  preferredShapes?: ReadonlyMap<string, string>
): RecurringShapeEvaluation {
  const preferredShape = preferredShapes?.get(normalizeChord(event.chord)) ?? null;
  if (!preferredShape) {
    return { preferredShape, preferredShapeFeasible: false, matchesPreferredShape: false, penalty: 0 };
  }
  const preferredShapeFeasible = candidates.some(option => shapeKey(option) === preferredShape);
  const matchesPreferredShape = shapeKey(candidate) === preferredShape;
  return {
    preferredShape,
    preferredShapeFeasible,
    matchesPreferredShape,
    penalty: preferredShapeFeasible && !matchesPreferredShape ? RECURRING_SHAPE_MISMATCH_COST : 0,
  };
}

function formatCandidate(candidate: DPCandidate): string {
  const melody = candidate.melodyString !== null
    ? `mel:s${candidate.melodyString}/f${candidate.melodyFret}`
    : "mel:—";
  const bass = candidate.bassString !== null
    ? `bass:s${candidate.bassString}/f${candidate.bassFret}`
    : "bass:—";
  return `${melody} ${bass} pos=${candidate.handPosition}${candidate.usesBarre ? " [BARRE]" : ""}`;
}

function fallbackCandidate(state: DPHandState): DPCandidate {
  return {
    origin: "fallback-noop",
    melodyString: null,
    melodyFret: 0,
    bassString: null,
    bassFret: 0,
    melodyTechnique: "free-stroke",
    shapeFrets: [...state.frets],
    handPosition: state.handPosition,
    usesBarre: state.barreFret !== null,
  };
}

function emitCandidateGeneration(
  logger: DPDiagnosticLogger,
  pass: ViterbiPass,
  details: ReturnType<typeof generateCandidatesDetailed>
): void {
  logger.event({
    type: "candidate-generation",
    phase: "candidate-generation",
    pass,
    eventIndex: details.eventIndex,
    capo: details.capo,
    melodyPositionsTested: details.melodyPositionsTested,
    melodyPositionsAccepted: details.melodyPositions.length,
    bassPositionsTested: details.bassPositionsTested,
    bassPositionsAccepted: details.bassPositions.length,
    cartesianCombinationCount: details.cartesianCombinationCount,
    rejectionCounts: { ...details.rejectionCounts },
    acceptedBeforeCap: details.acceptedBeforeCap,
    candidateCap: details.candidateCap,
    retainedCount: details.retainedCount,
    prunedByCapCount: details.prunedByCapCount,
    sortKeys: [...details.sortKeys],
    retainedCandidates: details.retainedCandidates.map(snapshotCandidate),
  });
}

function bestPredecessorIndex(column: TrellisCell[]): number {
  let bestIndex = 0;
  let bestCost = Infinity;
  for (let index = 0; index < column.length; index++) {
    if (column[index].cumulativeCost < bestCost) {
      bestCost = column[index].cumulativeCost;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function appendFallbackColumn(input: {
  trellis: TrellisCell[][];
  pass: ViterbiPass;
  eventIndex: number;
  predecessorColumn: TrellisCell[] | null;
  logger: DPDiagnosticLogger;
}): void {
  const predecessorIndex = input.predecessorColumn ? bestPredecessorIndex(input.predecessorColumn) : -1;
  const predecessor = input.predecessorColumn?.[predecessorIndex];
  const state = predecessor?.state ?? initialHandState();
  const cumulativeCost = predecessor?.cumulativeCost ?? 0;
  const candidate = fallbackCandidate(state);
  input.logger.log("  ⚠ No feasible candidates — preserving predecessor hand state as fallback no-op");
  input.logger.event({
    type: "fallback-noop",
    phase: input.pass,
    severity: "warning",
    pass: input.pass,
    eventIndex: input.eventIndex,
    predecessorIndex,
    preservedState: {
      ...state,
      frets: [...state.frets],
      ringingUntil: [...state.ringingUntil],
    },
    reason: "no-feasible-candidates",
  });
  input.trellis.push([{
    candidate,
    cumulativeCost,
    predecessorIndex,
    state,
    candidateIndex: 0,
  }]);
  input.logger.event({
    type: "trellis-column",
    phase: input.pass,
    pass: input.pass,
    eventIndex: input.eventIndex,
    predecessorCount: input.predecessorColumn?.length ?? 1,
    candidateCount: 1,
    transitionCount: input.predecessorColumn?.length ?? 1,
    selectedPredecessors: [predecessorIndex],
  });
}

function runViterbiPass(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  capo: number,
  logger: DPDiagnosticLogger,
  pass: ViterbiPass,
  preferredShapes?: ReadonlyMap<string, string>
): DPResult {
  const startedAt = Date.now();
  logger.section("VITERBI OPTIMIZER");
  logger.entry("Pass", pass);
  logger.entry("Total events", events.length);
  logger.entry("Skill level", skillLevel);
  logger.entry("Capo", capo);
  logger.event({
    type: "viterbi-pass-started",
    phase: pass,
    pass,
    eventCount: events.length,
    skillLevel,
    capo,
  });

  if (events.length === 0) {
    logger.entry("Status", "No events to optimize");
    logger.event({
      type: "pass-summary",
      phase: pass,
      pass,
      totalCost: 0,
      pathLength: 0,
      unresolvedEventCount: 0,
      totalMovement: 0,
      techniqueDistribution: {},
      elapsedMs: Date.now() - startedAt,
    });
    return { path: [], totalCost: 0, capo, skillLevel, logs: logger.getLines(), diagnostics: logger.getDiagnostics() };
  }

  const trellis: TrellisCell[][] = [];
  const firstDetails = generateCandidatesDetailed(events[0], skillLevel, capo);
  emitCandidateGeneration(logger, pass, firstDetails);
  logger.section("STEP 0 — INITIALIZE");
  logger.entry("Event", `chord=${events[0].chord} mel=${midiToNoteName(events[0].melodyMidi)} bass=${midiToNoteName(events[0].bassMidi)} dur=${events[0].durationSteps}steps`);
  logger.entry("Candidates generated", firstDetails.retainedCount);

  if (firstDetails.retainedCount === 0) {
    appendFallbackColumn({ trellis, pass, eventIndex: 0, predecessorColumn: null, logger });
  } else {
    const initialState = initialHandState();
    const firstColumn = firstDetails.retainedCandidates.map((candidate, candidateIndex) => {
      const recurring = recurringShapeEvaluation(events[0], candidate, firstDetails.retainedCandidates, preferredShapes);
      const transition = transitionCostDetailed(initialState, candidate, events[0], skillLevel, {
        recurringShapePenalty: recurring.penalty,
        preferredShape: recurring.preferredShape,
        preferredShapeFeasible: recurring.preferredShapeFeasible,
        candidateShape: shapeKey(candidate),
      });
      const resolvedCandidate = { ...candidate, melodyTechnique: transition.technique };
      logger.event({
        type: "transition-evaluated",
        phase: pass,
        pass,
        eventIndex: 0,
        predecessorIndex: -1,
        candidateIndex,
        predecessorCost: 0,
        transition,
        cumulativeCost: transition.totalCost,
        selectedForCandidate: true,
        tieWithCurrentBest: false,
      });
      if (recurring.preferredShape) {
        logger.event({
          type: "recurring-shape",
          phase: pass,
          pass,
          action: "evaluated",
          eventIndex: 0,
          chord: normalizeChord(events[0].chord),
          preferredShape: recurring.preferredShape,
          candidateShape: shapeKey(candidate),
          feasible: recurring.preferredShapeFeasible,
          matches: recurring.matchesPreferredShape,
          penalty: recurring.penalty,
        });
      }
      if (candidateIndex < 5) logger.item(candidateIndex, `${formatCandidate(candidate)} → cost=${transition.totalCost.toFixed(2)}`);
      return {
        candidate: resolvedCandidate,
        cumulativeCost: transition.totalCost,
        predecessorIndex: -1,
        state: applyCandidate(initialState, resolvedCandidate, events[0]),
        candidateIndex,
      };
    });
    if (firstColumn.length > 5) logger.log(`  ... and ${firstColumn.length - 5} more candidates`);
    trellis.push(firstColumn);
    logger.event({
      type: "trellis-column",
      phase: pass,
      pass,
      eventIndex: 0,
      predecessorCount: 1,
      candidateCount: firstColumn.length,
      transitionCount: firstColumn.length,
      selectedPredecessors: firstColumn.map(() => -1),
    });
  }

  for (let time = 1; time < events.length; time++) {
    const event = events[time];
    const details = generateCandidatesDetailed(event, skillLevel, capo);
    const candidates = details.retainedCandidates;
    const previousColumn = trellis[time - 1];
    emitCandidateGeneration(logger, pass, details);
    logger.section(`STEP ${time} — FORWARD PASS`);
    logger.entry("Event", `chord=${event.chord} mel=${midiToNoteName(event.melodyMidi)} bass=${midiToNoteName(event.bassMidi)} dur=${event.durationSteps}steps`);
    logger.entry("Candidates", candidates.length);

    if (candidates.length === 0) {
      appendFallbackColumn({ trellis, pass, eventIndex: time, predecessorColumn: previousColumn, logger });
      continue;
    }

    const selectedPredecessors: number[] = [];
    const column = candidates.map((candidate, candidateIndex) => {
      const recurring = recurringShapeEvaluation(event, candidate, candidates, preferredShapes);
      const attempts: { predecessorIndex: number; predecessorCost: number; transition: TransitionCostBreakdown; total: number; tiedWhenEvaluated: boolean }[] = [];
      let bestPredecessorIndex = 0;
      let bestTotal = Infinity;

      for (let predecessorIndex = 0; predecessorIndex < previousColumn.length; predecessorIndex++) {
        const predecessor = previousColumn[predecessorIndex];
        const transition = transitionCostDetailed(predecessor.state, candidate, event, skillLevel, {
          recurringShapePenalty: recurring.penalty,
          preferredShape: recurring.preferredShape,
          preferredShapeFeasible: recurring.preferredShapeFeasible,
          candidateShape: shapeKey(candidate),
        });
        const total = predecessor.cumulativeCost + transition.totalCost;
        const tiedWhenEvaluated = total === bestTotal;
        attempts.push({ predecessorIndex, predecessorCost: predecessor.cumulativeCost, transition, total, tiedWhenEvaluated });
        if (total < bestTotal) {
          bestTotal = total;
          bestPredecessorIndex = predecessorIndex;
        }
      }

      for (const attempt of attempts) {
        logger.event({
          type: "transition-evaluated",
          phase: pass,
          pass,
          eventIndex: time,
          predecessorIndex: attempt.predecessorIndex,
          candidateIndex,
          predecessorCost: attempt.predecessorCost,
          transition: attempt.transition,
          cumulativeCost: attempt.total,
          selectedForCandidate: attempt.predecessorIndex === bestPredecessorIndex,
          tieWithCurrentBest: attempt.tiedWhenEvaluated,
        });
      }
      if (recurring.preferredShape) {
        logger.event({
          type: "recurring-shape",
          phase: pass,
          pass,
          action: "evaluated",
          eventIndex: time,
          chord: normalizeChord(event.chord),
          preferredShape: recurring.preferredShape,
          candidateShape: shapeKey(candidate),
          feasible: recurring.preferredShapeFeasible,
          matches: recurring.matchesPreferredShape,
          penalty: recurring.penalty,
        });
      }

      const selectedAttempt = attempts[bestPredecessorIndex] ?? attempts[0];
      const predecessorState = previousColumn[bestPredecessorIndex]?.state ?? initialHandState();
      const resolvedCandidate: DPCandidate = {
        ...candidate,
        melodyTechnique: selectedAttempt?.transition.technique ?? "free-stroke",
      };
      selectedPredecessors.push(bestPredecessorIndex);
      if (candidateIndex < 3) {
        logger.item(candidateIndex, `${formatCandidate(candidate)} ← prev[${bestPredecessorIndex}] trans=${selectedAttempt?.transition.totalCost.toFixed(2) ?? "Infinity"} tech=${resolvedCandidate.melodyTechnique} cumCost=${bestTotal.toFixed(2)}`);
      }
      return {
        candidate: resolvedCandidate,
        cumulativeCost: bestTotal,
        predecessorIndex: bestPredecessorIndex,
        state: applyCandidate(predecessorState, resolvedCandidate, event),
        candidateIndex,
      };
    });

    if (candidates.length > 3) logger.log(`  ... and ${candidates.length - 3} more candidates evaluated`);
    trellis.push(column);
    logger.event({
      type: "trellis-column",
      phase: pass,
      pass,
      eventIndex: time,
      predecessorCount: previousColumn.length,
      candidateCount: candidates.length,
      transitionCount: previousColumn.length * candidates.length,
      selectedPredecessors,
    });
  }

  const lastColumn = trellis[trellis.length - 1];
  const bestEndIndex = bestPredecessorIndex(lastColumn);
  const bestEndCost = lastColumn[bestEndIndex].cumulativeCost;
  const path: DPCandidate[] = new Array(events.length);
  let currentIndex = bestEndIndex;
  for (let time = events.length - 1; time >= 0; time--) {
    const cell = trellis[time][currentIndex];
    path[time] = cell.candidate;
    logger.event({
      type: "backtrack-step",
      phase: "backtrack",
      pass,
      eventIndex: time,
      candidateIndex: currentIndex,
      predecessorIndex: cell.predecessorIndex,
      candidate: snapshotCandidate(cell.candidate),
      cumulativeCost: cell.cumulativeCost,
    });
    currentIndex = cell.predecessorIndex;
  }

  logger.section("BACKTRACK — OPTIMAL PATH");
  logger.entry("Total cost", bestEndCost.toFixed(2));
  logger.entry("Path length", path.length);
  for (let time = 0; time < path.length; time++) {
    const candidate = path[time];
    const event = events[time];
    const positionJump = time > 0 ? Math.abs(candidate.handPosition - path[time - 1].handPosition) : 0;
    logger.item(time, [
      `chord=${event.chord}`,
      `mel=${midiToNoteName(event.melodyMidi)}→s${candidate.melodyString ?? "—"}/f${candidate.melodyFret}`,
      `bass=${midiToNoteName(event.bassMidi)}→s${candidate.bassString ?? "—"}/f${candidate.bassFret}`,
      `pos=${candidate.handPosition}`,
      positionJump > 0 ? `Δpos=${positionJump}` : "",
      `tech=${candidate.melodyTechnique}`,
      candidate.usesBarre ? "BARRE" : "",
      candidate.origin === "fallback-noop" ? "UNRESOLVED" : "",
    ].filter(Boolean).join(" | "));
  }

  const totalMovement = path.reduce((sum, candidate, index) =>
    index > 0 ? sum + Math.abs(candidate.handPosition - path[index - 1].handPosition) : sum, 0);
  const techniqueDistribution: Record<string, number> = {};
  for (const candidate of path) {
    techniqueDistribution[candidate.melodyTechnique] = (techniqueDistribution[candidate.melodyTechnique] ?? 0) + 1;
  }
  const unresolvedEventCount = path.filter(candidate => candidate.origin === "fallback-noop").length;
  logger.section("OPTIMIZATION SUMMARY");
  logger.entry("Total hand movement", `${totalMovement} frets across ${path.length} events`);
  logger.entry("Average movement/event", (totalMovement / Math.max(path.length, 1)).toFixed(2));
  logger.entry("Barre shapes used", path.filter(candidate => candidate.usesBarre).length);
  logger.entry("Technique distribution", Object.entries(techniqueDistribution).map(([technique, count]) => `${technique}:${count}`).join(", "));
  logger.entry("Unresolved events", unresolvedEventCount);
  logger.event({
    type: "pass-summary",
    phase: pass,
    pass,
    totalCost: bestEndCost,
    pathLength: path.length,
    unresolvedEventCount,
    totalMovement,
    techniqueDistribution,
    elapsedMs: Date.now() - startedAt,
  });

  return { path, totalCost: bestEndCost, capo, skillLevel, logs: logger.getLines(), diagnostics: logger.getDiagnostics() };
}

export function optimizeFingerstylePath(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  capo: number = 0,
  logger?: DPDiagnosticLogger
): DPResult {
  const ownsLogger = logger === undefined;
  const log = logger ?? new DPDiagnosticLogger();
  const startedAt = Date.now();
  const firstPass = runViterbiPass(events, skillLevel, capo, log, "establish-grips");
  const preferredShapes = new Map<string, string>();

  for (let index = 0; index < events.length && index < firstPass.path.length; index++) {
    const chord = normalizeChord(events[index].chord);
    const candidate = firstPass.path[index];
    if (chord && chord !== "n.c." && candidate.origin !== "fallback-noop" && !preferredShapes.has(chord)) {
      const shape = shapeKey(candidate);
      preferredShapes.set(chord, shape);
      log.event({
        type: "recurring-shape",
        phase: "grip-memory",
        pass: "establish-grips",
        action: "established",
        eventIndex: index,
        chord,
        preferredShape: shape,
      });
    }
  }

  log.section("CHORD SHAPE MEMORY");
  log.entry("Established chord shapes", preferredShapes.size);
  for (const [chord, shape] of preferredShapes) log.log(`  ${chord}: ${shape}`);
  const result = runViterbiPass(events, skillLevel, capo, log, "apply-grip-preferences", preferredShapes);

  if (ownsLogger) {
    const unresolvedEventCount = result.path.filter(candidate => candidate.origin === "fallback-noop").length;
    const outcome = !Number.isFinite(result.totalCost)
      ? "failed"
      : unresolvedEventCount > 0
        ? "accepted-with-unresolved-events"
        : result.path.length === 0
          ? "no-effective-dp-change"
          : "accepted";
    log.event({
      type: "run-summary",
      phase: "summary",
      outcome,
      inputEventCount: events.length,
      resolvedEventCount: events.length - unresolvedEventCount,
      unresolvedEventCount,
      changedEventCount: 0,
      unchangedEventCount: events.length,
      totalCost: result.totalCost,
      elapsedMs: Date.now() - startedAt,
    });
    log.collector.complete(outcome);
  }

  return { ...result, logs: log.getLines(), diagnostics: log.getDiagnostics() };
}
