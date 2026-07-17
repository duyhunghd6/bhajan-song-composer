/**
 * Progressive pruning for workspace state before localStorage serialization.
 *
 * localStorage has a ~5 MB quota per origin. The accompaniment workflow
 * session, fingerstyle arrangements, and LLM diagnostics can easily exceed
 * this. Rather than arbitrarily truncating, we define pruning *levels* that
 * strip progressively more expendable data until the payload fits.
 *
 * Level 0 (lightweight) – always applied:
 *   • Strip `rawResult` and `diagnostics.llmLogs[].payloadPreview` from
 *     workflow runs (these are debug-only blobs).
 *
 * Level 1 (moderate) – applied if Level 0 still exceeds quota:
 *   • Trim AI suggestion arrays to keep only the selected item.
 *   • Strip diagnostics entirely from workflow runs.
 *
 * Level 2 (aggressive) – applied if Level 1 still exceeds quota:
 *   • Drop `guitarAccompanimentData.arrangement` and
 *     `pianoAccompanimentData` entirely (can be regenerated).
 *   • Drop `ensembleWorkflow` session data.
 */

import type { WorkspaceState } from "../useWorkspaceState";
import type { AccompanimentWorkflowSession, AccompanimentWorkflowStepState } from "@/lib/theory/accompaniment-workflow";
import type { EnsembleWorkflowSession, EnsembleWorkflowStepState } from "@/lib/theory/ensemble-workflow";

// ---------------------------------------------------------------------------
// Level 0 – strip debug/replay-only blobs
// ---------------------------------------------------------------------------

function pruneAccompanimentWorkflowRuns(steps: AccompanimentWorkflowSession["steps"]): AccompanimentWorkflowSession["steps"] {
  const pruned = { ...steps } as Record<string, AccompanimentWorkflowStepState>;
  for (const stepId of Object.keys(pruned)) {
    const stepState = pruned[stepId];
    if (!stepState?.runs?.length) continue;
    pruned[stepId] = {
      ...stepState,
      runs: stepState.runs.map((run) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rawResult, ...rest } = run;
        const prunedDiagnostics = run.diagnostics
          ? {
              ...run.diagnostics,
              llmLogs: run.diagnostics.llmLogs?.map((log) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { payloadPreview, ...logRest } = log;
                return logRest;
              }),
            }
          : undefined;
        return { ...rest, diagnostics: prunedDiagnostics };
      }),
    };
  }
  return pruned as AccompanimentWorkflowSession["steps"];
}

function pruneEnsembleWorkflowRuns(steps: EnsembleWorkflowSession["steps"]): EnsembleWorkflowSession["steps"] {
  const pruned = { ...steps } as Record<string, EnsembleWorkflowStepState>;
  for (const stepId of Object.keys(pruned)) {
    const stepState = pruned[stepId];
    if (!stepState?.runs?.length) continue;
    pruned[stepId] = {
      ...stepState,
      runs: stepState.runs.map((run) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rawResult, ...rest } = run;
        return rest;
      }),
    };
  }
  return pruned as EnsembleWorkflowSession["steps"];
}

