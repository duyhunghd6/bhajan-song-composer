import { describe, expect, it } from "vitest";

import {
  createAccompanimentWorkflowSession,
  getSelectedWorkflowOption,
  selectOption,
  type AccompanimentWorkflowOption,
} from "@/lib/theory/accompaniment-workflow";

const sampleAbc = `X:1
T:Workflow Selection
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 |`;

function makeOption(id: string): AccompanimentWorkflowOption {
  return {
    id,
    label: id,
    summary: `${id} summary`,
    justification: `${id} justification`,
    data: { strongBeatEmphasis: id },
    warnings: [],
    validationNotes: [],
  };
}

describe("accompaniment workflow wizard parts", () => {
  it("updates the active run when selecting an option from an older generated run", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const oldOption = makeOption("old-run-option");
    const newOption = makeOption("new-run-option");

    session.steps["key-beats"] = {
      runs: [
        {
          id: "old-run",
          createdAt: "2026-07-04T00:00:00.000Z",
          stepId: "key-beats",
          requestPrompt: "old prompt",
          userNote: "",
          options: [oldOption],
        },
        {
          id: "new-run",
          createdAt: "2026-07-05T00:00:00.000Z",
          stepId: "key-beats",
          requestPrompt: "new prompt",
          userNote: "",
          options: [newOption],
        },
      ],
      activeRunId: "new-run",
      selectedOptionId: null,
      selectedAt: null,
      promptNote: "",
    };

    const selected = selectOption(session, "key-beats", oldOption, "", "old-run");

    expect(selected.steps["key-beats"].activeRunId).toBe("old-run");
    expect(selected.steps["key-beats"].selectedOptionId).toBe("old-run-option");
    expect(getSelectedWorkflowOption(selected, "key-beats")).toEqual(oldOption);
  });
});
