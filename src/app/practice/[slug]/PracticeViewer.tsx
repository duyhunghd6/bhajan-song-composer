"use client";

import { useState, useEffect, useMemo } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { LayerVisibilityControls } from "@/components/composer/workspace/LayerVisibilityControls";
import { ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS } from "@/components/composer/workspace/preview";
import { buildArrangementPreviewModel } from "@/components/composer/workspace/arrangement-preview-model";
import { 
  useWorkspaceState, 
  DEFAULT_HARMONY_LAYER_VISIBILITY, 
  DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY, 
  DEFAULT_LAYER_VOLUMES 
} from "@/components/composer/useWorkspaceState";
import { getComposerMelodyStorageKey } from "@/components/composer/workspace/storage";
import { DEFAULT_ABC } from "@/components/composer/AbcEditor";
import type { SongMetadata } from "@/lib/songs/schema";

export interface PracticeViewerProps {
  initialAbc: string;
  metadata: SongMetadata;
}

const PRACTICE_DEFAULT_VISIBILITY: Record<string, boolean> = {
  ...DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
  ChordProgression: true,
  Guitar: false,
  Piano: false,
  Harmonium: true,
  Violin: true,
};

const PRACTICE_DEFAULT_VOLUMES: Record<string, number> = {
  ...DEFAULT_LAYER_VOLUMES,
  ChordProgression: 0,
  Harmonium: 20,
  Violin: 30,
  Melody: 70,
};

function getPracticeSettingsStorageKey(slug: string) {
  return `composer-practice-settings-${slug}`;
}

export default function PracticeViewer({ initialAbc, metadata }: PracticeViewerProps) {
  const { state: ws, isHydrated: isWorkspaceHydrated } = useWorkspaceState(metadata.slug);
  const [melodyAbc, setMelodyAbc] = useState(initialAbc || DEFAULT_ABC);
  
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(PRACTICE_DEFAULT_VISIBILITY);
  const [layerVolumes, setLayerVolumes] = useState<Record<string, number>>(PRACTICE_DEFAULT_VOLUMES);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(getPracticeSettingsStorageKey(metadata.slug));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.visibility) setLayerVisibility((prev) => ({ ...prev, ...parsed.visibility }));
        if (parsed.volumes) setLayerVolumes((prev) => ({ ...prev, ...parsed.volumes }));
      }
    } catch (e) {
      console.error("Failed to load practice settings", e);
    } finally {
      setIsHydrated(true);
    }
  }, [metadata.slug]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(
        getPracticeSettingsStorageKey(metadata.slug),
        JSON.stringify({ visibility: layerVisibility, volumes: layerVolumes })
      );
    } catch (e) {
      console.error("Failed to save practice settings", e);
    }
  }, [layerVisibility, layerVolumes, isHydrated, metadata.slug]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      const savedMelody = window.localStorage.getItem(getComposerMelodyStorageKey(metadata.slug));
      const isDefault = savedMelody === DEFAULT_ABC || (savedMelody && savedMelody.includes("T:New Bhajan Arrangement"));
      if (savedMelody && !isDefault) {
        setMelodyAbc(savedMelody);
      }
    } catch (e) {
      console.error("Failed to restore melody state from localStorage", e);
    }
  }, [isHydrated, metadata.slug]);

  const previewModel = useMemo(() => buildArrangementPreviewModel({
    activeAbc: melodyAbc,
    workflow: ws.accompanimentWorkflow,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedGuitarOrigin: ws.generatedGuitarOrigin,
    previewPurpose: "final",
    harmonyLayerVisibility: DEFAULT_HARMONY_LAYER_VISIBILITY,
    harmonyLayerVolumes: DEFAULT_LAYER_VOLUMES,
    accompanimentLayerVisibility: layerVisibility,
    accompanimentLayerVolumes: layerVolumes,
  }), [
    melodyAbc,
    ws.accompanimentWorkflow,
    ws.generatedAccompaniment,
    ws.generatedGuitar,
    ws.generatedGuitarOrigin,
    layerVisibility,
    layerVolumes,
  ]);

  const renderedAbc = previewModel.accompaniment.abc;
  
  // Inject sname to all voices that have name, so the instrument name appears on all staves
  const practiceAbc = renderedAbc.replace(
    /^(V:\S+.*?\bname="([^"]+)")/gm,
    (match, prefix, name) => {
      if (prefix.includes("sname=")) return match;
      return `${prefix} sname="${name}"`;
    }
  );

  const layerVisibilityItems = previewModel.accompaniment.layerVisibilityItems;
  const renderOptions = previewModel.getRenderOptionsFor(practiceAbc, ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {isHydrated && layerVisibilityItems.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <h2 className="mb-4 text-base font-bold text-zinc-900 dark:text-zinc-100">Layer Visibility & Volumes</h2>
          <LayerVisibilityControls
            items={layerVisibilityItems}
            visibility={layerVisibility}
            onVisibilityChange={setLayerVisibility}
            volumes={layerVolumes}
            onVolumeChange={setLayerVolumes}
          />
        </section>
      )}

      <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Resulting ABC Staff Preview</h3>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            Practice Mode
          </span>
        </div>
        
        {isHydrated && (
          <AbcjsPlaybackController
            abcString={practiceAbc}
            title={`${metadata.title} Practice Sheet`}
            canvasId={`practice-viewer-${metadata.slug}`}
            minWidthClassName="min-w-[520px]"
            sheetViewportClassName="max-h-[min(80vh,900px)] overflow-auto p-4"
            renderOptions={renderOptions}
          />
        )}
      </section>
    </div>
  );
}
