import { describe, expect, it } from "vitest";
import {
  ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  createAccompanimentWorkflowSession,
  getSelectedWorkflowOption,
  mergeRun,
  selectOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowStepId,
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

const sampleAbc = `X:1
T:Workflow State Sample
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |`;

function makeRun(
  id: string,
  optionIds: string[],
  stepId: AccompanimentWorkflowStepId = "key-scale-cadence"
): AccompanimentWorkflowRun {
  return {
    id,
    createdAt: "2026-07-06T00:00:00.000Z",
    stepId,
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
  it("defaults new fingerstyle generation to beginner skill with automatic density", () => {
    expect(DEFAULT_FINGERSTYLE_GENERATION_SETTINGS).toEqual({
      skillLevel: "beginner",
      densityMode: "auto",
      arrangementOptimization: "heuristic",
    });
  });

  it("stores accompaniment layer visibility and volumes in the persisted workspace state", () => {
    const state = {
      aiSuggestions: [],
      selectedCandidateId: null,
      acceptedHarmony: null,
      aiAccompanimentSuggestions: [],
      selectedAccompanimentIndex: null,
      pianoAccompanimentData: null,
      guitarAccompanimentData: null,
      generatedAccompaniment: null,
      aiGuitarSuggestions: [],
      aiPianoSuggestions: [],
      selectedGuitarIndex: null,
      selectedPianoIndex: null,
      generatedGuitar: null,
      generatedPiano: null,
      accompanimentWorkflowSetup: null,
      accompanimentWorkflow: null,
      ensembleWorkflow: null,
      stagedEnsembleLayers: null,
      appliedEnsembleLayers: null,
      accompanimentLayerVisibility: {
        ...DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
        Guitar: false,
      },
      accompanimentLayerVolumes: {
        ...DEFAULT_LAYER_VOLUMES,
        Guitar: 65,
      },
      fingerstyleGenerationSettings: {
        skillLevel: "beginner",
        densityMode: "auto",
      },
    } satisfies WorkspaceState;

    expect(state.accompanimentLayerVisibility.Guitar).toBe(false);
    expect(state.accompanimentLayerVolumes.Guitar).toBe(65);
  });

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

  it("clears only guitar branch work for accompaniment page restore/reset", () => {
    let workflow = createAccompanimentWorkflowSession(sampleAbc);
    const sharedRun = makeRun("shared-run", ["shared-option"], "voice-leading-validation");
    const guitarRun = makeRun("guitar-run", ["guitar-option"], "guitar-fingerstyle");
    const pianoRun = makeRun("piano-run", ["piano-option"], "piano-fills-pedal-validation");

    workflow = selectOption(mergeRun(workflow, sharedRun, ""), "voice-leading-validation", sharedRun.options[0], "", sharedRun.id);
    workflow = selectOption(mergeRun(workflow, guitarRun, ""), "guitar-fingerstyle", guitarRun.options[0], "", guitarRun.id);
    workflow = selectOption(mergeRun(workflow, pianoRun, ""), "piano-fills-pedal-validation", pianoRun.options[0], "", pianoRun.id);
    workflow = {
      ...workflow,
      guitarProfileHint: "folk-travis",
      pianoProfileHint: "pop-ballad",
    };

    const state = {
      aiSuggestions: [{ id: "harmony", label: "Harmony", analysis: "", chords: [], abc: sampleAbc }],
      selectedCandidateId: "harmony",
      acceptedHarmony: null,
      aiAccompanimentSuggestions: [{ id: "accomp", label: "Accompaniment", summary: "", pattern: [], abc: "generated accompaniment" }],
      selectedAccompanimentIndex: 0,
      pianoAccompanimentData: { abc: "generated piano" },
      guitarAccompanimentData: { composerLayer: { abc: "generated guitar" } },
      generatedAccompaniment: "generated accompaniment",
      aiGuitarSuggestions: [{ id: "guitar", label: "Guitar", summary: "", pattern: [], abc: "generated guitar" }],
      aiPianoSuggestions: [{ id: "piano", label: "Piano", summary: "", pattern: [], abc: "generated piano" }],
      selectedGuitarIndex: 0,
      selectedPianoIndex: 0,
      generatedGuitar: "generated guitar",
      generatedPiano: "generated piano",
      accompanimentWorkflowSetup: workflow.setup,
      accompanimentWorkflow: workflow,
      ensembleWorkflow: { sourceAbcFingerprint: "ensemble" },
      stagedEnsembleLayers: { combined: "staged" },
      appliedEnsembleLayers: { combined: "applied" },
    } as unknown as WorkspaceState;

    expect(hasAccompanimentGuitarBranchWork(state)).toBe(true);

    const resetState = {
      ...state,
      ...buildAccompanimentGuitarBranchResetState(state),
    };

    expect(resetState.generatedGuitar).toBeNull();
    expect(resetState.guitarAccompanimentData).toBeNull();
    expect(resetState.aiGuitarSuggestions).toEqual([]);
    expect(resetState.selectedGuitarIndex).toBeNull();
    expect(resetState.ensembleWorkflow).toBeNull();
    expect(resetState.stagedEnsembleLayers).toBeNull();
    expect(resetState.appliedEnsembleLayers).toBeNull();
    for (const stepId of ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS) {
      expect(resetState.accompanimentWorkflow?.steps[stepId].runs).toEqual([]);
      expect(resetState.accompanimentWorkflow?.steps[stepId].selectedOptionId).toBeNull();
    }
    expect(resetState.accompanimentWorkflow?.guitarProfileHint).toBeNull();

    expect(getSelectedWorkflowOption(resetState.accompanimentWorkflow!, "voice-leading-validation")?.id).toBe("shared-option");
    expect(getSelectedWorkflowOption(resetState.accompanimentWorkflow!, "piano-fills-pedal-validation")?.id).toBe("piano-option");
    expect(resetState.accompanimentWorkflow?.pianoProfileHint).toBe("pop-ballad");
    expect(resetState.generatedPiano).toBe("generated piano");
    expect(resetState.pianoAccompanimentData).toBe(state.pianoAccompanimentData);
    expect(resetState.aiPianoSuggestions).toBe(state.aiPianoSuggestions);
    expect(resetState.selectedPianoIndex).toBe(0);
    expect(resetState.generatedAccompaniment).toBe("generated accompaniment");
    expect(resetState.aiAccompanimentSuggestions).toBe(state.aiAccompanimentSuggestions);
    expect(resetState.selectedAccompanimentIndex).toBe(0);
  });
});
