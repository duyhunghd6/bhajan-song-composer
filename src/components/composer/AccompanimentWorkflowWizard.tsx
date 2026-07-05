"use client";

import { useEffect, useMemo, useState } from "react";
import { generateAccompanimentWorkflowStep, generateConsolidatedChordIngestionWorkflowSteps } from "@/app/actions/accompaniment-workflow";
import {
  ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  buildAccompanimentWorkflowPrompt,
  clearAccompanimentWorkflowStepResults,
  createAccompanimentWorkflowSession,
  extractLyricChordAnnotations,
  getAccompanimentWorkflowPromptSummary,
  getNextUncompletedWorkflowStepId,
  getSelectedWorkflowContext,
  getSelectedWorkflowOption,
  isAccompanimentWorkflowSourceCurrent,
  isAccompanimentWorkflowStepComplete,
  isAccompanimentWorkflowStepUnlocked,
  isChordIngestionWorkflowStep,
  type AccompanimentWorkflowMetadata,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowScope,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";

interface AccompanimentWorkflowWizardProps {
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  workflow: AccompanimentWorkflowSession | null;
  onWorkflowChange: (workflow: AccompanimentWorkflowSession | null) => void;
  onGuitarProfileSelected: (profile: string | null) => void;
  onPianoProfileSelected: (profile: string | null) => void;
}

const SCOPE_CLASS: Record<AccompanimentWorkflowScope, string> = {
  shared: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
  guitar: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
  piano: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-300",
};

function emptyStepState() {
  return { runs: [], activeRunId: null, selectedOptionId: null, selectedAt: null, promptNote: "" };
}

function mergeRun(workflow: AccompanimentWorkflowSession, run: AccompanimentWorkflowRun, promptNote: string): AccompanimentWorkflowSession {
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

function mergeRuns(workflow: AccompanimentWorkflowSession, runs: AccompanimentWorkflowRun[], promptNote: string): AccompanimentWorkflowSession {
  const next = runs.reduce((current, run) => mergeRun(current, run, promptNote), workflow);
  return {
    ...next,
    currentStepId: runs[0]?.stepId ?? next.currentStepId,
  };
}

function selectOption(
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

function extractProfile(option: AccompanimentWorkflowOption): string | null {
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

function makeSkippedOption(stepId: AccompanimentWorkflowStepId, instrumentLabel: string): AccompanimentWorkflowOption {
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

function skipWorkflowSteps(
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

function hasWorkflowStepResults(
  workflow: AccompanimentWorkflowSession,
  stepIds: readonly AccompanimentWorkflowStepId[]
): boolean {
  return stepIds.some((stepId) => {
    const stepState = workflow.steps[stepId];
    return Boolean(stepState?.runs.length || stepState?.activeRunId || stepState?.selectedOptionId || stepState?.selectedAt);
  });
}

function RunOptionList({
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

export default function AccompanimentWorkflowWizard({
  sourceAbc,
  metadata,
  workflow,
  onWorkflowChange,
  onGuitarProfileSelected,
  onPianoProfileSelected,
}: AccompanimentWorkflowWizardProps) {
  const [activeStepId, setActiveStepId] = useState<AccompanimentWorkflowStepId>(workflow?.currentStepId ?? "melody-snapshot");
  const [userNotes, setUserNotes] = useState<Partial<Record<AccompanimentWorkflowStepId, string>>>({});
  const [savedNoteStepId, setSavedNoteStepId] = useState<AccompanimentWorkflowStepId | null>(null);
  const [generatingStepId, setGeneratingStepId] = useState<AccompanimentWorkflowStepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceCurrent = isAccompanimentWorkflowSourceCurrent(workflow, sourceAbc);
  const session = useMemo(() => workflow && sourceCurrent ? workflow : null, [workflow, sourceCurrent]);
  const persistedCurrentStepId = session?.currentStepId;
  const activeStep = ACCOMPANIMENT_WORKFLOW_STEPS.find((step) => step.id === activeStepId) ?? ACCOMPANIMENT_WORKFLOW_STEPS[0];
  const activeStepState = session?.steps[activeStep.id] ?? emptyStepState();
  const activeUserNote = userNotes[activeStep.id] ?? activeStepState.promptNote;
  const lyricChordAnnotations = useMemo(() => extractLyricChordAnnotations(sourceAbc), [sourceAbc]);
  const canConsolidateChordIngestion = lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(activeStep.id);
  const promptPreview = buildAccompanimentWorkflowPrompt({
    stepId: activeStep.id,
    sourceAbc,
    metadata,
    previousSelections: session ? getSelectedWorkflowContext(session, activeStep.id) : [],
    userNote: activeUserNote,
  });

  useEffect(() => {
    if (!persistedCurrentStepId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- active wizard step must hydrate from the persisted workflow session after localStorage restore.
    setActiveStepId((current) => current === persistedCurrentStepId ? current : persistedCurrentStepId);
  }, [persistedCurrentStepId]);

  const beginWorkflow = () => {
    const next = createAccompanimentWorkflowSession(sourceAbc);
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    onGuitarProfileSelected(null);
    onPianoProfileSelected(null);
    setUserNotes({});
    setSavedNoteStepId(null);
    setGeneratingStepId(null);
    setError(null);
  };

  const savePromptNote = () => {
    if (!session) return;
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
    if (!session) return;
    setGeneratingStepId(activeStep.id);
    setError(null);
    try {
      if (canConsolidateChordIngestion) {
        const runs = await generateConsolidatedChordIngestionWorkflowSteps({
          sourceAbc,
          metadata,
          previousSelections: getSelectedWorkflowContext(session, "chord-tone-mapping"),
          userNote: activeUserNote,
        });
        onWorkflowChange(mergeRuns(session, runs, activeUserNote));
        return;
      }

      const run = await generateAccompanimentWorkflowStep({
        stepId: activeStep.id,
        sourceAbc,
        metadata,
        previousSelections: getSelectedWorkflowContext(session, activeStep.id),
        userNote: activeUserNote,
      });
      onWorkflowChange(mergeRun(session, run, activeUserNote));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate workflow options.");
    } finally {
      setGeneratingStepId(null);
    }
  };

  const handleSkipInstrument = (instrument: "Guitar" | "Piano") => {
    if (!session) return;
    const stepIds = instrument === "Guitar" ? ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS : ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS;
    const next = skipWorkflowSteps(session, stepIds, instrument, activeUserNote);
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    if (instrument === "Guitar") onGuitarProfileSelected(null);
    if (instrument === "Piano") onPianoProfileSelected(null);
    setError(null);
  };

  const handleClearInstrument = (instrument: "Guitar" | "Piano") => {
    if (!session) return;
    const stepIds = instrument === "Guitar" ? ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS : ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS;
    const clearedWorkflow = clearAccompanimentWorkflowStepResults(session, stepIds);
    const next = {
      ...clearedWorkflow,
      guitarProfileHint: instrument === "Guitar" ? null : clearedWorkflow.guitarProfileHint,
      pianoProfileHint: instrument === "Piano" ? null : clearedWorkflow.pianoProfileHint,
    };
    onWorkflowChange(next);
    setActiveStepId(next.currentStepId);
    if (instrument === "Guitar") onGuitarProfileSelected(null);
    if (instrument === "Piano") onPianoProfileSelected(null);
    setError(null);
  };

  const handleSelectOption = (option: AccompanimentWorkflowOption) => {
    if (!session) return;
    const next = selectOption(session, activeStep.id, option, activeUserNote);
    onWorkflowChange(next);
    if (activeStep.id === "guitar-fills-validation") onGuitarProfileSelected(extractProfile(option));
    if (activeStep.id === "piano-fills-pedal-validation") onPianoProfileSelected(extractProfile(option));
  };

  if (!session) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Step-by-step AI Accompaniment Workflow</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Start a persisted human-in-the-loop session for the current harmonized ABC. Each step stores LLM options and your selected choice.
          </p>
          {workflow && !sourceCurrent && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
              The melody or harmonized ABC changed since the saved workflow was created. Start a fresh workflow to avoid mixing old choices with new music.
            </p>
          )}
        </div>
        <button type="button" onClick={beginWorkflow} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-600">
          {workflow && !sourceCurrent ? "Reset Workflow for Current ABC" : "Start 12-step Workflow"}
        </button>
      </div>
    );
  }

  const activeUnlocked = isAccompanimentWorkflowStepUnlocked(session, activeStep.id);
  const canSkipGuitar = activeUnlocked && activeStep.scope === "guitar";
  const canSkipPiano = activeUnlocked && activeStep.scope === "piano";
  const hasGuitarResults = hasWorkflowStepResults(session, ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS);
  const hasPianoResults = hasWorkflowStepResults(session, ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Step-by-step AI Accompaniment Workflow</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            12 review points: shared harmonic foundation first, then Guitar and Piano branches.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasGuitarResults && (
            <button
              type="button"
              onClick={() => handleClearInstrument("Guitar")}
              className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
            >
              Clear Guitar Result Set
            </button>
          )}
          {hasPianoResults && (
            <button
              type="button"
              onClick={() => handleClearInstrument("Piano")}
              className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-2.5 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300"
            >
              Clear Piano Result Set
            </button>
          )}
          <button type="button" onClick={beginWorkflow} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400">
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ACCOMPANIMENT_WORKFLOW_STEPS.map((step) => {
          const complete = isAccompanimentWorkflowStepComplete(session, step.id);
          const unlocked = isAccompanimentWorkflowStepUnlocked(session, step.id);
          const selected = getSelectedWorkflowOption(session, step.id);
          return (
            <button
              key={step.id}
              type="button"
              disabled={!unlocked}
              onClick={() => setActiveStepId(step.id)}
              className={`rounded-xl border p-3 text-left transition ${
                activeStepId === step.id
                  ? "border-amber-400 bg-amber-500/10"
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
              <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{selected?.label ?? (unlocked ? "Ready" : "Locked")}</p>
            </button>
          );
        })}
      </div>

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
          {canSkipGuitar && (
            <button
              type="button"
              disabled={generatingStepId === activeStep.id}
              onClick={() => handleSkipInstrument("Guitar")}
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300"
            >
              Skip Guitar Branch
            </button>
          )}
          {canSkipPiano && (
            <button
              type="button"
              disabled={generatingStepId === activeStep.id}
              onClick={() => handleSkipInstrument("Piano")}
              className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-300"
            >
              Skip Piano Branch
            </button>
          )}
          {!activeUnlocked && <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">Select required previous steps before generating this one.</span>}
        </div>

        <RunOptionList workflow={session} stepId={activeStep.id} onSelect={handleSelectOption} />
      </section>
    </div>
  );
}
