import {
  ACCOMPANIMENT_WORKFLOW_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepId,
  type AccompanimentWorkflowStepState,
} from "./definition";

const STEP_BY_ID = new Map(ACCOMPANIMENT_WORKFLOW_STEPS.map((step) => [step.id, step]));

export function emptyStepState(): AccompanimentWorkflowStepState {
  return { runs: [], activeRunId: null, selectedOptionId: null, selectedAt: null, promptNote: "" };
}

function sessionEnabledStepIds(session: AccompanimentWorkflowSession): AccompanimentWorkflowStepId[] {
  const enabledStepIds = (session as Partial<AccompanimentWorkflowSession>).enabledStepIds;
  if (Array.isArray(enabledStepIds) && enabledStepIds.length > 0) {
    return enabledStepIds.filter((stepId): stepId is AccompanimentWorkflowStepId =>
      ACCOMPANIMENT_WORKFLOW_STEP_IDS.some((candidate) => candidate === stepId)
    );
  }

  return [...ACCOMPANIMENT_WORKFLOW_STEP_IDS];
}

function getWorkflowRun(stepState: AccompanimentWorkflowStepState | undefined | null, runId: string | null): AccompanimentWorkflowRun | null {
  if (!stepState || !runId) return null;
  return stepState.runs.find((run) => run.id === runId) ?? null;
}

function getSelectedWorkflowOption(
  session: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId
): AccompanimentWorkflowOption | null {
  const stepState = session.steps[stepId];
  if (!stepState) return null;
  const activeRun = getWorkflowRun(stepState, stepState.activeRunId);
  if (!activeRun || !stepState.selectedOptionId) return null;
  return activeRun.options.find((option) => option.id === stepState.selectedOptionId) ?? null;
}

function isWorkflowStepComplete(session: AccompanimentWorkflowSession, stepId: AccompanimentWorkflowStepId): boolean {
  return Boolean(getSelectedWorkflowOption(session, stepId));
}

function isWorkflowStepUnlocked(session: AccompanimentWorkflowSession, stepId: AccompanimentWorkflowStepId): boolean {
  const enabled = new Set(sessionEnabledStepIds(session));
  if (!enabled.has(stepId)) return false;

  const step = STEP_BY_ID.get(stepId);
  if (!step) return false;
  return step.dependencies
    .filter((dependency) => enabled.has(dependency))
    .every((dependency) => isWorkflowStepComplete(session, dependency));
}

function getNextUncompletedWorkflowStepId(session: AccompanimentWorkflowSession): AccompanimentWorkflowStepId | null {
  return sessionEnabledStepIds(session).find((stepId) =>
    isWorkflowStepUnlocked(session, stepId) && !isWorkflowStepComplete(session, stepId)
  ) ?? null;
}

export function mergeRun(workflow: AccompanimentWorkflowSession, run: AccompanimentWorkflowRun, promptNote: string): AccompanimentWorkflowSession {
  const stepState = workflow.steps[run.stepId] ?? emptyStepState();
  
  // As requested, we just store only 1 last run (plus the active/selected run if it exists to preserve selections)
  const selectedRun = stepState.activeRunId && stepState.selectedOptionId
    ? stepState.runs.find((candidate) => candidate.id === stepState.activeRunId)
    : null;
  const nextRuns = selectedRun && selectedRun.id !== run.id
    ? [selectedRun, run]
    : [run];
  const hasSelectedOption = Boolean(
    stepState.activeRunId
      && stepState.selectedOptionId
      && nextRuns.some((candidate) => candidate.id === stepState.activeRunId && candidate.options.some((option) => option.id === stepState.selectedOptionId))
  );

  return {
    ...workflow,
    currentStepId: run.stepId,
    steps: {
      ...workflow.steps,
      [run.stepId]: {
        ...stepState,
        runs: nextRuns,
        activeRunId: hasSelectedOption ? stepState.activeRunId : run.id,
        selectedOptionId: hasSelectedOption ? stepState.selectedOptionId : null,
        selectedAt: hasSelectedOption ? stepState.selectedAt : null,
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
  promptNote: string,
  runId?: string
): AccompanimentWorkflowSession {
  const stepState = workflow.steps[stepId] ?? emptyStepState();
  const selectedWorkflow = {
    ...workflow,
    steps: {
      ...workflow.steps,
      [stepId]: {
        ...stepState,
        activeRunId: runId ?? stepState.activeRunId,
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
    guitarProfileHint: stepId === "guitar-comping-profile" ? extractProfile(option) : workflow.guitarProfileHint,
  };
}

export function extractProfile(option: AccompanimentWorkflowOption): string | null {
  const guitarTab = option.data.guitarTab;
  const guitarTabData = guitarTab && typeof guitarTab === "object" && !Array.isArray(guitarTab)
    ? guitarTab as Record<string, unknown>
    : null;
  const candidates = [
    guitarTabData?.compingProfileId,
    option.data.compingProfileId,
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
  };
}

export function hasWorkflowStepResults(
  workflow: AccompanimentWorkflowSession | null | undefined,
  stepIds: readonly AccompanimentWorkflowStepId[]
): boolean {
  if (!workflow) return false;
  return stepIds.some((stepId) => {
    const stepState = workflow.steps[stepId];
    return Boolean(stepState?.runs.length || stepState?.activeRunId || stepState?.selectedOptionId || stepState?.selectedAt);
  });
}
