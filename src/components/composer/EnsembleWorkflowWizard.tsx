"use client";

import { useEffect, useMemo, useState } from "react";
import { generateEnsembleWorkflowStep } from "@/app/actions/ensemble-workflow";
import { generateEnsembleExpansionOutput } from "@/lib/theory/ensemble-output-contract";
import type { AccompanimentStage } from "@/lib/theory/accompaniment-stage";
import {
  buildEnsembleWorkflowPrompt,
  createEnsembleWorkflowSession,
  ENSEMBLE_WORKFLOW_STEP_IDS,
  ENSEMBLE_WORKFLOW_STEPS,
  fingerprintEnsembleSelections,
  fingerprintEnsembleSource,
  getEnsembleGenerationPlan,
  getEnsembleInstrumentStepIds,
  getEnsembleStepInstrument,
  getEnsembleWorkflowPromptSummary,
  getSelectedEnsembleWorkflowContext,
  getSelectedEnsembleWorkflowOption,
  isEnsembleInstrumentSkipped,
  isEnsembleWorkflowSourceCurrent,
  isEnsembleWorkflowStepComplete,
  isEnsembleWorkflowStepUnlocked,
  type EnsembleInstrument,
  type EnsembleWorkflowMetadata,
  type EnsembleWorkflowOption,
  type EnsembleWorkflowRun,
  type EnsembleWorkflowScope,
  type EnsembleWorkflowSession,
  type EnsembleWorkflowStepId,
} from "@/lib/theory/ensemble-workflow";
import type { EnsembleLayerAbcBundle } from "./useWorkspaceState";

interface EnsembleWorkflowWizardProps {
  sourceAbc: string;
  melodyAbc: string;
  accompaniment: AccompanimentStage | null;
  metadata: EnsembleWorkflowMetadata;
  workflow: EnsembleWorkflowSession | null;
  stagedLayers: EnsembleLayerAbcBundle | null;
  appliedLayers: EnsembleLayerAbcBundle | null;
  onWorkflowChange: (workflow: EnsembleWorkflowSession | null) => void;
  onStagedLayersChange: (layers: EnsembleLayerAbcBundle | null) => void;
  onAppliedLayersChange: (layers: EnsembleLayerAbcBundle | null) => void;
}