function pruneLevel0(state: WorkspaceState): WorkspaceState {
  const result = { ...state };

  // Prune accompaniment workflow runs
  if (result.accompanimentWorkflow) {
    result.accompanimentWorkflow = {
      ...result.accompanimentWorkflow,
      steps: pruneAccompanimentWorkflowRuns(result.accompanimentWorkflow.steps),
    };
  }

  // Prune ensemble workflow runs
  if (result.ensembleWorkflow) {
    result.ensembleWorkflow = {
      ...result.ensembleWorkflow,
      steps: pruneEnsembleWorkflowRuns(result.ensembleWorkflow.steps),
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Level 1 – trim suggestions + strip diagnostics entirely
// ---------------------------------------------------------------------------

function pruneLevel1(state: WorkspaceState): WorkspaceState {
  const result = pruneLevel0(state);

  // Keep only the selected suggestion in each suggestion array
  if (result.aiSuggestions.length > 1 && result.selectedCandidateId) {
    const selected = result.aiSuggestions.find((s) => s.id === result.selectedCandidateId);
    result.aiSuggestions = selected ? [selected] : result.aiSuggestions.slice(0, 1);
  }

  if (result.aiGuitarSuggestions.length > 1 && result.selectedGuitarIndex != null) {
    const item = result.aiGuitarSuggestions[result.selectedGuitarIndex];
    result.aiGuitarSuggestions = item ? [item] : [];
    result.selectedGuitarIndex = item ? 0 : null;
  }

  if (result.aiPianoSuggestions.length > 1 && result.selectedPianoIndex != null) {
    const item = result.aiPianoSuggestions[result.selectedPianoIndex];
    result.aiPianoSuggestions = item ? [item] : [];
    result.selectedPianoIndex = item ? 0 : null;
  }

  if (result.aiAccompanimentSuggestions.length > 1 && result.selectedAccompanimentIndex != null) {
    const item = result.aiAccompanimentSuggestions[result.selectedAccompanimentIndex];
    result.aiAccompanimentSuggestions = item ? [item] : [];
    result.selectedAccompanimentIndex = item ? 0 : null;
  }

  // Strip diagnostics entirely from workflow runs
  if (result.accompanimentWorkflow) {
    const steps = { ...result.accompanimentWorkflow.steps } as Record<string, AccompanimentWorkflowStepState>;
    for (const stepId of Object.keys(steps)) {
      const stepState = steps[stepId];
      if (!stepState?.runs?.length) continue;
      steps[stepId] = {
        ...stepState,
        runs: stepState.runs.map((run) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { rawResult, diagnostics, ...rest } = run;
          return rest;
        }),
      };
    }
    result.accompanimentWorkflow = {
      ...result.accompanimentWorkflow,
      steps: steps as AccompanimentWorkflowSession["steps"],
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Level 2 – drop regenerable heavy objects
// ---------------------------------------------------------------------------

function pruneLevel2(state: WorkspaceState): WorkspaceState {
  const result = pruneLevel1(state);

  // Drop full arrangement (regenerable from workflow data)
  if (result.guitarAccompanimentData) {
    result.guitarAccompanimentData = null;
  }

  // Drop full piano accompaniment (regenerable)
  if (result.pianoAccompanimentData) {
    result.pianoAccompanimentData = null;
  }

  // Drop ensemble workflow (regenerable from accompaniment)
  if (result.ensembleWorkflow) {
    result.ensembleWorkflow = null;
  }

  // Drop staged ensemble layers (regenerable)
  if (result.stagedEnsembleLayers) {
    result.stagedEnsembleLayers = null;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const PRUNE_LEVELS = [pruneLevel0, pruneLevel1, pruneLevel2] as const;

/** Maximum size in bytes before we escalate to the next pruning level. */
const QUOTA_TARGET_BYTES = 4 * 1024 * 1024; // 4 MB – leave headroom below the ~5 MB browser limit

/**
 * Serialize workspace state for localStorage, applying progressive pruning
 * levels until the result fits within the quota target.
 *
 * Returns `null` if the state cannot be pruned to fit (extremely unlikely).
 */
export function serializeForStorage(state: WorkspaceState): string | null {
  for (const prune of PRUNE_LEVELS) {
    const pruned = prune(state);
    const json = JSON.stringify(pruned);
    if (json.length * 2 <= QUOTA_TARGET_BYTES) {
      // Each char is ~2 bytes in UTF-16 storage
      return json;
    }
  }

  // Last resort: try the most aggressively pruned version anyway
  const lastResort = PRUNE_LEVELS[PRUNE_LEVELS.length - 1](state);
  return JSON.stringify(lastResort);
}
