"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import GuitarFretboard, {
  getGuitarFretY,
  getGuitarStringX,
  type GuitarFretPosition,
} from "@/components/instruments/GuitarFretboard";
import PianoKeyboard, {
  buildPianoKeys,
  type PianoHandMode,
  type PianoHighlightedNote,
} from "@/components/instruments/PianoKeyboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import type { InstrumentNoteMarker } from "@/components/instruments/InstrumentNoteMarkers";
import { buildSynchronizedInstrumentHighlights } from "@/components/playback/instrument-highlighting";
import type { MusicSheetPlaybackCursorEvent } from "@/components/music-sheet/AbcjsPlaybackController";
import type { PianoPedalAutomation } from "@/lib/theory/piano-accompaniment";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

export type VisualInstrumentVariant = "instrument-sync" | "note-markers" | "teacher-mode";

type VariantConfig = {
  label: string;
  description: string;
};

type VisualInstrumentNoteMarker = InstrumentNoteMarker & {
  instrument: "guitar" | "piano";
  cursorSeconds: number;
};

const VALID_VARIANTS = new Set<VisualInstrumentVariant>([
  "instrument-sync",
  "note-markers",
  "teacher-mode",
]);

const VARIANT_CONFIG: Record<VisualInstrumentVariant, VariantConfig> = {
  "instrument-sync": {
    label: "Instrument Sync",
    description: "Music staff cursor drives guitar fret/string and piano key highlights.",
  },
  "note-markers": {
    label: "Note Markers",
    description: "Numbered left/right-hand note markers are synchronized to playback targets.",
  },
  "teacher-mode": {
    label: "Teacher Mode",
    description: "Measure-by-measure coaching with hand filters, pedal state, and visible marker data.",
  },
};

const SAMPLE_MELODY_ABC = `X:1
T:Namostute Visual Instrument Study
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 |`;

const CHORD_SHAPE_POSITIONS: GuitarFretPosition[] = [
  { string: 6, fret: 0, note: "E", tone: "bass" },
  { string: 5, fret: 2, finger: 2, note: "B", tone: "chord" },
  { string: 4, fret: 2, finger: 3, note: "E", tone: "root" },
  { string: 3, fret: 0, note: "G", tone: "melody" },
  { string: 2, fret: 0, note: "B", tone: "melody" },
  { string: 1, fret: 0, note: "E", tone: "melody" },
];

const PEDAL_AUTOMATION: PianoPedalAutomation = {
  controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
  events: [
    { measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 },
    { measureIndex: 1, beat: 1, chord: "Bm", type: "pedal-flush", value: 0, previousChord: "Em" },
    { measureIndex: 1, beat: 1.1, chord: "Bm", type: "pedal-down", value: 127 },
    { measureIndex: 2, beat: 1, chord: "G", type: "pedal-flush", value: 0, previousChord: "Bm" },
    { measureIndex: 2, beat: 1.1, chord: "G", type: "pedal-down", value: 127 },
    { measureIndex: 3, beat: 4, chord: "Em", type: "pedal-up", value: 0 },
  ],
};

const TEACHER_EVENTS = [
  {
    measure: 1,
    chord: "Em",
    staff: "E melody pickup with open E bass",
    guitar: "Blue (2)/(3) markers hold the Em shell; yellow (1) marks the thumb-clock bass.",
    piano: "Blue (5)/(2) markers show E2→B2 foundation; yellow markers place G-B-E guide tones below melody.",
    pedal: "Pedal down on beat 1, then hold through the measure.",
  },
  {
    measure: 2,
    chord: "Bm",
    staff: "B sustained melody with A return",
    guitar: "Blue markers move to a compact Bm grip; yellow marker labels the beat-1 pinch.",
    piano: "Flush old harmony, then show the next yellow right-hand marker after Bm lands.",
    pedal: "Pedal flush at beat 1, down again at beat 1.1.",
  },
  {
    measure: 3,
    chord: "G",
    staff: "G-A-B phrase answers the previous line",
    guitar: "Blue marker anchors the G bass target; yellow marker keeps the quarter-note pulse visible.",
    piano: "Blue markers shift to G2/D3 while yellow markers keep common-tone B where possible.",
    pedal: "Pedal flush on the G chord change, then hold.",
  },
  {
    measure: 4,
    chord: "Em",
    staff: "Final E resolves the phrase",
    guitar: "Return to open Em markers and let melody ring.",
    piano: "Release pedal at the cadence so the phrase closes cleanly.",
    pedal: "Pedal up on beat 4.",
  },
];

