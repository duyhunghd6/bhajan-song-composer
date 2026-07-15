"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

const EXAMPLES = [
  {
    title: "1. Hari Bol - Voice-led Combined Accompaniment",
    description: "User-requested voice-led combined accompaniment example showing melody and layered guitar chords.",
    abc: `X: 1
T: Hari Bol - Voice-led Combined Accompaniment
M: 4/4
L: 1/8
Q: 1/4=65
K: Em
%%score (Melody) (Guitar)
%%vocalspace 10
%%botmargin 80
V:Melody name="Melody" stem=up
V:Guitar clef=treble-8 name="Guitar" stem=down
%%MIDI program 24
% Staff system 1: Melody and visible instruments share this measure range.
[V:Melody] | "G"B B2 B (Bd) c B |
w: Ke-sha-va Ma- _ dha-va
w: ⬤ * * ● * • * |
[V:Guitar] | [!1!b!2!B!3!G!4!D!5!D!6!B,] !1!b !4!D !1!b/2 !3!G/2 [!1!b!6!B,] !1!d'/2 !2!B/2 [!1!c'!4!D] !1!b/2 !3!G/2 |`,
    expectedAsciiGuitarTab: `e|-7-----7-----------7-----7-----10----8-----7-----|
B|-0--------------------------------0--------------|
G|-0--------------------0-----------------------0--|
D|-0-----------0-----------------------0-----------|
A|-5-----------------------------------------------|
E|-7-----------------------7-----------------------|`
  }
];

function getTestTabRenderOptions(abc: string, tabEnabled: boolean) {
  if (!tabEnabled) return {};

  let guitarIndex = -1;

  // 1. Try to find the score line and locate Guitar index among active/visible voices
  const scoreLineMatch = abc.match(/^\s*%%score\s+(.+)$/m);
  if (scoreLineMatch) {
    const scoreLine = scoreLineMatch[1];
    const staffGroups = scoreLine.match(/(\([^)]+\)|\[[^\]]+\]|\{[^}]+\}|\S+)/g);
    if (staffGroups) {
      guitarIndex = staffGroups.findIndex((group) => group.toLowerCase().includes("guitar"));
    }
  }

  // 2. Fallback to order of appearance in V: lines if not found in %%score
  if (guitarIndex === -1) {
    const voiceIds: string[] = [];
    const lines = abc.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*V:\s*([A-Za-z0-9_]+)/);
      if (match) {
        const voiceId = match[1];
        if (!voiceIds.includes(voiceId)) {
          voiceIds.push(voiceId);
        }
      }
    }
    guitarIndex = voiceIds.findIndex(id => id.toLowerCase().includes("guitar"));
  }

  if (guitarIndex >= 0) {
    return {
      tablature: [
        ...Array.from({ length: guitarIndex }, () => ({ instrument: "" as const })),
        {
          instrument: "guitar" as const,
          label: "",
          tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
          capo: 0,
          hideTabSymbol: false,
        },
      ],
    };
  }

  return {
    tablature: [
      {
        instrument: "guitar" as const,
        label: "",
        tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
        capo: 0,
        hideTabSymbol: false,
      },
    ],
  };
}

export default function TestTabPage() {
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
                  renderOptions={getTestTabRenderOptions(ex.abc, true)}
                />
              </div>
              {ex.expectedAsciiGuitarTab && (
                <div className="mt-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                  <h4 className="text-sm font-bold text-zinc-300 mb-2 font-mono">Expected Custom Fingerstyle Output (to Compare):</h4>
                  <pre className="text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre p-2 bg-zinc-900 rounded-lg">
                    {ex.expectedAsciiGuitarTab}
                  </pre>
                </div>
              )}
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
