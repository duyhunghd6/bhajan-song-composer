"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";
import { generatePianoAccompaniment } from "@/lib/theory/piano-accompaniment";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

const SAMPLE_MELODY_ABC = `X:1
T:Namostute Piano Accompaniment Study
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 | G2 z2 B2 z2 | E8 |`;

const SAMPLE_PROGRESSION = ["Em", "Bm", "G", "Em"];

function statusPill(isReady: boolean, label: string) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
      isReady
        ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
        : "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/30"
    }`}>
      {label}
    </span>
  );
}

function formatBeat(beat: number) {
  return Number.isInteger(beat) ? beat.toString() : beat.toFixed(1);
}

export default function PianoAccompanimentMockup() {
  const piano = useMemo(() => generatePianoAccompaniment(SAMPLE_MELODY_ABC, {
    progression: SAMPLE_PROGRESSION,
    bassFoundation: "1-5-8",
    compingProfile: "pop-ballad",
  }), []);

  const validationPassed =
    piano.leftHandBassMap.every((measure) => measure.lowIntervalLimit.valid) &&
    piano.rightHandVoicingMap.every((measure) => measure.melodyMaskingAvoided) &&
    piano.gapFillMap.some((measure) => measure.events.length > 0) &&
    piano.physicalValidation.valid &&
    piano.pedalAutomation.events.length > 0 &&
    piano.pianoKeyHighlights.length > 0;
  const firstCompingProfile = piano.compingProfileMap[0];
  const previewAbc = `X:401
