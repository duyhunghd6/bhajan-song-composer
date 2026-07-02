import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mockup Review Gate — Bhajan Song Composer",
  description:
    "Standalone proof-of-concept review gate for arrangement workflow integrations.",
};

interface MockupGate {
  title: string;
  unid: string;
  href?: string;
  status: "review-ready" | "not-ready";
  purpose: string;
}

const MOCKUP_GATES: MockupGate[] = [
  {
    title: "Arrangement Pipeline POC",
    unid: "br-plan-09.c02",
    href: "/mockups/arrangement",
    status: "review-ready",
    purpose:
      "Melody input, key/scale detection, strong-beat analysis, chords, accompaniment, full-track decisions, final preview, and validation.",
  },
  {
    title: "Fingerstyle Engine POC",
    unid: "br-plan-09.c03",
    href: "/mockups/fingerstyle",
    status: "review-ready",
    purpose:
      "Upward construction, downward compression, string routing, pruning, playability, fallback suggestions, matrix, preview, and visual events.",
  },
  {
    title: "Piano Accompaniment POC",
    unid: "br-plan-09.c04",
    href: "/mockups/piano",
    status: "review-ready",
    purpose:
      "Comping profile, bass anchoring, Low Interval Limit, right-hand voice leading, gap fills, validation, pedal automation, preview, and key highlights.",
  },
  {
    title: "Ensemble Expansion POC",
    unid: "br-plan-09.c05",
    href: "/mockups/ensemble",
    status: "review-ready",
    purpose:
      "Integration handshake, density grid, bass map, melodic gaps, Djembe, Flute/Violin yield states, conflicts, preview, and layer activity.",
  },
];

export default function MockupsPage() {
  const readyCount = MOCKUP_GATES.filter((gate) => gate.status === "review-ready").length;
  const allReady = readyCount === MOCKUP_GATES.length;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-6 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Mockup & POC Gate
            </span>
            <span className="font-mono text-xs text-zinc-500">UNID: br-plan-09.c01</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-zinc-50 sm:text-5xl">
                Mockup Review Gate
              </h1>
              <p className="max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
                Standalone POC pages must prove each major arrangement workflow before Composer integration starts. Every gate must show representative input, intermediate decisions, final artifact, and validation output end-to-end.
              </p>
            </div>

            <section
              aria-label="Integration gate status"
              className={`rounded-2xl border p-5 shadow-2xl ${
                allReady
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : "border-rose-400/30 bg-rose-500/10"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Gate status</p>
              <p className={`mt-2 text-2xl font-black ${allReady ? "text-emerald-300" : "text-rose-300"}`}>
                {allReady ? "Integration unlocked" : "Integration locked"}
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                {readyCount} of {MOCKUP_GATES.length} standalone POC gates review-ready
              </p>
            </section>
          </div>
        </header>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Required standalone POC pages</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Major workflow integration is blocked until every POC renders input, decisions, final artifact, and validation end-to-end.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900"
            >
              ← Back to catalogue
            </Link>
          </div>

          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {MOCKUP_GATES.map((gate) => {
              const isReady = gate.status === "review-ready";

              return (
                <li key={gate.unid} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100">{gate.title}</h3>
                      <p className="mt-1 font-mono text-xs text-zinc-500">{gate.unid}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        isReady
                          ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
                          : "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/30"
                      }`}
                    >
                      {isReady ? "Review-ready standalone POC" : "Not ready"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-400">{gate.purpose}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400">
                      {isReady ? "Standalone review available" : "Required before integration"}
                    </span>
                    {gate.href ? (
                      <Link
                        href={gate.href}
                        className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300"
                      >
                        Open standalone POC
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
