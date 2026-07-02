"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Song, SongMetadata } from "@/lib/songs/schema";
import SongForm from "./SongForm";
import { getComposerStepHref } from "./composer-steps";

interface ComposerWorkstationProps {
  songs: Song[];
}

const DEFAULT_DRAFT_SLUG = "new-bhajan-arrangement";

export default function ComposerWorkstation({ songs }: ComposerWorkstationProps) {
  const searchParams = useSearchParams();
  const edit = searchParams.get("edit");
  const initialSong = edit ? songs.find((s) => s.meta.slug === edit) : undefined;
  const loadedMetadata: SongMetadata | undefined = initialSong ? initialSong.meta : undefined;
  const [metadata, setMetadata] = useState<SongMetadata | undefined>(loadedMetadata);

  const currentSlug = metadata?.slug || initialSong?.meta.slug || DEFAULT_DRAFT_SLUG;
  const startHref = getComposerStepHref(currentSlug, "melody");

  const resourceSummary = useMemo(() => {
    const source = initialSong;
    return {
      videos: metadata?.videos.length ?? source?.meta.videos.length ?? 1,
      notations: metadata?.abcNotations.length ?? source?.meta.abcNotations.length ?? 1,
      loadedLayers: source?.abcNotations.length ?? 0,
    };
  }, [initialSong, metadata]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Composer Home
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
              Metadata & Layer Status
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {initialSong
                ? `Review metadata for ${initialSong.meta.title}, then continue into the focused route-based arrangement steps.`
                : "Create the song shell first, then move into the five dedicated composer child-UIs."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/edit"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-sm transition-all hover:border-amber-500 hover:text-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              ← Back to Edit List
            </Link>
            <Link
              href={startHref}
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-amber-600"
            >
              {initialSong ? "Continue arrangement" : "Save & Start Melody"}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Draft slug</p>
          <p className="mt-2 break-all font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{currentSlug}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Resource rows</p>
          <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {resourceSummary.videos} video · {resourceSummary.notations} notation
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Layer status</p>
          <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {resourceSummary.loadedLayers > 0 ? `${resourceSummary.loadedLayers} catalogue layers loaded` : "Starter melody layer ready"}
          </p>
        </div>
      </section>

      <SongForm
        key={`form-${initialSong?.meta.slug || "new"}`}
        initialMetadata={loadedMetadata}
        storageKey={`bhajan-song-composer:song-form:draft:${initialSong?.meta.slug || "new"}`}
        onChange={setMetadata}
      />
    </div>
  );
}
