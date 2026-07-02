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
    <div className="grid gap-6 md:grid-cols-[30%_70%] lg:grid-cols-[20%_80%]">
      <aside className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 p-5 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Layers & Navigation
          </p>
          <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Composer Steps
          </h2>
          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Draft slug: <span className="font-mono">{slug}</span>
          </p>
        </div>

        <nav aria-label="Composer step progress" className="p-4">
          <ol className="space-y-2">
            <li className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              [✓] Metadata
            </li>
            {COMPOSER_STEPS.map((candidate, index) => {
              const marker = index < currentIndex ? "[✓]" : candidate.id === currentStep ? "[▶]" : "[ ]";
              const isCurrent = candidate.id === currentStep;

              return (
                <li key={candidate.id}>
                  <Link
                    href={getComposerStepHref(slug, candidate.id)}
                    className={`block rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      isCurrent
                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-amber-200 hover:text-amber-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400 dark:hover:border-amber-900 dark:hover:text-amber-300"
                    }`}
                  >
                    {marker} {candidate.number}. {candidate.label}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="border-t border-zinc-100 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <h3 className="font-bold uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">
            Track States
          </h3>
          <ul className="mt-3 space-y-2">
            <li>Melody {currentIndex >= 0 ? "(Active)" : "(Pending)"}</li>
            <li>Harmony {currentIndex >= 1 ? "(Background)" : "(Pending)"}</li>
            <li>Accompaniment {currentIndex >= 2 ? "(Background)" : "(Pending)"}</li>
            <li>Ensemble {currentIndex >= 3 ? "(Background)" : "(Pending)"}</li>
          </ul>
        </section>
      </aside>

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
