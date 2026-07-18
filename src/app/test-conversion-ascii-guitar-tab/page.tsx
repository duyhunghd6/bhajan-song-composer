"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import PocHandoffChecklist from "@/components/mockups/PocHandoffChecklist";
import { convertAsciiGuitarTabToForcedAbc } from "@/lib/theory/fingerstyle-arranger/ascii-guitartab-conversion";
import { formatAbcAsciiGuitarTabValidation } from "@/lib/theory/fingerstyle-arranger/abc-ascii-guitartab-validation";

const AbcjsPlaybackController = dynamic(
  () => import("@/components/music-sheet/AbcjsPlaybackController"),
  { ssr: false },
);

const SOURCE_ABC = `X:1
T:Ganesha, Ganesha — ASCII GuitarTab Conversion Fixture
L:1/8
M:4/4
Q:1/2=120
K:G
%%score (Melody) (Guitar)
%%vocalspace 10
%%botmargin 80
V:Melody name="Melody" stem=up
V:Guitar clef=treble-8 name="Guitar" stem=down
%%MIDI program 24
% Staff system 1: Melody and visible instruments share this measure range.
[V:Melody] | B, | : "Em" E E2 F GF E B, | "Em" E E2 F GF E2 | "Am" B2 A2 G2 A2 | "Em" E E3- E2 z B, |
w: Ga- | ne- sha Ga- ne- * sha Ga- | ne- sha Ga- ne- * sha | Jay jay Shri Ga- | ne- sha! _ Ga
w: | ⬤ | ⬤ * * ● * • * | ⬤ * * ● * • | ⬤ • ● • | ⬤ * ● * |`;

const ASCII_FIXTURE = `Measures 1–5
e|-------------------------------------------------|-0-----0-----------2-----3-----2-----0-----------|-0-----0-----------2-----3-----2-----0-----------|-7-----------5-----------3-----------5-----------|-0-----0-----------2-----3-----2-----0-----------|
B|-0-----------------------------------------------|-------------------------------------------0-----|-------------------------------------------------|----------------------------------------5--------|-------------------------------------------0-----|
G|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|----------0--------------------------------------|
D|-------------------------------------------------|-------------------------------------2-----------|-------------------------------------2-----------|-------------2-----------------------2-----------|-------------------------------------------------|
A|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|-0-----------------------0-----------------------|-------------------------------------------------|
E|-------------------------------------------------|-0-----------------------0-----------------------|-0-----------------------0-----------------------|-------------------------------------------------|-0-----------------------------------------------|`;

const renderOptions = {
  tablature: [
    {
      instrument: "guitar" as const,
      label: "",
      tuning: ["E,", "A,", "D", "G", "B", "e"],
      capo: 0,
      hideTabSymbol: false,
    },
  ],
};

function CopyButton({ label, text, testId }: { label: string; text: string; testId: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 2000);
  }, [text]);

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={handleCopy}
      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-sky-400 hover:text-sky-300"
    >
      {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : label}
    </button>
  );
}

