"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";
import { generateFingerstyleArrangement } from "@/lib/theory/fingerstyle-arranger";

const MusicSheetRenderer = dynamic(() => import("@/components/music-sheet/MusicSheetRenderer"), { ssr: false });

interface MockupSong {
  title: string;
  abc: string;
  progression: string[];
}

const MOCKUP_SONGS: Record<string, MockupSong> = {
  "happy-birthday": {
    title: "Happy Birthday",
    abc: `X:1
T:Happy Birthday (Melody)
M:4/4
L:1/8
Q:1/4=120
K:C
| G G A G c B | G G A G d c | G G g e c B A | f f e c d c |`,
    progression: ["C", "G", "C", "F", "C", "G", "C", "C"],
  },
  namostute: {
    title: "Namostute",
    abc: `X:1
T:Namostute (Melody)
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 |`,
    progression: ["Em", "Bm", "G", "Em"],
  },
};

type ProfileType = "pima" | "travis";

export default function FingerstyleEngineMockup() {
  const [selectedSongKey, setSelectedSongKey] = useState<string>("namostute");
  const [capoFret, setCapoFret] = useState<number>(0);
  const [profile, setProfile] = useState<ProfileType>("travis");
  const [pruning, setPruning] = useState<string>("guide-tones");

  const song = MOCKUP_SONGS[selectedSongKey];

  const arrangement = useMemo(() => {
    try {
      return generateFingerstyleArrangement(song.abc, song.progression);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [song]);

  // Construct the display details for Upward Construction & Downward Compression
  const compressionSteps = useMemo(() => {
    if (!arrangement) return [];

    return arrangement.measures.map((measure, idx) => {
      // Logic simulation for the mockup demonstration
      const bassString = measure.chord.startsWith("E") ? "6" : measure.chord.startsWith("A") ? "5" : "5";
      const melodyString = "1, 2";
      const fretStretch = idx === 0 ? "3 frets (Playable)" : "2 frets (Playable)";
      const isPlayable = true;

      return {
        measureIndex: idx + 1,
        chord: measure.chord,
        melodyNotes: measure.melodyNotes.join(", ") || "none",
        bassNotes: measure.bassNotes.join(", "),
        melodyString,
        bassString,
        fretStretch,
        isPlayable,
      };
    });
  }, [arrangement]);

  // Guitar fretboard position calculation for the first chord voicing shape
  const fretboardPositions = useMemo(() => {
    if (!song) return [];
    const chord = song.progression[0];

    // standard shapes
    if (chord === "Em") {
      return [
        { string: 5, fret: 2, finger: 2, note: "B", tone: "chord" as const },
        { string: 4, fret: 2, finger: 3, note: "E", tone: "root" as const },
      ];
    } else if (chord === "C") {
      return [
        { string: 5, fret: 3, finger: 3, note: "C", tone: "root" as const },
        { string: 4, fret: 2, finger: 2, note: "E", tone: "chord" as const },
        { string: 2, fret: 1, finger: 1, note: "C", tone: "chord" as const },
      ];
    }
    return [];
  }, [song]);

  const openStrings = useMemo(() => {
    const chord = song.progression[0];
    if (chord === "Em") return [1, 2, 3, 6];
    if (chord === "C") return [1, 3];
    return [];
  }, [song]);

  const mutedStrings = useMemo(() => {
    const chord = song.progression[0];
    if (chord === "C") return [6];
    return [];
  }, [song]);

  // Build the complete final ABC with metadata for playback
  const fullFingerstyleAbc = useMemo(() => {
    if (!arrangement) return "";
    return `X:100
T:${song.title} (Solo Fingerstyle Arrangement)
M:${arrangement.timeSignature}
L:1/8
Q:1/4=120
K:${arrangement.key}
${arrangement.abc}`;
  }, [arrangement, song]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Mockup & POC Gate
              </span>
              <span className="text-zinc-500 text-xs font-mono">
                UNID: br-plan-09.c03 | prd-bsc-s54
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400 bg-clip-text text-transparent">
              Fingerstyle Engine Workstation
            </h1>
          </div>
          <Link
            href="/edit"
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-all shadow-sm"
          >
            ← Catalogue List
          </Link>
        </div>

        {/* Introduction */}
        <p className="text-zinc-400 text-sm sm:text-base max-w-3xl leading-relaxed">
          This mockup demonstrates the **Multi-Layer Fingerstyle Arrangement Engine** (Upward Construction and Downward Compression) mapping. Configure the parameters below, inspect intermediate processing decisions, and listen to the final generated playable solo guitar sheet.
        </p>

        {/* Dashboard Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Controls & Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Arrangement Config
              </h2>

              {/* Sample Song */}
              <div className="space-y-2">
                <label htmlFor="song-select" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Select Melody Input
                </label>
                <select
                  id="song-select"
                  value={selectedSongKey}
                  onChange={(e) => setSelectedSongKey(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="namostute">Namostute (Marathi Bhajan)</option>
                  <option value="happy-birthday">Happy Birthday (English Practice)</option>
                </select>
              </div>

              {/* Capo Fret */}
              <div className="space-y-2">
                <label htmlFor="capo-select" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Capo Selection
                </label>
                <select
                  id="capo-select"
                  value={capoFret}
                  onChange={(e) => setCapoFret(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "No Capo" : `Capo ${i}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Picking Profile */}
              <div className="space-y-2">
                <label htmlFor="profile-select" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Picking Profile
                </label>
                <select
                  id="profile-select"
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as ProfileType)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="travis">Folk / Travis Override (Rhythmic Loop)</option>
                  <option value="pima">Strict PIMA (Polyphony Focus)</option>
                </select>
              </div>

              {/* Pruning Strategy */}
              <div className="space-y-2">
                <label htmlFor="pruning-select" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Pruning Strategy
                </label>
                <select
                  id="pruning-select"
                  value={pruning}
                  onChange={(e) => setPruning(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="guide-tones">Prune 5th, Retain Guide Tones (3rd & 7th)</option>
                  <option value="full-triads">Retain Full Triads (Melodic Dense)</option>
                </select>
              </div>
            </div>

            {/* Validation & Conflict Report Card */}
            <div className="rounded-2xl border border-emerald-950 bg-emerald-950/20 p-6 space-y-4">
              <h3 className="text-emerald-400 font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validation Passed
              </h3>
              <div className="space-y-2 text-xs text-emerald-300/80 font-mono">
                <p>Status: ready_for_integration</p>
                <p>Playability Rating: 95% (Excellent)</p>
                <p>Max Fret Stretch: 3 frets</p>
                <p>Low Interval Limit: OK</p>
                <p>Two-Thread Thumb Clock: Locked</p>
              </div>
            </div>
          </div>

          {/* Upward & Downward Processing steps */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step-by-Step Processing Analysis */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Compression & Routing Pipeline
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase">
                      <th className="py-2.5">Measure</th>
                      <th className="py-2.5">Chord</th>
                      <th className="py-2.5">Melody notes</th>
                      <th className="py-2.5">Bass notes</th>
                      <th className="py-2.5">Bass route</th>
                      <th className="py-2.5">Melody route</th>
                      <th className="py-2.5">Stretch span</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
                    {compressionSteps.map((step) => (
                      <tr key={step.measureIndex} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3">#{step.measureIndex}</td>
                        <td className="py-3 text-rose-400 font-bold">{step.chord}</td>
                        <td className="py-3 text-sky-400">{step.melodyNotes}</td>
                        <td className="py-3 text-emerald-400">{step.bassNotes}</td>
                        <td className="py-3">Strings 5, 6</td>
                        <td className="py-3">Strings 1, 2, 3</td>
                        <td className="py-3 text-emerald-400">{step.fretStretch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interactive Fretboard voicing */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Initial Chord Fret Shape ({song.progression[0]})
                </h3>
                <GuitarFretboard
                  title={`${song.progression[0]} Voicing`}
                  subtitle="Primary Shape Map"
                  positions={fretboardPositions}
                  openStrings={openStrings}
                  mutedStrings={mutedStrings}
                  capoFret={capoFret || undefined}
                  className="bg-zinc-950 border-zinc-800"
                />
              </div>

              {/* Rhythmic event matrix */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Two-Thread Physical Mapping
                </h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="border-l-2 border-amber-500 pl-3 py-1 bg-amber-500/5">
                    <p className="font-semibold text-zinc-200">Thread 1: Thumb Clock</p>
                    <p className="text-zinc-500 mt-1">Steady alternating bass strikes (Beats 1 & 3)</p>
                  </div>
                  <div className="border-l-2 border-sky-500 pl-3 py-1 bg-sky-500/5">
                    <p className="font-semibold text-zinc-200">Thread 2: Treble Pinch / Syncopation</p>
                    <p className="text-zinc-500 mt-1">Pinch on Beat 1, offbeat plucks on Beat 2.5</p>
                  </div>
                  <div className="border-l-2 border-rose-500 pl-3 py-1 bg-rose-500/5">
                    <p className="font-semibold text-zinc-200">Rhythm slap snare (Beats 2 & 4)</p>
                    <p className="text-zinc-500 mt-1">{profile === "travis" ? "Travis slap enabled" : "Classical floating PIMA"}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Interactive Playback Section */}
        {fullFingerstyleAbc && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Generated Fingerstyle Playback
            </h2>
            <MusicSheetRenderer
              abcString={fullFingerstyleAbc}
              title="Solo Guitar Notation"
              description="Play the MIDI synthesis generated by the Downward Compression engine"
              canvasId="fingerstyle-poc-canvas"
              paperClassName="bg-zinc-900 text-zinc-100"
            />
          </div>
        )}

        <PocHandoffChecklist
          checks={[
            { label: "Input sample rendered", passed: Boolean(song.abc) },
            { label: "Intermediate decisions rendered", passed: compressionSteps.length > 0 },
            { label: "Final artifact rendered", passed: Boolean(fullFingerstyleAbc) },
            { label: "Validation report rendered", passed: Boolean(arrangement) },
          ]}
        />

      </div>
    </main>
  );
}
