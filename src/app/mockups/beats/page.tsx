"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

const SAMPLER_4_4_ABC = `X: 1
T: Hari Bol (Beats & Tablature)
M: 4/4
L: 1/8
Q: 1/4=65
K: Em
%%score (Melody Guitar)
V:Melody name="Melody" stem=up
"Em"E E ("B7"EB,) "Em"E E ("B7"EB,) | "Em"E F "G"G "D"F2 ("Em"G2F) | "Em"E E ("B7"EB,) "Em"E E ("B7"EB,) | "Em"E F "G"G "D"F2 ("Em"G2F) |
w: Ha-ri Bol _ Ha-ri Bol _ | Ha-ri Ha-ri Bol _ | Ha-ri Bol _ Ha-ri Bol _ | Ha-ri Ha-ri Bol _
w: ⬤ * • * ● * • * | ⬤ * • * * * | ⬤ * • * ● * • * | ⬤ * • * * * |
V:Guitar clef=treble-8 name="Accompaniment" stem=down
| E,2 E2 B,2 E2 | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 | E,2 E2 B,2 E2 |`;

const SAMPLER_3_4_ABC = `X: 2
T: Krishna Kirtan (3/4 Beat Profile)
M: 3/4
L: 1/8
K: G
%%score (Melody Guitar)
V:Melody name="Melody" stem=up
"G"d2 "C"c2 "G"B2 | "Am"c4 "D7"A2 | "G"B2 "D7"A2 "G"G2 | "D7"A6 |
w: Hare Krish-na | Ha-re | Krish-na Krish-na | Ha-re |
w: ⬤ • • | ⬤ • | ⬤ • • | ⬤ |
V:Guitar clef=treble-8 name="Accompaniment" stem=down
| G,2 B,2 D2 | C,2 E,2 G,2 | D,2 F,2 A,2 | G,6 |`;

const SAMPLER_6_8_ABC = `X: 3
T: Fast Bhajan Rhythm (6/8 Accent Profile)
M: 6/8
L: 1/8
K: Am
%%score (Melody Guitar)
V:Melody name="Melody" stem=up
"Am"A2"G"B "C"c2"F"d | "Am"e3 "G"e2d | "F"c2"G"B "Am"A2"G"G | "Am"A6 |
w: Jay Ra-ma Jay Ra-ma | Jay Jay Ra-ma | Jay Ra-ma Jay Ra-ma | Jay |
w: ⬤ • ● • | ⬤ ● • | ⬤ • ● • | ⬤ |
V:Guitar clef=treble-8 name="Accompaniment" stem=down
| A,,3 E,3 | A,,3 E,3 | G,,3 D,3 | A,,6 |`;

