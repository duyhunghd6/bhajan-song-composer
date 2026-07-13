import type { DPCandidate, DPHandState, DPNoteEvent, DPResult, SkillLevel } from "./dp-types";
import { DPDiagnosticLogger, initialHandState, midiToNoteName, indexToString } from "./dp-types";
import { generateCandidates } from "./dp-candidates";
import { transitionCost, applyCandidate, detectBestTechnique } from "./dp-cost";

// ---------------------------------------------------------------------------
// Viterbi Trellis
// ---------------------------------------------------------------------------

interface TrellisCell {
  /** The candidate at this cell. */
  candidate: DPCandidate;
  /** Cumulative minimum cost to reach this cell. */
  cumulativeCost: number;
  /** Index of the predecessor cell in the previous time step's candidate array. */
  predecessorIndex: number;
  /** Hand state after applying this candidate. */
  state: DPHandState;
}

/** Format a candidate for logging. */
function formatCandidate(c: DPCandidate): string {
  const mel = c.melodyString !== null
    ? `mel:s${c.melodyString}/f${c.melodyFret}`
    : "mel:—";
  const bass = c.bassString !== null
    ? `bass:s${c.bassString}/f${c.bassFret}`
    : "bass:—";
  const barre = c.usesBarre ? " [BARRE]" : "";
  return `${mel} ${bass} pos=${c.handPosition}${barre}`;
}

/** Format a shape frets array for logging. */
function formatShape(frets: (number | null)[]): string {
  return frets.map((f, i) => {
    const s = indexToString(i);
    return f !== null ? `s${s}:${f}` : `s${s}:x`;
  }).join(" ");
}

/**
 * Run the Viterbi algorithm to find the minimum-cost path through the
 * space of hand-shape candidates across all events.
 *
 * Complexity: O(N × K²) where N = number of events, K = candidates per event.
 * With K capped at 20 and N typically < 200, this runs in ~80K iterations.
 */
