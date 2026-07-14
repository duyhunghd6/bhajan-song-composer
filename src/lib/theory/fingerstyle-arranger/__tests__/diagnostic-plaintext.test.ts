import { describe, expect, it } from "vitest";

import { renderFingerstyleDiagnosticPlaintext } from "../diagnostic-plaintext";
import { applyDPToTimeSliceMeasures } from "../dp-integration";
import {
  projectDpDiagnosticEvents,
  summaryFromDpRun,
  type FingerstyleGenerationDiagnosticEvent,
} from "../generation-diagnostics";
import type { TimeSliceGridStep, TimeSliceMeasure } from "../time-slice";

function makeMeasure(): TimeSliceMeasure {
  const grid: TimeSliceGridStep[] = Array.from({ length: 16 }, (_, index) => ({
    step: index + 1,
    chord: "Em",
    weight: index === 0 ? "⬤" : null,
    melody: {
      pitch: index === 0 ? "E4" : null,
      state: index === 0 ? "attack" : "rest",
    },
    lyric: null,
    tablature: index === 0
      ? [
          { string: 3, fret: 0, finger: "i", role: "melody" },
          { string: 6, fret: 0, finger: "p", role: "root" },
        ]
      : [],
  }));

  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA devotional fingerstyle",
      voicing_plan: "Open Em",
      fill_density: "few",
    },
    grid,
  };
}

describe("renderFingerstyleDiagnosticPlaintext", () => {
  it("renders inputs, candidate funnels, both Viterbi passes, costs, and validation as copyable text", () => {
    const result = applyDPToTimeSliceMeasures([makeMeasure()], 120, {
      skillLevel: "intermediate",
      capo: 0,
      autoCapo: false,
    });
    const runId = "test-run";
    const llmEvent: FingerstyleGenerationDiagnosticEvent = {
      id: `${runId}-llm-0`,
      runId,
      sequence: 0,
      createdAt: "2026-07-14T00:00:00.000Z",
      source: "llm",
      kind: "chat-request",
      phase: "llm-tool-loop",
      status: "started",
      message: "Sending source measure to the arranger.",
    };
    const events = [
      llmEvent,
      ...projectDpDiagnosticEvents(runId, result.diagnostics, 1),
    ];
    const summary = summaryFromDpRun(result.diagnostics, 0);

    const plaintext = renderFingerstyleDiagnosticPlaintext({
      runId,
      startedAt: "2026-07-14T00:00:00.000Z",
      completedAt: "2026-07-14T00:00:01.000Z",
      scope: {
        songSlug: "ganesha",
        lineIndex: 0,
        measureIndexes: [1],
        sourceFingerprint: "source-test",
      },
      events,
      summary,
    });

    expect(plaintext).toContain("FINGERSTYLE LLM + DP DIAGNOSTIC VISUALIZATION (PLAINTEXT)");
    expect(plaintext).toContain("LLM TOOL-LOOP TIMELINE");
    expect(plaintext).toContain("DP INPUTS AND EFFECTIVE CONDITIONS");
    expect(plaintext).toContain("DP DECISION INPUTS");
    expect(plaintext).toContain("CANDIDATE FUNNELS");
    expect(plaintext).toContain("PASS: establish-grips");
    expect(plaintext).toContain("PASS: apply-grip-preferences");
    expect(plaintext).toContain("VITERBI TRELLIS");
    expect(plaintext).toContain("SELECTED PATH AND COST BREAKDOWN");
    expect(plaintext).toContain("movement=");
    expect(plaintext).toContain("recurring=");
    expect(plaintext).toContain("WRITEBACK AND VALIDATION");
    expect(plaintext).toContain("END FINGERSTYLE DIAGNOSTICS");
  });
});
