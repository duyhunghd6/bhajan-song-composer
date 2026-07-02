import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAllSongs } from "@/lib/songs/loader";
import ComposerStepShell from "@/components/composer/ComposerStepShell";
import ComposerStepWorkspace from "@/components/composer/ComposerStepWorkspace";
import { COMPOSER_STEPS, isComposerStepId } from "@/components/composer/composer-steps";

interface PageProps {
  params: Promise<{ slug: string; step: string }>;
}

export const metadata: Metadata = {
  title: "Composer Step — Bhajan Song Composer",
  description: "Route-based composer workstation step for focused bhajan arrangement editing.",
};

export async function generateStaticParams() {
  const songs = await loadAllSongs();
  const slugs = new Set(["new-bhajan-arrangement", ...songs.map((song) => song.meta.slug.toLowerCase())]);

  return Array.from(slugs).flatMap((slug) =>
    COMPOSER_STEPS.map((step) => ({
      slug,
      step: step.id,
    }))
  );
}

export default async function ComposeStepPage({ params }: PageProps) {
  const { slug, step } = await params;

  if (!isComposerStepId(step)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 transition-colors duration-300 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="transition-colors hover:text-amber-500">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/edit" className="transition-colors hover:text-amber-500">
            Catalogue Editor
          </Link>
          <span className="mx-2">/</span>
          <Link href="/compose" className="transition-colors hover:text-amber-500">
            Composer
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{slug}</span>
        </nav>

        <ComposerStepShell slug={slug} currentStep={step}>
          <ComposerStepWorkspace slug={slug} step={step} />
        </ComposerStepShell>
      </div>
    </main>
  );
}
