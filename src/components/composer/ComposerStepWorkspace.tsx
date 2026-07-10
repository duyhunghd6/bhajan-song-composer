"use client";

import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import {
  DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
  DEFAULT_HARMONY_LAYER_VISIBILITY,
  DEFAULT_LAYER_VOLUMES,
  useWorkspaceState,
} from "./useWorkspaceState";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import type { ComposerStepId } from "./composer-steps";
import { AccompanimentStep } from "./workspace/AccompanimentStep";
import { GuitarFingerstyleStep } from "./workspace/GuitarFingerstyleStep";
import {
  buildAccompanimentGuitarBranchResetState,
  hasAccompanimentGuitarBranchWork,
} from "./workspace/accompaniment-guitar-reset";
import { buildArrangementPreviewModel } from "./workspace/arrangement-preview-model";
import { HarmonyStep } from "./workspace/HarmonyStep";
import {
  COMPOSER_PREVIEW_RENDER_OPTIONS,
  ComposerNotationPreviewLayout,
} from "./workspace/preview";
import { clearComposerSongStorage, getComposerMelodyStorageKey } from "./workspace/storage";
import { cleanAbcForExport } from "@/lib/theory/abc-layer-visibility";

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
  const { state: ws, updateState, resetState: resetWorkspaceState } = useWorkspaceState(slug);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(DEFAULT_HARMONY_LAYER_VISIBILITY);
  const [layerVolumes, setLayerVolumes] = useState<Record<string, number>>(DEFAULT_LAYER_VOLUMES);
  const [copyStatus, setCopyStatus] = useState("Copy Markdown");
  const accompLayerVisibility = ws.accompanimentLayerVisibility ?? DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY;
  const accompLayerVolumes = ws.accompanimentLayerVolumes ?? DEFAULT_LAYER_VOLUMES;
  const setAccompLayerVisibility = useCallback((nextVisibility: SetStateAction<Record<string, boolean>>) => {
    updateState({
      accompanimentLayerVisibility: typeof nextVisibility === "function"
        ? nextVisibility(accompLayerVisibility)
        : nextVisibility,
    });
  }, [accompLayerVisibility, updateState]);
  const setAccompLayerVolumes = useCallback((nextVolumes: SetStateAction<Record<string, number>>) => {
    updateState({
      accompanimentLayerVolumes: typeof nextVolumes === "function"
        ? nextVolumes(accompLayerVolumes)
        : nextVolumes,
    });
  }, [accompLayerVolumes, updateState]);

  // Hydrate melodyAbc from localStorage after mount (client-only)
  useEffect(() => {
    try {
      const savedMelody = window.localStorage.getItem(getComposerMelodyStorageKey(slug));
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

  const previewModel = useMemo(() => buildArrangementPreviewModel({
    activeAbc,
    workflow: ws.accompanimentWorkflow,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedPiano: ws.generatedPiano,
    harmonyLayerVisibility: layerVisibility,
    harmonyLayerVolumes: layerVolumes,
    accompanimentLayerVisibility: accompLayerVisibility,
    accompanimentLayerVolumes: accompLayerVolumes,
  }), [
    activeAbc,
    ws.accompanimentWorkflow,
    ws.generatedAccompaniment,
    ws.generatedGuitar,
    ws.generatedPiano,
    layerVisibility,
    layerVolumes,
    accompLayerVisibility,
    accompLayerVolumes,
  ]);

  const { pipeline, activeWorkflow, workflowAppliedMusicAbc } = previewModel;

  const handleRestoreHarmony = useCallback(() => {
    const originalMelodyAbc = initialMelodyAbc ?? DEFAULT_ABC;
    setMelodyAbc(originalMelodyAbc);
    resetWorkspaceState();
    try {
      clearComposerSongStorage(window.localStorage, slug);
    } catch (e) {
      console.error("Failed to clear composer state from localStorage", e);
    }
    setLayerVisibility(DEFAULT_HARMONY_LAYER_VISIBILITY);
    setLayerVolumes(DEFAULT_LAYER_VOLUMES);
  }, [initialMelodyAbc, resetWorkspaceState, slug]);

  const hasGuitarBranchWork = hasAccompanimentGuitarBranchWork(ws);

  const handleResetGuitarBranchWork = useCallback(() => {
    updateState(buildAccompanimentGuitarBranchResetState(ws));
    setAccompLayerVisibility((current) => ({
      ...current,
      TAB: false,
    }));
  }, [ws, updateState]);
  const accompanimentAbc = previewModel.accompaniment.abc;
  const accompanimentVoiceNames = previewModel.accompaniment.voiceNames;
  const getRenderOptionsFor = previewModel.getRenderOptionsFor;

  if (step === "melody") {
    return (
      <div className="space-y-5">
        <AbcEditor
          title="ABC Notation Editor"
          value={melodyAbc}
          initialAbc={initialMelodyAbc ?? DEFAULT_ABC}
          storageKey={getComposerMelodyStorageKey(slug)}
          onChange={setMelodyAbc}
        />
      </div>
    );
  }

  if (step === "harmony") {
    return (
      <HarmonyStep
        melodyAbc={melodyAbc}
        initialMelodyAbc={initialMelodyAbc}
        hasMounted={hasMounted}
        pipeline={pipeline}
        harmonyPreview={previewModel.harmony}
        layerVisibility={layerVisibility}
        setLayerVisibility={setLayerVisibility}
        layerVolumes={layerVolumes}
        setLayerVolumes={setLayerVolumes}
        ws={ws}
        updateState={updateState}
        onRestore={handleRestoreHarmony}
      />
    );
  }

  if (step === "accompaniment") {
    return (
      <AccompanimentStep
        activeAbc={activeAbc}
        hasMounted={hasMounted}
        pipeline={pipeline}
        workflowAppliedMusicAbc={workflowAppliedMusicAbc}
        accompanimentPreview={previewModel.accompaniment}
        accompLayerVisibility={accompLayerVisibility}
        setAccompLayerVisibility={setAccompLayerVisibility}
        accompLayerVolumes={accompLayerVolumes}
        setAccompLayerVolumes={setAccompLayerVolumes}
        getRenderOptionsFor={getRenderOptionsFor}
        ws={ws}
        updateState={updateState}
        canResetGuitarBranchWork={hasGuitarBranchWork}
        onResetGuitarBranchWork={handleResetGuitarBranchWork}
      />
    );
  }

  if (step === "guitar-fingerstyle") {
    return (
      <GuitarFingerstyleStep
        slug={slug}
        activeAbc={activeAbc}
        hasMounted={hasMounted}
        pipeline={pipeline}
        workflowAppliedMusicAbc={workflowAppliedMusicAbc}
        accompanimentPreview={previewModel.accompaniment}
        accompLayerVisibility={accompLayerVisibility}
        setAccompLayerVisibility={setAccompLayerVisibility}
        accompLayerVolumes={accompLayerVolumes}
        setAccompLayerVolumes={setAccompLayerVolumes}
        ws={ws}
        updateState={updateState}
        canResetGuitarBranchWork={hasGuitarBranchWork}
        onResetGuitarBranchWork={handleResetGuitarBranchWork}
      />
    );
  }

  const reviewAbc = accompanimentAbc || melodyAbc;
  const cleanReviewAbc = cleanAbcForExport(reviewAbc);
  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\nabcNotations:\n  - type: "melody"\n    label: "Melody Music Sheet"\n---\n\n## Lyrics\n\nDraft lyrics...\n\n## ABC\n\n\`\`\`abc\n${cleanReviewAbc}\n\`\`\``;

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
