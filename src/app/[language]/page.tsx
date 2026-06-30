import { Metadata } from "next";
import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { loadAllSongs } from "@/lib/songs/loader";

interface PageProps {
  params: Promise<{ language: string }>;
}

export async function generateStaticParams() {
  const SONGS_DIR = path.join(process.cwd(), "data", "songs");
  try {
    const files = await fs.readdir(SONGS_DIR, { withFileTypes: true });
    return files
      .filter((file) => file.isDirectory())
      .map((file) => ({ language: file.name.toLowerCase() }));
  } catch {
    return [
      { language: "hindi" },
      { language: "marathi" },
      { language: "sanskrit" },
      { language: "english" },
    ];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { language } = await params;
  const capLang = language.charAt(0).toUpperCase() + language.slice(1);
  return {
    title: `${capLang} Bhajan Catalogue — Bhajan Song Composer`,
    description: `Alphabetical list of Sahaja Yoga bhajans in ${capLang}. Browse, read lyrics, and play musical notation.`,
  };
}

export default async function LanguageCatalogue({ params }: PageProps) {
  const { language } = await params;
  const songs = await loadAllSongs();

  const langSongs = songs.filter(
    (song) => song.meta.language.toLowerCase() === language.toLowerCase()
  );

  // Sort alphabetically
  const sortedSongs = [...langSongs].sort((a, b) =>
    a.meta.title.localeCompare(b.meta.title)
  );

  // Group by first letter
  const grouped: Record<string, typeof sortedSongs> = {};
  sortedSongs.forEach((song) => {
    const letter = song.meta.title.charAt(0).toUpperCase();
    if (!grouped[letter]) {
      grouped[letter] = [];
    }
    grouped[letter].push(song);
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const capLanguage = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-amber-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium capitalize">
            {language}
          </span>
        </nav>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 capitalize">
            {capLanguage} Songs
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {langSongs.length} {langSongs.length === 1 ? "song" : "songs"} available in this category.
          </p>
        </div>

        {/* Alphabetical A-Z Anchor Index */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-wrap gap-2 justify-center">
          {alphabet.map((letter) => {
            const hasSongs = !!grouped[letter];
            return hasSongs ? (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors"
              >
                {letter}
              </a>
            ) : (
              <span
                key={letter}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium text-zinc-300 dark:text-zinc-700 bg-zinc-100 dark:bg-zinc-900/50 cursor-not-allowed select-none"
              >
                {letter}
              </span>
            );
          })}
        </div>

        {/* Alphabetical List */}
        <div className="space-y-10">
          {Object.keys(grouped)
            .sort()
            .map((letter) => (
              <section
                key={letter}
                id={`letter-${letter}`}
                className="space-y-4 scroll-mt-6"
              >
                <h2 className="text-2xl font-bold text-amber-500 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  {letter}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {grouped[letter].map((song) => (
                    <Link
                      key={song.meta.slug}
                      id={`song-card-${song.meta.slug}`}
                      href={`/${language}/${song.meta.slug}`}
                      className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/40 dark:hover:border-amber-500/40 rounded-xl shadow-sm hover:shadow transition-all group"
                    >
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">
                        {song.meta.title}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex gap-2">
                        {song.meta.raga && (
                          <span>
                            <strong>Raga:</strong> {song.meta.raga}
                          </span>
                        )}
                        <span>
                          <strong>Key:</strong> {song.meta.key}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

          {langSongs.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-zinc-500 dark:text-zinc-400">No songs found in this language.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