T:Layer 2 Piano Accompaniment Preview
M:${piano.sourceAnalysis.timeSignature}
L:1/8
Q:1/4=120
K:${piano.sourceAnalysis.key}
${piano.grandStaffAbc}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="space-y-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Mockup & POC Gate
            </span>
            <span className="font-mono text-xs text-zinc-500">
              UNID: br-plan-09.c04 | prd-bsc-s54, prd-bsc-s55
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div className="space-y-4">
              <h1 className="bg-gradient-to-r from-amber-300 via-purple-300 to-sky-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                Piano Accompaniment Workstation
              </h1>
              <p className="max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
                Standalone proof-of-concept for generating Layer 2 piano accompaniment from a melody and chord progression. The page exposes comping profile selection, bass anchoring, Low Interval Limit checks, right-hand voice leading, melodic gap fills, pedal automation, playback preview, and key highlights before Composer integration.
              </p>
            </div>

            <section className={`rounded-2xl border p-5 shadow-2xl ${
              validationPassed
                ? "border-emerald-400/30 bg-emerald-500/10"
                : "border-rose-400/30 bg-rose-500/10"
            }`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Review status</p>
              <p className={`mt-2 text-2xl font-black ${validationPassed ? "text-emerald-300" : "text-rose-300"}`}>
                {validationPassed ? "Validation Passed" : "Validation Blocked"}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Piano maps, validation reports, pedal events, ABC preview, and visual key metadata are generated from the public piano accompaniment API.
              </p>
            </section>
          </div>

          <Link
            href="/mockups"
            className="inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            ← Back to mockup gate
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Comping Profile</h2>
                <p className="mt-1 text-sm text-zinc-400">Selected rhythmic texture and hand split.</p>
              </div>
              {statusPill(Boolean(firstCompingProfile), "ready")}
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Style</dt>
                <dd className="font-semibold text-emerald-300">{firstCompingProfile?.style}</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Feel</dt>
                <dd className="font-mono text-zinc-200">{firstCompingProfile?.rhythmicFeel}</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Measures</dt>
                <dd className="font-mono text-zinc-200">{piano.compingProfileMap.length}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl lg:col-span-2">
            <h2 className="text-xl font-bold text-zinc-100">Bass Anchoring & Low Interval Limit</h2>
            <p className="mt-1 text-sm text-zinc-400">Left hand locks each chord to a root/fifth/octave foundation while rejecting unsafe low intervals.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {piano.leftHandBassMap.map((measure) => (
                <div key={measure.measureIndex} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Measure {measure.measureIndex + 1}</p>
                      <p className="mt-1 text-lg font-black text-zinc-100">{measure.chord}</p>
                    </div>
                    {statusPill(measure.lowIntervalLimit.valid, measure.lowIntervalLimit.valid ? "clear" : "blocked")}
                  </div>
                  <dl className="mt-4 space-y-2 text-xs text-zinc-300">
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Foundation</dt>
                      <dd className="font-mono">Foundation: {measure.foundation}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Low Interval Limit</dt>
                      <dd className="font-mono text-emerald-300">Low Interval Limit: {measure.lowIntervalLimit.valid ? "clear" : "blocked"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Bass notes</dt>
                      <dd className="font-mono">{measure.events.map((event) => `${event.note} ${event.role}`).join(" · ")}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Right-Hand Voice Leading</h2>
            <p className="mt-1 text-sm text-zinc-400">Guide tones avoid the active melody note and retain common tones where possible.</p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4">Measure</th>
                    <th className="py-2 pr-4">Chord</th>
                    <th className="py-2 pr-4">Guide tones</th>
                    <th className="py-2 pr-4">Common tones</th>
                    <th className="py-2 pr-4">Masking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                  {piano.rightHandVoicingMap.map((measure) => (
                    <tr key={measure.measureIndex}>
                      <td className="py-3 pr-4">#{measure.measureIndex + 1}</td>
                      <td className="py-3 pr-4 text-amber-300">{measure.chord}</td>
                      <td className="py-3 pr-4">Guide tones: {measure.guideTones.join(", ") || "none"}</td>
                      <td className="py-3 pr-4">{measure.commonTones.join(", ") || "new voicing"}</td>
                      <td className="py-3 pr-4 text-emerald-300">Melody masking avoided</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Melodic Gap Fills</h2>
            <p className="mt-1 text-sm text-zinc-400">Passing fills are generated only inside safe rests or held-note windows and yield before melody resumes.</p>
            <ul className="mt-5 space-y-3">
              {piano.gapFillMap.flatMap((measure) => measure.events).map((event) => (
                <li key={`${event.measureIndex}-${event.beat}`} className="rounded-xl bg-zinc-950/70 p-4 font-mono text-xs text-zinc-300">
                  M{event.measureIndex + 1} beat {formatBeat(event.beat)} · {event.role} · {event.notes.join(", ")} · yields at {event.yieldsToMelodyAt ?? "phrase end"}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <PianoPedalIndicator
            title="Pedal Automation"
            pedalAutomation={piano.pedalAutomation}
            currentMeasureIndex={1}
            currentBeat={1}
            className="border-zinc-800 bg-zinc-900/70 shadow-xl"
          />

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl lg:col-span-2">
            <h2 className="text-xl font-bold text-zinc-100">Piano Key Highlights</h2>
            <p className="mt-1 text-sm text-zinc-400">Fingering metadata drives visual key highlights for left and right hands.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {piano.pianoKeyHighlights.slice(0, 12).map((highlight, index) => (
                <div key={`${highlight.measureIndex}-${highlight.hand}-${highlight.midi}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">M{highlight.measureIndex + 1} · {highlight.hand}</p>
                  <p className="mt-2 text-2xl font-black text-zinc-100">{highlight.note}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">finger {highlight.finger} · {highlight.role}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <h2 className="text-xl font-bold text-zinc-100">Grand Staff Preview</h2>
          <p className="mt-1 text-sm text-zinc-400">Combined left hand, right hand, comping, gap-fill, playback, and MIDI metadata are available as a reviewable artifact.</p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-white text-zinc-950">
            <AbcjsPlaybackController
              abcString={previewAbc}
              title="Layer 2 Piano Accompaniment Preview"
              description="ABCJS playback preview of the generated piano accompaniment artifact."
              canvasId="piano-accompaniment-preview"
              minWidthClassName="min-w-[900px]"
              paperClassName="bg-white"
            />
          </div>
        </section>

        <PocHandoffChecklist
          checks={[
            { label: "Input sample rendered", passed: Boolean(SAMPLE_MELODY_ABC) },
            { label: "Intermediate decisions rendered", passed: piano.leftHandBassMap.length > 0 && piano.rightHandVoicingMap.length > 0 },
            { label: "Final artifact rendered", passed: Boolean(previewAbc) },
            { label: "Validation report rendered", passed: validationPassed },
          ]}
        />
      </div>
    </main>
  );
}
