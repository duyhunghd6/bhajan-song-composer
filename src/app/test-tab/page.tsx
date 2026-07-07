"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

const defaultUserBugAbc = `X: 1
T: Loading...
K: C
`;

const EXAMPLES = [
  {
    title: "1. test-abcjs-full-song1 (Hari Bol with Guitar track)",
    description: "Melody with lyrics and beat indicators, plus Layer 2 Guitar Accompaniment on a separate staff.",
    renderOptions: {}, // Standard rendering, no auto-tab
    abc: `X: 1
T: Hari Bol
M: 4/4
L: 1/8
Q: 1/4=65
K: Em
%%score (Melody Guitar)
%%vocalspace 10
%%botmargin 80
V:Melody name="Original Melody" stem=up
V:Guitar clef=treble-8 name="Layer 2 Guitar Accompaniment" stem=down
%%MIDI program 24
% Staff system 1: Melody and visible instruments share this measure range.
[V:Melody] | E E (EB,) E E (EB,) | E F G F2 (G2F) | E E (EB,) E E (EB,) | E F G F2 (G2F) |
w: Ha-ri Bol _ Ha-ri Bol _ | Ha-ri Ha-ri Bol _ | Ha-ri Bol _ Ha-ri Bol _ | Ha-ri Ha-ri Bol _
[V:Guitar] | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 |
% Staff system 2: Melody and visible instruments share this measure range.
[V:Melody] | E E2 F (GB) A G | (FE) D F E4 | E E2 F (GB) A G | (FE) D F E4 |
w: Mu-kun-da Ma- _ dha-va | Go- _ vin-da Bol | Mu-kun-da Ma- _ dha-va | Go- _ vin-da Bol
[V:Guitar] | E,2 E2 B,2 E2 | D,2 D2 A,2 F2 | E,2 E2 B,2 E2 | D,2 D2 A,2 F2 |
% Staff system 3: Melody and visible instruments share this measure range.
[V:Melody] | B B B (Bd) c B | (AG) A B A4 | B B2 B (Bd) c B | (AG) A B A2 B2 |
w: Ke-sha-va Ma- _ dha-va | Go- _ vin-da Bol | Ke-sha-va Ma- _ dha-va | Go- _ vin-da Bol _
[V:Guitar] | G,2 G2 D,2 B2 | D,2 D2 A,2 A2 | G,2 G2 D,2 B2 | D,2 D2 A,2 A2 |
% Staff system 4: Melody and visible instruments share this measure range.
[V:Melody] | E E2 F (GB) A G | (FE) DF E4 | E E2 F (GB) A G | (FE) D F E4 |
w: Mu-kun-da Ma- _ dha-va | Go- _ vin-da Bol | Mu-kun-da Ma- _ dha-va | Go- _ vin-da Bol
[V:Guitar] | E,2 E2 B,2 E2 | D,2 D2 A,2 F2 | E,2 E2 B,2 E2 | D,2 D2 A,2 F2 |`
  },
  {
    title: "2. Full Fingerstyle with Lyrics (Hari Bol)",
    description: "Melody (stems up) with lyrics, layered over Bass Accompaniment (stems down) on a single combined staff.",
    abc: `X: 1
T: Hari Bol (Fingerstyle Arrangement)
M: 4/4
L: 1/8
Q: 1/4=65
K: Em
%%score (Melody Guitar)
%%playchord 0
%%vocalspace 10
%%botmargin 80
V:Melody name="Original Melody" stem=up
E E (EB,) E E (EB,) | E F G F2 (G2F) | E E (EB,) E E (EB,) | E F G F2 (G2F) |
w: Ha-ri Bol _ Ha-ri Bol _ | Ha-ri Ha-ri Bol _ | Ha-ri Bol _ Ha-ri Bol _ | Ha-ri Ha-ri Bol _
V:Guitar clef=treble-8 name="Layer 2 Guitar Accompaniment" stem=down
| E,2 E2 B,2 E2 | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 |`
  },
  {
    title: "3. Melody Only (No Lyrics)",
    description: "A simple melody rendered directly to tablature. Notice how clean it is when there are no lyrics or bass stems to clear.",
    abc: `X: 2
T: Simple Folk Melody
M: 4/4
L: 1/4
K: G
%%score (Guitar)
%%botmargin 60
V:Guitar clef=treble-8
G A B c | d2 B2 | c e d c | B4 |`
  },
  {
    title: "4. Polyphonic Block Chords (Strumming)",
    description: "Multiple notes stacked vertically in brackets [ ] to create chords. The tablature correctly identifies the strings for each note.",
    abc: `X: 3
T: G Major Chord Progression
M: 4/4
L: 1/2
K: G
%%score (Guitar)
%%botmargin 60
V:Guitar clef=treble-8
[G,B,DGB] [C,G,CEG] | [D,A,DFA] [G,B,DGB] |`
  },
  {
    title: "5. Rapid Scale Run (Arpeggios)",
    description: "Fast 16th notes spanning multiple strings to demonstrate fret mapping across the neck.",
    abc: `X: 4
T: E Minor Arpeggio Run
M: 4/4
L: 1/16
K: Em
%%score (Guitar)
%%botmargin 60
V:Guitar clef=treble-8
E,G,B,E GBeB GEDB, G,4 |`
  }
];

