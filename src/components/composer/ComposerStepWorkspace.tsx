"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceState } from "./useWorkspaceState";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";
import { buildAccompanimentAbc, getAccompanimentVoiceNames } from "@/lib/theory/accompaniment-abc";
import {
  buildAccompanimentWorkflowAbcAnnotation,
  getLatestSelectedWorkflowStep,
  getSelectedWorkflowOption,
  getWorkflowAppliedMusicAbc,
  isAccompanimentWorkflowSourceCurrent,
  isAccompanimentWorkflowStepComplete,
} from "@/lib/theory/accompaniment-workflow";
import {
  buildEnsembleWorkflowAbcAnnotation,
  isEnsembleWorkflowSourceCurrent,
} from "@/lib/theory/ensemble-workflow";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import EnsembleWorkflowWizard from "./EnsembleWorkflowWizard";
import type { ComposerStepId } from "./composer-steps";
import type { TheoryAssistantArrangementSuggestion } from "./theory-assistant-layer";
import { AccompanimentStep } from "./workspace/AccompanimentStep";
import { HarmonyStep } from "./workspace/HarmonyStep";
import type { StrongBeatDirective } from "@/lib/theory/abc-beat-annotations";
import {
  ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
  COMPOSER_PREVIEW_RENDER_OPTIONS,
  ComposerNotationPreviewLayout,
  harmonizationOptionAbc,
  harmonizationOptionId,
} from "./workspace/preview";

interface ComposerStepWorkspaceProps {
  slug: string;
  step: ComposerStepId;
  initialMelodyAbc?: string;
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
  const strongBeatsStepComplete = Boolean(
    activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "strong-beat-targets")
  );
  const effectiveAccompLayerVisibility = useMemo(() => {
    if (!strongBeatsStepComplete) {
      return {
        ...accompLayerVisibility,
        __strong_beats__: false,
      };
    }

    return {
      ...accompLayerVisibility,
      __strong_beats__: accompLayerVisibility.__strong_beats__ !== false,
    };
  }, [accompLayerVisibility, strongBeatsStepComplete]);
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

  const strongBeatDirectives = useMemo(() => {
    const option = activeWorkflow ? getSelectedWorkflowOption(activeWorkflow, "strong-beat-targets") : null;
    return (option?.data?.strongBeatDirectives as StrongBeatDirective[]) ?? undefined;
  }, [activeWorkflow]);

  const accompanimentBuild = useMemo(() => buildAccompanimentAbc({
    baseAbc: workflowAppliedMusicAbc,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedPiano: ws.generatedPiano,
    layerVisibility: effectiveAccompLayerVisibility,
    strongBeatDirectives,
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, workflowAppliedMusicAbc, effectiveAccompLayerVisibility, strongBeatDirectives]);

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
    strongBeatDirectives,
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, workflowAppliedMusicAbc, ensembleInputLayerVisibility, strongBeatDirectives]);
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
    layerVisibility: effectiveAccompLayerVisibility,
    strongBeatDirectives,
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, workflowAppliedMusicAbc, appliedEnsembleSources, effectiveAccompLayerVisibility, strongBeatDirectives]);

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
    return (
      <HarmonyStep
        melodyAbc={melodyAbc}
        setMelodyAbc={setMelodyAbc}
        initialMelodyAbc={initialMelodyAbc}
        activeAbc={activeAbc}
        hasMounted={hasMounted}
        isHarmonizing={isHarmonizing}
        setIsHarmonizing={setIsHarmonizing}
        pipeline={pipeline}
        layerVisibility={layerVisibility}
        setLayerVisibility={setLayerVisibility}
        ws={ws}
        updateState={updateState}
        currentSuggestion={currentSuggestion}
        setCurrentSuggestion={setCurrentSuggestion}
      />
    );
  }

  if (step === "accompaniment") {
    return (
      <AccompanimentStep
        activeAbc={activeAbc}
        setMelodyAbc={setMelodyAbc}
        initialMelodyAbc={initialMelodyAbc}
        hasMounted={hasMounted}
        pipeline={pipeline}
        workflowAppliedMusicAbc={workflowAppliedMusicAbc}
        activeWorkflow={activeWorkflow}
        accompanimentAbc={accompanimentAbc}
        accompanimentVoiceNames={accompanimentVoiceNames}
        accompLayerVisibility={accompLayerVisibility}
        setAccompLayerVisibility={setAccompLayerVisibility}
        hasGuitarVoice={hasGuitarVoice}
        guitarTabEnabled={guitarTabEnabled}
        appliedWorkflowStep={appliedWorkflowStep}
        getRenderOptionsFor={getRenderOptionsFor}
        ws={ws}
        updateState={updateState}
      />
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
                melodyAbc={activeAbc}
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
