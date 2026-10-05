"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Song } from "@/lib/songs/schema";

interface SongEditListProps {
  songs: Song[];
}

export default function SongEditList({ songs }: SongEditListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSongs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return songs;
    return songs.filter((song) => {
      const title = song.meta.title.toLowerCase();
      const language = song.meta.language.toLowerCase();
      const raga = (song.meta.raga || "").toLowerCase();
      const tags = song.meta.tags.map((t) => t.toLowerCase());
      return (
        title.includes(query) ||
        language.includes(query) ||
        raga.includes(query) ||
        tags.some((tag) => tag.includes(query))
      );
    });
  }, [songs, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div className="flex-1 max-w-lg">
          <label htmlFor="song-search-input" className="sr-only">
            Search songs
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="song-search-input"
              type="text"
              placeholder="Search by title, raga, language, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-zinc-400 transition-all"
            />
          </div>
        </div>

        <Link
          href="/compose"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Song
        </Link>
      </div>

      {/* Song Grid */}
      {filteredSongs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 p-12 rounded-2xl text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No songs match your search query.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSongs.map((song) => {
            const metadataHref = `/compose?edit=${song.meta.slug}`;
            const hasVideo = song.meta.videos && song.meta.videos.length > 0;
            const hasBackingTrack =
              song.meta.videos?.some((v) => v.type === "backing-track") ||
              song.abcNotations?.some((n) => n.type === "backing-track");
            const hasMelody = song.abcNotations?.some((n) => n.type === "melody");
            const hasGuitar = song.abcNotations?.some((n) =>
              n.type.toLowerCase().includes("guitar")
            );
            const hasPiano = song.abcNotations?.some((n) =>
              n.type.toLowerCase().includes("piano")
            );

            return (
              <article
                key={song.meta.slug}
                data-song-slug={song.meta.slug}
                className="group flex flex-col justify-between bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-900/50 transition-all hover:-translate-y-1 duration-300"
              >
                <div className="space-y-4">
                  {/* Title & Language */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">
                        {song.meta.title}
                      </h3>
                      <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-0.5">
                        {song.meta.language}
                      </p>
                    </div>
                    <span className="song-key-badge px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50">
                      Key: {song.meta.key}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {song.meta.raga && (
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200/40 dark:border-zinc-700/40">
                        Raga: {song.meta.raga}
                      </span>
                    )}
                    {song.meta.taal && (
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200/40 dark:border-zinc-700/40">
                        Taal: {song.meta.taal}
                      </span>
                    )}
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200/40 dark:border-zinc-700/40 capitalize">
                      {song.meta.category}
                    </span>
                  </div>

                  {/* Resource Indicators */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3.5 space-y-2">
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      Available Resources
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Choose a resource to edit it or add a new layer. Guitar and Piano open their Layer 2 lane after Harmony is validated.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        {
                          id: "video",
                          icon: "📹",
                          label: "Video",
                          available: hasVideo,
                          href: `${metadataHref}#video-resources`,
                          availableClass: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/45",
                        },
                        {
                          id: "backing-track",
                          icon: "🎹",
                          label: "BT",
                          available: hasBackingTrack,
                          href: `${metadataHref}#notation-resources`,
                          availableClass: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/45",
                        },
                        {
                          id: "melody",
                          icon: "🎼",
                          label: "Melody",
                          available: hasMelody,
                          href: `/compose/${song.meta.slug}/melody`,
                          availableClass: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/45",
                        },
                        {
                          id: "guitar",
                          icon: "🎸",
                          label: "Guitar",
                          available: hasGuitar,
                          href: `/compose/${song.meta.slug}/accompaniment?instrument=guitar-classic`,
                          availableClass: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/45",
                        },
                        {
                          id: "piano",
                          icon: "🎹",
                          label: "Piano",
                          available: hasPiano,
                          href: `/compose/${song.meta.slug}/accompaniment?instrument=piano`,
                          availableClass: "bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-300 dark:border-cyan-900/45",
                        },
                      ].map((resource) => (
                        <Link
                          key={resource.id}
                          data-indicator={resource.id}
                          href={resource.href}
                          aria-label={`${resource.available ? "Edit" : "Add"} ${resource.label} for ${song.meta.title}`}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 hover:-translate-y-px hover:shadow-sm ${
                            resource.available
                              ? `${resource.availableClass} font-medium`
                              : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:border-zinc-900/45 dark:bg-zinc-950/20 dark:text-zinc-500"
                          }`}
                        >
                          <span aria-hidden="true">{resource.icon}</span>
                          {resource.label}
                          <span className="sr-only"> — {resource.available ? "Edit" : "Add"}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-end">
                  <Link
                    href={metadataHref}
                    className="edit-song-btn w-full sm:w-auto text-center inline-flex items-center justify-center px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500 text-zinc-700 dark:text-zinc-200 hover:text-white hover:bg-amber-500 transition-all font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    Edit Song
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
