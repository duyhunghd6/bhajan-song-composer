import {
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  clearAccompanimentWorkflowStepResults,
  hasWorkflowStepResults,
} from "@/lib/theory/accompaniment-workflow";
import type { WorkspaceState } from "../useWorkspaceState";

const hasItems = (value: unknown[] | null | undefined) => Boolean(value && value.length > 0);
const ALL_BRANCH_STEP_IDS = Object.values(ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS).flat();

export function hasAccompanimentGuitarBranchWork(state: WorkspaceState): boolean {
  return Boolean(
    (state.accompanimentWorkflow && hasWorkflowStepResults(
      state.accompanimentWorkflow,
      ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar
    )) ||
    state.accompanimentWorkflow?.guitarProfileHint ||
    state.generatedGuitar ||
    state.guitarAccompanimentData ||
    hasItems(state.aiGuitarSuggestions) ||
    state.selectedGuitarIndex !== null ||
    state.ensembleWorkflow ||
    state.stagedEnsembleLayers ||
    state.appliedEnsembleLayers
  );
}

export function buildHarmonyValidationBranchResetState(state: WorkspaceState): Partial<WorkspaceState> {
  const clearedWorkflow = state.accompanimentWorkflow
    ? {
        ...clearAccompanimentWorkflowStepResults(state.accompanimentWorkflow, ALL_BRANCH_STEP_IDS),
        guitarProfileHint: null,
      }
    : null;

  return {
    aiAccompanimentSuggestions: [],
    selectedAccompanimentIndex: null,
    generatedAccompaniment: null,
    guitarAccompanimentData: null,
    generatedGuitar: null,
    generatedGuitarOrigin: null,
    aiGuitarSuggestions: [],
    selectedGuitarIndex: null,
    accompanimentWorkflow: clearedWorkflow,
    ensembleWorkflow: null,
    stagedEnsembleLayers: null,
    appliedEnsembleLayers: null,
  };
}

export function buildAccompanimentGuitarBranchResetState(state: WorkspaceState): Partial<WorkspaceState> {
  const clearedWorkflow = state.accompanimentWorkflow
    ? {
        ...clearAccompanimentWorkflowStepResults(
          state.accompanimentWorkflow,
          ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar
        ),
        guitarProfileHint: null,
      }
    : null;

  return {
    guitarAccompanimentData: null,
    generatedGuitar: null,
    generatedGuitarOrigin: null,
    aiGuitarSuggestions: [],
    selectedGuitarIndex: null,
    accompanimentWorkflow: clearedWorkflow,
    ensembleWorkflow: null,
    stagedEnsembleLayers: null,
    appliedEnsembleLayers: null,
  };
}