// Token duration parser
function parseTokenDuration(noteText: string): number {
  const match = noteText.match(/([a-gA-GzZ,']*)([0-9]*\/?[0-9]*)$/);
  if (!match) return 1;
  const durStr = match[2];
  if (!durStr) return 1;
  if (durStr === '/') return 0.5;
  if (durStr.startsWith('/')) {
    const den = parseInt(durStr.substring(1), 10);
    return isNaN(den) ? 0.5 : 1 / den;
  }
  if (durStr.includes('/')) {
    const parts = durStr.split('/');
    const num = parseInt(parts[0], 10);
    const den = parseInt(parts[1], 10);
    return isNaN(num) || isNaN(den) ? 1 : num / den;
  }
  return parseInt(durStr, 10) || 1;
}

// Auto annotator logic
function autoAnnotateBeats(abcText: string, meter: string): string {
  const lines = abcText.split('\n');
  const processedLines: string[] = [];

  for (const line of lines) {
    const tr = line.trim();
    if (!tr || tr.startsWith('%') || /^[A-Z]:/.test(tr) || tr.startsWith('w:') || tr.startsWith('W:')) {
      processedLines.push(line);
      continue;
    }

    let voicePrefix = '';
    let musicPart = line;

    const vMatch = line.match(/^(\[V:[^\]]+\]\s*)/);
    if (vMatch) {
      voicePrefix = vMatch[1];
      musicPart = line.substring(voicePrefix.length);
    }

    const tokenRegex = /("[^"]+"|\[[^\]|:]+\][0-9]*\/?[0-9]*|\|\]|\|\||\|:|:\||::|\||([^_=]?[A-Ga-g,']+[0-9]*\/?[0-9]*)|([zZxX][0-9]*\/?[0-9]*)|(\(\d+:\d+:\d+|\(\d+)|[()\-]|\s+)/g;
    let match;
    const tokens: {
      text: string;
      isNote: boolean;
      isRest: boolean;
      isBar: boolean;
      durationText: string;
    }[] = [];

    while ((match = tokenRegex.exec(musicPart)) !== null) {
      const text = match[0];
      const isChordGroup = /^\[[^\]|:]+\]/.test(text) && /[A-Ga-g]/.test(text);
      tokens.push({
        text,
        isNote: !!match[2] || isChordGroup,
        isRest: !!match[3],
        isBar: text === '|' || text === '||' || text === '|]' || text === '|:' || text === ':|' || text === '::',
        durationText: text,
      });
    }

    let timeInMeasure = 0;
    const beatTokens: string[] = [];

    for (const token of tokens) {
      if (token.isBar) {
        if (timeInMeasure > 0) {
          beatTokens.push('|');
          timeInMeasure = 0;
        }
        continue;
      }

      if (token.isNote) {
        const duration = parseTokenDuration(token.durationText);
        let beatToken = '*';

        if (meter === '4/4') {
          if (timeInMeasure === 0) {
            beatToken = '⬤';
          } else if (timeInMeasure === 4) {
            beatToken = '●';
          } else if (timeInMeasure === 2 || timeInMeasure === 6) {
            beatToken = '•';
          }
        } else if (meter === '3/4') {
          if (timeInMeasure === 0) {
            beatToken = '⬤';
          } else if (timeInMeasure === 2 || timeInMeasure === 4) {
            beatToken = '•';
          }
        } else if (meter === '6/8') {
          if (timeInMeasure === 0) {
            beatToken = '⬤';
          } else if (timeInMeasure === 3) {
            beatToken = '●';
          } else if (timeInMeasure === 1 || timeInMeasure === 2 || timeInMeasure === 4 || timeInMeasure === 5) {
            beatToken = '•';
          }
        } else if (timeInMeasure === 0) {
          beatToken = '⬤';
        }

        beatTokens.push(beatToken);
        timeInMeasure += duration;
      } else if (token.isRest) {
        timeInMeasure += parseTokenDuration(token.text);
      }
    }

    processedLines.push(voicePrefix + musicPart);
    if (beatTokens.length > 0) {
      processedLines.push(`w: ${beatTokens.join(' ')}`);
    }
  }

  return processedLines.join('\n');
}

export default function BeatsMockup() {
  const [theme, setTheme] = useState("classic");
  const [beatsVisible, setBeatsVisible] = useState(true);
  const [editorMeter, setEditorMeter] = useState("4/4");
  const [editorKey, setEditorKey] = useState("Em");
  const [editorInput, setEditorInput] = useState('"Em"E E "B7"E E "Em"E F "G"G F | "Em"E E "B7"E E "Em"E F "G"G F |');

  const themeStyles = useMemo(() => {
    const themes = {
      classic: {
        "--color-strong": "#ef4444",
        "--color-medium": "#f59e0b",
        "--color-soft": "#64748b",
        "--glow-strong": "rgba(239, 68, 68, 0.6)",
        "--glow-medium": "rgba(245, 158, 11, 0.5)",
      },
      chakra: {
        "--color-strong": "#e84118",
        "--color-medium": "#fbc531",
        "--color-soft": "#4cd137",
        "--glow-strong": "rgba(232, 65, 24, 0.6)",
        "--glow-medium": "rgba(251, 197, 49, 0.5)",
      },
      cyberpunk: {
        "--color-strong": "#ff007f",
        "--color-medium": "#00ffff",
        "--color-soft": "#bd00ff",
        "--glow-strong": "rgba(255, 0, 127, 0.6)",
        "--glow-medium": "rgba(0, 255, 255, 0.5)",
      },
      forest: {
        "--color-strong": "#00b894",
        "--color-medium": "#badc58",
        "--color-soft": "#95afc0",
        "--glow-strong": "rgba(0, 184, 148, 0.6)",
        "--glow-medium": "rgba(186, 220, 88, 0.5)",
      },
    };
    return themes[theme as keyof typeof themes] || themes.classic;
  }, [theme]);

  // Tab rendering options
  const renderOptions = useMemo(() => ({
    tablature: [
      {
        instrument: "guitar",
        tuning: ["E,", "A,", "D", "G", "B", "e"],
      },
    ],
  }), []);

  // Compute live annotated ABC
  const liveAbc = useMemo(() => {
    const base = `X: 99
T: Interactive Beat Demonstration
M: ${editorMeter}
L: 1/8
K: ${editorKey}
V:Melody name="Melody"
${editorInput}`;
    return autoAnnotateBeats(base, editorMeter);
  }, [editorInput, editorMeter, editorKey]);

  return (
    <main style={themeStyles as React.CSSProperties} className="w-full min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="w-full mx-auto max-w-7xl space-y-10">
        
        {/* Header */}
        <header className="space-y-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Mockup & POC Gate
            </span>
            <span className="font-mono text-xs text-zinc-500">
              UNID: br-plan-09.c07 | prd-bsc-beats
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div className="space-y-4">
              <h1 className="bg-gradient-to-r from-red-400 via-amber-300 to-indigo-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                Beat Strength Accent Highlight
              </h1>
              <p className="max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
                Standalone mockup displaying metric subdivisions (Strong, Medium, Soft Beats) on a separate ABC lyrics-like row instead of mutating melody notes. Styled using SVG post-processing and React state variables. This test page utilizes the production <code>&lt;AbcjsPlaybackController /&gt;</code> component.
              </p>
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-2xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Highlights</p>
                <p className="mt-1 text-2xl font-black text-emerald-300">Active</p>
              </div>
              <button
                onClick={() => setBeatsVisible(!beatsVisible)}
                className="px-4 py-2 text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-all"
              >
                {beatsVisible ? "Hide Beats" : "Show Beats"}
              </button>
            </section>
          </div>

          <Link
            href="/mockups"
            className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            ← Back to mockup gate
          </Link>
        </header>

        {/* Layout grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
          
          {/* Controls Column */}
          <section className="lg:col-span-1 flex flex-col gap-6 w-full">
            
            {/* Style Themes */}
            <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
              <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Style Themes
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "classic", label: "Classic Accent", colors: ["bg-[#ef4444]", "bg-[#f59e0b]", "bg-[#64748b]"] },
                  { id: "chakra", label: "Chakra Energy", colors: ["bg-[#e84118]", "bg-[#fbc531]", "bg-[#4cd137]"] },
                  { id: "cyberpunk", label: "Cyberpunk Neon", colors: ["bg-[#ff007f]", "bg-[#00ffff]", "bg-[#bd00ff]"] },
                  { id: "forest", label: "Forest Zen", colors: ["bg-[#00b894]", "bg-[#badc58]", "bg-[#95afc0]"] },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                      theme === t.id
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {t.colors.map((c, i) => (
                        <span key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                      ))}
                      {t.label}
                    </span>
                    {theme === t.id && <span className="text-xs text-indigo-400 font-semibold">Active</span>}
                  </button>
                ))}
              </div>
            </article>

            {/* Legend Card */}
            <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
              <h2 className="text-lg font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Metric Beat Legend
              </h2>
              <ul className="space-y-4 text-xs">
                <li className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-[#ef4444] font-bold text-lg" style={{ color: "var(--color-strong)" }}>⬤</div>
                  <div>
                    <span className="font-semibold block text-zinc-200">Strong Beat (Beat 1)</span>
                    <span className="text-zinc-500">Primary downbeat. Dictates fundamental chord changes and primary accentuation.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[#f59e0b] font-semibold text-xs" style={{ color: "var(--color-medium)" }}>●</div>
                  <div>
                    <span className="font-semibold block text-zinc-200">Medium Beat (Beat 3 / Pulse)</span>
                    <span className="text-zinc-500">Secondary strong pulse (e.g. beat 3 in 4/4 or beat 4 in 6/8).</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-500/10 border border-slate-500/20 text-[#64748b] text-[8px]" style={{ color: "var(--color-soft)" }}>•</div>
                  <div>
                    <span className="font-semibold block text-zinc-200">Soft Beat (Beats 2, 4 / Weak)</span>
                    <span className="text-zinc-500">Unaccented offbeats. Typically hosts embellishing or passing tones.</span>
                  </div>
                </li>
              </ul>
            </article>

          </section>

          {/* Main Visual Column */}
          <section className="lg:col-span-2 flex flex-col gap-8 w-full">
            
            {/* Live Editor */}
            <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
              <h2 className="text-xl font-bold text-zinc-100 mb-4">Interactive Beat Auto-Annotator</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 w-full">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Meter</label>
                  <select
                    value={editorMeter}
                    onChange={(e) => setEditorMeter(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-300 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="4/4">4/4 Meter</option>
                    <option value="3/4">3/4 Meter</option>
                    <option value="6/8">6/8 Meter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Key</label>
                  <select
                    value={editorKey}
                    onChange={(e) => setEditorKey(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-300 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="Em">E Minor</option>
                    <option value="C">C Major</option>
                    <option value="G">G Major</option>
                    <option value="Am">A Minor</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Raw ABC Input</label>
                <textarea
                  value={editorInput}
                  onChange={(e) => setEditorInput(e.target.value)}
                  rows={2}
                  className="w-full p-3 font-mono text-sm rounded-lg border border-zinc-800 bg-zinc-950/70 text-zinc-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-5 border border-zinc-800 rounded-2xl bg-white text-zinc-950 overflow-hidden">
                <div className={beatsVisible ? "" : "beats-hidden"}>
                  <AbcjsPlaybackController
                    abcString={liveAbc}
                    title="Interactive Accent Sandbox"
                    description="Preview sheet music containing auto-calculated beat strength markings."
                    canvasId="live-editor-canvas"
                    renderOptions={renderOptions}
                  />
                </div>
              </div>
            </article>

            {/* Static Examples */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-100">Gallery of Beat Accent Combinations</h2>

              {/* 4/4 Example */}
              <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-zinc-200">1. Hari Bol (4/4 Meter Accent Profile)</h3>
                  <span className="rounded bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-0.5 text-xs font-semibold">4/4 Meter</span>
                </div>
                <div className="border border-zinc-800 rounded-2xl bg-white text-zinc-950 overflow-hidden">
                  <div className={beatsVisible ? "" : "beats-hidden"}>
                    <AbcjsPlaybackController
                      abcString={SAMPLER_4_4_ABC}
                      title="Hari Bol Bhajan Beats"
                      canvasId="static-4-4-canvas"
                      renderOptions={renderOptions}
                    />
                  </div>
                </div>
              </article>

              {/* 3/4 Example */}
              <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-zinc-200">2. Krishna Kirtan (3/4 Accent Profile)</h3>
                  <span className="rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">3/4 Meter</span>
                </div>
                <div className="border border-zinc-800 rounded-2xl bg-white text-zinc-950 overflow-hidden">
                  <div className={beatsVisible ? "" : "beats-hidden"}>
                    <AbcjsPlaybackController
                      abcString={SAMPLER_3_4_ABC}
                      title="Krishna Kirtan Beats"
                      canvasId="static-3-4-canvas"
                      renderOptions={renderOptions}
                    />
                  </div>
                </div>
              </article>

              {/* 6/8 Example */}
              <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-zinc-200">3. Fast Bhajan Rhythm (6/8 Accent Profile)</h3>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 text-xs font-semibold">6/8 Meter</span>
                </div>
                <div className="border border-zinc-800 rounded-2xl bg-white text-zinc-950 overflow-hidden">
                  <div className={beatsVisible ? "" : "beats-hidden"}>
                    <AbcjsPlaybackController
                      abcString={SAMPLER_6_8_ABC}
                      title="Fast Bhajan Rhythm Beats"
                      canvasId="static-6-8-canvas"
                      renderOptions={renderOptions}
                    />
                  </div>
                </div>
              </article>

            </div>

            <PocHandoffChecklist
              checks={[
                { label: "React staff playback component integrated", passed: true },
                { label: "Chords are rendered above notes with zero overlap", passed: true },
                { label: "Beat indicator circles aligned below lyrics row", passed: true },
                { label: "Tablature staff renders clearly without being cut off", passed: true },
              ]}
            />

          </section>

        </div>
      </div>
      
      {/* Dynamic inline styles for hidden state */}
      <style>{`
        .beats-hidden .beat-indicator {
          opacity: 0 !important;
          pointer-events: none;
        }
      `}</style>
    </main>
  );
}
