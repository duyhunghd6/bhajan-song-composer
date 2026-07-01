interface PocHandoffCheck {
  label: string;
  passed: boolean;
}

interface PocHandoffChecklistProps {
  checks: PocHandoffCheck[];
}

export default function PocHandoffChecklist({ checks }: PocHandoffChecklistProps) {
  const allReady = checks.every((check) => check.passed);

  return (
    <section
      aria-label="Integration handoff checklist"
      className={`rounded-3xl border p-6 shadow-xl ${
        allReady
          ? "border-emerald-400/30 bg-emerald-500/10"
          : "border-rose-400/30 bg-rose-500/10"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Integration handoff checklist
          </p>
          <h2 className={`mt-2 text-2xl font-black ${allReady ? "text-emerald-300" : "text-rose-300"}`}>
            {allReady ? "Review-ready for Composer integration" : "Composer integration blocked"}
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            {allReady ? "Composer integration: unlocked" : "Composer integration: blocked"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            allReady
              ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
              : "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/30"
          }`}
        >
          {allReady ? "review-ready" : "blocked"}
        </span>
      </div>

      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/70 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-200">{check.label}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                check.passed
                  ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/30"
              }`}
            >
              {check.passed ? "pass" : "fail"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
