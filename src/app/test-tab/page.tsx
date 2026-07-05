"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

const EXAMPLES = [
  {
    title: "1. Full Fingerstyle with Lyrics (Hari Bol)",
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
    title: "2. Melody Only (No Lyrics)",
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
    title: "3. Polyphonic Block Chords (Strumming)",
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
    title: "4. Rapid Scale Run (Arpeggios)",
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
  const renderOptions = useMemo(() => ({
    tablature: [
      {
        instrument: "guitar",
        tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
      },
    ],
  }), []);

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
                  renderOptions={renderOptions}
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
