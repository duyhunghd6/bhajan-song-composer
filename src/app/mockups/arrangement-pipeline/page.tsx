"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";
import { generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";

const AbcjsPlaybackController = dynamic(() => import("@/components/music-sheet/AbcjsPlaybackController"), { ssr: false });

const SAMPLE_MELODY_ABC = `X:1
T:Namostute Arrangement Pipeline Study
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 |`;

function statusPill(isReady: boolean, label: string) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        isReady
          ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
          : "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/30"
      }`}
    >
      {label}
    </span>
  );
}

export default function ArrangementPipelineMockup() {
  const pipeline = useMemo(
    () =>
      generateArrangementPipeline(SAMPLE_MELODY_ABC, {
        accompaniment: {
          instrument: "piano",
          compingPattern: "arpeggio",
        },
      }),
    [],
  );

  const validationPassed = Object.values(pipeline.validation).every(Boolean);
  const sourceKey = SAMPLE_MELODY_ABC.match(/^K:(.+)$/m)?.[1].trim() ?? pipeline.harmonization.key;
  const previewAbc = `X:302
T:Arrangement Pipeline Full-Track Preview
M:${pipeline.harmonization.timeSignature}
L:1/8
Q:1/4=120
K:${pipeline.harmonization.key}
${pipeline.finalAbc}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="space-y-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Mockup & POC Gate
            </span>
            <span className="font-mono text-xs text-zinc-500">
              UNID: br-plan-09.c02 | prd-bsc-s54, prd-bsc-s55
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div className="space-y-4">
              <h1 className="bg-gradient-to-r from-amber-300 via-sky-300 to-emerald-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
                Arrangement Pipeline Workstation
              </h1>
              <p className="max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
                Standalone proof-of-concept for turning a Layer 1 melody into a reviewable full-track proposal. The page exposes the ordered pipeline from melody analysis through harmonization, accompaniment, expansion decisions, final preview, and validation output before Composer integration.
              </p>
            </div>

            <section
              className={`rounded-2xl border p-5 shadow-2xl ${
                validationPassed
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : "border-rose-400/30 bg-rose-500/10"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Review status</p>
              <p className={`mt-2 text-2xl font-black ${validationPassed ? "text-emerald-300" : "text-rose-300"}`}>
                {validationPassed ? "Validation Passed" : "Validation Blocked"}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Ordered stages, decisions, final ABC, and gate checks are generated from the public arrangement pipeline API.
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
                <h2 className="text-xl font-bold text-zinc-100">Melody Input</h2>
                <p className="mt-1 text-sm text-zinc-400">Layer 1 source material and detected tonal context.</p>
              </div>
              {statusPill(true, "ready")}
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Key</dt>
                <dd className="font-semibold text-emerald-300">Key: {sourceKey}</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Scale</dt>
                <dd className="font-semibold text-emerald-300">Scale: {pipeline.harmonization.scale}</dd>
              </div>
              <div className="flex justify-between rounded-xl bg-zinc-950/70 px-4 py-3">
                <dt className="text-zinc-400">Meter</dt>
                <dd className="font-mono text-zinc-200">{pipeline.harmonization.timeSignature}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl lg:col-span-2">
            <h2 className="text-xl font-bold text-zinc-100">Strong Beats & Chord Decisions</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Harmonization scores each measure from strong-beat melody tones, functional chord fit, and cadence role.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4">Measure</th>
                    <th className="py-2 pr-4">Strong beat</th>
                    <th className="py-2 pr-4">Chord</th>
                    <th className="py-2 pr-4">Function</th>
                    <th className="py-2 pr-4">Cadence role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                  {pipeline.harmonization.measures.map((measure) => (
                    <tr key={measure.measureIndex}>
                      <td className="py-3 pr-4">#{measure.measureIndex + 1}</td>
                      <td className="py-3 pr-4">Strong beat: {measure.strongBeatNotes.join(", ")}</td>
                      <td className="py-3 pr-4 text-amber-300">
                        {measure.chord.name} · {measure.chord.romanNumeral}
                      </td>
                      <td className="py-3 pr-4">{measure.chord.function}</td>
                      <td className="py-3 pr-4">Cadence role: {measure.cadenceRole}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl lg:col-span-2">
            <h2 className="text-xl font-bold text-zinc-100">Layer 2 Accompaniment</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Piano accompaniment follows the harmonized progression while minimizing bass motion and preserving common tones.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {pipeline.accompaniment.measures.map((measure) => (
                <div key={measure.measureIndex} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Measure {measure.measureIndex + 1}
                      </p>
                      <p className="mt-1 text-lg font-black text-zinc-100">{measure.chord}</p>
                    </div>
                    <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-300 ring-1 ring-sky-400/30">
                      {measure.compingPattern}
                    </span>
                  </div>
                  <dl className="mt-4 space-y-2 text-xs text-zinc-300">
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Bass anchor</dt>
                      <dd className="font-mono">{measure.bassNote} · {measure.inversion}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Voice-leading distance</dt>
                      <dd className="font-mono">Voice-leading distance: {measure.voiceLeading.semitoneDistance} semitones</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Stable notes</dt>
                      <dd className="font-mono">{measure.voiceLeading.stableNotes.join(", ") || "new voicing"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Full-Track Decisions</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Expansion adds bass/kick alignment, frequency ranges, and counter-melody gap fills without blocking the melody.
            </p>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-zinc-950/70 p-4">
                <p className="text-sm font-bold text-emerald-300">Bass/kick alignment</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {pipeline.fullTrackExpansion.measures.length} measures align generated bass anchors to kick guidance.
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-950/70 p-4">
                <p className="text-sm font-bold text-emerald-300">Counter-melody gap fills</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {pipeline.fullTrackExpansion.measures.reduce((count, measure) => count + measure.counterMelodies.length, 0)} fills are constrained to rests or sustained melody notes.
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-950/70 p-4">
                <p className="text-sm font-bold text-emerald-300">Frequency ranges</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {pipeline.fullTrackExpansion.frequencyPlan.map((assignment) => (
                    <li key={assignment.family}>
                      {assignment.family}: {assignment.range}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <h2 className="text-xl font-bold text-zinc-100">Pipeline Stage Order</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Full-track export remains locked until every previous stage is completed in order.
          </p>
          <ol className="mt-5 grid gap-3 md:grid-cols-5">
            {pipeline.gates.map((gate, index) => (
              <li key={gate.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step {index + 1}</p>
                <p className="mt-1 text-sm font-bold text-zinc-100">{gate.label}</p>
                <p className="mt-2 text-xs text-emerald-300">{gate.state}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Combined Full-Track Preview</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Final generated ABC joins the melody, harmonization summary, Layer 2 accompaniment, and Layer 3 full-track guidance.
            </p>
            <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-white text-zinc-950">
              <AbcjsPlaybackController
                abcString={previewAbc}
                title="Combined Full-Track Preview"
                description="Generated by the arrangement pipeline POC"
                controls
                canvasId="arrangement-pipeline-preview"
              />
            </div>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
            <h2 className="text-xl font-bold text-zinc-100">Validation Checklist</h2>
            <p className="mt-1 text-sm text-zinc-400">Review gate evidence generated by the page.</p>
            <dl className="mt-5 space-y-3 text-sm">
              {Object.entries(pipeline.validation).map(([key, passed]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/70 px-4 py-3">
                  <dt className="text-zinc-300">{key}</dt>
                  <dd>{statusPill(passed, passed ? "pass" : "fail")}</dd>
                </div>
              ))}
            </dl>
          </article>
        </section>

        <PocHandoffChecklist
          checks={[
            { label: "Input sample rendered", passed: Boolean(sourceKey) },
            { label: "Intermediate decisions rendered", passed: pipeline.harmonization.measures.length > 0 && pipeline.accompaniment.measures.length > 0 },
            { label: "Final artifact rendered", passed: Boolean(previewAbc) },
            { label: "Validation report rendered", passed: validationPassed },
          ]}
        />
      </div>
    </main>
  );
}
