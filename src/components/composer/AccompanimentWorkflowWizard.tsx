"use client";

import { useEffect, useMemo, useState } from "react";
import { generateAccompanimentWorkflowStep, generateConsolidatedChordIngestionWorkflowSteps } from "@/app/actions/accompaniment-workflow";
import {
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  applyAccompanimentWorkflowSetupToSession,
  buildAccompanimentWorkflowPrompt,
  clearAccompanimentWorkflowStepResults,
  createAccompanimentWorkflowSession,
  extractLyricChordAnnotations,
  getAccompanimentWorkflowPromptSummary,
  getDefaultAccompanimentWorkflowSetup,
  getSelectedWorkflowContext,
  getSelectedWorkflowOption,
  getVisibleAccompanimentWorkflowSteps,
  getVisibleAccompanimentWorkflowStepsForSetup,
  hasWorkflowStepResults,
  isAccompanimentWorkflowSourceCurrent,
  isAccompanimentWorkflowStepComplete,
  isAccompanimentWorkflowStepUnlocked,
  isChordIngestionWorkflowStep,
  mergeRun,
  mergeRuns,
  normalizeAccompanimentWorkflowSetup,
  selectOption,
  skipWorkflowSteps,
  emptyStepState,
  type AccompanimentWorkflowLlmLogEntry,
  type AccompanimentWorkflowMetadata,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowScope,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowSetup,
  type AccompanimentWorkflowStepDefinition,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";

import {
  LlmCallLogPanel,
  RunOptionList,
  SCOPE_CLASS,
} from "./accompaniment-workflow/wizard-parts";
import WorkflowSetupPanel from "./accompaniment-workflow/WorkflowSetupPanel";

type BranchScope = Exclude<AccompanimentWorkflowScope, "shared">;

interface AccompanimentWorkflowWizardProps {
  mode?: "harmony" | "accompaniment" | "guitar";
  sourceAbc: string;
  branchSourceAbc?: string | null;
  metadata: AccompanimentWorkflowMetadata;
  workflow: AccompanimentWorkflowSession | null;
  workflowSetup: AccompanimentWorkflowSetup | null;
  onWorkflowChange: (workflow: AccompanimentWorkflowSession | null) => void;
  onWorkflowSetupChange: (setup: AccompanimentWorkflowSetup) => void;
  onReset?: () => void;
}

const BRANCH_LABELS: Record<BranchScope, string> = {
  guitar: "Guitar",
  harmonium: "Harmonium",
  djembe: "Djembe",
};

interface WorkflowStepGridProps {
  steps: AccompanimentWorkflowStepDefinition[];
  session: AccompanimentWorkflowSession | null;
  activeStepId: AccompanimentWorkflowStepId;
  onStepClick: (stepId: AccompanimentWorkflowStepId) => void;
}

function WorkflowStepGrid({ steps, session, activeStepId, onStepClick }: WorkflowStepGridProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {steps.map((step) => {
        const complete = session ? isAccompanimentWorkflowStepComplete(session, step.id) : false;
        const unlocked = session ? isAccompanimentWorkflowStepUnlocked(session, step.id) : true;
        const selected = session ? getSelectedWorkflowOption(session, step.id) : null;
        return (
          <button
            key={step.id}
            type="button"
            disabled={session ? !unlocked : false}
            onClick={() => onStepClick(step.id)}
            className={`rounded-xl border p-3 text-left transition ${
              activeStepId === step.id
                ? "border-amber-400 bg-amber-50/10"
                : complete
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30"
                  : unlocked
                    ? "border-zinc-200 bg-zinc-50 hover:border-amber-300/60 dark:border-zinc-800 dark:bg-zinc-900/50"
                    : "border-zinc-200 bg-zinc-100 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{step.index}. {step.shortLabel}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${SCOPE_CLASS[step.scope]}`}>{step.scope}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
              {selected?.label ?? (session ? (unlocked ? "Ready" : "Locked") : "Planned")}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function makeClientLlmLog(input: {
  stepId: AccompanimentWorkflowStepId;
  status: AccompanimentWorkflowLlmLogEntry["status"];
  message: string;
}): AccompanimentWorkflowLlmLogEntry {
  return {
    id: `client-${input.stepId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    stepId: input.stepId,
    kind: input.status === "started" ? "chat-request" : "chat-error",
    status: input.status,
    message: input.message,
  };
}

function logsFromRuns(runs: AccompanimentWorkflowRun[]): AccompanimentWorkflowLlmLogEntry[] {
  const seen = new Set<string>();
  const logs: AccompanimentWorkflowLlmLogEntry[] = [];
  for (const run of runs) {
    for (const log of run.diagnostics?.llmLogs ?? []) {
      if (seen.has(log.id)) continue;
      seen.add(log.id);
      logs.push(log);
    }
  }
  return logs;
}

function enabledBranchScopes(session: AccompanimentWorkflowSession): BranchScope[] {
  const visibleScopes = new Set(getVisibleAccompanimentWorkflowSteps(session).map((step) => step.scope));
  return (Object.keys(ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS) as BranchScope[])
    .filter((scope) => visibleScopes.has(scope));
}

export default function AccompanimentWorkflowWizard({
  mode = "accompaniment",
  sourceAbc,
  branchSourceAbc,
  metadata,
  workflow,
  workflowSetup,
  onWorkflowChange,
  onWorkflowSetupChange,
  onReset,
}: AccompanimentWorkflowWizardProps) {
  const sourceCurrent = isAccompanimentWorkflowSourceCurrent(workflow, sourceAbc);
  const session = useMemo(() => workflow && sourceCurrent ? workflow : null, [workflow, sourceCurrent]);
  const branchWorkflowSourceAbc = mode === "accompaniment" ? branchSourceAbc : sourceAbc;
  const effectivePromptSourceAbc = branchWorkflowSourceAbc ?? sourceAbc;
  const editableSetup = useMemo(
    () => workflowSetup || session?.setup
      ? normalizeAccompanimentWorkflowSetup(workflowSetup ?? session?.setup)
      : getDefaultAccompanimentWorkflowSetup(),
    [workflowSetup, session?.setup]
  );
  const visibleSteps = useMemo(
    () => session
      ? getVisibleAccompanimentWorkflowSteps(session)
      : getVisibleAccompanimentWorkflowStepsForSetup(editableSetup),
    [session, editableSetup]
  );
  const filteredSteps = useMemo(() => {
    if (mode === "harmony") {
      return visibleSteps.filter((s) => s.scope === "shared");
    } else if (mode === "guitar") {
      return visibleSteps.filter((s) => s.scope === "guitar");
    } else {
      return visibleSteps.filter((s) => s.scope !== "shared");
    }
  }, [visibleSteps, mode]);

  const [activeStepId, setActiveStepId] = useState<AccompanimentWorkflowStepId>(
    session && filteredSteps.some((s) => s.id === session.currentStepId)
      ? session.currentStepId
      : filteredSteps[0]?.id ?? "key-beats"
  );
  const [userNotes, setUserNotes] = useState<Partial<Record<AccompanimentWorkflowStepId, string>>>({});
  const [savedNoteStepId, setSavedNoteStepId] = useState<AccompanimentWorkflowStepId | null>(null);
  const [generatingStepId, setGeneratingStepId] = useState<AccompanimentWorkflowStepId | null>(null);
  const [liveLlmLogs, setLiveLlmLogs] = useState<AccompanimentWorkflowLlmLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const activeStep = filteredSteps.find((step) => step.id === activeStepId) ?? filteredSteps[0];
  const activeStepState = activeStep && session ? session.steps[activeStep.id] ?? emptyStepState() : emptyStepState();
  const activeUserNote = activeStep ? userNotes[activeStep.id] ?? activeStepState.promptNote : "";
  const lyricChordAnnotations = useMemo(() => extractLyricChordAnnotations(effectivePromptSourceAbc), [effectivePromptSourceAbc]);
  const canConsolidateChordIngestion = Boolean(activeStep && lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(activeStep.id));
  const promptPreview = activeStep ? buildAccompanimentWorkflowPrompt({
    stepId: activeStep.id,
    sourceAbc: effectivePromptSourceAbc,
    metadata,
    previousSelections: session ? getSelectedWorkflowContext(session, activeStep.id) : [],
    setup: session?.setup ?? editableSetup,
    userNote: activeUserNote,
  }) : "";

  useEffect(() => {
    if (!session?.currentStepId) return;
    if (filteredSteps.some((s) => s.id === session.currentStepId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveStepId((current) => current === session.currentStepId ? current : session.currentStepId);
    }
  }, [session?.currentStepId, filteredSteps]);

  useEffect(() => {
    if (filteredSteps.some((step) => step.id === activeStepId)) return;
    const fallback = filteredSteps[0]?.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fallback) setActiveStepId(fallback);
  }, [activeStepId, filteredSteps]);

  const beginWorkflow = (setup: AccompanimentWorkflowSetup = editableSetup) => {
    const normalizedSetup = normalizeAccompanimentWorkflowSetup(setup);
    const next = createAccompanimentWorkflowSession(sourceAbc, normalizedSetup);
    onWorkflowSetupChange(normalizedSetup);
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    setUserNotes({});
    setSavedNoteStepId(null);
    setGeneratingStepId(null);
    setLiveLlmLogs([]);
    setError(null);
  };

  const handleSetupChange = (setup: AccompanimentWorkflowSetup) => {
    const normalizedSetup = normalizeAccompanimentWorkflowSetup(setup);
    onWorkflowSetupChange(normalizedSetup);

    if (!session) return;

    const next = applyAccompanimentWorkflowSetupToSession(session, normalizedSetup);
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    setError(null);
  };

  const savePromptNote = () => {
    if (!session || !activeStep) return;
    const stepState = session.steps[activeStep.id] ?? emptyStepState();
    onWorkflowChange({
      ...session,
      steps: {
        ...session.steps,
        [activeStep.id]: {
          ...stepState,
          promptNote: activeUserNote,
        },
      },
    });
    setSavedNoteStepId(activeStep.id);
    window.setTimeout(() => setSavedNoteStepId((current) => current === activeStep.id ? null : current), 1600);
  };

  const generateStep = async () => {
    if (!session || !activeStep) return;
    const stepId = activeStep.id;
    const startedLog = makeClientLlmLog({
      stepId,
      status: "started",
      message: `LLM call started for Step ${activeStep.index}: ${activeStep.shortLabel}.`,
    });
    setGeneratingStepId(stepId);
    setLiveLlmLogs((current) => [...current, startedLog]);
    setError(null);
    try {
      if (canConsolidateChordIngestion) {
        const runs = await generateConsolidatedChordIngestionWorkflowSteps({
          sourceAbc: effectivePromptSourceAbc,
          metadata,
          previousSelections: getSelectedWorkflowContext(session, "chord-roles-progression"),
          setup: session.setup,
          userNote: activeUserNote,
        });
        setLiveLlmLogs((current) => [...current, ...logsFromRuns(runs)]);
        onWorkflowChange(mergeRuns(session, runs, activeUserNote));
        return;
      }

      const run = await generateAccompanimentWorkflowStep({
        stepId,
        sourceAbc: effectivePromptSourceAbc,
        metadata,
        previousSelections: getSelectedWorkflowContext(session, stepId),
        setup: session.setup,
        userNote: activeUserNote,
      });
      setLiveLlmLogs((current) => [...current, ...logsFromRuns([run])]);
      onWorkflowChange(mergeRun(session, run, activeUserNote));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to generate workflow options.";
      setLiveLlmLogs((current) => [
        ...current,
        makeClientLlmLog({
          stepId,
          status: "failed",
          message: `LLM call failed for Step ${activeStep.index}: ${message}`,
        }),
      ]);
      setError(message);
    } finally {
      setGeneratingStepId(null);
    }
  };

  const handleSkipBranch = (scope: BranchScope) => {
    if (!session) return;
    const next = skipWorkflowSteps(session, ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS[scope], BRANCH_LABELS[scope], activeUserNote);
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    setError(null);
  };

  const handleClearBranch = (scope: BranchScope) => {
    if (!session) return;
    const clearedWorkflow = clearAccompanimentWorkflowStepResults(session, ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS[scope]);
    const next = {
      ...clearedWorkflow,
      guitarProfileHint: scope === "guitar" ? null : clearedWorkflow.guitarProfileHint,
    };
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    setError(null);
  };

  const handleSelectOption = (option: AccompanimentWorkflowOption, runId: string) => {
    if (!session || !activeStep) return;
    onWorkflowChange(selectOption(session, activeStep.id, option, activeUserNote, runId));
  };

  if (mode === "accompaniment" && !branchSourceAbc) {
    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <h3 className="font-bold">Harmony validation required</h3>
        <p className="mt-1 leading-5">Select an option in Harmony step 3, Validate Harmony, before generating accompaniment branches.</p>
      </section>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        {mode === "accompaniment" && (
          <WorkflowSetupPanel
            setup={editableSetup}
            disabled={Boolean(generatingStepId)}
            onSetupChange={handleSetupChange}
          />
        )}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans">
            {mode === "harmony" ? "Step-by-step AI Harmony Workflow" : mode === "guitar" ? "Step-by-step Guitar Fingerstyle Workflow" : "Step-by-step AI Accompaniment Workflow"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {mode === "harmony"
              ? `${filteredSteps.length} planned review points for the shared harmonic foundation. Configure your instruments above before starting.`
              : mode === "guitar"
                ? `${filteredSteps.length} planned review points for the guitar fingerstyle arrangement.`
                : `${filteredSteps.length} planned review points will be created from the selected instruments. Change the setup above to preview the exact workflow before starting.`}
          </p>
          {workflow && !sourceCurrent && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
              The melody or harmonized ABC changed since the saved workflow was created. Start a fresh workflow to avoid mixing old choices with new music.
            </p>
          )}
        </div>
        <WorkflowStepGrid
          steps={filteredSteps}
          session={null}
          activeStepId={activeStep?.id ?? activeStepId}
          onStepClick={setActiveStepId}
        />
        {activeStep && (
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{activeStep.index}. {activeStep.label}</h4>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{activeStep.description}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${SCOPE_CLASS[activeStep.scope]}`}>{activeStep.scope}</span>
            </div>
            <details className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-xs font-bold text-zinc-700 dark:text-zinc-200">Default prompt preview</summary>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500 dark:text-zinc-400">{getAccompanimentWorkflowPromptSummary(activeStep.id)}</p>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{promptPreview}</pre>
            </details>
          </section>
        )}
        <button type="button" onClick={() => beginWorkflow()} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-600">
          {workflow && !sourceCurrent 
            ? "Reset Workflow for Current ABC" 
            : mode === "harmony"
              ? `Start ${filteredSteps.length}-step Harmony Workflow`
              : mode === "guitar"
                ? `Start ${filteredSteps.length}-step Guitar Fingerstyle Workflow`
                : `Start ${filteredSteps.length}-step Accompaniment Workflow`}
        </button>
      </div>
    );
  }

  const activeUnlocked = activeStep ? isAccompanimentWorkflowStepUnlocked(session, activeStep.id) : false;
  const workflowComplete = filteredSteps.length > 0 && filteredSteps.every((step) => isAccompanimentWorkflowStepComplete(session, step.id));
  const branchScopes = enabledBranchScopes(session);
  const canSkipActiveBranch = activeUnlocked && activeStep.scope !== "shared";
  const persistedLlmLogs = logsFromRuns(activeStepState.runs);
  const transientLlmLogs = activeStep ? liveLlmLogs.filter((log) =>
    log.stepId === activeStep.id || (log.stepId === "consolidated-chord-ingestion" && isChordIngestionWorkflowStep(activeStep.id))
  ) : [];
  const activeLlmLogs = Array.from(new Map([...persistedLlmLogs, ...transientLlmLogs].map((log) => [log.id, log])).values());

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      {mode === "accompaniment" && (
        <WorkflowSetupPanel
          setup={editableSetup}
          sessionSetup={session.setup}
          disabled={Boolean(generatingStepId)}
          onSetupChange={handleSetupChange}
          onResetWithSetup={() => beginWorkflow(editableSetup)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans">
            {mode === "harmony" ? "Step-by-step AI Harmony Workflow" : mode === "guitar" ? "Step-by-step Guitar Fingerstyle Workflow" : "Step-by-step AI Accompaniment Workflow"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {mode === "harmony"
              ? `${filteredSteps.length} shared harmonic foundation steps.`
              : mode === "guitar"
                ? workflowComplete
                  ? `Workflow complete: all ${filteredSteps.length} guitar review points selected and applied.`
                  : `${filteredSteps.length} review points for the guitar arrangement.`
                : workflowComplete
                  ? `Workflow complete: all ${filteredSteps.length} enabled accompaniment review point${filteredSteps.length === 1 ? "" : "s"} selected and applied to the result preview.`
                  : `${filteredSteps.length} review points: shared harmonic foundation first, then enabled instrument branches.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {branchScopes.map((scope) => hasWorkflowStepResults(session, ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS[scope]) && (
            <button
              key={scope}
              type="button"
              onClick={() => handleClearBranch(scope)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${SCOPE_CLASS[scope]}`}
            >
              Clear {BRANCH_LABELS[scope]} Result Set
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (onReset) {
                onReset();
              } else {
                beginWorkflow(session.setup);
              }
            }}
            className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
          >
            Reset
          </button>
        </div>
      </div>

      <WorkflowStepGrid
        steps={filteredSteps}
        session={session}
        activeStepId={activeStepId}
        onStepClick={setActiveStepId}
      />

      {workflowComplete && mode === "accompaniment" && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
          Accompaniment workflow complete. All enabled instrument steps are selected; disabled instruments were skipped by setup and are not required for the result ABC.
        </p>
      )}

      {activeStep ? (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{activeStep.index}. {activeStep.label}</h4>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{activeStep.description}</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${SCOPE_CLASS[activeStep.scope]}`}>{activeStep.scope}</span>
          </div>

          <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <summary className="cursor-pointer text-xs font-bold text-zinc-700 dark:text-zinc-200">Default prompt preview</summary>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500 dark:text-zinc-400">{getAccompanimentWorkflowPromptSummary(activeStep.id)}</p>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{promptPreview}</pre>
          </details>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
              User note to add to prompt
              <textarea
                value={activeUserNote}
                onChange={(event) => setUserNotes((current) => ({ ...current, [activeStep.id]: event.target.value }))}
                placeholder="Optional: add style, mood, instrument, raga, or playability instructions for this step."
                className="mt-2 min-h-20 w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-normal text-zinc-800 outline-none transition focus:border-amber-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!activeUnlocked}
                onClick={savePromptNote}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:text-amber-300"
              >
                Save prompt note
              </button>
              {savedNoteStepId === activeStep.id && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Prompt note saved</span>
              )}
              {activeStepState.promptNote && savedNoteStepId !== activeStep.id && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved note will be sent with this step.</span>
              )}
            </div>
          </div>

          {canConsolidateChordIngestion && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              Detected {lyricChordAnnotations.length} lyric chord annotation{lyricChordAnnotations.length === 1 ? "" : "s"}. Generate once to fill Chord Roles, Progression, and Validate Harmony from the supplied lyric chord progression.
            </p>
          )}

          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!activeUnlocked || generatingStepId === activeStep.id}
              onClick={generateStep}
              className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-600 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
            >
              {generatingStepId === activeStep.id
                ? "Generating..."
                : canConsolidateChordIngestion
                  ? "Generate 3 Harmony Steps from Lyrics Chords"
                  : "Generate / Regenerate Options"}
            </button>
            {canSkipActiveBranch && (
              <button
                type="button"
                disabled={generatingStepId === activeStep.id}
                onClick={() => handleSkipBranch(activeStep.scope as BranchScope)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${SCOPE_CLASS[activeStep.scope]}`}
              >
                Skip {BRANCH_LABELS[activeStep.scope as BranchScope]} Branch
              </button>
            )}
            {!activeUnlocked && <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">Select required previous steps before generating this one.</span>}
          </div>

          <RunOptionList workflow={session} stepId={activeStep.id} onSelect={handleSelectOption} />

          <LlmCallLogPanel logs={activeLlmLogs} />
        </section>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
          No accompaniment instrument steps are enabled. Use Accompaniment setup above to check at least one instrument.
        </p>
      )}
    </div>
  );
}