const SCOPE_CLASS: Record<EnsembleWorkflowScope, string> = {
  shared: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
  djembe: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-300",
  flute: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-300",
  violin: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/70 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  final: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function emptyStepState() {
  return { runs: [], activeRunId: null, selectedOptionId: null, selectedAt: null, promptNote: "" };
}

function mergeRun(workflow: EnsembleWorkflowSession, run: EnsembleWorkflowRun, promptNote: string): EnsembleWorkflowSession {
  const stepState = workflow.steps[run.stepId] ?? emptyStepState();
  return {
    ...workflow,
    currentStepId: run.stepId,
    appliedAt: null,
    appliedSelectionFingerprint: null,
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

function selectOption(
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

function buildSkipOption(instrument: EnsembleInstrument): EnsembleWorkflowOption {
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

function skipInstrumentSteps(workflow: EnsembleWorkflowSession, instrument: EnsembleInstrument): EnsembleWorkflowSession {
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
      runs: [...stepState.runs, run],
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

function RunOptionList({
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

export default function EnsembleWorkflowWizard({
  sourceAbc,
  melodyAbc,
  accompaniment,
  metadata,
  workflow,
  stagedLayers,
  appliedLayers,
  onWorkflowChange,
  onStagedLayersChange,
  onAppliedLayersChange,
}: EnsembleWorkflowWizardProps) {
  const [activeStepId, setActiveStepId] = useState<EnsembleWorkflowStepId>(workflow?.currentStepId ?? "foundation-handshake");
  const [userNotes, setUserNotes] = useState<Partial<Record<EnsembleWorkflowStepId, string>>>({});
  const [savedNoteStepId, setSavedNoteStepId] = useState<EnsembleWorkflowStepId | null>(null);
  const [generatingStepId, setGeneratingStepId] = useState<EnsembleWorkflowStepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceCurrent = isEnsembleWorkflowSourceCurrent(workflow, sourceAbc);
  const session = useMemo(() => workflow && sourceCurrent ? workflow : null, [workflow, sourceCurrent]);
  const persistedCurrentStepId = session?.currentStepId;
  const activeStep = ENSEMBLE_WORKFLOW_STEPS.find((step) => step.id === activeStepId) ?? ENSEMBLE_WORKFLOW_STEPS[0];
  const activeStepState = session?.steps[activeStep.id] ?? emptyStepState();
  const activeUserNote = userNotes[activeStep.id] ?? activeStepState.promptNote;
  const selectedContexts = session ? getSelectedEnsembleWorkflowContext(session) : [];
  const selectionFingerprint = session ? fingerprintEnsembleSelections(session) : "";
  const sourceFingerprint = fingerprintEnsembleSource(sourceAbc);
  const promptPreview = buildEnsembleWorkflowPrompt({
    stepId: activeStep.id,
    sourceAbc,
    metadata,
    previousSelections: session ? getSelectedEnsembleWorkflowContext(session, activeStep.id) : [],
    userNote: activeUserNote,
  });

  useEffect(() => {
    if (!persistedCurrentStepId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- active wizard step must hydrate from the persisted workflow session after localStorage restore.
    setActiveStepId((current) => current === persistedCurrentStepId ? current : persistedCurrentStepId);
  }, [persistedCurrentStepId]);

  const beginWorkflow = () => {
    const next = createEnsembleWorkflowSession(sourceAbc);
    onWorkflowChange(next);
    onStagedLayersChange(null);
    onAppliedLayersChange(null);
    setActiveStepId(next.currentStepId);
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
      const run = await generateEnsembleWorkflowStep({
        stepId: activeStep.id,
        sourceAbc,
        metadata,
        previousSelections: getSelectedEnsembleWorkflowContext(session, activeStep.id),
        userNote: activeUserNote,
      });
      onWorkflowChange(mergeRun(session, run, activeUserNote));
      onStagedLayersChange(null);
      onAppliedLayersChange(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate ensemble workflow options.");
    } finally {
      setGeneratingStepId(null);
    }
  };

  const handleSelectOption = (option: EnsembleWorkflowOption) => {
    if (!session) return;
    const next = selectOption(session, activeStep.id, option, activeUserNote);
    onWorkflowChange(next);
    onStagedLayersChange(null);
    onAppliedLayersChange(null);
  };

  const buildFinalReviewPreview = () => {
    if (!session || !accompaniment) {
      setError("Generate or select a Layer 2 accompaniment before building ensemble layers.");
      return;
    }

    try {
      const output = generateEnsembleExpansionOutput(melodyAbc, {
        accompaniment,
        plan: getEnsembleGenerationPlan(session),
      });
      const djembeSkipped = isEnsembleInstrumentSkipped(session, "djembe");
      const fluteSkipped = isEnsembleInstrumentSkipped(session, "flute");
      const violinSkipped = isEnsembleInstrumentSkipped(session, "violin");
      const djembe = djembeSkipped ? null : output.abcLayers.layer3Djembe;
      const flute = fluteSkipped ? null : output.abcLayers.layer3Flute;
      const violin = violinSkipped ? null : output.abcLayers.layer3Violin;
      onStagedLayersChange({
        djembe,
        flute,
        violin,
        combined: [djembe, flute, violin].filter(Boolean).join("\n"),
        sourceFingerprint,
        selectionFingerprint,
        appliedAt: null,
        validation: output.validation,
        conflictReport: output.conflictReport,
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to build ensemble review preview.");
    }
  };

  const applyReviewedLayers = () => {
    if (!session || !stagedLayers) return;
    const appliedAt = new Date().toISOString();
    onAppliedLayersChange({ ...stagedLayers, appliedAt });
    onWorkflowChange({
      ...session,
      appliedAt,
      appliedSelectionFingerprint: stagedLayers.selectionFingerprint,
    });
  };

  if (!session) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Step-by-step AI Ensemble Workflow</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Start a persisted Djembe → Flute → Violin workflow. Instrument choices are staged first and only added to ABCNotation after final review.
          </p>
          {workflow && !sourceCurrent && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
              The ensemble foundation changed since the saved workflow was created. Start a fresh workflow to avoid mixing old choices with new music.
            </p>
          )}
        </div>
        <button type="button" onClick={beginWorkflow} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">
          {workflow && !sourceCurrent ? "Reset Ensemble Workflow for Current ABC" : "Start 8-step Ensemble Workflow"}
        </button>
      </div>
    );
  }

  const activeUnlocked = isEnsembleWorkflowStepUnlocked(session, activeStep.id);
  const activeInstrument = getEnsembleStepInstrument(activeStep.id);
  const activeInstrumentSkipped = activeInstrument ? isEnsembleInstrumentSkipped(session, activeInstrument) : false;
  const finalUnlocked = isEnsembleWorkflowStepUnlocked(session, "final-conflict-review-apply");
  const stagedCurrent = stagedLayers?.sourceFingerprint === sourceFingerprint && stagedLayers.selectionFingerprint === selectionFingerprint;
  const appliedCurrent = appliedLayers?.sourceFingerprint === sourceFingerprint && appliedLayers.selectionFingerprint === selectionFingerprint;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Step-by-step AI Ensemble Workflow</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            8 review points: foundation, Djembe, Flute, Violin, then one final staged apply to ABCNotation.
          </p>
        </div>
        <button type="button" onClick={beginWorkflow} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400">
          Reset
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ENSEMBLE_WORKFLOW_STEPS.map((step) => {
          const complete = isEnsembleWorkflowStepComplete(session, step.id);
          const unlocked = isEnsembleWorkflowStepUnlocked(session, step.id);
          const selected = getSelectedEnsembleWorkflowOption(session, step.id);
          return (
            <button
              key={step.id}
              type="button"
              disabled={!unlocked}
              onClick={() => setActiveStepId(step.id)}
              className={`rounded-xl border p-3 text-left transition ${
                activeStepId === step.id
                  ? "border-emerald-400 bg-emerald-500/10"
                  : complete
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30"
                    : unlocked
                      ? "border-zinc-200 bg-zinc-50 hover:border-emerald-300/60 dark:border-zinc-800 dark:bg-zinc-900/50"
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
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500 dark:text-zinc-400">{getEnsembleWorkflowPromptSummary(activeStep.id)}</p>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{promptPreview}</pre>
        </details>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
            User note to add to prompt
            <textarea
              value={activeUserNote}
              onChange={(event) => setUserNotes((current) => ({ ...current, [activeStep.id]: event.target.value }))}
              placeholder="Optional: add groove density, devotional mood, yield behavior, register, or playability instructions for this step."
              className="mt-2 min-h-20 w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-normal text-zinc-800 outline-none transition focus:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!activeUnlocked}
              onClick={savePromptNote}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:text-emerald-300"
            >
              Save prompt note
            </button>
            {savedNoteStepId === activeStep.id && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Prompt note saved</span>
            )}
          </div>
        </div>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!activeUnlocked || generatingStepId === activeStep.id}
            onClick={generateStep}
            className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-600 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
          >
            {generatingStepId === activeStep.id ? "Generating..." : "Generate / Regenerate Options"}
          </button>
          {activeInstrument && (
            <button
              type="button"
              disabled={!activeUnlocked}
              onClick={() => {
                const next = skipInstrumentSteps(session, activeInstrument);
                onWorkflowChange(next);
                onStagedLayersChange(null);
                onAppliedLayersChange(null);
                setActiveStepId(next.currentStepId);
              }}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              {activeInstrumentSkipped ? `Skipped ${activeInstrument}` : `Skip ${activeInstrument[0].toUpperCase()}${activeInstrument.slice(1)}`}
            </button>
          )}
          {!activeUnlocked && <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">Select required previous steps before generating this one.</span>}
        </div>

        <RunOptionList workflow={session} stepId={activeStep.id} onSelect={handleSelectOption} />
      </section>

      <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Final staged ensemble application</h4>
          <p className="mt-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
            Selected instrument options are staged here first. ABCNotation changes only after you apply the reviewed Djembe, Flute, and Violin layers.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {selectedContexts.filter((selection) => selection.stepId !== "foundation-handshake" && selection.stepId !== "final-conflict-review-apply").map((selection) => (
            <div key={selection.stepId} className="rounded-xl border border-emerald-200 bg-white/70 p-3 text-xs dark:border-emerald-900/70 dark:bg-zinc-950/40">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">{selection.label}</p>
              <p className="mt-1 leading-5 text-zinc-600 dark:text-zinc-400">{selection.summary}</p>
              {selection.data.skipInstrument === true && (
                <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Skipped: no ABC layer will be added.</p>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!finalUnlocked || !accompaniment}
            onClick={buildFinalReviewPreview}
            className="rounded-xl border border-emerald-500/30 bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Build Final Review Preview
          </button>
          <button
            type="button"
            disabled={!stagedCurrent || !stagedLayers}
            onClick={applyReviewedLayers}
            className="rounded-xl border border-amber-400/30 bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply Reviewed Ensemble Layers
          </button>
          {stagedCurrent && <span className="self-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">Final preview is staged.</span>}
          {appliedCurrent && <span className="self-center text-xs font-semibold text-amber-700 dark:text-amber-300">Applied to ABCNotation.</span>}
        </div>
        {stagedLayers?.validation && stagedCurrent && (
          <p className="rounded-xl border border-emerald-200 bg-white/70 p-3 text-xs text-emerald-800 dark:border-emerald-900/70 dark:bg-zinc-950/40 dark:text-emerald-300">
            Layer readiness: handshake {String(stagedLayers.validation.handshakeReady)}, ABC {String(stagedLayers.validation.abcLayersReady)}, playback {String(stagedLayers.validation.playbackEventsReady)}.
          </p>
        )}
      </section>
    </div>
  );
}
