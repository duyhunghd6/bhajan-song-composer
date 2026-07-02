import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { loadAllSongs } from "@/lib/songs/loader";
import ComposerWorkstation from "@/components/composer/ComposerWorkstation";

export const metadata: Metadata = {
  title: "Composer — Bhajan Song Composer",
  description:
    "Draft ABC notation for Sahaja Yoga bhajan arrangements with live SVG preview, undo/redo, and browser-local WIP saving.",
};

export default async function ComposePage() {
  const songs = await loadAllSongs();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-amber-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/edit" className="hover:text-amber-500 transition-colors">
            Catalogue Editor
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">Composer</span>
        </nav>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                Composer Workstation
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                Song Metadata & Layers Dashboard
              </h1>
            </div>
            <span className="px-3 py-1 text-xs font-semibold rounded-full border border-amber-200 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
              Browser-local WIP
            </span>
          </div>
          <p className="max-w-3xl text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Create or refine the song metadata and resource rows first, then continue into the five
            focused composer child-UIs for melody, harmony, accompaniment, ensemble, and review.
            Drafts are saved in this browser so you can refresh or return later without losing unsaved work.
          </p>
        </div>

        <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">Loading workstation...</div>}>
          <ComposerWorkstation songs={songs} />
        </Suspense>
      </div>
    </main>
  );
}
