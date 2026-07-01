"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Song, SongMetadata } from "@/lib/songs/schema";
import SongForm from "./SongForm";
import LayerManager, { ComposerLayer } from "./LayerManager";

interface ComposerWorkstationProps {
  songs: Song[];
}

export default function ComposerWorkstation({ songs }: ComposerWorkstationProps) {
  const searchParams = useSearchParams();
  const edit = searchParams.get("edit");
  const initialSong = edit ? songs.find((s) => s.meta.slug === edit) : undefined;

  // Map loaded song metadata
  const loadedMetadata: SongMetadata | undefined = initialSong ? initialSong.meta : undefined;

  // Map loaded song ABC notations to ComposerLayer format
  const loadedLayers: ComposerLayer[] | undefined = initialSong
    ? initialSong.abcNotations.map((notation, index) => ({
        id: notation.type,
        name: notation.label || notation.type,
        role: ["melody", "harmony", "bass", "rhythm"].includes(notation.type)
          ? (notation.type as any)
          : "custom",
        abc: notation.content,
        visible: notation.default ?? (index === 0),
      }))
    : undefined;

  const currentSlug = initialSong ? initialSong.meta.slug : null;

  return (
    <div className="space-y-8">
      {/* Workspace Header Dashboard */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {initialSong ? `Editing: ${initialSong.meta.title}` : "Workspace: Create New Song"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {initialSong
              ? `Revising notation tracks and metadata for ${initialSong.meta.title} (${initialSong.meta.language}).`
              : "Drafting a completely new bhajan composition layers template."}
          </p>
        </div>
        <div>
          <Link
            href="/edit"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-amber-500 hover:border-amber-500 transition-all font-semibold text-xs cursor-pointer bg-white dark:bg-zinc-900 shadow-sm"
          >
            ← Back to Edit List
          </Link>
        </div>
      </section>

      {/* Editor Workspace */}
      <SongForm
        key={`form-${currentSlug || "new"}`}
        initialMetadata={loadedMetadata}
        storageKey={`bhajan-song-composer:song-form:draft:${currentSlug || "new"}`}
      />

      <LayerManager
        key={`layers-${currentSlug || "new"}`}
        initialLayers={loadedLayers}
        storageKey={`bhajan-song-composer:composer:layers:${currentSlug || "new"}`}
      />
    </div>
  );
}