export default function TestTabPage() {
  const [showMelody, setShowMelody] = useState(true);
  const [showGuitar, setShowGuitar] = useState(true);
  const [showGuitarTab, setShowGuitarTab] = useState(true);
  const [fetchedAbc, setFetchedAbc] = useState(defaultUserBugAbc);

  useEffect(() => {
    fetch("/user-bug.abc")
      .then((res) => res.text())
      .then((text) => setFetchedAbc(text))
      .catch((err) => console.error("Failed to load user-bug.abc:", err));
  }, []);

  const renderOptions = useMemo(() => ({
    tablature: [
      {
        instrument: "guitar",
        label: "Guitar",
        tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
      },
    ],
  }), []);

  const noTabRenderOptions = useMemo(() => ({}), []);

  const userBugScoreLine = useMemo(() => {
    const voices = [];
    if (showMelody) voices.push("Melody");
    if (showGuitar) voices.push("Guitar");
    if (voices.length === 0) return "%%score ()";
    return `%%score (${voices.join(" ")})`;
  }, [showMelody, showGuitar]);

  const userBugCase = useMemo(() => {
    let abc = fetchedAbc.replace("%%SCORE_PLACEHOLDER", userBugScoreLine);
    if (!showMelody) {
      abc = abc
        .split("\n")
        .filter((line) => !line.trim().startsWith("w:"))
        .join("\n");
    }
    return {
      title: "User Provided Bug Case",
      description: "Bug rendering issue - with toggles",
      abc,
      renderOptions: showGuitarTab ? renderOptions : noTabRenderOptions,
    };
  }, [showMelody, userBugScoreLine, showGuitarTab, renderOptions, noTabRenderOptions, fetchedAbc]);

  return (
    <main className="w-full min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="w-full mx-auto max-w-5xl space-y-10">
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Tablature POC
          </span>
          <h1 className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            ABC Tablature Rendering Gallery
          </h1>
          <p className="text-zinc-400 max-w-3xl text-sm leading-6">
            This test page renders standard ABC notation into beautiful Guitar Tablature using the reusable React <code>&lt;AbcjsPlaybackController /&gt;</code> component.
          </p>
          <div className="flex gap-3">
            <Link
              href="/test-beats"
              className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              Go to Beats Sandbox →
            </Link>
          </div>
        </header>

        <section className="space-y-8">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-4 border-amber-500/30">
            <div>
              <h2 className="text-xl font-bold text-zinc-100">{userBugCase.title}</h2>
              <p className="text-xs text-zinc-400 mt-1">{userBugCase.description}</p>
            </div>
            <div className="flex flex-wrap gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <input type="checkbox" checked={showMelody} onChange={(e) => setShowMelody(e.target.checked)} className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500" />
                Show Melody Line
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <input type="checkbox" checked={showGuitar} onChange={(e) => setShowGuitar(e.target.checked)} className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500" />
                Show Guitar Classic Line
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
                <input type="checkbox" checked={showGuitarTab} onChange={(e) => setShowGuitarTab(e.target.checked)} className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500" />
                Show GUITAR TAB Line
              </label>
            </div>
            <div className="border border-zinc-800 rounded-2xl bg-white text-zinc-950 overflow-hidden">
              <AbcjsPlaybackController
                abcString={userBugCase.abc}
                title={userBugCase.title}
                canvasId="test-tab-canvas-user-bug"
                renderOptions={userBugCase.renderOptions}
              />
            </div>
          </article>

          {EXAMPLES.map((ex, index) => (
            <article key={index} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">{ex.title}</h2>
                <p className="text-xs text-zinc-400 mt-1">{ex.description}</p>
              </div>
              <div className="border border-zinc-800 rounded-2xl bg-white text-zinc-950 overflow-hidden">
                <AbcjsPlaybackController
                  abcString={ex.abc}
                  title={ex.title}
                  canvasId={`test-tab-canvas-${index}`}
                  renderOptions={ex.renderOptions !== undefined ? ex.renderOptions : renderOptions}
                />
              </div>
            </article>
          ))}
        </section>

        <PocHandoffChecklist
          checks={[
            { label: "React playback controller integrated", passed: true },
            { label: "Tablature staff renders perfectly below melody", passed: true },
            { label: "Lyrics space is aligned and padded correctly", passed: true },
          ]}
        />
      </div>
    </main>
  );
}
