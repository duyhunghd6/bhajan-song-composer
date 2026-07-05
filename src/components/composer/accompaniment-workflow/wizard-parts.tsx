import {
  ACCOMPANIMENT_WORKFLOW_STEPS,
  getNextUncompletedWorkflowStepId,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowScope,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";

export const SCOPE_CLASS: Record<AccompanimentWorkflowScope, string> = {
  shared: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
  guitar: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  piano: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300",
};

export function emptyStepState() {
  return { runs: [], activeRunId: null, selectedOptionId: null, selectedAt: null, promptNote: "" };
}

export function mergeRun(workflow: AccompanimentWorkflowSession, run: AccompanimentWorkflowRun, promptNote: string): AccompanimentWorkflowSession {
  const stepState = workflow.steps[run.stepId] ?? emptyStepState();
  return {
    ...workflow,
    currentStepId: run.stepId,
    steps: {
      ...workflow.steps,
      [run.stepId]: {
        ...stepState,
        runs: [...stepState.runs, run],
        activeRunId: run.id,
        selectedOptionId: null,
        selectedAt: null,
        promptNote,
      },
    },
  };
}

export function mergeRuns(workflow: AccompanimentWorkflowSession, runs: AccompanimentWorkflowRun[], promptNote: string): AccompanimentWorkflowSession {
  const next = runs.reduce((current, run) => mergeRun(current, run, promptNote), workflow);
  return {
    ...next,
    currentStepId: runs[0]?.stepId ?? next.currentStepId,
  };
}

export function selectOption(
  workflow: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId,
  option: AccompanimentWorkflowOption,
  promptNote: string
): AccompanimentWorkflowSession {
  const stepState = workflow.steps[stepId] ?? emptyStepState();
  const selectedWorkflow = {
    ...workflow,
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
  const nextStepId = getNextUncompletedWorkflowStepId(selectedWorkflow) ?? stepId;

  return {
    ...selectedWorkflow,
    currentStepId: nextStepId,
    guitarProfileHint: stepId === "guitar-fills-validation" ? extractProfile(option) : workflow.guitarProfileHint,
    pianoProfileHint: stepId === "piano-fills-pedal-validation" ? extractProfile(option) : workflow.pianoProfileHint,
  };
}

export function extractProfile(option: AccompanimentWorkflowOption): string | null {
  const candidates = [
    option.data.profileId,
    option.data.compingProfile,
    option.data.pickingProfile,
    option.data.style,
    option.data.profile,
    option.id,
  ];
  const match = candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return match?.trim() ?? null;
}

export function makeSkippedOption(stepId: AccompanimentWorkflowStepId, instrumentLabel: string): AccompanimentWorkflowOption {
  const step = ACCOMPANIMENT_WORKFLOW_STEPS.find((candidate) => candidate.id === stepId);
  return {
    id: `skip-${stepId}`,
    label: `Skip ${step?.shortLabel ?? instrumentLabel}`,
    summary: `${instrumentLabel} accompaniment is intentionally skipped for this workflow step.`,
    justification: `The user chose to skip ${instrumentLabel}, so no ${instrumentLabel.toLowerCase()} profile, voicing, bass, fill, or polish decision is required.`,
    data: { skipped: true, instrument: instrumentLabel.toLowerCase(), skippedStepId: stepId },
    warnings: [],
    validationNotes: [`Skipped by user; downstream ${instrumentLabel.toLowerCase()} generation should not require this step.`],
  };
}

export function skipWorkflowSteps(
  workflow: AccompanimentWorkflowSession,
  stepIds: readonly AccompanimentWorkflowStepId[],
  instrumentLabel: string,
  promptNote: string
): AccompanimentWorkflowSession {
  const timestamp = new Date().toISOString();
  const next = stepIds.reduce((current, stepId, index) => {
    const option = makeSkippedOption(stepId, instrumentLabel);
    const runId = `${stepId}-skip-${Date.now()}-${index}`;
    return {
      ...current,
      steps: {
        ...current.steps,
        [stepId]: {
          runs: [{
            id: runId,
            createdAt: timestamp,
            stepId,
            requestPrompt: `User skipped ${instrumentLabel} branch.`,
            userNote: promptNote,
            options: [option],
          }],
          activeRunId: runId,
          selectedOptionId: option.id,
          selectedAt: timestamp,
          promptNote,
        },
      },
    };
  }, workflow);

  return {
    ...next,
    currentStepId: getNextUncompletedWorkflowStepId(next) ?? next.currentStepId,
    guitarProfileHint: instrumentLabel === "Guitar" ? null : next.guitarProfileHint,
    pianoProfileHint: instrumentLabel === "Piano" ? null : next.pianoProfileHint,
  };
}

export function hasWorkflowStepResults(
  workflow: AccompanimentWorkflowSession,
  stepIds: readonly AccompanimentWorkflowStepId[]
): boolean {
  return stepIds.some((stepId) => {
    const stepState = workflow.steps[stepId];
    return Boolean(stepState?.runs.length || stepState?.activeRunId || stepState?.selectedOptionId || stepState?.selectedAt);
  });
}

export function RunOptionList({
  workflow,
  stepId,
  onSelect,
}: {
  workflow: AccompanimentWorkflowSession;
  stepId: AccompanimentWorkflowStepId;
  onSelect: (option: AccompanimentWorkflowOption) => void;
}) {
  const stepState = workflow.steps[stepId] ?? emptyStepState();
  const runs = [...stepState.runs].reverse();

  if (runs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No LLM output stored for this step yet. Generate options to begin this human review point.
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
                  className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                    isSelected
                      ? "border-amber-400 bg-amber-500/10 shadow-sm"
                      : "border-zinc-200 bg-zinc-50 hover:border-amber-300/60 dark:border-zinc-800 dark:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{option.label}</h4>
                    {isSelected && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Selected</span>}
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

