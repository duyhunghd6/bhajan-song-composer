"use client";

import { useMemo } from "react";

interface YouTubePlayerProps {
  url: string;
  title: string;
}

export function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function YouTubePlayer({ url, title }: YouTubePlayerProps) {
  const videoId = useMemo(() => getYouTubeId(url), [url]);

  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
        <svg
          className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="font-semibold text-zinc-950 dark:text-zinc-50">
          Invalid YouTube URL
        </span>
        <span className="text-xs text-zinc-500 mt-1">{url}</span>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80 shadow-md bg-black">
      <iframe
        id="youtube-iframe-player"
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
