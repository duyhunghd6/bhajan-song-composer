"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Song, SongVideo, SongAbcNotation } from "@/lib/songs/schema";
import YouTubePlayer from "./YouTubePlayer";
import AbcSheetViewer from "./AbcSheetViewer";

interface PlaybackControllerProps {
  song: Song;
}

export default function PlaybackController({ song }: PlaybackControllerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const videos = song.meta.videos;
  const notations = song.abcNotations;

  // Determine defaults
  const defaultVideo = videos.find((v) => v.default) || videos[0];
  const defaultNotation = notations.find((n) => n.default) || notations[0];

  // States
  const [viewMode, setViewMode] = useState<"video" | "sheet" | "split">("split");
  const [activeVideo, setActiveVideo] = useState<SongVideo | null>(defaultVideo);
  const [activeNotation, setActiveNotation] = useState<
    (SongAbcNotation & { content: string }) | null
  >(defaultNotation as any);

  // Sync state with URL search params after mounting
  useEffect(() => {
    const videoParam = searchParams.get("video");
    const sheetParam = searchParams.get("sheet");
    const viewParam = searchParams.get("view");

    if (viewParam === "video" || viewParam === "sheet" || viewParam === "split") {
      setViewMode(viewParam);
    }

    if (videoParam) {
      const match = videos.find((v) => v.type === videoParam);
      if (match) setActiveVideo(match);
    }

    if (sheetParam) {
      const match = notations.find((n) => n.type === sheetParam);
      if (match) setActiveNotation(match as any);
    }
  }, [searchParams, videos, notations]);

  // Helper to update URL search parameters
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Use router.replace inside a transition to prevent UI blocking
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleViewModeChange = (mode: "video" | "sheet" | "split") => {
    setViewMode(mode);
    updateUrlParams({ view: mode });
  };

  const handleVideoChange = (video: SongVideo) => {
    setActiveVideo(video);
    updateUrlParams({ video: video.type });
  };

  const handleNotationChange = (notation: SongAbcNotation & { content: string }) => {
    setActiveNotation(notation);
    updateUrlParams({ sheet: notation.type });
  };

  return (
    <div className="w-full space-y-6">
      {/* View Mode Tabs */}
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-2xl shadow-sm">
        <div className="flex gap-1.5 w-full sm:w-auto">
          {(["video", "sheet", "split"] as const).map((mode) => (
            <button
              key={mode}
              id={`view-mode-tab-${mode}`}
              onClick={() => handleViewModeChange(mode)}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold capitalize rounded-xl transition-all cursor-pointer ${
                viewMode === mode
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {mode === "split" ? "Split View" : `${mode} view`}
            </button>
          ))}
        </div>

        <span className="hidden sm:inline-flex text-xs font-medium text-zinc-400">
          Tip: selections are saved in the URL!
        </span>
      </div>

      {/* Main Container based on view mode */}
      <div className="grid gap-6 w-full">
        {/* Split View: Video & Sheet side by side */}
        {viewMode === "split" && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Video Side */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm space-y-3">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Select Video Track
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {videos.map((v) => (
                    <button
                      key={v.type}
                      id={`split-video-select-${v.type}`}
                      onClick={() => handleVideoChange(v)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                        activeVideo?.type === v.type
                          ? "bg-amber-500/10 text-amber-600 border-amber-400 dark:text-amber-400"
                          : "bg-transparent text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeVideo && (
                <YouTubePlayer url={activeVideo.url} title={activeVideo.label} />
              )}
            </div>

            {/* Notation Side */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm space-y-3">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Select Music Sheet Layer
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {notations.map((n) => (
                    <button
                      key={n.type}
                      id={`split-sheet-select-${n.type}`}
                      onClick={() => handleNotationChange(n as any)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                        activeNotation?.type === n.type
                          ? "bg-amber-500/10 text-amber-600 border-amber-400 dark:text-amber-400"
                          : "bg-transparent text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeNotation && (
                <AbcSheetViewer
                  abcString={activeNotation.content}
                  songTitle={song.meta.title}
                />
              )}
            </div>
          </div>
        )}

        {/* Video Only View */}
        {viewMode === "video" && (
          <div className="max-w-3xl mx-auto w-full space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Active Video:
              </span>
              <div className="flex gap-1.5">
                {videos.map((v) => (
                  <button
                    key={v.type}
                    id={`video-only-select-${v.type}`}
                    onClick={() => handleVideoChange(v)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                      activeVideo?.type === v.type
                        ? "bg-amber-500/10 text-amber-600 border-amber-400 dark:text-amber-400"
                        : "bg-transparent text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {activeVideo && (
              <YouTubePlayer url={activeVideo.url} title={activeVideo.label} />
            )}
          </div>
        )}

        {/* Sheet Only View */}
        {viewMode === "sheet" && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Active Layer:
              </span>
              <div className="flex gap-1.5">
                {notations.map((n) => (
                  <button
                    key={n.type}
                    id={`sheet-only-select-${n.type}`}
                    onClick={() => handleNotationChange(n as any)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                      activeNotation?.type === n.type
                        ? "bg-amber-500/10 text-amber-600 border-amber-400 dark:text-amber-400"
                        : "bg-transparent text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            {activeNotation && (
              <AbcSheetViewer
                abcString={activeNotation.content}
                songTitle={song.meta.title}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
