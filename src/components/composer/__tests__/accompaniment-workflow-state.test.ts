import { describe, expect, it } from "vitest";
import { createAccompanimentWorkflowSession, type AccompanimentWorkflowRun } from "@/lib/theory/accompaniment-workflow";
import { mergeRun, selectOption } from "../accompaniment-workflow/wizard-parts";

const sampleAbc = `X:1
T:Workflow State Sample
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |`;

function makeRun(id: string, optionIds: string[]): AccompanimentWorkflowRun {
  return {
    id,
    createdAt: "2026-07-06T00:00:00.000Z",
    stepId: "key-scale-cadence",
    requestPrompt: "test prompt",
    userNote: "",
    options: optionIds.map((optionId) => ({
      id: optionId,
      label: optionId,
      summary: `${optionId} summary`,
      justification: `${optionId} justification`,
      data: { style: optionId },
      warnings: [],
      validationNotes: [],
    })),
  };
}

describe("accompaniment workflow wizard state", () => {
  it("keeps previous generated options after a selected step is regenerated", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const firstRun = makeRun("run-1", ["option-a", "option-b"]);
    const secondRun = makeRun("run-2", ["option-c", "option-d"]);

    const generated = mergeRun(session, firstRun, "first prompt");
    const selected = selectOption(generated, "key-scale-cadence", firstRun.options[1], "first prompt", firstRun.id);
    const regenerated = mergeRun(selected, secondRun, "second prompt");

    expect(regenerated.steps["key-scale-cadence"].runs).toHaveLength(2);
    expect(regenerated.steps["key-scale-cadence"].runs[0].options.map((option) => option.id)).toEqual(["option-a", "option-b"]);
    expect(regenerated.steps["key-scale-cadence"].runs[1].options.map((option) => option.id)).toEqual(["option-c", "option-d"]);
    expect(regenerated.steps["key-scale-cadence"].activeRunId).toBe("run-1");
    expect(regenerated.steps["key-scale-cadence"].selectedOptionId).toBe("option-b");
  });
});
