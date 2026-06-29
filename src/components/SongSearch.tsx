"use client";

import { useState } from "react";
import Link from "next/link";

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

  const languages = ["all", "hindi", "marathi", "sanskrit", "english"];

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

  return (
    <div className="w-full space-y-6">
      {/* Search Input */}
      <div className="relative">
        <input
          id="song-search-input"
          type="text"
          placeholder="Search songs by title, lyrics, raga, or tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-5 py-4 pl-12 text-zinc-900 dark:text-zinc-100 bg-white/70 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent backdrop-blur-md transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Language Filter Tags */}
      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        {languages.map((lang) => (
          <button
            key={lang}
            id={`lang-filter-${lang}`}
            onClick={() => setSelectedLanguage(lang)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize border transition-all cursor-pointer ${
              selectedLanguage === lang
                ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-105 animate-pulse"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <Link
              key={`${song.language}-${song.slug}`}
              id={`song-link-${song.language}-${song.slug}`}
              href={`/${song.language}/${song.slug}`}
              className="group p-5 bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-amber-500/40 dark:hover:border-amber-500/40 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 backdrop-blur-sm"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">
                    {song.title}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border capitalize ${getLanguageBadgeColor(
                      song.language
                    )}`}
                  >
                    {song.language}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {song.raga && (
                    <span>
                      <strong>Raga:</strong> {song.raga}
                    </span>
                  )}
                  {song.taal && (
                    <span>
                      <strong>Taal:</strong> {song.taal}
                    </span>
                  )}
                  <span>
                    <strong>Key:</strong> {song.key}
                  </span>
                </div>

                {/* Lyrics Snippet */}
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 italic font-serif">
                  {song.lyrics}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-auto pt-2">
                {song.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md border border-zinc-200/50 dark:border-zinc-700/50"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-2 text-center py-12 bg-white/30 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <svg
              className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              No songs found
            </h3>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Try adjusting your search query or language filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