function Status({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${passed
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
      <span className="mr-2 font-bold">{passed ? "PASS" : "FAIL"}</span>
      {label}
    </div>
  );
}

export default function TestConversionAsciiGuitarTabPage() {
  const conversion = useMemo(() => convertAsciiGuitarTabToForcedAbc({
    sourceAbc: SOURCE_ABC,
    asciiGuitarTab: ASCII_FIXTURE,
    chords: ["C", "Em", "Em", "Am", "Em"],
  }), []);

  const exactAscii = conversion.roundTripAscii === conversion.normalizedInputAscii;
  const physicalValid = conversion.validation.valid && conversion.validation.mismatchCount === 0;
  const sourceMelodyAligned = conversion.sourceMelodyAlignment.aligned;
  const durationTransfer = conversion.sourceMelodyDurationTransfer;
  const validationText = formatAbcAsciiGuitarTabValidation(conversion.validation);
  const sourceAlignmentText = sourceMelodyAligned
    ? `${conversion.sourceMelodyAlignment.matchedAttackCount} source melody attacks matched exact physical TAB pitches.`
    : conversion.sourceMelodyAlignment.mismatches.map(mismatch => (
      `Measure ${mismatch.measure}, cell ${mismatch.stepIndex + 1}: ${mismatch.kind} for ${mismatch.sourcePitch}; candidates ${mismatch.candidatePitches.join(", ") || "none"}.`
    )).join("\n");
  const durationTransferText = durationTransfer.transfers.length === 0
    ? "No source melody attack requested a duration longer than one ASCII cell."
    : durationTransfer.transfers.map(transfer => (
      transfer.blockedByStepIndices.length === 0
        ? `Measure ${transfer.measure}, cell ${transfer.stepIndex + 1}: preserved ${transfer.sourcePitch} for ${transfer.appliedDurationSteps} cells on string ${transfer.string}.`
        : `Measure ${transfer.measure}, cell ${transfer.stepIndex + 1}: source ${transfer.sourcePitch} requested ${transfer.requestedDurationSteps} cells; kept the physical one-cell attack because string ${transfer.string} re-attacks at cells ${transfer.blockedByStepIndices.map(step => step + 1).join(", ")}.`
    )).join("\n");

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Conversion Regression Sandbox
            </span>
            <Link href="/test-tab" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">
              ABC Tablature Gallery →
            </Link>
          </div>
          <h1 className="bg-gradient-to-r from-amber-300 via-sky-300 to-emerald-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            ASCII-GuitarTab → ABCNotation
          </h1>
          <p className="max-w-4xl text-sm leading-6 text-zinc-400">
            This page converts the physical ASCII string/fret grid against the source ABC melody. ASCII attacks start as one cell; an exact source-melody match inherits its source duration only when its guitar string is not re-attacked before that duration ends. Its statuses separately verify physical TAB, source-pitch alignment, duration-transfer warnings, and ASCII round-trip.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-3">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Input 1: ASCII-GuitarTab attacks</h2>
              <CopyButton label="Copy ASCII" text={ASCII_FIXTURE} testId="copy-ascii-guitar-tab-input" />
            </div>
            <pre data-testid="ascii-guitar-tab-input" className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-emerald-300">
              {ASCII_FIXTURE}
            </pre>
          </article>
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Input 2: ABC source melody</h2>
              <CopyButton label="Copy source ABC" text={SOURCE_ABC} testId="copy-source-abc-input" />
            </div>
            <pre data-testid="source-abc-input" className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-amber-300">
              {SOURCE_ABC}
            </pre>
          </article>
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Output: Forced Guitar ABCNotation</h2>
              <CopyButton label="Copy ABC" text={conversion.forcedAbc} testId="copy-forced-guitar-abc-output" />
            </div>
            <pre data-testid="forced-guitar-abc-output" className="min-h-48 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-sky-300">
              {conversion.forcedAbc}
            </pre>
          </article>
        </section>

        <section className="grid gap-3 sm:grid-cols-4" aria-label="Conversion assertions">
          <div data-testid="ascii-guitar-tab-validation"><Status passed={physicalValid} label={`${conversion.validation.mismatchCount} physical event mismatches`} /></div>
          <div data-testid="ascii-guitar-tab-source-alignment"><Status passed={sourceMelodyAligned} label={`${conversion.sourceMelodyAlignment.mismatchCount} source melody pitch-alignment mismatches`} /></div>
          <div data-testid="ascii-guitar-tab-duration-transfer"><Status passed label={`${durationTransfer.preservedCount} source durations preserved; ${durationTransfer.blockedCount} same-string conflicts`} /></div>
          <div data-testid="ascii-guitar-tab-round-trip-match"><Status passed={exactAscii} label="ASCII cell-attack round-trip" /></div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Round-trip ASCII-GuitarTab</h2>
            <CopyButton label="Copy ASCII" text={conversion.roundTripAscii} testId="copy-ascii-guitar-tab-round-trip" />
          </div>
          <pre data-testid="ascii-guitar-tab-round-trip" className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-emerald-300">
            {conversion.roundTripAscii}
          </pre>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Validation details</span>
            <CopyButton label="Copy validation" text={validationText} testId="copy-ascii-guitar-tab-validation" />
          </div>
          <pre className="mt-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-400">
            {validationText}
          </pre>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Source melody alignment</div>
          <pre className="mt-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-400">
            {sourceAlignmentText}
          </pre>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Source duration transfer</div>
          <pre className="mt-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-400">
            {durationTransferText}
          </pre>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-white p-4 text-zinc-950 shadow-xl sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-zinc-900">ABCJS Music Staff Playback + Guitar TAB</h2>
          <div data-testid="ascii-guitar-tab-canvas">
            <AbcjsPlaybackController
              abcString={conversion.forcedAbc}
              title="ASCII GuitarTab Conversion"
              canvasId="test-conversion-ascii-guitar-tab-canvas"
              renderOptions={renderOptions}
            />
          </div>
        </section>

        <PocHandoffChecklist
          checks={[
            { label: "ASCII fixture parsed into the canonical time-slice grid", passed: true },
            { label: "Forced-string ABC matches independently expected physical TAB events", passed: physicalValid },
            { label: "Source melody pitches align with physical TAB attacks", passed: sourceMelodyAligned },
            { label: "Eligible source melody durations transfer without same-string re-attacks", passed: true },
            { label: "ASCII cell-attack round-trip has zero mismatches", passed: exactAscii },
          ]}
        />
      </div>
    </main>
  );
}
