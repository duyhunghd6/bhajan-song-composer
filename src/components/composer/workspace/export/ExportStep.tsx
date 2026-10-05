"use client";

import { Button, buttonStyles } from "@/components/ui/Button";


import Link from "next/link";
import styles from "../harmony.module.css";
import { useMemo, useState, useTransition } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { publishArrangement } from "@/app/actions/publish-arrangement";
import { cleanAbcForExport } from "@/lib/theory/abc-layer-visibility";
import type { ComposerPublishedNotationType } from "@/lib/songs/composer-notation";
import type { ArrangementSourceGraph } from "../arrangement-source/arrangement-source-graph";
import { COMPOSER_PREVIEW_RENDER_OPTIONS, COMPOSER_STAFF_PLAYBACK_PROPS } from "../preview";

interface ExportStepProps {
  slug: string;
  sourceGraph: ArrangementSourceGraph;
  previewAbc: string;
  getRenderOptionsFor: (abc: string, options: typeof COMPOSER_PREVIEW_RENDER_OPTIONS) => Record<string, unknown>;
}

export function ExportStep({ slug, sourceGraph, previewAbc, getRenderOptionsFor }: ExportStepProps) {
  const [selectedTypes, setSelectedTypes] = useState<ComposerPublishedNotationType[]>([]);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [practiceHref, setPracticeHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedLayers = useMemo(
    () => sourceGraph.exportableLayers.filter((layer) => selectedTypes.includes(layer.type)),
    [selectedTypes, sourceGraph.exportableLayers]
  );

  const toggleLayer = (type: ComposerPublishedNotationType) => {
    setSelectedTypes((current) => current.includes(type)
      ? current.filter((candidate) => candidate !== type)
      : [...current, type]);
    setPracticeHref(null);
    setPublishStatus(null);
  };

  const publishSelectedLayers = () => {
    startTransition(async () => {
      const result = await publishArrangement({
        slug,
        layers: selectedLayers.map((layer) => ({
          type: layer.type,
          abc: cleanAbcForExport(layer.abc),
        })),
      });
      if (result.success) {
        setPracticeHref(result.practiceHref);
        setPublishStatus(`Published ${result.publishedTypes.length} notation layer${result.publishedTypes.length === 1 ? "" : "s"} to the local catalogue.`);
      } else {
        setPracticeHref(null);
        setPublishStatus(`Could not publish: ${result.error}`);
      }
    });
  };

  return (
    <div className={`${styles.workspace} ${styles.rightWorkspace}`}>
      <section className={styles.score} aria-label="Arrangement preview">
          <AbcjsPlaybackController
            abcString={previewAbc}
            title="Export Music Playback Controller"
            canvasId="composer-export-preview"
            {...COMPOSER_STAFF_PLAYBACK_PROPS}
            renderOptions={getRenderOptionsFor(previewAbc, COMPOSER_PREVIEW_RENDER_OPTIONS)}
          />
      </section>
        <aside className={styles.assistant} aria-label="Export tools"><div className={styles.panelBody}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Export selected notation layers</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Choose the validated layers to publish. Composer drafts stay local until this step succeeds.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Practice showcase
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {sourceGraph.exportableLayers.map((layer) => {
              const selected = selectedTypes.includes(layer.type);
              return (
                <label key={layer.type} className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleLayer(layer.type)}
                    className="mt-1 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{layer.label}</span>
                    <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">{layer.provenance} · `{slug}.{layer.type}.abc`</span>
                  </span>
                </label>
              );
            })}
          </div>

          {sourceGraph.warnings.length > 0 && (
            <ul className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {sourceGraph.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}
            </ul>
          )}

          <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <strong>Will preserve:</strong> the existing song Markdown body, including Lyrics and Notes. Unselected notation files are not deleted or changed.
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md"
              type="button"
              onClick={publishSelectedLayers}
              disabled={selectedLayers.length === 0 || isPending}

            >
              {isPending ? "Publishing…" : `Publish ${selectedLayers.length || "selected"} layer${selectedLayers.length === 1 ? "" : "s"}`}
            </Button>
            {practiceHref && (
              <Link href={practiceHref} className={buttonStyles()}>
                Open Practice
              </Link>
            )}
          </div>
          {publishStatus && <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300" role="status">{publishStatus}</p>}
        </div></aside>
    </div>
  );
}
