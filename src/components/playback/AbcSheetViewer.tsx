"use client";

import { useMemo, useState } from "react";
import { GuitarFretboard, PianoKeyboard, PianoPedalIndicator } from "@/components/instruments";
import AbcjsPlaybackController, {
  type MusicSheetPlaybackCursorEvent,
} from "@/components/music-sheet/AbcjsPlaybackController";
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

  const renderOptions = useMemo(() => {
    let guitarIndex = -1;
    const scoreMatch = abcString.match(/^%%score\s+(.+)$/m);
    
    if (scoreMatch) {
      // Parse the score directive: e.g. "(Melody Guitar) (Piano)" -> ["(Melody Guitar)", "(Piano)"]
      const scoreLine = scoreMatch[1];
      const staffGroups = scoreLine.match(/(\([^)]+\)|\[[^\]]+\]|\{[^}]+\}|\S+)/g);
      if (staffGroups) {
        guitarIndex = staffGroups.findIndex(group => group.includes("Guitar"));
      }
    }
    
    if (guitarIndex === -1) {
      // Fallback: use order of V: declarations
      const matches = [...abcString.matchAll(/^V:([^\s=]+)/gm)];
      const voiceNames = [...new Set(matches.map(m => m[1]))];
      guitarIndex = voiceNames.indexOf("Guitar");
    }
    
    if (guitarIndex >= 0) {
      return {
        tablature: [
          ...Array.from({ length: guitarIndex }, () => ({ instrument: "" as const })),
          {
            instrument: "guitar" as const,
            label: "GUITAR TAB (%T)",
            tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
            capo: 0,
            hideTabSymbol: false,
          },
        ]
      };
    }
    return {};
  }, [abcString]);

  return (
    <div className="space-y-4">
      <AbcjsPlaybackController
        abcString={abcString}
        title="Music Sheet Playback"
        description={`Interactive notation playback for ${songTitle}.`}
        canvasId="abc-music-canvas"
        controls
        showLoopControls
        onPlaybackCursor={setPlaybackCursor}
        renderOptions={renderOptions}
      />

      <section
        aria-label="Synchronized instrument highlights"
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Visual Instrument Highlight Panel
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Layout toggles: Guitar Fretboard Mode / Piano Keyboard Mode. Highlights follow the active note in {songTitle}.
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
            noteMarkers={instrumentHighlights.guitarNoteMarkers}
          />
          <PianoKeyboard
            title="Synchronized piano"
            subtitle="Keys highlighted from the Music Sheet cursor"
            startOctave={3}
            octaveCount={3}
            highlights={instrumentHighlights.pianoHighlights}
            noteMarkers={instrumentHighlights.pianoNoteMarkers}
          />
        </div>

        <div className="mt-4">
          <PianoPedalIndicator
            title="Sustain Pedal Indicator"
            pedalAutomation={{
              controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
              events: [
                { measureIndex: 0, beat: 1, chord: "I", type: "pedal-up", value: 0 },
                { measureIndex: 0, beat: 2, chord: "I", type: "pedal-down", value: 127 },
              ],
            }}
            currentMeasureIndex={0}
            currentBeat={playbackCursor ? 2 : 1}
          />
        </div>
      </section>
    </div>
  );
}
