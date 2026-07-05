import {
  ENSEMBLE_WORKFLOW_STEP_IDS,
  ENSEMBLE_WORKFLOW_STEPS,
  getEnsembleInstrumentStepIds,
  getSelectedEnsembleWorkflowOption,
  type EnsembleInstrument,
  type EnsembleWorkflowOption,
  type EnsembleWorkflowRun,
  type EnsembleWorkflowScope,
  type EnsembleWorkflowSession,
  type EnsembleWorkflowStepId,
} from "@/lib/theory/ensemble-workflow";

export const SCOPE_CLASS: Record<EnsembleWorkflowScope, string> = {
  shared: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
  djembe: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300",
  flute: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-300",
  violin: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  final: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export function emptyStepState() {
  return { runs: [], activeRunId: null, selectedOptionId: null, selectedAt: null, promptNote: "" };
}

export function mergeRun(workflow: EnsembleWorkflowSession, run: EnsembleWorkflowRun, promptNote: string): EnsembleWorkflowSession {
  const stepState = workflow.steps[run.stepId] ?? emptyStepState();

  let preservedRun: EnsembleWorkflowRun | null = null;
  if (stepState.activeRunId && stepState.selectedOptionId) {
    const active = stepState.runs.find(r => r.id === stepState.activeRunId);
    if (active) {
      const selectedOption = active.options.find(o => o.id === stepState.selectedOptionId);
      if (selectedOption) {
        preservedRun = {
          ...active,
          options: [selectedOption]
        };
      }
    }
  }

  const nextRuns = preservedRun && preservedRun.id !== run.id ? [preservedRun, run] : [run];

  return {
    ...workflow,
    currentStepId: run.stepId,
    appliedAt: null,
    appliedSelectionFingerprint: null,
    steps: {
      ...workflow.steps,
      [run.stepId]: {
        ...stepState,
        runs: nextRuns,
        activeRunId: preservedRun ? stepState.activeRunId : run.id,
        selectedOptionId: preservedRun ? stepState.selectedOptionId : null,
        selectedAt: preservedRun ? stepState.selectedAt : null,
        promptNote,
      },
    },
  };
}

export function selectOption(
  workflow: EnsembleWorkflowSession,
  stepId: EnsembleWorkflowStepId,
  option: EnsembleWorkflowOption,
  promptNote: string
): EnsembleWorkflowSession {
  const stepState = workflow.steps[stepId] ?? emptyStepState();
  const stepIndex = ENSEMBLE_WORKFLOW_STEP_IDS.indexOf(stepId);
  const nextStepId = ENSEMBLE_WORKFLOW_STEP_IDS[stepIndex + 1] ?? stepId;

  return {
    ...workflow,
    currentStepId: nextStepId,
    appliedAt: null,
    appliedSelectionFingerprint: null,
    steps: {
      ...workflow.steps,
      [stepId]: {
        ...stepState,
        selectedOptionId: option.id,
        selectedAt: new Date().toISOString(),
        promptNote,
      },
    },
  };
}

export function buildSkipOption(instrument: EnsembleInstrument): EnsembleWorkflowOption {
  const label = `Skip ${instrument[0].toUpperCase()}${instrument.slice(1)}`;
  return {
    id: `skip-${instrument}`,
    label,
    summary: `Do not generate a Layer 3 ${instrument} part for this ensemble pass.`,
    justification: `Skipping ${instrument} leaves more space for the selected ensemble instruments and avoids adding an unnecessary layer.`,
    data: { skipInstrument: true, instrument },
    warnings: [],
    validationNotes: [`${label} selected by user; this instrument will not block final apply or add ABC.`],
  };
}

export function skipInstrumentSteps(workflow: EnsembleWorkflowSession, instrument: EnsembleInstrument): EnsembleWorkflowSession {
  const skipOption = buildSkipOption(instrument);
  const now = new Date().toISOString();
  const nextSteps = { ...workflow.steps };

  for (const stepId of getEnsembleInstrumentStepIds(instrument)) {
    const stepState = nextSteps[stepId] ?? emptyStepState();
    const run: EnsembleWorkflowRun = {
      id: `${stepId}-skip-${now}`,
      createdAt: now,
      stepId,
      requestPrompt: `User selected ${skipOption.label}.`,
      userNote: "",
      options: [skipOption],
    };
    nextSteps[stepId] = {
      ...stepState,
      runs: [run],
      activeRunId: run.id,
      selectedOptionId: skipOption.id,
      selectedAt: now,
      promptNote: stepState.promptNote,
    };
  }

  const lastSkippedStep = getEnsembleInstrumentStepIds(instrument).at(-1)!;
  const nextStepIndex = ENSEMBLE_WORKFLOW_STEP_IDS.indexOf(lastSkippedStep) + 1;
  return {
    ...workflow,
    currentStepId: ENSEMBLE_WORKFLOW_STEP_IDS[nextStepIndex] ?? "final-conflict-review-apply",
    appliedAt: null,
    appliedSelectionFingerprint: null,
    steps: nextSteps,
  };
}

export function RunOptionList({
  workflow,
  stepId,
  onSelect,
}: {
  workflow: EnsembleWorkflowSession;
  stepId: EnsembleWorkflowStepId;
  onSelect: (option: EnsembleWorkflowOption) => void;
}) {
  const stepState = workflow.steps[stepId] ?? emptyStepState();
  const runs = [...stepState.runs].reverse();

  if (runs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No LLM output stored for this ensemble step yet. Generate options to begin this human review point.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <div key={run.id} className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <span>Run stored {new Date(run.createdAt).toLocaleString()}</span>
            {run.userNote && <span>User note: {run.userNote}</span>}
          </div>
          <div className="grid gap-2">
            {run.options.map((option) => {
              const isSelected = stepState.activeRunId === run.id && stepState.selectedOptionId === option.id;
              return (
                <button
                  key={`${run.id}-${option.id}`}
                  type="button"
                  onClick={() => onSelect(option)}
                  className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-500/10 shadow-sm"
                      : "border-zinc-200 bg-zinc-50 hover:border-emerald-300/60 dark:border-zinc-800 dark:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{option.label}</h4>
                    {isSelected && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">Selected</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{option.summary}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300"><strong>Why:</strong> {option.justification}</p>
                  {option.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                      {option.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  )}
                  {option.validationNotes.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
                      {option.validationNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

