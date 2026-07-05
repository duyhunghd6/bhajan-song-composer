"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceState } from "./useWorkspaceState";
import type { ReactNode } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import PianoKeyboard from "@/components/instruments/PianoKeyboard";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";
import { harmonizeMelody } from "@/app/actions/harmonize";
import { type HarmonizationOption } from "@/lib/theory/harmonization-candidates";
import { buildAccompanimentAbc, getAccompanimentVoiceNames } from "@/lib/theory/accompaniment-abc";
import {
  buildAccompanimentWorkflowAbcAnnotation,
  getLatestSelectedWorkflowStep,
  getWorkflowAppliedMusicAbc,
  isAccompanimentWorkflowSourceCurrent,
} from "@/lib/theory/accompaniment-workflow";
import {
  buildEnsembleWorkflowAbcAnnotation,
  isEnsembleWorkflowSourceCurrent,
} from "@/lib/theory/ensemble-workflow";
import { generatePianoAccompaniment } from "@/lib/theory/piano-accompaniment";
import type { PianoCompingProfileId } from "@/lib/theory/piano-comping-profiles";
import { buildFingerstyleComposerIntegration, type FingerstyleComposerProfileId } from "./fingerstyle-integration";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import TheoryAssistant from "./TheoryAssistant";
import AccompanimentWorkflowWizard from "./AccompanimentWorkflowWizard";
import EnsembleWorkflowWizard from "./EnsembleWorkflowWizard";
import type { ComposerStepId } from "./composer-steps";
import { buildTheoryAssistantLayerProposal, type TheoryAssistantArrangementSuggestion } from "./theory-assistant-layer";

interface ComposerStepWorkspaceProps {
  slug: string;
  step: ComposerStepId;
  initialMelodyAbc?: string;
}

interface ComposerNotationPreviewLayoutProps {
  source: ReactNode;
  preview: ReactNode;
}

const COMPOSER_PREVIEW_RENDER_OPTIONS = {
  staffwidth: 720,
  wrap: {
    minSpacing: 1.7,
    maxSpacing: 2.5,
    preferredMeasuresPerLine: 4,
    lastLineLimit: 0.6,
  },
  paddingright: 32,
};

const ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS = {
  staffwidth: 900,
  wrap: {
    minSpacing: 1.5,
    maxSpacing: 2.2,
    preferredMeasuresPerLine: 4,
    lastLineLimit: 0.6,
  },
  paddingright: 16,
};

const COMPOSER_PREVIEW_PROPS = {
  minWidthClassName: "min-w-[520px] max-w-[760px]",
  sheetViewportClassName: "max-h-[min(72vh,780px)] overflow-auto p-4",
  renderOptions: COMPOSER_PREVIEW_RENDER_OPTIONS,
};



function harmonizationOptionId(option: HarmonizationOption, index: number): string {
  return option.id || `candidate-${index + 1}`;
}

function harmonizationOptionLabel(option: HarmonizationOption): string {
  return option.label || option.progression_name;
}

function harmonizationOptionAbc(option: HarmonizationOption): string {
  return option.harmonizedAbc || option.abc;
}

function formatCandidateConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function ComposerNotationPreviewLayout({ source, preview }: ComposerNotationPreviewLayoutProps) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="composer-step-responsive-grid grid gap-0">
        <div className="composer-step-source-panel min-w-0 space-y-5 border-b border-zinc-100 p-5 dark:border-zinc-800 min-[1280px]:border-r min-[1280px]:border-b-0">
          {source}
        </div>
        <div className="min-w-0 space-y-3 p-5">
          {preview}
        </div>
      </div>
    </section>
  );
}

