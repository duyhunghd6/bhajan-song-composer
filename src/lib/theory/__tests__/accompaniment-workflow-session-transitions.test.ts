import { describe, expect, it } from "vitest";
import {
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  createAccompanimentWorkflowSession,
  getNextUncompletedWorkflowStepId,
  selectOption,
  type AccompanimentWorkflowOption,
} from "@/lib/theory/accompaniment-workflow";

const sampleAbc = `X:1
T:Workflow State Sample
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 |`;

function option(id: string): AccompanimentWorkflowOption {
  return { id, label: id, summary: id, justification: id, data: {}, warnings: [], validationNotes: [] };
}

describe("accompaniment workflow session transitions", () => {
  it("only schedules enabled retained branches", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc, {
      style: "accompaniment",
      instruments: [
        { id: "guitar-classic", enabled: false, order: 0 },
        { id: "indian-harmonium", enabled: true, order: 1 },
        { id: "djembe", enabled: true, order: 2 },
      ],
    });
    expect(session.enabledStepIds).toEqual([
      "key-beats", "chord-roles-progression", "voice-leading-validation",
      ...ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.harmonium,
      ...ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.djembe,
    ]);
  });

  it("starts from the first shared workflow step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    expect(getNextUncompletedWorkflowStepId(session)).toBe("key-beats");
  });
});
