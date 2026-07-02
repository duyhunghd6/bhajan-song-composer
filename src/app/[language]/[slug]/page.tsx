import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadSong, loadAllSongs } from "@/lib/songs/loader";
import PlaybackController from "@/components/playback/PlaybackController";

interface PageProps {
  params: Promise<{ language: string; slug: string }>;
}

function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export async function generateStaticParams() {
  const songs = await loadAllSongs();
  return songs.map((song) => ({
    language: song.meta.language.toLowerCase(),
    slug: song.meta.slug.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { language, slug } = await params;
  try {
    const song = await loadSong(language, slug);
    return {
      title: `${song.meta.title} — ${song.meta.language.toUpperCase()} Bhajan | Bhajan Song Composer`,
      description: `Lyrics and sheet music for ${song.meta.title} (${song.meta.language}). Raga: ${song.meta.raga || "N/A"}, Taal: ${song.meta.taal || "N/A"}.`,
    };
  } catch {
    return {
      title: "Song Not Found",
    };
  }
}

export default async function SongPage({ params }: PageProps) {
  const { language, slug } = await params;

  let song;
  try {
    song = await loadSong(language, slug);
  } catch {
    notFound();
  }

  const referenceVideo = song.meta.videos.find((video) => video.default) ?? song.meta.videos[0] ?? null;
  const referenceVideoId = referenceVideo ? getYouTubeId(referenceVideo.url) : null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-amber-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/${language}`} className="hover:text-amber-500 transition-colors capitalize">
            {language}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{song.meta.title}</span>
        </nav>

        {/* Song Header Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              {song.meta.title}
            </h1>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 capitalize">
                {song.meta.language}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-800 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 capitalize">
                {song.meta.category}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t border-zinc-100 dark:border-zinc-800 pt-4">
            {song.meta.raga && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block text-xs">Raga</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{song.meta.raga}</span>
              </div>
            )}
            {song.meta.taal && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block text-xs">Taal</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{song.meta.taal}</span>
              </div>
            )}
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 block text-xs">Key</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{song.meta.key}</span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 block text-xs">Time Signature</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {song.meta.timeSignature}
              </span>
            </div>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-2" aria-label="Playback reference and lyrics">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                  Reference Material
                </p>
                <h2 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  YouTube Player
                </h2>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                Type: {referenceVideo?.type ?? "Unavailable"}
              </span>
            </div>
            {referenceVideoId ? (
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-black shadow-md dark:border-zinc-800/80">
                <iframe
                  id="reference-youtube-iframe-player"
                  src={`https://www.youtube.com/embed/${referenceVideoId}?enablejsapi=1`}
                  title={referenceVideo?.label ?? song.meta.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                No reference video available.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="border-b border-zinc-100 pb-2 text-xl font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
              Lyrics & Transliteration
            </h2>
            <div className="mt-4 whitespace-pre-line font-serif text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              {song.lyrics}
            </div>
          </div>
        </section>

        {/* Playback Module Component */}
        <Suspense fallback={<div className="p-12 text-center text-sm text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">Loading playback controls...</div>}>
          <PlaybackController song={song} />
        </Suspense>

        {/* Notes */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Notes Card */}
          <div className="md:col-span-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Notes & Information
            </h2>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-line leading-relaxed">
              {song.notes || "No performance notes available."}
            </div>

            {song.meta.composer && (
              <div className="text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <strong>Composer:</strong> {song.meta.composer}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
