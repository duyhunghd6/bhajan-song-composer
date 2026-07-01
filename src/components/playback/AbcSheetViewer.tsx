"use client";

import MusicSheetRenderer from "@/components/music-sheet/MusicSheetRenderer";

interface AbcSheetViewerProps {
  abcString: string;
  songTitle: string;
}

export default function AbcSheetViewer({ abcString }: AbcSheetViewerProps) {
  return (
    <MusicSheetRenderer
      abcString={abcString}
      title="Music Sheet Playback"
      canvasId="abc-music-canvas"
      controls
      showLoopControls
    />
  );
}
