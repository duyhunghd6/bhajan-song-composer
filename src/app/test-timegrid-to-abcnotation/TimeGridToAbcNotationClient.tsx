"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { groupMeasuresByLine } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { runSourceTimeGridConversionDiagnostic } from "@/lib/theory/fingerstyle-arranger/melody-time-grid-round-trip";

const AbcjsPlaybackController = dynamic(
  () => import("@/components/music-sheet/AbcjsPlaybackController"),
  { ssr: false },
);

const guitarRenderOptions = {
  tablature: [{
    instrument: "guitar" as const,
    label: "",
    tuning: ["E,,", "A,,", "D,", "G,", "B,", "E"],
    capo: 0,
    hideTabSymbol: false,
  }],
};

interface Props {
  sourceAbc: string;
}

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
    <button type="button" data-testid={testId} onClick={handleCopy} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-sky-400 hover:text-sky-300">
      {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : label}
    </button>
  );
}

function DownloadJsonButton({ text, testId }: { text: string; testId: string }) {
  const download = useCallback(() => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "timegrid-document.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [text]);

  return <button type="button" data-testid={testId} onClick={download} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-sky-400 hover:text-sky-300">Download v3 JSON</button>;
}

function Status({ passed, label, testId }: { passed: boolean; label: string; testId: string }) {
  return (
    <div data-testid={testId} className={`rounded-xl border px-4 py-3 ${passed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
      <span className="mr-2 font-bold">{passed ? "PASS" : "FAIL"}</span>{label}
    </div>
  );
}

function CodePanel({ title, text, copyLabel, testId, color = "text-zinc-300" }: {
  title: string;
  text: string;
  copyLabel: string;
  testId: string;
  color?: string;
}) {
  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <CopyButton label={copyLabel} text={text} testId={`copy-${testId}`} />
      </div>
      <pre data-testid={testId} className={`max-h-[32rem] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 ${color}`}>{text}</pre>
    </article>
  );
}

function GridLine({ measures }: { measures: ReturnType<typeof runSourceTimeGridConversionDiagnostic>["document"]["measures"] }) {
  return (
    <div className="space-y-4">
      {measures.map(measure => (
        <article key={measure.measure} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">Measure {measure.measure}</span>
            <span>{measure.grid.length} steps · {measure.pickupDurationUnits ? `pickup ${measure.pickupDurationUnits} units` : "full measure"}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-16">
            {measure.grid.map((step, index) => {
              const tab = step.tablature?.[0];
              const tone = step.melody.state === "attack"
                ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                : step.melody.state === "sustain"
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
                  : "border-zinc-800 bg-zinc-900 text-zinc-500";
              return (
                <div key={step.step} className={`min-w-0 rounded-lg border p-2 font-mono text-[10px] leading-4 ${tone}`}>
                  <div className="text-zinc-500">{index + 1}</div>
                  <div className="truncate font-semibold">{step.melody.pitch ?? "rest"}</div>
                  <div className="text-[9px] uppercase opacity-70">{step.melody.state}</div>
                  {tab && <div className="mt-1 text-[9px] text-emerald-300">s{tab.string} f{tab.fret} ×{tab.durationSteps}</div>}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function TimeGridToAbcNotationClient({ sourceAbc }: Props) {
  const result = useMemo(() => runSourceTimeGridConversionDiagnostic(sourceAbc), [sourceAbc]);
  const groupedLines = useMemo(() => groupMeasuresByLine(result.document.measures), [result.document.measures]);
  const physicsValid = result.unmappableAttacks.length === 0 && result.physicsValidation.every(validation => validation.valid);
  const guitarProjectionValid = result.unmappableAttacks.length === 0 && result.generatedGuitarValidation.valid;
  const physicsIssues = result.physicsValidation.flatMap((validation, index) => validation.issues.map(issue => `Measure ${index + 1}, step ${issue.step ?? "?"}: ${issue.message}`));

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-10">
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-300">Canonical TimeGrid Diagnostic</span>
            <div className="flex gap-2">
              <Link href="/test-conversion-ascii-guitar-tab" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">ASCII Conversion →</Link>
              <Link href="/test-tab" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">Tablature Gallery →</Link>
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-violet-300 via-sky-300 to-emerald-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">ABCNotation → TimeGrid → Guitar ABC</h1>
          <p className="max-w-4xl text-sm leading-6 text-zinc-400">
            The saved Ganesha ABC is retained verbatim as the immutable import document, then compiled into the meter-aware canonical TimeGrid. The TimeGrid produces a separate forced-string Guitar ABC projection. Exact source identity and physical Guitar-ABC validation are intentionally separate contracts.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Conversion assertions">
          <Status testId="time-grid-source-exact-match" passed={result.sourceExactMatch} label="Original ABC re-emitted exactly" />
          <Status testId="time-grid-compiled" passed={result.document.measures.length > 0} label={`${result.document.measures.length} meter-aware measures compiled`} />
          <Status testId="time-grid-physics" passed={physicsValid} label="Physical TimeGrid validation" />
          <Status testId="time-grid-guitar-abc" passed={guitarProjectionValid} label="Generated Guitar ABC matches grid" />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <CodePanel title="Input: original saved Ganesha ABC" text={sourceAbc} copyLabel="Copy source" testId="time-grid-source-abc" color="text-amber-300" />
          <CodePanel title="Output: exact re-emitted source ABC" text={result.reEmittedSourceAbc} copyLabel="Copy exact output" testId="time-grid-reemitted-source-abc" color="text-emerald-300" />
        </section>

        <section className="space-y-3">
          <p className="text-sm text-zinc-400">One canonical, human/AI-readable and parseable TimeGrid document. The shared sheet style is at the root; only section-specific changes appear in <code>styleOverrides</code>.</p>
          <CodePanel title="Output: TimeGrid document" text={result.timeGridDocument} copyLabel="Copy TimeGrid JSON" testId="time-grid-document-output" color="text-sky-300" />
          <DownloadJsonButton text={result.timeGridDocument} testId="download-time-grid-document" />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Line-by-line canonical TimeGrid</h2>
              <p className="mt-1 text-sm text-zinc-400">{groupedLines.length} visual Melody lines · {result.document.measures.length} measures · {result.mappings.length} physical melody mappings</p>
            </div>
            <span className="text-xs text-zinc-500">Amber = attack · blue = sustain · green = physical TimeGrid event</span>
          </div>
          <div className="mt-6 space-y-6">
            {groupedLines.map((line, index) => (
              <div key={line[0]?.lineIndex ?? index}>
                <h3 className="mb-3 text-sm font-semibold text-violet-200">[V:Melody] line {index + 1} · measures {line[0]?.measure}–{line.at(-1)?.measure}</h3>
                <GridLine measures={line} />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <CodePanel title="Output: generated forced-string Guitar ABC" text={result.standaloneGeneratedGuitarAbc} copyLabel="Copy Guitar ABC" testId="time-grid-guitar-abc-output" color="text-violet-300" />
          <article className="rounded-3xl border border-zinc-800 bg-white p-4 text-zinc-950 shadow-xl sm:p-6">
            <h2 className="mb-4 text-lg font-bold">Generated Guitar notation + TAB</h2>
            <div data-testid="time-grid-guitar-canvas">
              <AbcjsPlaybackController abcString={result.standaloneGeneratedGuitarAbc} title="Ganesha Canonical TimeGrid Guitar" canvasId="test-timegrid-guitar-canvas" renderOptions={guitarRenderOptions} />
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <h2 className="text-lg font-bold">Conversion diagnostics</h2>
          <pre data-testid="time-grid-diagnostics" className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-400">
            Source identity: {result.sourceExactMatch ? "exact string match" : "mismatch"}
            {"\n"}Physical mappings: {result.mappings.length}; unmappable melody attacks: {result.unmappableAttacks.length}
            {result.unmappableAttacks.map(attack => `\nUnmappable: measure ${attack.measure}, step ${attack.stepIndex + 1}, ${attack.pitch}`).join("")}
            {"\n\n"}Physics issues: {physicsIssues.length}
            {physicsIssues.map(issue => `\n${issue}`).join("")}
            {"\n\n"}Generated Guitar ABC: {result.generatedGuitarValidation.valid ? "valid" : `${result.generatedGuitarValidation.mismatchCount} mismatch(es)`}
            {result.generatedGuitarValidation.mismatches.map(mismatch => `\n${mismatch.message}`).join("")}
          </pre>
        </section>
      </div>
    </main>
  );
}
