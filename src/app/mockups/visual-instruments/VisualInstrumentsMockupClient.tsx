"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import PianoKeyboard, { type PianoHandMode, type PianoHighlightedNote } from "@/components/instruments/PianoKeyboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { buildSynchronizedInstrumentHighlights } from "@/components/playback/instrument-highlighting";
import type { MusicSheetPlaybackCursorEvent } from "@/components/music-sheet/AbcjsPlaybackController";
import {
  CHORD_SHAPE_POSITIONS,
  EventCard,
  PEDAL_AUTOMATION,
  SAMPLE_MELODY_ABC,
  TEACHER_EVENTS,
  VariantSwitcher,
  buildActiveMarkers,
  buildGuitarNoteMarkerTimeline,
  buildMockCursor,
  buildPianoNoteMarkerTimeline,
  getPedalCursor,
  normalizeVariant,
  StatePanel,
  VARIANT_CONFIG,
  type VisualInstrumentVariant,
} from "./mockup-parts";
export type { VisualInstrumentVariant } from "./mockup-parts";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

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
