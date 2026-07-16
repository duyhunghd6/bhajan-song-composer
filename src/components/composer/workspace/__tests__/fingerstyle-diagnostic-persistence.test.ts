import { describe, expect, it } from "vitest";

import type { FingerstyleGenerationDiagnosticRun } from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";
import {
  persistFingerstyleDiagnosticRun,
  restoreFingerstyleDiagnosticRuns,
} from "../fingerstyle-diagnostic-persistence";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function makeRun(index: number, lineIndex = 0): FingerstyleGenerationDiagnosticRun {
  const runId = `run-${index}`;
  return {
    version: 2,
    runId,
    startedAt: `2026-07-14T00:00:${String(index).padStart(2, "0")}.000Z`,
    completedAt: `2026-07-14T00:01:${String(index).padStart(2, "0")}.000Z`,
    scope: {
      songSlug: "ganesha",
      lineIndex,
      measureIndexes: [lineIndex + 1],
      sourceFingerprint: "current-source",
    },
    events: [{
      id: `${runId}-llm-0`,
      runId,
      sequence: 0,
      createdAt: "2026-07-14T00:00:00.000Z",
      phase: "llm-tool-loop",
      status: "info",
      message: "tool input",
      source: "llm",
      kind: "tool-call",
      toolName: "submit_arranged_line",
      payloadPreview: { secretPrompt: "must not enter localStorage" },
    }],
    summary: {
      outcome: "accepted",
      inputEventCount: 1,
      resolvedEventCount: 1,
      unresolvedEventCount: 0,
      changedEventCount: 1,
      unchangedEventCount: 0,
      totalCost: null,
      elapsedMs: 10,
    },
    plaintext: `diagnostic plaintext ${index}`,
    persistence: { persisted: true, logPath: `.fingerstyle-diagnostics/run-${index}.jsonl` },
  };
}

describe("fingerstyle diagnostic persistence", () => {
  it("rejects runs captured from a different source fingerprint", () => {
    const storage = new MemoryStorage();
    persistFingerstyleDiagnosticRun({
      storage,
      storageKey: "diagnostics",
      sourceFingerprint: "old-source",
      run: makeRun(1),
    });

    expect(restoreFingerstyleDiagnosticRuns(
      storage.getItem("diagnostics"),
      "current-source",
    )).toEqual([]);
  });

  it("keeps the five newest runs per line and strips LLM payload previews", () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < 6; index += 1) {
      persistFingerstyleDiagnosticRun({
        storage,
        storageKey: "diagnostics",
        sourceFingerprint: "current-source",
        run: makeRun(index),
      });
    }

    const restored = restoreFingerstyleDiagnosticRuns(
      storage.getItem("diagnostics"),
      "current-source",
    );
    expect(restored.map(run => run.runId)).toEqual([
      "run-1",
      "run-2",
      "run-3",
      "run-4",
      "run-5",
    ]);
    expect(restored[0].events[0]).not.toHaveProperty("payloadPreview");
    expect(restored[0].plaintext).toBe("diagnostic plaintext 1");
  });

  it("does not fail generation when browser storage rejects diagnostic writes", () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };

    expect(() => persistFingerstyleDiagnosticRun({
      storage,
      storageKey: "diagnostics",
      sourceFingerprint: "current-source",
      run: makeRun(1),
    })).not.toThrow();
  });

  it("does not restore diagnostic runs from an older run schema", () => {
    const legacyRun = { ...makeRun(1), version: 1, plaintext: "FINGERSTYLE LLM + DP DIAGNOSTIC VISUALIZATION" };
    const saved = JSON.stringify({
      version: 1,
      sourceFingerprint: "current-source",
      runs: [legacyRun, makeRun(2)],
    });

    expect(restoreFingerstyleDiagnosticRuns(saved, "current-source").map(run => run.runId)).toEqual(["run-2"]);
  });
});
