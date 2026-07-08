"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import VirtualGuitarFretboard from "@/components/instruments/VirtualGuitarFretboard";
import PianoKeyboard, { type PianoHandMode, type PianoHighlightedNote } from "@/components/instruments/PianoKeyboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { buildSynchronizedInstrumentHighlights } from "@/components/playback/instrument-highlighting";
import { Chord, Scale, Note } from "@tonaljs/tonal";
import { getGuitarVoicings } from "@/lib/theory/guitar-voicings";
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
  
  // Interactive Chord state
  const [activeHoverChord, setActiveHoverChord] = useState<string | null>(null);
  
  const activeChordNotes = useMemo(() => {
    if (!activeHoverChord) return [];
    return Chord.get(activeHoverChord).notes;
  }, [activeHoverChord]);

  const activeVoicings = useMemo(() => {
    if (!activeHoverChord) return undefined;
    return getGuitarVoicings(activeHoverChord);
  }, [activeHoverChord]);

  const ROOT_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MODIFIERS = ["dim", "5", "7", "maj7", "9", "11", "aug", "sus4"];

  const [selectedKey, setSelectedKey] = useState<string>("C");

  const diatonicScale = useMemo(() => {
    const scaleNotes = Scale.get(`${selectedKey} major`).notes;
    // Diatonic qualities for major scale: I, ii, iii, IV, V, vi, vii°
    const qualities = ["M", "m", "m", "M", "M", "m", "dim"] as const;
    
    return scaleNotes.map((note, i) => ({
      root: note,
      quality: qualities[i % 7]
    }));
  }, [selectedKey]);

  const getDiatonicChordSymbol = (root: string, quality: "M" | "m" | "dim", mod: string) => {
    if (mod === "") {
      if (quality === "M") return root;
      if (quality === "m") return `${root}m`;
      if (quality === "dim") return `${root}dim`;
    }
    
    // Power chords and sus4 are neutral
    if (mod === "5" || mod === "sus4") return `${root}${mod}`;
    
    if (quality === "dim") {
      if (mod === "7") return `${root}dim7`;
      if (mod === "maj7") return `${root}m7b5`; // Half-diminished
      return `${root}dim`; // fallback
    }
    
    if (quality === "M") {
      if (mod === "dim") return `${root}dim`;
      if (mod === "aug") return `${root}aug`;
      if (mod === "maj7") return `${root}maj7`;
      return `${root}${mod}`; 
    }
    
    if (quality === "m") {
      if (mod === "dim") return `${root}dim7`;
      if (mod === "aug" || mod === "maj7") return `${root}mM7`; 
      return `${root}m${mod}`; 
    }
    
    return root;
  };

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

        {activeVariant === "virtual-guitar-master" ? (
          <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[30rem_1fr] lg:items-start">
              <aside className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl h-[700px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100 mb-1">Chord Builder Table</h2>
                    <p className="text-xs text-zinc-400">Hover over any base chord or modifier to visualize its notes on the fretboard.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-zinc-400 whitespace-nowrap">Key:</label>
                    <select 
                      value={selectedKey}
                      onChange={(e) => setSelectedKey(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500 outline-none w-28"
                    >
                      {ROOT_NOTES.map(key => (
                        <option key={key} value={key}>{key} Major</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur z-10">
                      <tr>
                        <th className="py-2 text-zinc-500 font-semibold text-sm border-b border-zinc-800 w-24">Note</th>
                        <th className="py-2 text-zinc-500 font-semibold text-sm border-b border-zinc-800">Chord List (Main | Modifiers)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diatonicScale.map(({ root, quality }, idx) => {
                        return (
                          <tr key={`${root}-${idx}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                            <td className="py-3 font-bold text-zinc-300 align-top">
                              {root} <span className="text-xs text-zinc-500 ml-1 font-normal">({quality})</span>
                            </td>
                            
                            <td className="py-2 align-middle">
                              <div className="flex flex-nowrap items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                                {["", ...MODIFIERS].map((mod, i) => {
                                  const chord = getDiatonicChordSymbol(root, quality, mod);
                                  const isBase = mod === "";
                                  const isHovered = activeHoverChord === chord;
                                  
                                  return (
                                    <div key={mod} className="flex items-center">
                                      {i === 1 && <div className="w-px h-4 bg-zinc-700 mx-2" />}
                                      <button
                                        className={`text-center px-2 py-1 rounded transition whitespace-nowrap flex-shrink-0 ${
                                          isBase ? "font-bold text-sm min-w-[3rem]" : "text-[10px]"
                                        } ${
                                          isHovered 
                                            ? "bg-amber-500 text-zinc-950 shadow-sm" 
                                            : isBase 
                                              ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700" 
                                              : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700 hover:text-white"
                                        }`}
                                        onMouseEnter={() => setActiveHoverChord(chord)}
                                        onMouseLeave={() => setActiveHoverChord(null)}
                                      >
                                        {isBase ? chord : `+${mod}`}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </aside>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-zinc-100">
                    {activeHoverChord ? `${activeHoverChord} Notes Highlighted` : "Virtual Guitar Fretboard Reference"}
                  </h2>
                  {activeHoverChord && (
                    <span className="text-sm font-mono bg-zinc-800 px-3 py-1 rounded-lg text-amber-400">
                      Hovering: {activeChordNotes.join(", ")}
                    </span>
                  )}
                </div>
                <VirtualGuitarFretboard 
                  fretCount={16} 
                  activeNotes={activeChordNotes.length > 0 ? activeChordNotes : undefined}
                  activeVoicings={activeVoicings && activeVoicings.length > 0 ? activeVoicings : undefined}
                  onNoteClick={(note, string, fret) => console.log(`Selected: ${note} on string ${string}, fret ${fret}`)}
                />
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