export default function ComposerStepWorkspace({ slug, step, initialMelodyAbc }: ComposerStepWorkspaceProps) {
  // Always initialize with the server-safe value to avoid hydration mismatch.
  // localStorage restoration happens in useEffect below.
  const [melodyAbc, setMelodyAbc] = useState(initialMelodyAbc ?? DEFAULT_ABC);
  const [hasMounted, setHasMounted] = useState(false);
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const { state: ws, updateState } = useWorkspaceState(slug);
  const [layerVisibility, setLayerVisibility] = useState({ melody: true, harmony: true });
  const [accompLayerVisibility, setAccompLayerVisibility] = useState<Record<string, boolean>>({});
  const [ensembleInputLayers, setEnsembleInputLayers] = useState<Record<string, boolean>>({
    __melody__: true,
    Guitar: true,
    PianoLH: true,
    PianoRH: true,
    PianoCompingLH: true,
  });
  const [currentSuggestion, setCurrentSuggestion] = useState<TheoryAssistantArrangementSuggestion | null>(null);
  const [copyStatus, setCopyStatus] = useState("Copy Markdown");

  // Hydrate melodyAbc from localStorage after mount (client-only)
  useEffect(() => {
    try {
      const savedMelody = window.localStorage.getItem(`bhajan-song-composer:compose:${slug}:melody`);
      const isDefault = savedMelody === DEFAULT_ABC || (savedMelody && savedMelody.includes("T:New Bhajan Arrangement"));
      if (savedMelody && !isDefault) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- melody must hydrate from localStorage after mount to avoid SSR/localStorage mismatches.
        setMelodyAbc(savedMelody);
      }
    } catch (e) {
      console.error("Failed to restore melody state from localStorage", e);
    }
    setHasMounted(true);
  }, [slug]);

  // Derive the active ABC to use across steps. If a harmony option is selected, use it; otherwise fallback to the pure melody.
  const activeHarmonyOption = useMemo(() => {
    if (!ws.aiSuggestions || !ws.selectedCandidateId) return null;
    return ws.aiSuggestions.find((opt, idx) => harmonizationOptionId(opt, idx) === ws.selectedCandidateId) || null;
  }, [ws.aiSuggestions, ws.selectedCandidateId]);

  const activeAbc = activeHarmonyOption ? harmonizationOptionAbc(activeHarmonyOption) : melodyAbc;

  const pipeline = useMemo(() => {
    try {
      return generateArrangementPipeline(activeAbc);
    } catch {
      return null;
    }
  }, [activeAbc]);

  const activeWorkflow = isAccompanimentWorkflowSourceCurrent(ws.accompanimentWorkflow, activeAbc)
    ? ws.accompanimentWorkflow
    : null;
  const workflowAppliedMusicAbc = useMemo(
    () => getWorkflowAppliedMusicAbc(activeWorkflow, activeAbc),
    [activeWorkflow, activeAbc]
  );
  const workflowAppliedPipeline = useMemo(() => {
    try {
      return generateArrangementPipeline(workflowAppliedMusicAbc);
    } catch {
      return pipeline;
    }
  }, [workflowAppliedMusicAbc, pipeline]);
  const accompanimentBuild = useMemo(() => buildAccompanimentAbc({
    baseAbc: workflowAppliedMusicAbc,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedPiano: ws.generatedPiano,
    layerVisibility: accompLayerVisibility,
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, workflowAppliedMusicAbc, accompLayerVisibility]);

  const ensembleInputLayerVisibility = useMemo(() => ({
    __melody__: ensembleInputLayers.__melody__ !== false,
    Guitar: ensembleInputLayers.Guitar !== false,
    PianoLH: ensembleInputLayers.PianoLH !== false,
    PianoRH: ensembleInputLayers.PianoRH !== false,
    PianoCompingLH: ensembleInputLayers.PianoCompingLH !== false,
  }), [ensembleInputLayers]);
  const ensembleFoundationBuild = useMemo(() => buildAccompanimentAbc({
    baseAbc: workflowAppliedMusicAbc,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedPiano: ws.generatedPiano,
    layerVisibility: {
      __melody__: ensembleInputLayerVisibility.__melody__,
      Guitar: ensembleInputLayerVisibility.Guitar,
      PianoLH: ensembleInputLayerVisibility.PianoLH,
      PianoRH: ensembleInputLayerVisibility.PianoRH,
      PianoCompingLH: ensembleInputLayerVisibility.PianoCompingLH,
    },
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, workflowAppliedMusicAbc, ensembleInputLayerVisibility]);
  const ensembleFoundationAbc = ensembleFoundationBuild.abc;
  const activeEnsembleWorkflow = isEnsembleWorkflowSourceCurrent(ws.ensembleWorkflow, ensembleFoundationAbc)
    ? ws.ensembleWorkflow
    : null;
  const appliedEnsembleSources = useMemo(() => (
    activeEnsembleWorkflow?.appliedAt && ws.appliedEnsembleLayers
      ? [ws.appliedEnsembleLayers.djembe, ws.appliedEnsembleLayers.flute, ws.appliedEnsembleLayers.violin]
      : []
  ), [activeEnsembleWorkflow?.appliedAt, ws.appliedEnsembleLayers]);
  const ensembleBuild = useMemo(() => buildAccompanimentAbc({
    baseAbc: workflowAppliedMusicAbc,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedPiano: ws.generatedPiano,
    extraVoiceSources: appliedEnsembleSources,
    layerVisibility: accompLayerVisibility,
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, workflowAppliedMusicAbc, appliedEnsembleSources, accompLayerVisibility]);

  const appliedWorkflowStep = useMemo(() => getLatestSelectedWorkflowStep(activeWorkflow), [activeWorkflow]);
  const workflowAnnotationAbc = useMemo(
    () => buildAccompanimentWorkflowAbcAnnotation(activeWorkflow),
    [activeWorkflow]
  );
  const ensembleAnnotationAbc = useMemo(
    () => buildEnsembleWorkflowAbcAnnotation(activeEnsembleWorkflow),
    [activeEnsembleWorkflow]
  );
  const accompanimentAbc = workflowAnnotationAbc
    ? `${accompanimentBuild.abc.trimEnd()}\n\n${workflowAnnotationAbc}`
    : accompanimentBuild.abc;
  const ensembleAbc = [ensembleBuild.abc, workflowAnnotationAbc, ensembleAnnotationAbc]
    .filter((block) => block.trim().length > 0)
    .join("\n\n");

  const accompanimentVoiceNames = useMemo(
    () => getAccompanimentVoiceNames(ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano),
    [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano]
  );
  const ensembleVoiceNames = useMemo(
    () => getAccompanimentVoiceNames(ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, appliedEnsembleSources),
    [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, appliedEnsembleSources]
  );
  const availableEnsembleInputLayers = useMemo(() => {
    const names = getAccompanimentVoiceNames(ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano);
    return [
      { key: "__melody__", label: "🎵 Melody", available: true },
      { key: "Guitar", label: "🎸 Guitar", available: names.includes("Guitar") },
      { key: "PianoLH", label: "🎹 Piano L H", available: names.includes("PianoLH") },
      { key: "PianoRH", label: "🎹 Piano R H", available: names.includes("PianoRH") },
      { key: "PianoCompingLH", label: "🎹 Piano Comping L H", available: names.includes("PianoCompingLH") },
    ];
  }, [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano]);
  const hasGuitarVoice = accompanimentBuild.visibleVoiceNames.includes("Guitar");
  const guitarTabEnabled = Boolean(hasGuitarVoice && accompLayerVisibility["__guitar_tab__"] === true);

  const getRenderOptionsFor = useCallback((abc: string, baseOptions: typeof ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS | typeof COMPOSER_PREVIEW_RENDER_OPTIONS) => {
    if (!guitarTabEnabled) return baseOptions;

    let guitarIndex = -1;
    const scoreMatch = abc.match(/^%%score\s+(.+)$/m);
    
    if (scoreMatch) {
      const scoreLine = scoreMatch[1];
      const staffGroups = scoreLine.match(/(\([^)]+\)|\[[^\]]+\]|\{[^}]+\}|\S+)/g);
      if (staffGroups) {
        guitarIndex = staffGroups.findIndex(group => group.includes("Guitar"));
      }
    }
    
    if (guitarIndex === -1) {
      const matches = [...abc.matchAll(/^V:([^\s=]+)/gm)];
      const voiceNames = [...new Set(matches.map(m => m[1]))];
      guitarIndex = voiceNames.indexOf("Guitar");
    }

    if (guitarIndex >= 0) {
      const result = {
        staffwidth: baseOptions.staffwidth,
        paddingright: baseOptions.paddingright,
        // stafftopmargin: 35 creates a clean vertical separation between lyric text and tab numbers on systems 2, 3, 4, etc.
        stafftopmargin: 35,
        // We omit baseOptions.wrap here because abcjs auto-wrapping conflicts with tablature rendering on multi-system staves.
        // The ABC notation has explicit line breaks, so it wraps naturally without issues.
        tablature: [
          ...Array.from({ length: guitarIndex }, () => ({ instrument: "" as const })),
          {
            instrument: "guitar" as const,
            label: "GUITAR TAB (%T)",
            tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
            capo: 0,
            hideTabSymbol: false,
          },
        ],
      };
      console.log("[DEBUG] getRenderOptionsFor returns:", JSON.stringify(result));
      return result;
    }

    console.log("[DEBUG] getRenderOptionsFor fallback. guitarIndex:", guitarIndex);
    return baseOptions;
  }, [guitarTabEnabled]);

  if (step === "melody") {
    return (
      <div className="space-y-5">
        <AbcEditor
          title="ABC Notation Editor"
          value={melodyAbc}
          initialAbc={initialMelodyAbc ?? DEFAULT_ABC}
          storageKey={`bhajan-song-composer:compose:${slug}:melody`}
          onChange={setMelodyAbc}
        />
      </div>
    );
  }

  if (step === "harmony") {
    // --- PREVIEW RENDERER LOGIC ---
    //
    // ⚠️ CRITICAL: DO NOT replace melody notes with rests (z) to "mute" the melody.
    // abcjs CreateSynth generates ZERO audio events for rests. If all notes become rests,
    // the audio buffer is empty and synth.start() crashes with:
    //   "Cannot set properties of undefined (setting 'onended')"
    // This happens because directSource[0] is undefined when audioBuffers is empty.
    //
    // ✅ CORRECT APPROACH: Keep the full ABC string (melody + chords) intact.
    // Use abcjs's native `voicesOff` / `chordsOff` synth options (passed via synthOptions prop)
    // to selectively mute layers at the audio synthesis level.
    // See: node_modules/abcjs/src/synth/abc_midi_flattener.js (line ~107, ~122)
    let harmonyPreviewAbc = "";
    if (ws.acceptedHarmony) {
      harmonyPreviewAbc = `${activeAbc.trimEnd()}\n\n${ws.acceptedHarmony.abc}`;
    } else {
      harmonyPreviewAbc = activeAbc;
    }

    // Compute synthOptions based on layer visibility toggles.
    const harmonySynthOptions: { voicesOff?: boolean; chordsOff?: boolean } = {};
    if (!layerVisibility.melody) {
      // Mute melody voice (voice index 0), but keep chord accompaniment playing
      harmonySynthOptions.voicesOff = true;
    }
    if (!layerVisibility.harmony) {
      // Disable chord accompaniment synthesis, keep melody notes
      harmonySynthOptions.chordsOff = true;
    }

    return (
      <div className="space-y-6">
        <ComposerNotationPreviewLayout
          source={(
            <>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Analysis Settings</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">
                    Detect Key
                  </button>
                  <button type="button" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                    Set Raga
                  </button>
                  <button
                    type="button"
                    disabled={isHarmonizing || !pipeline}
                    onClick={async () => {
                      if (!pipeline) return;
                      setIsHarmonizing(true);
                      try {
                        const result = await harmonizeMelody(melodyAbc, {
                          key: pipeline.harmonization.key,
                          scale: pipeline.harmonization.scale,
                          timeSignature: pipeline.harmonization.timeSignature
                        });
                        updateState({ aiSuggestions: result.options });
                        updateState({ selectedCandidateId: null });
                      } catch (err) {
                        console.error(err);
                        alert("Failed to harmonize using AI.");
                      } finally {
                        setIsHarmonizing(false);
                      }
                    }}
                    className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-600 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
                  >
                    {isHarmonizing ? "Generating Options..." : "✨ Suggest AI Harmonization"}
                  </button>
                  {hasMounted && initialMelodyAbc && activeAbc !== initialMelodyAbc && (
                    <button
                      type="button"
                      onClick={() => {
                        setMelodyAbc(initialMelodyAbc);
                        updateState({ aiSuggestions: [], selectedCandidateId: null, acceptedHarmony: null });
                      }}
                      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      ↺ Restore Original Melody
                    </button>
                  )}
                </div>
                
                {ws.aiSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Suggested Progressions</h3>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {ws.aiSuggestions.map((option, idx) => {
                        const candidateId = harmonizationOptionId(option, idx);
                        const candidateLabel = harmonizationOptionLabel(option);
                        const candidateAbc = harmonizationOptionAbc(option);
                        const isSelected = ws.selectedCandidateId === candidateId;

                        return (
                          <button
                            key={candidateId}
                            onClick={() => {
                              updateState({ selectedCandidateId: candidateId });

                              // Automatically accept it as a harmony layer to generate the separate V:Chords staff
                              try {
                                const proposal = buildTheoryAssistantLayerProposal(candidateAbc, { skillLevel: "intermediate", capoFret: 0 });
                                proposal.name = `AI Option: ${candidateLabel}`;
                                updateState({ acceptedHarmony: proposal });
                              } catch (e) {
                                console.error("Failed to build layer proposal for AI option", e);
                              }
                            }}
                            className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                              isSelected
                                ? "border-amber-400 bg-amber-500/10 shadow-sm"
                                : "border-zinc-200 bg-white hover:border-amber-300/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Option {idx + 1}: {candidateLabel}</h4>
                              {isSelected && (
                                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Active</span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              <span>{option.style}</span>
                              <span>Confidence {formatCandidateConfidence(option.confidence)}</span>
                            </div>
                            {option.progression.length > 0 && (
                              <p className="mt-2 font-mono text-xs text-amber-700 dark:text-amber-300">
                                {option.progression.join(" → ")}
                              </p>
                            )}
                            {option.romanNumerals.length > 0 && (
                              <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                {option.romanNumerals.join(" → ")}
                              </p>
                            )}
                            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                              {option.explanation}
                            </p>
                            {option.warnings.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                                {option.warnings.map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            )}
                            {option.validationNotes.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
                                {option.validationNotes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
              <TheoryAssistant abc={activeAbc} onAcceptArrangement={(val) => updateState({ acceptedHarmony: val })} onAnalysisChange={setCurrentSuggestion} />
            </>
          )}
          preview={(
            <>
              <section className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Layer Visibility</h2>
                <div className="mt-3 flex gap-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                      checked={layerVisibility.melody} 
                      onChange={e => setLayerVisibility(v => ({ ...v, melody: e.target.checked }))} 
                    /> 
                    Melody Layer
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                      checked={layerVisibility.harmony} 
                      onChange={e => setLayerVisibility(v => ({ ...v, harmony: e.target.checked }))} 
                    /> 
                    Harmonic Chord Progression Layer
                  </label>
                </div>
              </section>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Harmonization Preview</h3>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Bounded preview
                  </span>
                </div>
                <AbcjsPlaybackController
                  abcString={harmonyPreviewAbc}
                  title="Harmonization Audio Preview"
                  canvasId="composer-harmony-preview"
                  synthOptions={harmonySynthOptions}
                  {...COMPOSER_PREVIEW_PROPS}
                />
              </div>

              <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Current ABCNotation of the Song</h2>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {activeAbc}
                </pre>
              </section>
            </>
          )}
        />

        <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="composer-step-responsive-grid grid gap-0">
            <div className="border-b border-zinc-100 p-5 dark:border-zinc-800 min-[1280px]:border-r min-[1280px]:border-b-0">
              <section className="h-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                <h2 className="mb-2 text-lg font-bold text-emerald-900 dark:text-emerald-100">Composer Layer Note</h2>
                {currentSuggestion ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white/60 p-3 text-xs leading-5 text-emerald-900 dark:bg-zinc-900/50 dark:text-emerald-200">
                    {currentSuggestion.abcBlock}
                  </pre>
                ) : (
                  <p>Accept an arrangement from the Theory Assistant to see the composer layer note.</p>
                )}
              </section>
            </div>
            <div className="p-5">
              <section className="h-full rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Chord Track Editor (Ghosted Melody below)</h2>
                <pre className="mt-3 max-h-[min(54vh,640px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {`% Ghosted melody context\n${activeAbc}\n\n% Chord Track Editor\n${ws.acceptedHarmony ? ws.acceptedHarmony.abc : "% Accept an arrangement from the Theory Assistant to see the chord track here."}`}
                </pre>
              </section>
            </div>
          </div>
        </section>

      </div>
    );
  }

  if (step === "accompaniment") {
    // The combined ABC is built at the top level so hook ordering stays stable across steps.
    return (
      <div className="space-y-6">
        <ComposerNotationPreviewLayout
          source={(
            <>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Accompaniment Generation</h2>
                  <div className="flex items-center gap-1.5">
                    {hasMounted && initialMelodyAbc && activeAbc !== initialMelodyAbc && (
                      <button
                        type="button"
                        onClick={() => {
                          setMelodyAbc(initialMelodyAbc);
                          updateState({ aiSuggestions: [], selectedCandidateId: null, acceptedHarmony: null, aiAccompanimentSuggestions: [], selectedAccompanimentIndex: null, pianoAccompanimentData: null, guitarAccompanimentData: null, generatedAccompaniment: null, aiGuitarSuggestions: [], aiPianoSuggestions: [], selectedGuitarIndex: null, selectedPianoIndex: null, generatedGuitar: null, generatedPiano: null, accompanimentWorkflow: null });
                          setAccompLayerVisibility({});
                        }}
                        title="Restore Original Melody"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                      >
                        <span className="text-sm">↺</span>
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                    )}
                  </div>
                </div>


                <AccompanimentWorkflowWizard
                  sourceAbc={activeAbc}
                  metadata={{
                    key: pipeline?.harmonization.key ?? "Unknown",
                    scale: pipeline?.harmonization.scale ?? "Unknown",
                    timeSignature: pipeline?.harmonization.timeSignature ?? "4/4",
                  }}
                  workflow={ws.accompanimentWorkflow}
                  onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
                  onGuitarProfileSelected={(profile) => {
                    if (profile === null) {
                      updateState({
                        generatedGuitar: null,
                        guitarAccompanimentData: null,
                        selectedGuitarIndex: null,
                        aiGuitarSuggestions: [],
                        ensembleWorkflow: null,
                        stagedEnsembleLayers: null,
                        appliedEnsembleLayers: null,
                      });
                      return;
                    }

                    const guitarProfiles: FingerstyleComposerProfileId[] = ["strict-pima", "folk-travis"];
                    const pickingProfile = guitarProfiles.includes(profile as FingerstyleComposerProfileId)
                      ? profile as FingerstyleComposerProfileId
                      : "strict-pima";
                    const integration = buildFingerstyleComposerIntegration(workflowAppliedMusicAbc, undefined, { pickingProfile });
                    updateState({ generatedGuitar: integration.composerLayer.abc, guitarAccompanimentData: integration });
                  }}
                  onPianoProfileSelected={(profile) => {
                    if (profile === null) {
                      updateState({
                        generatedPiano: null,
                        pianoAccompanimentData: null,
                        selectedPianoIndex: null,
                        aiPianoSuggestions: [],
                        ensembleWorkflow: null,
                        stagedEnsembleLayers: null,
                        appliedEnsembleLayers: null,
                      });
                      return;
                    }

                    const pianoStyles: PianoCompingProfileId[] = ["pop-ballad", "rock-rnb", "classical-folk"];
                    const compingProfile = pianoStyles.includes(profile as PianoCompingProfileId)
                      ? profile as PianoCompingProfileId
                      : "pop-ballad";
                    const accompaniment = generatePianoAccompaniment(workflowAppliedMusicAbc, { compingProfile });
                    updateState({ generatedPiano: accompaniment.abc, pianoAccompanimentData: accompaniment });
                  }}
                />
              </section>
            </>
          )}
          preview={(
            <>
              {/* Layer Visibility Toggles — always shown when any accompaniment is generated */}
              {(ws.generatedAccompaniment || ws.generatedGuitar || ws.generatedPiano) && (
                <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Layer Visibility</h2>
                  <div className="flex flex-wrap gap-3">
                    {/* Melody toggle */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                        checked={accompLayerVisibility['__melody__'] !== false}
                        onChange={() => setAccompLayerVisibility(prev => ({
                          ...prev,
                          ['__melody__']: !(prev['__melody__'] !== false)
                        }))}
                      />
                      🎵 Melody
                    </label>
                    {/* Original Chords toggle */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                        checked={accompLayerVisibility['__chords__'] !== false}
                        onChange={() => setAccompLayerVisibility(prev => ({
                          ...prev,
                          ['__chords__']: !(prev['__chords__'] !== false)
                        }))}
                      />
                      🎶 Original Chords
                    </label>
                    {/* Strong beats toggle */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                        checked={accompLayerVisibility['__strong_beats__'] === true}
                        onChange={() => setAccompLayerVisibility(prev => ({
                          ...prev,
                          ['__strong_beats__']: !(prev['__strong_beats__'] === true)
                        }))}
                      />
                      ⬤ Strong Beats
                    </label>
                    {/* Guitar tablature toggle */}
                    {hasGuitarVoice && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                          checked={guitarTabEnabled}
                          onChange={() => setAccompLayerVisibility(prev => ({
                            ...prev,
                            ['__guitar_tab__']: !guitarTabEnabled
                          }))}
                        />
                        🎸 GUITAR TAB
                      </label>
                    )}
                    {/* Accompaniment voice toggles */}
                    {accompanimentVoiceNames.map(voiceName => {
                      const isVisible = accompLayerVisibility[voiceName] !== false;
                      const friendlyName = voiceName
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^\s/, '')
                        .replace('Piano', '🎹 Piano')
                        .replace('Guitar', '🎸 Guitar');
                      return (
                        <label key={voiceName} className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                            checked={isVisible}
                            onChange={() => setAccompLayerVisibility(prev => ({
                              ...prev,
                              [voiceName]: !isVisible
                            }))}
                          />
                          {friendlyName}
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Resulting ABC Staff Preview</h3>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Bounded preview
                </span>
              </div>
              <AbcjsPlaybackController
                abcString={accompanimentAbc}
                title={appliedWorkflowStep ? `Resulting ABC Staff Preview: Step ${appliedWorkflowStep.label}` : "Accompaniment Music Sheet"}
                canvasId="composer-accompaniment-preview"
                minWidthClassName="min-w-[520px]"
                sheetViewportClassName="max-h-[min(76vh,860px)] overflow-auto p-4"
                renderOptions={getRenderOptionsFor(accompanimentAbc, ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS)}
              />
              {appliedWorkflowStep && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ABCNotation applied after Step {appliedWorkflowStep.index}: {appliedWorkflowStep.label}
                </p>
              )}

              <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Generated ABC Source</h2>
                <pre className="mt-3 max-h-[min(30vh,300px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {accompanimentAbc}
                </pre>
              </section>
            </>
          )}
        />

        <div className="w-full space-y-6">
          {/* Virtual Piano — always visible on accompaniment step */}
          <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Virtual Piano (Voicing & Comping)</h2>
            {ws.pianoAccompanimentData ? (
              <div className="space-y-6">
                <PianoPedalIndicator 
                  title="Sustain Pedal Indicator" 
                  pedalAutomation={ws.pianoAccompanimentData.pedalAutomation} 
                />
                <div className="overflow-x-auto pb-4">
                  <PianoKeyboard 
                    title="Piano Accompaniment Keys" 
                    startOctave={3} 
                    octaveCount={3}
                    size="compact"
                    highlights={ws.pianoAccompanimentData.pianoKeyHighlights}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Select a piano accompaniment style above to see highlighted voicings and pedal automation.
                </p>
                <div className="overflow-x-auto pb-4">
                  <PianoKeyboard 
                    title="Piano Keyboard" 
                    startOctave={3} 
                    octaveCount={3}
                    size="compact"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Virtual Guitar — always visible on accompaniment step */}
          <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Virtual Guitar (Fingerstyle)</h2>
            {ws.guitarAccompanimentData ? (
              <div className="overflow-x-auto pb-4">
                <GuitarFretboard 
                  title="Fingerstyle Fretboard Preview" 
                  positions={ws.guitarAccompanimentData.fretboard.positions} 
                />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Select a guitar accompaniment style above to see finger positions on the fretboard.
                </p>
                <div className="overflow-x-auto pb-4">
                  <GuitarFretboard 
                    title="Guitar Fretboard"
                  />
                </div>
              </div>
            )}
          </section>

          {ws.generatedAccompaniment && !ws.pianoAccompanimentData && !ws.guitarAccompanimentData && (
            <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/70 dark:bg-amber-950/30">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
            </section>
          )}
        </div>
      </div>
    );
  }

  if (step === "ensemble") {
    return (
      <ComposerNotationPreviewLayout
        source={(
          <>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="mb-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">Input Layers for Ensemble Composing</h2>
              <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                Choose which existing layers are sent as context for Djembe, Flute, and Violin generation.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {availableEnsembleInputLayers.map((layer) => (
                  <label key={layer.key} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${layer.available ? "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" : "border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50"}`}>
                    <input
                      type="checkbox"
                      className="mr-2 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                      disabled={!layer.available}
                      checked={layer.available && ensembleInputLayers[layer.key] !== false}
                      onChange={() => setEnsembleInputLayers((current) => ({
                        ...current,
                        [layer.key]: !(current[layer.key] !== false),
                      }))}
                    />
                    {layer.label}
                  </label>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Ensemble Generation</h2>
              <EnsembleWorkflowWizard
                sourceAbc={ensembleFoundationAbc}
                melodyAbc={workflowAppliedMusicAbc}
                accompaniment={workflowAppliedPipeline?.accompaniment ?? null}
                metadata={{
                  key: workflowAppliedPipeline?.harmonization.key ?? "Unknown",
                  scale: workflowAppliedPipeline?.harmonization.scale ?? "Unknown",
                  timeSignature: workflowAppliedPipeline?.harmonization.timeSignature ?? "4/4",
                }}
                workflow={ws.ensembleWorkflow}
                stagedLayers={ws.stagedEnsembleLayers}
                appliedLayers={ws.appliedEnsembleLayers}
                onWorkflowChange={(ensembleWorkflow) => updateState({ ensembleWorkflow })}
                onStagedLayersChange={(stagedEnsembleLayers) => updateState({ stagedEnsembleLayers })}
                onAppliedLayersChange={(appliedEnsembleLayers) => updateState({ appliedEnsembleLayers })}
              />
            </section>
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/30">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Conflict Resolution Hierarchy Log</h2>
              {ws.appliedEnsembleLayers?.conflictReport?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {ws.appliedEnsembleLayers.conflictReport.slice(0, 5).map((entry) => (
                    <li key={`${entry.measureIndex}-${entry.startMs}`}>m.{entry.measureIndex + 1} beat {entry.beat}: {entry.actions.join(", ") || "no action needed"}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Build and apply the final ensemble preview to see concrete Djembe/Flute/Violin conflict decisions.</p>
              )}
            </section>
            <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Multi-track ABC Source</h2>
              <pre className="mt-3 max-h-[min(54vh,640px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                {ensembleAbc}
              </pre>
            </section>
          </>
        )}
        preview={(
          <>
            {(ws.generatedAccompaniment || ws.generatedGuitar || ws.generatedPiano || ws.appliedEnsembleLayers) && (
              <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">Layer Visibility</h2>
                <div className="flex flex-wrap gap-3">
                  {ensembleVoiceNames.map((voiceName) => {
                    const isVisible = accompLayerVisibility[voiceName] !== false;
                    const friendlyName = voiceName
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^\s/, "")
                      .replace("Piano", "🎹 Piano")
                      .replace("Guitar", "🎸 Guitar")
                      .replace("Djembe", "🪘 Djembe")
                      .replace("Flute", "🪈 Flute")
                      .replace("Violin", "🎻 Violin");
                    return (
                      <label key={voiceName} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                          checked={isVisible}
                          onChange={() => setAccompLayerVisibility((prev) => ({
                            ...prev,
                            [voiceName]: !isVisible,
                          }))}
                        />
                        {friendlyName}
                      </label>
                    );
                  })}
                </div>
              </section>
            )}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Multi-track ABCJS Render (Full Score View)</h3>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {activeEnsembleWorkflow?.appliedAt ? "Applied ensemble" : "Foundation preview"}
              </span>
            </div>
            <AbcjsPlaybackController
              abcString={ensembleAbc}
              title="Multi-track Full Score Playback"
              canvasId="composer-ensemble-preview"
              minWidthClassName="min-w-[520px]"
              sheetViewportClassName="max-h-[min(76vh,860px)] overflow-auto p-4"
              renderOptions={getRenderOptionsFor(ensembleAbc, ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS)}
            />
          </>
        )}
      />
    );
  }

  const reviewAbc = activeEnsembleWorkflow?.appliedAt ? ensembleAbc : (accompanimentAbc || activeAbc);
  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\nabcNotations:\n  - type: "melody"\n    label: "Melody Music Sheet"\n---\n\n## Lyrics\n\nDraft lyrics...\n\n## ABC\n\n\`\`\`abc\n${reviewAbc}\n\`\`\``;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdown)
      .then(() => {
        setCopyStatus("Copied!");
        setTimeout(() => setCopyStatus("Copy Markdown"), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        setCopyStatus("Failed to copy");
        setTimeout(() => setCopyStatus("Copy Markdown"), 2000);
      });
  };

  return (
    <ComposerNotationPreviewLayout
      source={(
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Raw Markdown Output File Preview</h2>
          <textarea readOnly value={markdown} className="mt-3 min-h-72 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleCopyMarkdown} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">{copyStatus}</button>
            <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Submit as PR</button>
          </div>
        </section>
      )}
      preview={(
        <>
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Playback Simulation: Test Full Audio & Sync</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Play All Layers</button>
              <PianoPedalIndicator
                title="Sustain Pedal Indicator"
                pedalAutomation={{
                  controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
                  events: [{ measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 }],
                }}
              />
            </div>
          </section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review Music Staff Playback</h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Bounded preview
            </span>
          </div>
          <AbcjsPlaybackController
            abcString={reviewAbc}
            title="Review Music Playback Controller"
            canvasId="composer-review-preview"
            minWidthClassName="min-w-[520px] max-w-[760px]"
            sheetViewportClassName="max-h-[min(76vh,780px)] overflow-auto p-4"
            renderOptions={getRenderOptionsFor(reviewAbc, COMPOSER_PREVIEW_RENDER_OPTIONS)}
          />
        </>
      )}
    />
  );
}
