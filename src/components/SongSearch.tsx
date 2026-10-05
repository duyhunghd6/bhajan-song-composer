"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import GuitarIcon from "@/components/icons/GuitarIcon";

type SearchableSong = {
  title: string;
  slug: string;
  language: string;
  category: string;
  raga?: string;
  taal?: string;
  key: string;
  tags: string[];
  lyrics: string;
};

interface SongSearchProps {
  songs: SearchableSong[];
}

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-amber-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
    >
      {children}
    </Link>
  );
}

function MelodyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" d="M9 18V6l9-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="15" cy="16" r="3" />
    </svg>
  );
}

function HarmonyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 1.9 5.8H20l-5 3.6 1.9 5.8-4.9-3.6-4.9 3.6 1.9-5.8-5-3.6h6.1L12 3Z"
      />
    </svg>
  );
}

function ArrangeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h11m-4-3 3 3-3 3M20 17H9m4-3-3 3 3 3"
      />
    </svg>
  );
}

export default function SongSearch({ songs }: SongSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const filteredSongs = songs.filter((song) => {
    const matchesLang =
      selectedLanguage === "all" ||
      song.language.toLowerCase() === selectedLanguage.toLowerCase();
    const q = query.toLowerCase();
    const matchesQuery =
      song.title.toLowerCase().includes(q) ||
      song.lyrics.toLowerCase().includes(q) ||
      song.category.toLowerCase().includes(q) ||
      (song.raga && song.raga.toLowerCase().includes(q)) ||
      song.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchesLang && matchesQuery;
  });

  const isNavigatorView = query.trim() === "" && selectedLanguage === "all";
  const categoryGroups = Object.entries(
    songs.reduce<Record<string, SearchableSong[]>>((groups, song) => {
      const category = song.category.trim() || "Uncategorised";
      (groups[category] ??= []).push(song);
      return groups;
    }, {}),
  )
    .map(([category, categorySongs]) => ({
      category,
      songs: [...categorySongs].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const getLanguageBadgeColor = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "hindi":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      case "marathi":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
      case "sanskrit":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
      case "english":
        return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800";
    }
  };

  const SongCard = ({ song }: { song: SearchableSong }) => {
    const songHref = `/${song.language}/${song.slug}`;
    const composeHref = `/compose/${song.slug}`;
    return (
      <article className="group flex min-w-0 flex-col justify-between rounded-2xl border border-zinc-200/70 bg-white/60 p-4 shadow-sm backdrop-blur-sm transition duration-300 hover:border-amber-500/50 hover:bg-white hover:shadow-md dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:hover:border-amber-500/50 dark:hover:bg-zinc-900">
        <Link
          href={songHref}
          className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-zinc-900 transition-colors group-hover:text-amber-600 dark:text-zinc-100 dark:group-hover:text-amber-400">
              {song.title}
            </h3>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${getLanguageBadgeColor(song.language)}`}
            >
              {song.language}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {song.raga && <span>Raga: {song.raga}</span>}
            {song.taal && <span>Taal: {song.taal}</span>}
            <span>Key: {song.key}</span>
          </div>
        </Link>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <Link
            href={songHref}
            className="text-xs font-semibold text-zinc-500 transition hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400"
          >
            Open song <span aria-hidden="true">→</span>
          </Link>
          <div
            className="flex items-center gap-1.5"
            aria-label={`Composer shortcuts for ${song.title}`}
          >
            <IconButton
              href={`${composeHref}/melody`}
              label={`Edit melody for ${song.title}`}
            >
              <MelodyIcon />
            </IconButton>
            <IconButton
              href={`${composeHref}/harmony`}
              label={`Harmonize ${song.title}`}
            >
              <HarmonyIcon />
            </IconButton>
            <IconButton
              href={`${composeHref}/accompaniment`}
              label={`Arrange accompaniment for ${song.title}`}
            >
              <ArrangeIcon />
            </IconButton>
            <IconButton
              href={`${composeHref}/guitar-fingerstyle`}
              label={`Create guitar fingerstyle for ${song.title}`}
            >
              <GuitarIcon className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div className="relative">
        <input
          id="song-search-input"
          type="search"
          placeholder="Search songs by title, lyrics, raga, or tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl border border-zinc-200 bg-white/70 py-4 pl-12 pr-5 text-zinc-900 shadow-sm backdrop-blur-md transition-all placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <svg
          aria-hidden="true"
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-start">
        {["all", "hindi", "marathi", "sanskrit", "english"].map((lang) => (
          <button
            key={lang}
            id={`lang-filter-${lang}`}
            onClick={() => setSelectedLanguage(lang)}
            className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-all ${selectedLanguage === lang ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700"}`}
          >
            {lang}
          </button>
        ))}
      </div>

      {isNavigatorView ? (
        <div className="space-y-8" aria-label="Song categories">
          {categoryGroups.map((group) => (
            <section
              key={group.category}
              className="space-y-3"
              aria-labelledby={`category-${group.category}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h3
                    id={`category-${group.category}`}
                    className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
                  >
                    {group.category}
                  </h3>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {group.songs.length}{" "}
                    {group.songs.length === 1 ? "song" : "songs"}
                  </span>
                </div>
                {group.songs.length > 4 && (
                  <button
                    onClick={() => setQuery(group.category)}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    View all {group.songs.length}{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {group.songs.slice(0, 4).map((song) => (
                  <SongCard key={`${song.language}-${song.slug}`} song={song} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-live="polite"
        >
          {filteredSongs.length > 0 ? (
            filteredSongs.map((song) => (
              <SongCard key={`${song.language}-${song.slug}`} song={song} />
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 bg-white/30 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                No songs found
              </h3>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Try adjusting your search query or language filter.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
