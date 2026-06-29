import { Metadata } from "next";
import { loadAllSongs } from "@/lib/songs/loader";
import SongSearch from "@/components/SongSearch";

export const metadata: Metadata = {
  title: "Bhajan Song Composer — Sahaja Yoga Devotional Music Hub",
  description: "Browse, play, and compose Sahaja Yoga bhajans. Explore chord progressions, guitar fretboards, and piano sheets with interactive playback.",
};

export default async function Home() {
  const songs = await loadAllSongs();

  const searchableSongs = songs.map((song) => ({
    title: song.meta.title,
    slug: song.meta.slug,
    language: song.meta.language,
    category: song.meta.category,
    raga: song.meta.raga,
    taal: song.meta.taal,
    key: song.meta.key,
    tags: song.meta.tags,
    lyrics: song.lyrics,
  }));

  // Calculate quick stats
  const langCounts = songs.reduce((acc, song) => {
    const lang = song.meta.language.toLowerCase();
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">
            Bhajan Song Composer
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
            A unified open-source workstation for Sahaja Yoga devotional music. Learn, practice, and compose arrangements with interactive playback and AI music theory guidance.
          </p>
        </div>

        {/* Quick Stats / Language Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {["hindi", "marathi", "sanskrit", "english"].map((lang) => (
            <div
              key={lang}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 text-center shadow-sm capitalize"
            >
              <div className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
                {lang}
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {langCounts[lang] || 0}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 my-8" />

        {/* Interactive Search & List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Song Catalogue
          </h2>
          <SongSearch songs={searchableSongs} />
        </div>
      </div>
    </main>
  );
}
