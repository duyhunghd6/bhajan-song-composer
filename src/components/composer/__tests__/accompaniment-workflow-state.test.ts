import { describe, expect, it } from "vitest";
import {
  ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  createAccompanimentWorkflowSession,
  mergeRun,
  selectOption,
  type AccompanimentWorkflowRun,
} from "@/lib/theory/accompaniment-workflow";
import {
  DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
  DEFAULT_FINGERSTYLE_GENERATION_SETTINGS,
  DEFAULT_LAYER_VOLUMES,
  type WorkspaceState,
} from "../useWorkspaceState";
import {
  buildAccompanimentGuitarBranchResetState,
  hasAccompanimentGuitarBranchWork,
} from "../workspace/accompaniment-guitar-reset";

const abc = `X:1\nM:4/4\nL:1/8\nK:Em\n| E2 E2 G2 A2 |`;

function run(stepId: (typeof ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS)[number]): AccompanimentWorkflowRun {
  return {
    id: stepId,
    createdAt: "2026-07-20T00:00:00.000Z",
    stepId,
    requestPrompt: "test",
    userNote: "",
    options: [{ id: "choice", label: "choice", summary: "", justification: "", data: {}, warnings: [], validationNotes: [] }],
  };
}

describe("accompaniment workspace state", () => {
  it("resets dedicated Guitar Fingerstyle artifacts and Guitar branch decisions", () => {
    let workflow = createAccompanimentWorkflowSession(abc);
    for (const stepId of ["key-beats", "chord-roles-progression", "voice-leading-validation"] as const) {
      const sharedRun = { ...run("guitar-comping-profile"), id: stepId, stepId } as AccompanimentWorkflowRun;
      workflow = selectOption(mergeRun(workflow, sharedRun, ""), stepId, sharedRun.options[0], "", sharedRun.id);
    }
    for (const stepId of ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS) {
      const guitarRun = run(stepId);
      workflow = selectOption(mergeRun(workflow, guitarRun, ""), stepId, guitarRun.options[0], "", guitarRun.id);
    }
    const state = {
      accompanimentWorkflow: workflow,
      accompanimentWorkflowSetup: workflow.setup,
      generatedGuitar: "guitar abc",
      generatedGuitarOrigin: "fingerstyle-timegrid",
      guitarAccompanimentData: null,
      aiGuitarSuggestions: [],
      selectedGuitarIndex: null,
      accompanimentLayerVisibility: DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
      accompanimentLayerVolumes: DEFAULT_LAYER_VOLUMES,
      fingerstyleGenerationSettings: DEFAULT_FINGERSTYLE_GENERATION_SETTINGS,
    } as unknown as WorkspaceState;

    expect(hasAccompanimentGuitarBranchWork(state)).toBe(true);
    const reset = buildAccompanimentGuitarBranchResetState(state);
    expect(reset.generatedGuitar).toBeNull();
    expect(reset.generatedGuitarOrigin).toBeNull();
    expect(reset.accompanimentWorkflow?.guitarProfileHint).toBeNull();
  });
});
