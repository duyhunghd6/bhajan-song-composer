"use client";

import { useMemo, useState } from "react";
import { GuitarFretboard, PianoKeyboard } from "@/components/instruments";
import MusicSheetRenderer, {
  type MusicSheetPlaybackCursorEvent,
} from "@/components/music-sheet/MusicSheetRenderer";
import { buildSynchronizedInstrumentHighlights } from "./instrument-highlighting";

interface AbcSheetViewerProps {
  abcString: string;
  songTitle: string;
}

export default function AbcSheetViewer({ abcString, songTitle }: AbcSheetViewerProps) {
  const [playbackCursor, setPlaybackCursor] = useState<MusicSheetPlaybackCursorEvent | null>(null);
  const instrumentHighlights = useMemo(
    () => buildSynchronizedInstrumentHighlights(abcString, playbackCursor),
    [abcString, playbackCursor]
  );

  return (
    <div className="space-y-4">
      <MusicSheetRenderer
        abcString={abcString}
        title="Music Sheet Playback"
        canvasId="abc-music-canvas"
        controls
        showLoopControls
        onPlaybackCursor={setPlaybackCursor}
      />

      <section
        aria-label="Synchronized instrument highlights"
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Instrument highlights
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Guitar strings/frets and piano keys follow the active note in {songTitle}.
            </p>
          </div>
          <p
            aria-live="polite"
            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {instrumentHighlights.statusText}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <GuitarFretboard
            title="Synchronized guitar"
            subtitle="Fret and string highlighted from the Music Sheet cursor"
            positions={instrumentHighlights.guitarPositions}
            openStrings={instrumentHighlights.guitarOpenStrings}
            startFret={instrumentHighlights.guitarStartFret}
            handOverlayEvents={instrumentHighlights.guitarHandOverlayEvents}
          />
          <PianoKeyboard
            title="Synchronized piano"
            subtitle="Keys highlighted from the Music Sheet cursor"
            startOctave={3}
            octaveCount={3}
            highlights={instrumentHighlights.pianoHighlights}
            handOverlayEvents={instrumentHighlights.pianoHandOverlayEvents}
          />
        </div>
      </section>
    </div>
  );
}
