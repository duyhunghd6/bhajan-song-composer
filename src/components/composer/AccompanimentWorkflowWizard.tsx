"use client";

import { isAlgorithmicHarmonyStep } from "@/lib/theory/harmony/workflow";
import { Button } from "@/components/ui/Button";


import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import harmonyStyles from "./workspace/harmony.module.css";
import GuitarIcon from "@/components/icons/GuitarIcon";

type BranchScope = Exclude<AccompanimentWorkflowScope, "shared">;

interface AccompanimentWorkflowWizardProps {
  presentation?: "default" | "studio";
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
};

interface WorkflowStepGridProps {
  steps: AccompanimentWorkflowStepDefinition[];
  session: AccompanimentWorkflowSession | null;
  activeStepId: AccompanimentWorkflowStepId;
  compact?: boolean;
  onStepClick: (stepId: AccompanimentWorkflowStepId) => void;
}

function ScopeBadge({ scope, className = "px-2 py-0.5" }: { scope: AccompanimentWorkflowScope, className?: string }) {
  return (
    <span className={`rounded-full border text-[10px] font-bold uppercase flex items-center justify-center ${className} ${SCOPE_CLASS[scope]}`}>
      {scope === "guitar" ? (
        <GuitarIcon className="w-4 h-4" />
      ) : (
        scope
      )}
    </span>
  );
}

function WorkflowStepGrid({ steps, session, activeStepId, onStepClick, compact }: WorkflowStepGridProps) {
  return (
    <div className={compact ? harmonyStyles.steps : "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"}>
      {steps.map((step) => {
        const complete = session ? isAccompanimentWorkflowStepComplete(session, step.id) : false;
        const unlocked = session ? isAccompanimentWorkflowStepUnlocked(session, step.id) : true;
        const selected = session ? getSelectedWorkflowOption(session, step.id) : null;
        return (
          <Button variant="choice" size="sm"
            key={step.id}
            type="button"
            aria-pressed={activeStepId === step.id}
            disabled={session ? !unlocked : false}
            onClick={() => onStepClick(step.id)}

          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{step.index}. {step.shortLabel}</span>
              {!compact && <ScopeBadge scope={step.scope} />}
            </div>
            <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
              {selected?.label ?? (complete ? "Selected" : session ? (unlocked ? "Ready" : "Locked") : "Explore")}
            </p>
          </Button>
        );
      })}
    </div>
  );
}

