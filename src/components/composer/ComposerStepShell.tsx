import Link from "next/link";
import type { ReactNode } from "react";
import {
  COMPOSER_STEPS,
  type ComposerStepId,
  getComposerStep,
  getComposerStepHref,
  getNextComposerStep,
  getPreviousComposerStep,
} from "./composer-steps";

interface ComposerStepShellProps {
  slug: string;
  currentStep: ComposerStepId;
  children: ReactNode;
}

export default function ComposerStepShell({ slug, currentStep, children }: ComposerStepShellProps) {
  const step = getComposerStep(currentStep);
  const previousStep = getPreviousComposerStep(currentStep);
  const nextStep = getNextComposerStep(currentStep);
  const currentIndex = COMPOSER_STEPS.findIndex((candidate) => candidate.id === currentStep);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Layers & Navigation
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Draft slug: <span className="font-mono">{slug}</span>
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                Metadata saved
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {currentIndex + 1} of {COMPOSER_STEPS.length}: {step.label}
          </p>
        </div>

        <nav aria-label="Composer step progress" className="mt-4">
          <ol className="grid gap-2 sm:grid-cols-5">
            {COMPOSER_STEPS.map((candidate, index) => {
              const isComplete = index < currentIndex;
              const isCurrent = candidate.id === currentStep;
              const stateLabel = isComplete ? "Complete" : isCurrent ? "Current" : "Pending";

              return (
                <li key={candidate.id} className="min-w-0">
                  <Link
                    href={getComposerStepHref(slug, candidate.id)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      isCurrent
                        ? "border-amber-300 bg-amber-50 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-amber-200 hover:text-amber-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400 dark:hover:border-amber-900 dark:hover:text-amber-300"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        isCurrent
                          ? "bg-amber-500 text-white"
                          : isComplete
                            ? "bg-emerald-500 text-white"
                            : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                      aria-hidden="true"
                    >
                      {isComplete ? "✓" : candidate.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{candidate.label}</span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">
                        {stateLabel}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </section>

      <section className="min-w-0 space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <header className="space-y-2 border-b border-zinc-100 pb-5 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Main Workspace Canvas
          </p>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {step.focus}
          </p>
        </header>

        {children}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <Link
            href={previousStep ? getComposerStepHref(slug, previousStep) : "/compose"}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {step.backLabel}
          </Link>
          {nextStep ? (
            <Link
              href={getComposerStepHref(slug, nextStep)}
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
            >
              {step.nextLabel}
            </Link>
          ) : (
            <Link
              href="/edit"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              {step.nextLabel}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
