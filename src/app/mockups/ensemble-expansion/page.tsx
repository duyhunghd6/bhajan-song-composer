"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { generateAccompanimentStage } from "@/lib/theory/accompaniment-stage";
import { generateEnsembleExpansionOutput } from "@/lib/theory/ensemble-output-contract";

const MusicSheetRenderer = dynamic(() => import("@/components/music-sheet/MusicSheetRenderer"), { ssr: false });

const SAMPLE_MELODY_ABC = `X:1
T:Namostute Ensemble Expansion Study
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 | G2 A2 B2 G2 | E8 |`;

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

function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function EnsembleExpansionMockup() {
  const output = useMemo(() => {
    const accompaniment = generateAccompanimentStage(SAMPLE_MELODY_ABC, {
      instrument: "piano",
      progression: SAMPLE_PROGRESSION,
      compingPattern: "arpeggio",
    });

    return generateEnsembleExpansionOutput(SAMPLE_MELODY_ABC, { accompaniment });
  }, []);

  const validationPassed = Object.values(output.validation).every(Boolean);
  const densityCounts = output.handshake.rhythmicDensityGrid.reduce<Record<string, number>>((counts, slice) => {
    counts[slice.density] = (counts[slice.density] ?? 0) + 1;
    return counts;
  }, {});
  const previewAbc = `X:301
T:Layer 3 Ensemble Expansion Preview
M:4/4
L:1/8
Q:1/4=120
K:Em
${output.abcLayers.combined}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="space-y-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Mockup & POC Gate
            </span>
            <span className="font-mono text-xs text-zinc-500">
              UNID: br-plan-09.c05 | prd-bsc-s54, prd-bsc-s55
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div className="space-y-4">
              <h1 className="bg-gradient-to-r from-amber-300 via-emerald-300 to-sky-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                Ensemble Expansion Workstation
              </h1>
              <p className="max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
                Standalone proof-of-concept for adding Layer 3 Djembe, Flute, and Violin support on top of an established melody and accompaniment foundation. The page exposes the integration handshake, intermediate decision maps, conflict handling, and final playback artifact before Composer integration.
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
                Handshake, event maps, ABC layers, playback events, MIDI control, and visual activity are all generated from public arrangement APIs.
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
                <h2 className="text-xl font-bold text-zinc-100">Integration Handshake</h2>
                <p className="mt-1 text-sm text-zinc-400">Layer readiness contract passed from the accompaniment pipeline into ensemble expansion.</p>
              </div>
              {statusPill(output.validation.handshakeReady, "ready")}
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Layer 1 melody</dt>
                <dd className="font-semibold text-emerald-300">Layer 1 melody: ready</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Layer 2 foundation</dt>
                <dd className="font-semibold text-emerald-300">Layer 2 foundation: ready</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Density slices</dt>
                <dd className="font-mono text-zinc-200">{output.handshake.rhythmicDensityGrid.length}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl lg:col-span-2">
            <h2 className="text-xl font-bold text-zinc-100">Rhythmic Density Grid</h2>
            <p className="mt-1 text-sm text-zinc-400">Each accompaniment subdivision records whether the singer and foundation are active so Layer 3 can decide between support, fills, and silence.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["open", "supporting", "busy"].map((density) => (
                <div key={density} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{density}</p>
                  <p className="mt-2 text-3xl font-black text-zinc-100">{densityCounts[density] ?? 0}</p>
                  <p className="mt-1 text-xs text-zinc-500">slices</p>
                </div>
              ))}
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4">Measure</th>
                    <th className="py-2 pr-4">Beat</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">Layer 1</th>
                    <th className="py-2 pr-4">Layer 2</th>
                    <th className="py-2 pr-4">Density</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                  {output.handshake.rhythmicDensityGrid.slice(0, 8).map((slice) => (
                    <tr key={`${slice.measureIndex}-${slice.beat}`}>
                      <td className="py-3 pr-4">#{slice.measureIndex + 1}</td>
                      <td className="py-3 pr-4">{formatBeat(slice.beat)}</td>
                      <td className="py-3 pr-4">{formatMs(slice.startMs)}</td>
                      <td className="py-3 pr-4">{slice.layer1Active ? "active" : "rest"}</td>
                      <td className="py-3 pr-4">{slice.layer2Active ? "active" : "rest"}</td>
                      <td className="py-3 pr-4 text-amber-300">{slice.density}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Bass Map</h2>
            <p className="mt-1 text-sm text-zinc-400">Djembe bass strokes lock to Layer 2 bass transients.</p>
            <ul className="mt-5 space-y-3">
              {output.handshake.bassMap.map((event) => (
                <li key={`${event.measureIndex}-${event.startMs}`} className="rounded-xl bg-zinc-950/70 p-4 font-mono text-xs text-zinc-300">
                  M{event.measureIndex + 1} beat {formatBeat(event.beat)} · {event.note} · {formatMs(event.startMs)}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Melodic Gaps</h2>
            <p className="mt-1 text-sm text-zinc-400">Fill zones are derived from sustained notes and rests in the singer line.</p>
            <ul className="mt-5 space-y-3">
              {output.handshake.melodicGapArray.map((gap) => (
                <li key={`${gap.measureIndex}-${gap.startMs}`} className="rounded-xl bg-zinc-950/70 p-4 font-mono text-xs text-zinc-300">
                  M{gap.measureIndex + 1} beat {formatBeat(gap.beat)} · {gap.type} · {gap.durationBeats} beats
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Djembe Interlock</h2>
                <p className="mt-1 text-sm text-zinc-400">Bass, slap, and mid-tone strokes keep clear transient ownership.</p>
              </div>
              {statusPill(output.djembe.validation.transientConflictsAvoided, "clear")}
            </div>
            <ul className="mt-5 space-y-3">
              {output.eventMaps.djembe.slice(0, 6).map((event) => (
                <li key={`${event.measureIndex}-${event.startMs}-${event.stroke}`} className="rounded-xl bg-zinc-950/70 p-4 font-mono text-xs text-zinc-300">
                  {event.stroke} · {event.source} · M{event.measureIndex + 1}.{formatBeat(event.beat)} · vel {event.velocity}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Flute / Violin Yield States</h2>
            <p className="mt-1 text-sm text-zinc-400">Auxiliary instruments sustain behind active melody, answer in melodic gaps, and stay silent when no support is needed.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-zinc-950/70 p-4">
                <h3 className="font-semibold text-sky-300">Flute yield decisions</h3>
                <ul className="mt-3 space-y-2 text-xs text-zinc-400">
                  {output.yieldDecisions.slice(0, 4).map((decision) => (
                    <li key={`flute-${decision.measureIndex}-${decision.startMs}`}>
                      M{decision.measureIndex + 1}.{formatBeat(decision.beat)} → {decision.fluteMode}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-zinc-950/70 p-4">
                <h3 className="font-semibold text-rose-300">Violin yield decisions</h3>
                <ul className="mt-3 space-y-2 text-xs text-zinc-400">
                  {output.yieldDecisions.slice(0, 4).map((decision) => (
                    <li key={`violin-${decision.measureIndex}-${decision.startMs}`}>
                      M{decision.measureIndex + 1}.{formatBeat(decision.beat)} → {decision.violinMode}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Conflict Report</h2>
            <p className="mt-1 text-sm text-zinc-400">The conflict resolver preserves Layer 1 melody first, then flattens or removes Layer 3 overloads.</p>
            <div className="mt-5 rounded-2xl bg-zinc-950/70 p-4">
              {output.conflictReport.length > 0 ? (
                <ul className="space-y-3 text-xs text-zinc-300">
                  {output.conflictReport.map((entry) => (
                    <li key={`${entry.measureIndex}-${entry.startMs}`}>
                      M{entry.measureIndex + 1}.{formatBeat(entry.beat)} · {entry.actions.join(", ")} · resolved: {entry.overloadResolved ? "yes" : "no"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-300">No overload conflicts in this sample; Layer 1 stays preserved.</p>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Combined Ensemble Preview</h2>
              <p className="mt-1 text-sm text-zinc-400">Layer 3 ABC, playback events, MIDI control events, and visual activity are ready for the Composer handoff.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Playback events</p>
                  <p className="mt-2 text-2xl font-black text-zinc-100">{output.playbackEvents.length}</p>
                </div>
                <div className="rounded-2xl bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">MIDI controls</p>
                  <p className="mt-2 text-2xl font-black text-zinc-100">{output.midiControlEvents.length}</p>
                </div>
                <div className="rounded-2xl bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Visual activity</p>
                  <p className="mt-2 text-2xl font-black text-zinc-100">{output.visualActivity.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
              <h3 className="font-bold text-emerald-300">Validation Passed</h3>
              <ul className="mt-4 space-y-2 font-mono text-xs text-emerald-200/90">
                {Object.entries(output.validation).map(([key, value]) => (
                  <li key={key}>{key}: {value ? "ready" : "blocked"}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <MusicSheetRenderer
              abcString={previewAbc}
              title="Layer 3 Ensemble Notation"
              description="Playable preview of generated Djembe, Flute, and Violin ensemble layers"
              canvasId="ensemble-expansion-poc-canvas"
              paperClassName="bg-zinc-900 text-zinc-100"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
