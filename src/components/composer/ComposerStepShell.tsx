import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./workspace/harmony.module.css";
import { COMPOSER_STEPS, type ComposerStepId, getComposerStepHref } from "./composer-steps";

interface ComposerStepShellProps {
  slug: string;
  currentStep: ComposerStepId;
  children: ReactNode;
}

export default function ComposerStepShell({ slug, currentStep, children }: ComposerStepShellProps) {
  return (
    <div className={styles.shell}>
      <nav aria-label="Composer step progress" className="overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        <ol className="flex min-w-max gap-2 sm:gap-6">
          {COMPOSER_STEPS.map((candidate) => (
            <li key={candidate.id}>
              <Link
                href={getComposerStepHref(slug, candidate.id)}
                aria-current={candidate.id === currentStep ? "step" : undefined}
                className={`flex min-h-12 items-center gap-2 border-b-2 px-2 text-sm transition-colors ${candidate.id === currentStep ? "border-amber-500 font-semibold text-amber-600 dark:text-amber-400" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
              >
                <span className="text-xs opacity-60">{candidate.number}</span>{candidate.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      {children}
    </div>
  );
}
