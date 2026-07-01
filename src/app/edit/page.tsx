import { Metadata } from "next";
import Link from "next/link";
import { loadAllSongs } from "@/lib/songs/loader";
import SongEditList from "@/components/composer/SongEditList";

export const metadata: Metadata = {
  title: "Catalogue Editor — Bhajan Song Composer",
  description: "Browse the Sahaja Yoga bhajan song catalogue, check available resources, and edit compositions.",
};

export default async function EditDashboardPage() {
  const songs = await loadAllSongs();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-amber-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">Catalogue Editor</span>
        </nav>

        {/* Title Description card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                Workstation Hub
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                Catalogue Editor
              </h1>
            </div>
            <span className="px-3 py-1 text-xs font-semibold rounded-full border border-amber-200 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
              Contribution Portal
            </span>
          </div>
          <p className="max-w-3xl text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Select a song from the library to revise its chords, update video materials, or generate new piano/guitar layers using the AI assistant. You can also compose a new song from scratch.
          </p>
        </div>

        <SongEditList songs={songs} />
      </div>
    </main>
  );
}