function buildMockCursor(abcString: string, token: string, milliseconds: number): MusicSheetPlaybackCursorEvent {
  const startChar = abcString.indexOf(token);
  const safeStart = Math.max(0, startChar);

  return {
    cursorSeconds: milliseconds / 1000,
    startChar: safeStart,
    endChar: safeStart + token.length,
    abcEvent: { milliseconds, startChar: safeStart, endChar: safeStart + token.length },
  };
}

function guitarMarker(
  id: string,
  hand: InstrumentNoteMarker["hand"],
  fingerNumber: InstrumentNoteMarker["fingerNumber"],
  string: number,
  fret: number,
  noteLabel: string,
  cursorSeconds: number,
  measureIndex: number,
  beat: number,
  techniqueLabel?: string
): VisualInstrumentNoteMarker {
  return {
    id,
    instrument: "guitar",
    hand,
    fingerNumber,
    x: getGuitarStringX(string),
    y: fret === 0 ? 28 : getGuitarFretY(fret),
    noteLabel,
    techniqueLabel,
    cursorSeconds,
    measureIndex,
    beat,
  };
}

function buildGuitarNoteMarkerTimeline(): VisualInstrumentNoteMarker[] {
  return [
    guitarMarker("guitar-m1-left-2-em-b", "left", 2, 5, 2, "M1 Em: string 5 fret 2", 0, 0, 1),
    guitarMarker("guitar-m1-left-3-em-e", "left", 3, 4, 2, "M1 Em: string 4 fret 2", 0, 0, 1),
    guitarMarker("guitar-m1-right-1-thumb-clock", "right", 1, 6, 0, "open E bass", 0, 0, 1, "thumb-clock"),
    guitarMarker("guitar-m1-right-2-syncopation", "right", 2, 3, 0, "open G melody", 0.5, 0, 2, "syncopation"),
    guitarMarker("guitar-m2-left-1-bm-barre", "left", 1, 5, 2, "M2 Bm: string 5 fret 2", 2, 1, 1),
    guitarMarker("guitar-m2-left-3-bm-d", "left", 3, 2, 3, "M2 Bm: string 2 fret 3", 2, 1, 1),
    guitarMarker("guitar-m2-right-5-slap", "right", 5, 4, 0, "beat 2 string-slap", 2.5, 1, 2, "string-slap"),
    guitarMarker("guitar-m3-left-2-g-bass", "left", 2, 6, 3, "M3 G: string 6 fret 3", 4, 2, 1),
    guitarMarker("guitar-m4-left-2-em-return", "left", 2, 5, 2, "M4 Em return", 6, 3, 1),
  ];
}

function pianoMarker(
  note: string,
  options: Omit<VisualInstrumentNoteMarker, "x" | "y" | "instrument" | "noteLabel">
): VisualInstrumentNoteMarker {
  const keys = buildPianoKeys(2, 4);
  const key = keys.find((candidate) => candidate.note === note);

  return {
    ...options,
    instrument: "piano",
    x: key ? key.x + key.width / 2 : 40,
    y: key ? Math.min(key.height - 18, options.hand === "left" ? 100 : 76) : 80,
    noteLabel: note,
  };
}