export function optimizeFingerstylePath(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  capo: number = 0,
  logger?: DPDiagnosticLogger
): DPResult {
  const log = logger ?? new DPDiagnosticLogger();

  if (events.length === 0) {
    log.section("VITERBI OPTIMIZER");
    log.entry("Status", "No events to optimize");
    return { path: [], totalCost: 0, capo, skillLevel, logs: log.getLines() };
  }

  log.section("VITERBI OPTIMIZER");
  log.entry("Total events", events.length);
  log.entry("Skill level", skillLevel);
  log.entry("Capo", capo);

  // === Build the trellis ===
  const trellis: TrellisCell[][] = [];

  // --- Step 0: Initialize the first column ---
  const firstCandidates = generateCandidates(events[0], skillLevel, capo);
  if (firstCandidates.length === 0) {
    log.log("  ⚠ No feasible candidates for first event — ABORT");
    return { path: [], totalCost: Infinity, capo, skillLevel, logs: log.getLines() };
  }

  log.section("STEP 0 — INITIALIZE");
  log.entry("Event", `chord=${events[0].chord} mel=${midiToNoteName(events[0].melodyMidi)} bass=${midiToNoteName(events[0].bassMidi)} dur=${events[0].durationSteps}steps`);
  log.entry("Candidates generated", firstCandidates.length);

  const init = initialHandState();
  const firstColumn: TrellisCell[] = firstCandidates.map((candidate, ci) => {
    const cost = transitionCost(init, candidate, events[0], skillLevel);
    const cell = {
      candidate,
      cumulativeCost: cost,
      predecessorIndex: -1,
      state: applyCandidate(init, candidate, events[0]),
    };
    if (ci < 5) { // Log top 5 candidates for readability
      log.item(ci, `${formatCandidate(candidate)} → cost=${cost.toFixed(2)}`);
    }
    return cell;
  });
  if (firstCandidates.length > 5) {
    log.log(`  ... and ${firstCandidates.length - 5} more candidates`);
  }
  trellis.push(firstColumn);

  // --- Forward pass ---
  for (let t = 1; t < events.length; t++) {
    const event = events[t];
    const candidates = generateCandidates(event, skillLevel, capo);
    const prevColumn = trellis[t - 1];

    log.section(`STEP ${t} — FORWARD PASS`);
    log.entry("Event", `chord=${event.chord} mel=${midiToNoteName(event.melodyMidi)} bass=${midiToNoteName(event.bassMidi)} dur=${event.durationSteps}steps`);
    log.entry("Candidates", candidates.length);

    if (candidates.length === 0) {
      const noOp: DPCandidate = {
        melodyString: null,
        melodyFret: 0,
        bassString: null,
        bassFret: 0,
        melodyTechnique: "free-stroke",
        shapeFrets: [null, null, null, null, null, null],
        handPosition: 0,
        usesBarre: false,
      };

      let bestPrev = 0;
      let bestCost = Infinity;
      for (let p = 0; p < prevColumn.length; p++) {
        const cost = prevColumn[p].cumulativeCost;
        if (cost < bestCost) {
          bestCost = cost;
          bestPrev = p;
        }
      }

      log.log("  ⚠ No feasible candidates — inserting no-op rest");
      log.entry("Best predecessor", `cell[${bestPrev}] cumCost=${bestCost.toFixed(2)}`);

      trellis.push([{
        candidate: noOp,
        cumulativeCost: bestCost,
        predecessorIndex: bestPrev,
        state: prevColumn[bestPrev].state,
      }]);
      continue;
    }

    const column: TrellisCell[] = candidates.map((candidate, ci) => {
      let bestPrevIndex = 0;
      let bestTotal = Infinity;
      let bestState: DPHandState = initialHandState();
      let bestTransCost = Infinity;
      let bestTechnique: string = "free-stroke";

      for (let p = 0; p < prevColumn.length; p++) {
        const prevCell = prevColumn[p];
        const tCost = transitionCost(prevCell.state, candidate, event, skillLevel);
        const total = prevCell.cumulativeCost + tCost;

        if (total < bestTotal) {
          bestTotal = total;
          bestPrevIndex = p;
          bestState = prevCell.state;
          bestTransCost = tCost;
          bestTechnique = detectBestTechnique(prevCell.state, candidate, event, skillLevel);
        }
      }

      if (ci < 3) { // Log top 3 for each step
        log.item(ci, `${formatCandidate(candidate)} ← prev[${bestPrevIndex}] trans=${bestTransCost.toFixed(2)} tech=${bestTechnique} cumCost=${bestTotal.toFixed(2)}`);
      }

      // Write the detected technique back onto the candidate so
      // the backtracked path carries the correct technique (not just "free-stroke")
      const resolvedCandidate: DPCandidate = {
        ...candidate,
        melodyTechnique: bestTechnique as DPCandidate["melodyTechnique"],
      };

      return {
        candidate: resolvedCandidate,
        cumulativeCost: bestTotal,
        predecessorIndex: bestPrevIndex,
        state: applyCandidate(bestState, resolvedCandidate, event),
      };
    });

    if (candidates.length > 3) {
      log.log(`  ... and ${candidates.length - 3} more candidates evaluated`);
    }

    trellis.push(column);
  }

  // --- Backtrack: extract the optimal path ---
  const lastColumn = trellis[trellis.length - 1];
  let bestEndIndex = 0;
  let bestEndCost = Infinity;
  for (let i = 0; i < lastColumn.length; i++) {
    if (lastColumn[i].cumulativeCost < bestEndCost) {
      bestEndCost = lastColumn[i].cumulativeCost;
      bestEndIndex = i;
    }
  }

  const path: DPCandidate[] = new Array(events.length);
  let currentIndex = bestEndIndex;
  for (let t = events.length - 1; t >= 0; t--) {
    const cell = trellis[t][currentIndex];
    path[t] = cell.candidate;
    currentIndex = cell.predecessorIndex;
  }

  // --- Log the optimal path ---
  log.section("BACKTRACK — OPTIMAL PATH");
  log.entry("Total cost", bestEndCost.toFixed(2));
  log.entry("Path length", path.length);

  for (let t = 0; t < path.length; t++) {
    const c = path[t];
    const ev = events[t];
    const tech = c.melodyTechnique;
    const posJump = t > 0 ? Math.abs(c.handPosition - path[t - 1].handPosition) : 0;

    log.item(t, [
      `chord=${ev.chord}`,
      `mel=${midiToNoteName(ev.melodyMidi)}→s${c.melodyString ?? "—"}/f${c.melodyFret}`,
      `bass=${midiToNoteName(ev.bassMidi)}→s${c.bassString ?? "—"}/f${c.bassFret}`,
      `pos=${c.handPosition}`,
      posJump > 0 ? `Δpos=${posJump}` : "",
      `tech=${tech}`,
      c.usesBarre ? "BARRE" : "",
    ].filter(Boolean).join(" | "));
  }

  // --- Summary statistics ---
  log.section("OPTIMIZATION SUMMARY");
  const totalMovement = path.reduce((sum, c, i) =>
    i > 0 ? sum + Math.abs(c.handPosition - path[i - 1].handPosition) : sum, 0
  );
  const barreCount = path.filter(c => c.usesBarre).length;
  const techniques = new Map<string, number>();
  for (const c of path) {
    techniques.set(c.melodyTechnique, (techniques.get(c.melodyTechnique) ?? 0) + 1);
  }

  log.entry("Total hand movement", `${totalMovement} frets across ${path.length} events`);
  log.entry("Average movement/event", (totalMovement / Math.max(path.length, 1)).toFixed(2));
  log.entry("Barre shapes used", barreCount);
  log.entry("Technique distribution", [...techniques.entries()].map(([t, n]) => `${t}:${n}`).join(", "));

  return {
    path,
    totalCost: bestEndCost,
    capo,
    skillLevel,
    logs: log.getLines(),
  };
}