function WorkflowDetails({ compact, label, children }: { compact: boolean; label: string; children: ReactNode }) {
  if (!compact) return <>{children}</>;
  return <details className={harmonyStyles.advanced}><summary>{label}</summary><div className="mt-4 space-y-3">{children}</div></details>;
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
  presentation = "default",
  sourceAbc,
  branchSourceAbc,
  metadata,
  workflow,
  workflowSetup,
  onWorkflowChange,
  onWorkflowSetupChange,
  onReset,
}: AccompanimentWorkflowWizardProps) {
  const compactPresentation = mode === "harmony" || presentation === "studio";
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
  const algorithmicHarmony = Boolean(activeStep && isAlgorithmicHarmonyStep(activeStep.id));
  const activeStepState = activeStep && session ? session.steps[activeStep.id] ?? emptyStepState() : emptyStepState();
  const activeUserNote = activeStep ? userNotes[activeStep.id] ?? activeStepState.promptNote : "";
  const lyricChordAnnotations = useMemo(() => extractLyricChordAnnotations(effectivePromptSourceAbc), [effectivePromptSourceAbc]);
  const canConsolidateChordIngestion = Boolean(!algorithmicHarmony && activeStep && lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(activeStep.id));
  const promptPreview = activeStep && !algorithmicHarmony ? buildAccompanimentWorkflowPrompt({
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
    if (!algorithmicHarmony) setLiveLlmLogs((current) => [...current, startedLog]);
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
      if (!algorithmicHarmony) setLiveLlmLogs((current) => [
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
      <div className={compactPresentation ? harmonyStyles.wizard : "space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50"}>
        {mode === "accompaniment" && (
          <WorkflowSetupPanel
            setup={editableSetup}
            disabled={Boolean(generatingStepId)}
            onSetupChange={handleSetupChange}
          />
        )}
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans">
            {mode === "harmony" ? "Build your harmony" : mode === "guitar" ? "Step-by-step Guitar Fingerstyle Workflow" : (presentation === "studio" ? "Shape your accompaniment" : "Step-by-step AI Accompaniment Workflow")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {mode === "harmony"
              ? "Start with the key and rhythm, explore chords, then review the harmony."
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
          compact={compactPresentation}
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
              {!compactPresentation && <ScopeBadge scope={activeStep.scope} className="px-2 py-1" />}
            </div>
            {!algorithmicHarmony && <details className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-xs font-bold text-zinc-700 dark:text-zinc-200">Default prompt preview</summary>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500 dark:text-zinc-400">{getAccompanimentWorkflowPromptSummary(activeStep.id)}</p>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{promptPreview}</pre>
            </details>}
            {algorithmicHarmony && <p className="mt-3 text-xs text-zinc-500">Analyze key and meter, rank chord progressions, then validate your selection. No AI connection required.</p>}
          </section>
        )}
        <Button variant="primary" size="md" type="button" onClick={() => beginWorkflow()} >
          {workflow && !sourceCurrent 
            ? "Reset Workflow for Current ABC" 
            : mode === "harmony"
              ? "Start shaping harmony →"
              : mode === "guitar"
                ? `Start ${filteredSteps.length}-step Guitar Fingerstyle Workflow`
                : `Start ${filteredSteps.length}-step Accompaniment Workflow`}
        </Button>
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
    <div className={compactPresentation ? harmonyStyles.wizard : "space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50"}>
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
            {mode === "harmony" ? "Build your harmony" : mode === "guitar" ? "Step-by-step Guitar Fingerstyle Workflow" : (presentation === "studio" ? "Shape your accompaniment" : "Step-by-step AI Accompaniment Workflow")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {mode === "harmony"
              ? "Generate suggestions, then select a result to unlock the next step."
              : mode === "guitar"
                ? workflowComplete
                  ? `Workflow complete: all ${filteredSteps.length} guitar review points selected and applied.`
                  : `${filteredSteps.length} review points for the guitar arrangement.`
                : workflowComplete
                  ? `Workflow complete: all ${filteredSteps.length} enabled accompaniment review point${filteredSteps.length === 1 ? "" : "s"} selected and applied to the result preview.`
                  : (presentation === "studio" ? "Choose a playing style, refine voicings, then create the score." : `${filteredSteps.length} review points: shared harmonic foundation first, then enabled instrument branches.`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {branchScopes.map((scope) => hasWorkflowStepResults(session, ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS[scope]) && (
            <Button variant="danger" size="sm"
              key={scope}
              type="button"
              onClick={() => handleClearBranch(scope)}

            >
              Clear {BRANCH_LABELS[scope]} Result Set
            </Button>
          ))}
          <Button variant="danger" size="sm"
            type="button"
            onClick={() => {
              if (onReset) {
                onReset();
              } else {
                beginWorkflow(session.setup);
              }
            }}

          >
            Reset
          </Button>
        </div>
      </div>

      <WorkflowStepGrid
          compact={compactPresentation}
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
            {!compactPresentation && <ScopeBadge scope={activeStep.scope} className="px-2 py-1" />}
          </div>

          {!algorithmicHarmony && <WorkflowDetails compact={compactPresentation} label="Creative direction & prompt">
          <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <summary className="cursor-pointer text-xs font-bold text-zinc-700 dark:text-zinc-200">Default prompt preview</summary>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500 dark:text-zinc-400">{getAccompanimentWorkflowPromptSummary(activeStep.id)}</p>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{promptPreview}</pre>
          </details>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
              Your direction (optional)
              <textarea
                value={activeUserNote}
                onChange={(event) => setUserNotes((current) => ({ ...current, [activeStep.id]: event.target.value }))}
                placeholder="Optional: add style, mood, instrument, raga, or playability instructions for this step."
                className="mt-2 min-h-20 w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-normal text-zinc-800 outline-none transition focus:border-amber-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm"
                type="button"
                disabled={!activeUnlocked}
                onClick={savePromptNote}

              >
                Save prompt note
              </Button>
              {savedNoteStepId === activeStep.id && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Prompt note saved</span>
              )}
              {activeStepState.promptNote && savedNoteStepId !== activeStep.id && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved note will be sent with this step.</span>
              )}
            </div>
          </div>

          </WorkflowDetails>}
          {algorithmicHarmony && <p className="text-xs text-zinc-500">Calculated from melody, key and meter. No AI connection required. Select a result to continue.</p>}

          {canConsolidateChordIngestion && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              Detected {lyricChordAnnotations.length} lyric chord annotation{lyricChordAnnotations.length === 1 ? "" : "s"}. Generate once to fill Chord Roles, Progression, and Validate Harmony from the supplied lyric chord progression.
            </p>
          )}

          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md"
              type="button"
              disabled={!activeUnlocked || generatingStepId === activeStep.id}
              onClick={generateStep}

            >
              {generatingStepId === activeStep.id
                ? (compactPresentation ? "Generating suggestions…" : "Generating...")
                : canConsolidateChordIngestion
                  ? "Generate 3 Harmony Steps from Lyrics Chords"
                  : compactPresentation
                    ? (activeStepState.runs.length ? (algorithmicHarmony ? "Recalculate suggestions" : "Try new suggestions") : "Generate suggestions")
                    : "Generate / Regenerate Options"}
            </Button>
            {canSkipActiveBranch && (
              <Button variant="ghost" size="sm"
                type="button"
                disabled={generatingStepId === activeStep.id}
                onClick={() => handleSkipBranch(activeStep.scope as BranchScope)}

              >
                Skip {BRANCH_LABELS[activeStep.scope as BranchScope]} Branch
              </Button>
            )}
            {!activeUnlocked && <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">Select required previous steps before generating this one.</span>}
          </div>

          {(!compactPresentation || activeStepState.runs.length > 0) && <RunOptionList workflow={session} stepId={activeStep.id} onSelect={handleSelectOption} />}

          {!algorithmicHarmony && <WorkflowDetails compact={compactPresentation} label={`Generation activity · ${activeLlmLogs.length} events`}><LlmCallLogPanel logs={activeLlmLogs} /></WorkflowDetails>}
        </section>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
          No accompaniment instrument steps are enabled. Use Accompaniment setup above to check at least one instrument.
        </p>
      )}
    </div>
  );
}