function buildPianoNoteMarkerTimeline(): VisualInstrumentNoteMarker[] {
  return [
    pianoMarker("E2", { id: "piano-m1-left-5-e2", hand: "left", fingerNumber: 5, cursorSeconds: 0, measureIndex: 0, beat: 1 }),
    pianoMarker("B2", { id: "piano-m1-left-2-b2", hand: "left", fingerNumber: 2, cursorSeconds: 1, measureIndex: 0, beat: 3 }),
    pianoMarker("G3", { id: "piano-m1-right-1-g3", hand: "right", fingerNumber: 1, cursorSeconds: 0, measureIndex: 0, beat: 1 }),
    pianoMarker("B3", { id: "piano-m1-right-2-b3", hand: "right", fingerNumber: 2, cursorSeconds: 0, measureIndex: 0, beat: 1 }),
    pianoMarker("E4", { id: "piano-m1-right-5-e4", hand: "right", fingerNumber: 5, cursorSeconds: 0, measureIndex: 0, beat: 1 }),
    pianoMarker("F#3", { id: "piano-m2-right-1-fsharp3", hand: "right", fingerNumber: 1, cursorSeconds: 2, measureIndex: 1, beat: 1 }),
    pianoMarker("B3", { id: "piano-m2-right-3-b3", hand: "right", fingerNumber: 3, cursorSeconds: 2, measureIndex: 1, beat: 1 }),
    pianoMarker("G2", { id: "piano-m3-left-5-g2", hand: "left", fingerNumber: 5, cursorSeconds: 4, measureIndex: 2, beat: 1 }),
  ];
}

function getPedalCursor(cursorSeconds: number) {
  const secondsPerMeasure = 2;
  const secondsPerBeat = 0.5;
  const measureIndex = Math.min(3, Math.max(0, Math.floor(cursorSeconds / secondsPerMeasure)));
  const beatInMeasure = cursorSeconds - measureIndex * secondsPerMeasure;
  const beat = Math.min(4, Math.max(1, 1 + beatInMeasure / secondsPerBeat));

  return { measureIndex, beat: Number(beat.toFixed(1)) };
}

function buildActiveMarkers(
  markers: VisualInstrumentNoteMarker[],
  cursorSeconds: number,
  lookbackSeconds = 1.25
): VisualInstrumentNoteMarker[] {
  return markers.filter((marker) => {
    const elapsed = cursorSeconds - marker.cursorSeconds;
    return elapsed >= -0.001 && elapsed <= lookbackSeconds;
  });
}

function formatCursor(cursor: MusicSheetPlaybackCursorEvent | null) {
  if (!cursor) return "No active cursor";
  return `${cursor.cursorSeconds.toFixed(1)}s · chars ${cursor.startChar ?? "?"}-${cursor.endChar ?? "?"}`;
}

