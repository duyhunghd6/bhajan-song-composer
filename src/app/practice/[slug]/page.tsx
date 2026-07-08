import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAllSongs } from "@/lib/songs/loader";
import PracticeViewer from "./PracticeViewer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Practice Viewer — Bhajan Song Composer",
  description: "Viewer for practicing bhajan arrangements with layer visibility.",
};

export async function generateStaticParams() {
  const songs = await loadAllSongs();
  return songs.map((song) => ({
    slug: song.meta.slug.toLowerCase(),
  }));
}

export default async function PracticePage({ params }: PageProps) {
  const { slug } = await params;

  const songs = await loadAllSongs();
  const song = songs.find((s) => s.meta.slug.toLowerCase() === slug.toLowerCase());

  if (!song) {
    notFound();
  }

  // Look for accompaniment first, then fallback to melody, then any other available
  const targetNotation = 
    song.abcNotations.find((n) => n.type === "accompaniment") ||
    song.abcNotations.find((n) => n.type === "melody") ||
    song.abcNotations[0];

  const initialAbc = targetNotation?.content || "";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 transition-colors duration-300 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1920px] space-y-8">
        <nav className="mx-auto max-w-5xl text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="transition-colors hover:text-amber-500">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{song.meta.title} (Practice)</span>
        </nav>

        {initialAbc ? (
          <PracticeViewer initialAbc={initialAbc} metadata={song.meta} />
        ) : (
          <div className="mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No ABC Notation Found</h2>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              This song does not have any generated music sheet. Try generating it in the composer first.
            </p>
            <div className="mt-6">
              <Link
                href={`/compose/${slug}/melody`}
                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
              >
                Go to Composer
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
