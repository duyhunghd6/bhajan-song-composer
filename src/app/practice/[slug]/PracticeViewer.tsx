"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { LayerVisibilityControls } from "@/components/composer/workspace/LayerVisibilityControls";
import { ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS } from "@/components/composer/workspace/preview";
import { getArrangementRenderOptionsFor } from "@/components/composer/workspace/arrangement-preview-model";
import {
  applyAbcLayerVisibility,
  applyAbcLayerVolumes,
  extractAbcLayerVisibilityItems,
  extractAbcVoiceIds,
  getVisibleAbcVoiceIds,
  isAbcLayerVisible,
} from "@/lib/theory/abc-layer-visibility";
import { isTabCapableGuitarVoiceId } from "@/lib/theory/guitar-string-forcing";
import type { SongMetadata } from "@/lib/songs/schema";

export interface PracticeNotationOption {
  type: string;
  label: string;
}

export interface PracticeViewerProps {
  initialAbc: string;
  metadata: SongMetadata;
  selectedNotation: PracticeNotationOption;
  notationOptions: PracticeNotationOption[];
}

const PRACTICE_DEFAULT_VISIBILITY: Record<string, boolean> = {
  ChordProgression: true,
  Guitar: false,
  Piano: false,
  Harmonium: true,
  Violin: true,
  Melody: true,
  TAB: false,
};

const PRACTICE_DEFAULT_VOLUMES: Record<string, number> = {
  ChordProgression: 0,
  Harmonium: 20,
  Violin: 30,
  Melody: 70,
};

function getPracticeSettingsStorageKey(slug: string, notationType: string, abc: string) {
  let hash = 0;
  for (let index = 0; index < abc.length; index += 1) hash = ((hash << 5) - hash + abc.charCodeAt(index)) | 0;
  return `composer-practice-settings-${slug}-${notationType}-${hash >>> 0}`;
}

export default function PracticeViewer({ initialAbc, metadata, selectedNotation, notationOptions }: PracticeViewerProps) {
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(PRACTICE_DEFAULT_VISIBILITY);
  const [layerVolumes, setLayerVolumes] = useState<Record<string, number>>(PRACTICE_DEFAULT_VOLUMES);
  const [isHydrated, setIsHydrated] = useState(false);
  const settingsKey = useMemo(
    () => getPracticeSettingsStorageKey(metadata.slug, selectedNotation.type, initialAbc),
    [initialAbc, metadata.slug, selectedNotation.type]
  );

  useEffect(() => {
    setLayerVisibility(PRACTICE_DEFAULT_VISIBILITY);
    setLayerVolumes(PRACTICE_DEFAULT_VOLUMES);
    try {
      const saved = window.localStorage.getItem(settingsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.visibility) setLayerVisibility((current) => ({ ...current, ...parsed.visibility }));
        if (parsed.volumes) setLayerVolumes((current) => ({ ...current, ...parsed.volumes }));
      }
    } catch (error) {
      console.error("Failed to load practice settings", error);
    } finally {
      setIsHydrated(true);
    }
  }, [settingsKey]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify({ visibility: layerVisibility, volumes: layerVolumes }));
    } catch (error) {
      console.error("Failed to save practice settings", error);
    }
  }, [isHydrated, layerVisibility, layerVolumes, settingsKey]);

  const renderedAbc = useMemo(() => applyAbcLayerVisibility(
    applyAbcLayerVolumes(initialAbc, layerVolumes),
    layerVisibility
  ), [initialAbc, layerVisibility, layerVolumes]);
  const visibleVoiceNames = getVisibleAbcVoiceIds(initialAbc, layerVisibility);
  const hasGuitarVoice = visibleVoiceNames.some(isTabCapableGuitarVoiceId);
  const guitarTabEnabled = hasGuitarVoice && isAbcLayerVisible("TAB", layerVisibility, false);
  const layerVisibilityItems = extractAbcLayerVisibilityItems(initialAbc, { tabEnabled: extractAbcVoiceIds(initialAbc).some(isTabCapableGuitarVoiceId) });
  const practiceAbc = renderedAbc.replace(
    /^(V:\S+.*?\bname="([^"]+)")/gm,
    (match, prefix, name) => prefix.includes("sname=") ? match : `${prefix} sname="${name}"`
  );
  const renderOptions = getArrangementRenderOptionsFor(practiceAbc, ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS, guitarTabEnabled);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {notationOptions.length > 1 && (
        <nav aria-label="Published notation" className="flex flex-wrap gap-2">
          {notationOptions.map((notation) => (
            <Link
              key={notation.type}
              href={`/practice/${metadata.slug}?notation=${encodeURIComponent(notation.type)}`}
              className={notation.type === selectedNotation.type
                ? "rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white"
                : "rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"}
            >
              {notation.label}
            </Link>
          ))}
        </nav>
      )}

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
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedNotation.label}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Published catalogue notation · Practice Mode</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Practice</span>
        </div>

        {isHydrated && (
          <AbcjsPlaybackController
            abcString={practiceAbc}
            title={`${metadata.title} Practice Sheet`}
            canvasId={`practice-viewer-${metadata.slug}-${selectedNotation.type}`}
            minWidthClassName="min-w-0"
            sheetViewportClassName="p-4"
            renderOptions={renderOptions}
          />
        )}
      </section>
    </div>
  );
}