function EventCard({ marker }: { marker: VisualInstrumentNoteMarker }) {
  return (
    <li className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-zinc-500">
            M{(marker.measureIndex ?? 0) + 1} beat {marker.beat ?? "?"} · {marker.cursorSeconds.toFixed(1)}s
          </p>
          <p className="mt-1 text-sm font-bold text-zinc-100">
            {marker.instrument} {marker.hand} hand · marker ({marker.fingerNumber})
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${marker.hand === "left" ? "bg-sky-400/10 text-sky-300" : "bg-amber-400/10 text-amber-300"}`}>
          {marker.noteLabel}
        </span>
      </div>
    </li>
  );
}

function StatePanel({
  cursor,
  statusText,
  guitarPositions,
  pianoHighlights,
  handMode,
}: {
  cursor: MusicSheetPlaybackCursorEvent | null;
  statusText: string;
  guitarPositions: GuitarFretPosition[];
  pianoHighlights: PianoHighlightedNote[];
  handMode: PianoHandMode;
}) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
      <h2 className="text-xl font-bold text-zinc-100">Visible Playback State</h2>
      <p className="mt-1 text-sm text-zinc-400">Prototype state is intentionally surfaced so reviewers can see exactly what the cursor changes.</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-zinc-950/80 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cursor</dt>
          <dd className="mt-2 font-mono text-amber-300">{formatCursor(cursor)}</dd>
        </div>
        <div className="rounded-2xl bg-zinc-950/80 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</dt>
          <dd className="mt-2 text-zinc-200">{statusText}</dd>
        </div>
        <div className="rounded-2xl bg-zinc-950/80 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Guitar targets</dt>
          <dd className="mt-2 font-mono text-zinc-300">
            {guitarPositions.length > 0
              ? guitarPositions.map((position) => `S${position.string}/F${position.fret}/${position.note}`).join(" · ")
              : "none"}
          </dd>
        </div>
        <div className="rounded-2xl bg-zinc-950/80 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Piano / markers</dt>
          <dd className="mt-2 font-mono text-zinc-300">
            {pianoHighlights.map((highlight) => highlight.note).join(" · ") || "none"} · mode {handMode}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function normalizeVariant(value: string | null): VisualInstrumentVariant {
  if (value && VALID_VARIANTS.has(value as VisualInstrumentVariant)) {
    return value as VisualInstrumentVariant;
  }

  return "instrument-sync";
}

function VariantSwitcher({ activeVariant }: { activeVariant: VisualInstrumentVariant }) {
  return (
    <nav className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-[min(42rem,calc(100%-2rem))] flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur" aria-label="Visual instrument mockup variants">
      {Object.entries(VARIANT_CONFIG).map(([variant, config]) => {
        const selected = variant === activeVariant;

        return (
          <Link
            key={variant}
            href={`/mockups/visual-instruments?variant=${variant}`}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              selected
                ? "bg-amber-400 text-zinc-950"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {config.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function VisualInstrumentsMockupClient() {
  const searchParams = useSearchParams();
  const activeVariant = normalizeVariant(searchParams.get("variant"));
  const [playbackCursor, setPlaybackCursor] = useState<MusicSheetPlaybackCursorEvent | null>(() =>
    buildMockCursor(SAMPLE_MELODY_ABC, "E2", 0)
  );
  const [handMode, setHandMode] = useState<PianoHandMode>("combined");
  const handlePlaybackCursor = useCallback((event: MusicSheetPlaybackCursorEvent | null) => {
    setPlaybackCursor(event ?? buildMockCursor(SAMPLE_MELODY_ABC, "E2", 0));
  }, []);

  const synchronizedHighlights = useMemo(
    () => buildSynchronizedInstrumentHighlights(SAMPLE_MELODY_ABC, playbackCursor),
    [playbackCursor]
  );
  const guitarMarkers = useMemo(() => buildGuitarNoteMarkerTimeline(), []);
  const pianoMarkers = useMemo(() => buildPianoNoteMarkerTimeline(), []);
  const cursorSeconds = playbackCursor?.cursorSeconds ?? 0;
  const activeGuitarMarkers = useMemo(
    () => buildActiveMarkers(guitarMarkers, cursorSeconds),
    [cursorSeconds, guitarMarkers]
  );
  const activePianoMarkers = useMemo(
    () => buildActiveMarkers(pianoMarkers, cursorSeconds),
    [cursorSeconds, pianoMarkers]
  );
  const pedalCursor = getPedalCursor(cursorSeconds);
  const variantConfig = VARIANT_CONFIG[activeVariant];
  const activePianoMarkerHighlights = activePianoMarkers.map<PianoHighlightedNote>((marker) => ({
    note: marker.noteLabel ?? "C4",
    hand: marker.hand,
    finger: marker.fingerNumber,
    label: `${marker.hand === "left" ? "LH" : "RH"}${marker.fingerNumber}`,
  }));
  const mergedPianoHighlights = [...activePianoMarkerHighlights, ...synchronizedHighlights.pianoHighlights];

  return (
    <main className="min-h-screen bg-zinc-950 px-4 pb-28 pt-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="space-y-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Throwaway UI Prototype · Mockup & POC Gate
            </span>
            <span className="font-mono text-xs text-zinc-500">prd-bsc-s17 · prd-bsc-s54 · stories 15-16c</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-end">
            <div className="space-y-4">
              <h1 className="bg-gradient-to-r from-amber-300 via-sky-300 to-emerald-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                Visual Instrument & Note Markers POC
              </h1>
              <p className="max-w-4xl text-base leading-7 text-zinc-400 sm:text-lg">
                This standalone mockup demonstrates synchronized guitar fretboard targets, piano keyboard highlights, numbered blue/yellow note markers, and sustain-pedal state driven by the same Music Sheet playback cursor.
              </p>
            </div>

            <section className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Current variant</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{variantConfig.label}</p>
              <p className="mt-2 text-sm text-zinc-300">{variantConfig.description}</p>
            </section>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/mockups" className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800">
              ← Back to mockup gate
            </Link>
            <span className="inline-flex items-center rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-400">
              Click a rendered staff note or press Play to update guitar/piano targets.
            </span>
          </div>
        </header>

        {activeVariant === "instrument-sync" ? (
          <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <AbcjsPlaybackController
                abcString={SAMPLE_MELODY_ABC}
                title="Music Staff Playback Cursor"
                description="The cursor callback powers the visible guitar and piano state below. Clicking notes also moves the cursor."
                onPlaybackCursor={handlePlaybackCursor}
                minWidthClassName="min-w-[520px]"
              />
              <StatePanel
                cursor={playbackCursor}
                statusText={synchronizedHighlights.statusText}
                guitarPositions={synchronizedHighlights.guitarPositions}
                pianoHighlights={synchronizedHighlights.pianoHighlights}
                handMode={handMode}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <GuitarFretboard
                title="Synchronized Guitar Fretboard"
                subtitle="Current staff note maps to string/fret target plus numbered note markers."
                positions={synchronizedHighlights.guitarPositions.length > 0 ? synchronizedHighlights.guitarPositions : CHORD_SHAPE_POSITIONS}
                openStrings={synchronizedHighlights.guitarOpenStrings.length > 0 ? synchronizedHighlights.guitarOpenStrings : [1, 2, 3, 6]}
                startFret={synchronizedHighlights.guitarStartFret}
                noteMarkers={synchronizedHighlights.guitarNoteMarkers}
                className="border-zinc-800 bg-zinc-900 shadow-xl"
              />
              <PianoKeyboard
                title="Synchronized Piano Keyboard"
                subtitle="The same staff cursor highlights piano keys and numbered marker targets."
                startOctave={3}
                octaveCount={3}
                highlights={synchronizedHighlights.pianoHighlights}
                noteMarkers={synchronizedHighlights.pianoNoteMarkers}
                handMode={handMode}
                onHandModeChange={setHandMode}
                className="border-zinc-800 bg-zinc-900 shadow-xl"
              />
            </section>
          </div>
        ) : null}

        {activeVariant === "note-markers" ? (
          <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
              <AbcjsPlaybackController
                abcString={SAMPLE_MELODY_ABC}
                title="Playback Driver for Note Markers"
                description="This staff now drives the active marker frame. Press Play or click notes to update guitar and piano markers."
                onPlaybackCursor={handlePlaybackCursor}
                minWidthClassName="min-w-[520px]"
              />
              <StatePanel
                cursor={playbackCursor}
                statusText={`Active marker frame at ${cursorSeconds.toFixed(1)}s · guitar ${activeGuitarMarkers.length} markers · piano ${activePianoMarkers.length} markers`}
                guitarPositions={synchronizedHighlights.guitarPositions}
                pianoHighlights={mergedPianoHighlights}
                handMode={handMode}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <GuitarFretboard
                title="Playback-Driven Guitar Note Markers"
                subtitle="Blue markers show left-hand fretting targets; yellow markers show right-hand picking or percussion events."
                positions={synchronizedHighlights.guitarPositions.length > 0 ? synchronizedHighlights.guitarPositions : CHORD_SHAPE_POSITIONS}
                openStrings={synchronizedHighlights.guitarOpenStrings.length > 0 ? synchronizedHighlights.guitarOpenStrings : [1, 2, 3, 6]}
                startFret={synchronizedHighlights.guitarStartFret}
                noteMarkers={activeGuitarMarkers}
                className="border-zinc-800 bg-zinc-900 shadow-xl"
              />
              <PianoKeyboard
                title="Playback-Driven Piano Note Markers"
                subtitle="Left and right hand markers update from the same playback cursor, with hand isolation still available."
                startOctave={2}
                octaveCount={4}
                highlights={mergedPianoHighlights}
                noteMarkers={activePianoMarkers}
                handMode={handMode}
                onHandModeChange={setHandMode}
                className="border-zinc-800 bg-zinc-900 shadow-xl"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_1fr_22rem]">
              <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
                <h2 className="text-xl font-bold text-zinc-100">Current Guitar Markers</h2>
                <p className="mt-1 text-sm text-zinc-400">Filtered from the full timeline using the staff cursor, so inactive future markers are hidden.</p>
                <ul className="mt-5 space-y-3">
                  {activeGuitarMarkers.map((marker) => <EventCard key={marker.id} marker={marker} />)}
                </ul>
              </article>

              <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
                <h2 className="text-xl font-bold text-zinc-100">Current Piano Markers</h2>
                <p className="mt-1 text-sm text-zinc-400">These are the active LH/RH numbered markers currently following the sheet cursor.</p>
                <ul className="mt-5 space-y-3">
                  {activePianoMarkers.map((marker) => <EventCard key={marker.id} marker={marker} />)}
                </ul>
              </article>

              <PianoPedalIndicator
                title="Pedal State"
                pedalAutomation={PEDAL_AUTOMATION}
                currentMeasureIndex={pedalCursor.measureIndex}
                currentBeat={pedalCursor.beat}
                className="border-zinc-800 bg-zinc-900/70 shadow-xl"
              />
            </section>
          </div>
        ) : null}

        {activeVariant === "teacher-mode" ? (
          <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <AbcjsPlaybackController
                  abcString={SAMPLE_MELODY_ABC}
                  title="Practice Staff"
                  description="Teacher mode keeps the notation visible while explaining what each marker means."
                  onPlaybackCursor={handlePlaybackCursor}
                  minWidthClassName="min-w-[520px]"
                />
                <StatePanel
                  cursor={playbackCursor}
                  statusText={synchronizedHighlights.statusText}
                  guitarPositions={synchronizedHighlights.guitarPositions}
                  pianoHighlights={synchronizedHighlights.pianoHighlights}
                  handMode={handMode}
                />
              </div>

              <div className="space-y-6">
                <PianoKeyboard
                  title="Teacher Marker Isolation"
                  subtitle="Use the buttons to practice left hand only, right hand only, or both together."
                  startOctave={2}
                  octaveCount={4}
                  highlights={mergedPianoHighlights}
                  noteMarkers={[...activePianoMarkers, ...synchronizedHighlights.pianoNoteMarkers]}
                  handMode={handMode}
                  onHandModeChange={setHandMode}
                  className="border-zinc-800 bg-zinc-900 shadow-xl"
                />
                <PianoPedalIndicator
                  title="Measure-Synced Pedal"
                  pedalAutomation={PEDAL_AUTOMATION}
                  currentMeasureIndex={pedalCursor.measureIndex}
                  currentBeat={pedalCursor.beat}
                  className="border-zinc-800 bg-zinc-900/70 shadow-xl"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
              <h2 className="text-xl font-bold text-zinc-100">Measure-by-Measure Coaching</h2>
              <p className="mt-1 text-sm text-zinc-400">These cards show the learner-facing explanation that can later be generated from arrangement metadata.</p>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {TEACHER_EVENTS.map((event) => (
                  <article key={event.measure} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs text-zinc-500">Measure {event.measure}</p>
                        <h3 className="mt-1 text-lg font-black text-amber-300">{event.chord}</h3>
                      </div>
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">review-ready</span>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div><dt className="font-semibold text-zinc-500">Staff</dt><dd className="text-zinc-300">{event.staff}</dd></div>
                      <div><dt className="font-semibold text-zinc-500">Guitar</dt><dd className="text-zinc-300">{event.guitar}</dd></div>
                      <div><dt className="font-semibold text-zinc-500">Piano</dt><dd className="text-zinc-300">{event.piano}</dd></div>
                      <div><dt className="font-semibold text-zinc-500">Pedal</dt><dd className="text-zinc-300">{event.pedal}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 shadow-xl">
          <h2 className="text-xl font-bold text-emerald-200">Review-ready handoff checklist</h2>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-200 md:grid-cols-2">
            <li>✓ Music Sheet cursor drives virtual instrument highlighting.</li>
            <li>✓ Guitar fret/string and piano key targets are visible in the state panel.</li>
            <li>✓ Numbered markers render as blue left-hand and yellow right-hand instructions.</li>
            <li>✓ Guitar marker labels include measure-synced fingering and technique events.</li>
            <li>✓ Piano can isolate left hand, right hand, or combined hands-together.</li>
            <li>✓ Pedal graphic reads MIDI CC64-style down, hold, flush, and up events.</li>
          </ul>
        </section>
      </div>

      <VariantSwitcher activeVariant={activeVariant} />
    </main>
  );
}
