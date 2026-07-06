"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceState } from "./useWorkspaceState";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";
import { buildAccompanimentAbc, getAccompanimentVoiceNames } from "@/lib/theory/accompaniment-abc";
import { generateAccompanimentSupportLayers } from "@/lib/theory/accompaniment-workflow/support-layers";
import {
  buildAccompanimentWorkflowAbcAnnotation,
  getLatestSelectedWorkflowStep,
  getSelectedWorkflowOption,
  getWorkflowAppliedMusicAbc,
  isAccompanimentWorkflowSourceCurrent,
  isAccompanimentWorkflowStepComplete,
} from "@/lib/theory/accompaniment-workflow";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import type { ComposerStepId } from "./composer-steps";
import { AccompanimentStep } from "./workspace/AccompanimentStep";
import { HarmonyStep } from "./workspace/HarmonyStep";
import type { StrongBeatDirective } from "@/lib/theory/abc-beat-annotations";
import {
  ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
  COMPOSER_PREVIEW_RENDER_OPTIONS,
  ComposerNotationPreviewLayout,
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
  const { state: ws, updateState } = useWorkspaceState(slug);
  const [layerVisibility, setLayerVisibility] = useState({ melody: true, harmony: true });
  const [accompLayerVisibility, setAccompLayerVisibility] = useState<Record<string, boolean>>({
    __melody__: true,
    __strong_beats__: true,
    __chords__: false,
    __guitar_tab__: false,
  });
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

  // The baseline ABC is the pure melody
  const activeAbc = melodyAbc;

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
  const accompanimentSupportLayers = useMemo(() => generateAccompanimentSupportLayers(workflowAppliedMusicAbc, {
    accompaniment: workflowAppliedPipeline?.accompaniment ?? null,
    workflow: activeWorkflow,
  }), [activeWorkflow, workflowAppliedMusicAbc, workflowAppliedPipeline]);
  const accompanimentSupportSources = useMemo(() => [
    accompanimentSupportLayers.djembe,
    accompanimentSupportLayers.flute,
    accompanimentSupportLayers.violin,
  ], [accompanimentSupportLayers]);

  const accompanimentBuild = useMemo(() => buildAccompanimentAbc({
    baseAbc: workflowAppliedMusicAbc,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedPiano: ws.generatedPiano,
    extraVoiceSources: accompanimentSupportSources,
    layerVisibility: effectiveAccompLayerVisibility,
    strongBeatDirectives,
  }), [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, accompanimentSupportSources, workflowAppliedMusicAbc, effectiveAccompLayerVisibility, strongBeatDirectives]);

  const appliedWorkflowStep = useMemo(() => getLatestSelectedWorkflowStep(activeWorkflow), [activeWorkflow]);
  const workflowAnnotationAbc = useMemo(
    () => buildAccompanimentWorkflowAbcAnnotation(activeWorkflow),
    [activeWorkflow]
  );
  const accompanimentAbc = workflowAnnotationAbc
    ? `${accompanimentBuild.abc.trimEnd()}\n\n${workflowAnnotationAbc}`
    : accompanimentBuild.abc;

  const accompanimentVoiceNames = useMemo(
    () => getAccompanimentVoiceNames(ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, accompanimentSupportSources),
    [ws.generatedAccompaniment, ws.generatedGuitar, ws.generatedPiano, accompanimentSupportSources]
  );

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
        stafftopmargin: 35,
        tablature: [
          ...Array.from({ length: guitarIndex }, () => ({ instrument: "" as const })),
          {
            instrument: "guitar" as const,
            label: "",
            tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
            capo: 0,
            hideTabSymbol: false,
          },
        ],
      };
      return result;
    }

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
        hasMounted={hasMounted}
        pipeline={pipeline}
        workflowAppliedMusicAbc={workflowAppliedMusicAbc}
        activeWorkflow={activeWorkflow}
        layerVisibility={layerVisibility}
        setLayerVisibility={setLayerVisibility}
        ws={ws}
        updateState={updateState}
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

  const reviewAbc = accompanimentAbc || melodyAbc;
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
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-sans">Raw Markdown Output File Preview</h2>
          <textarea readOnly value={markdown} className="mt-3 min-h-72 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleCopyMarkdown} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200 font-sans">{copyStatus}</button>
            <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white font-sans">Submit as PR</button>
          </div>
        </section>
      )}
      preview={(
        <>
          {(ws.generatedAccompaniment || ws.generatedGuitar || ws.generatedPiano || activeWorkflow) && (
            <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans">Layer Visibility</h2>
              <div className="flex flex-wrap gap-3">
                {accompanimentVoiceNames.map((voiceName) => {
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
                    <label key={voiceName} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-sans">
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
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-sans font-sans">Playback Simulation: Test Full Audio & Sync</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white font-sans">Play All Layers</button>
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
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">Review Music Staff Playback</h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-sans">
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
