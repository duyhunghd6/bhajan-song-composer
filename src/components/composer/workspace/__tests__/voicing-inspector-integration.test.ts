import { describe, expect, it } from "vitest";

import type { WorkspaceState } from "../../useWorkspaceState";
import {
  buildAccompanimentProjectPayload,
  buildInspectorIntegration,
  createVoicingOverride,
  revalidateVoicingOverridesForSource,
} from "../voicing-inspector-integration";

const sourceAbc = "X:1\nT:Locked source\nM:4/4\nL:1/8\nK:Am\n| A2 c2 e2 a2 |";

describe("Accompaniment voicing inspector integration", () => {
  it("builds an inspector target from immutable harmony and saves only a scoped override", () => {
    const integration = buildInspectorIntegration({
      chordSymbol: "Am",
      measureIndex: 2,
      measureCount: 8,
      strongBeatNotes: ["E4"],
      sourceAbc,
      overrides: [],
    });
    const selected = integration.candidates.find((candidate) => candidate.instrument === "guitar" && candidate.status === "valid");
    expect(selected).toBeDefined();
    if (!selected) throw new Error("Expected a validated Guitar candidate.");

    const override = createVoicingOverride({
      target: integration.target,
      inspectorCandidate: selected,
      scope: "window",
      createdAt: "2026-09-14T00:00:00.000Z",
    });

    expect(integration.target.context).toMatchObject({ measure: 3, beat: 1, chordIdentity: "Am" });
    expect(override.windowRange).toMatchObject({ scope: "chord-window", chordWindowId: integration.target.context.chordWindowId });
    expect(override.baseChordIdentity.symbol).toBe("Am");
    expect(override.sourceRevisionId).toBe(integration.target.sourceRevisionId);
    expect(sourceAbc).toBe("X:1\nT:Locked source\nM:4/4\nL:1/8\nK:Am\n| A2 c2 e2 a2 |");
  });

  it("retains complete workflow output and override decisions in the durable project payload", () => {
    const workspace = {
      accompanimentWorkflow: {
        setup: { style: "accompaniment", instruments: [] },
        currentStepId: "key-beats",
        steps: {
          "key-beats": {
            selectedOptionId: "option-a",
            runs: [{
              id: "run-a",
              stepId: "key-beats",
              requestPrompt: "Analyze source",
              userNote: "keep it sparse",
              rawResult: { tool: "analyze" },
              diagnostics: { logId: "log-a", logPath: "memory", exposedTools: [], validationAttempts: 1, maxValidationAttempts: 1 },
              options: [{ id: "option-a", label: "A", summary: "", justification: "", data: {}, warnings: [], validationNotes: [] }],
            }],
          },
        },
      },
      voicingOverrides: [{ id: "override-a" }],
      generatedAccompaniment: "X:1\nK:Am",
      generatedGuitar: null,
    } as unknown as WorkspaceState;
    const payload = buildAccompanimentProjectPayload({ slug: "locked-source", activeAbc: sourceAbc, branchSourceAbc: sourceAbc, workspace });

    expect(payload.song.sourceFingerprint).toBeTruthy();
    expect(payload.steps?.accompaniment.runs[0]).toMatchObject({
      id: "run-a",
      rawOutput: { tool: "analyze" },
      normalizedOutput: [{ id: "option-a" }],
      diagnostics: { logId: "log-a" },
    });
    expect(payload.decisions).toMatchObject({ voicingOverrides: [{ id: "override-a" }] });
    expect(payload.artifacts?.[0]).toMatchObject({ kind: "abc", uri: "workspace:generated-accompaniment" });
  });

  it("retains override identity but marks it stale when Harmony source changes", () => {
    const integration = buildInspectorIntegration({
      chordSymbol: "Am", measureIndex: 0, measureCount: 1, strongBeatNotes: ["A4"], sourceAbc, overrides: [],
    });
    const selected = integration.candidates.find((candidate) => candidate.instrument === "piano" && candidate.status === "valid");
    if (!selected) throw new Error("Expected a valid Piano candidate.");
    const override = createVoicingOverride({ target: integration.target, inspectorCandidate: selected, scope: "phrase" });
    const revalidated = revalidateVoicingOverridesForSource([override], "X:1\nM:4/4\nK:C\n| C8 |", "2026-09-14T00:01:00.000Z");

    expect(revalidated[0]).toMatchObject({ id: override.id, voicingId: override.voicingId, status: "stale" });
    expect(revalidated[0]?.validation.diagnostics.at(-1)).toContain("Harmony source changed");
  });
});
