export const COMPOSER_STEPS = [
  {
    id: "melody",
    number: 1,
    label: "Melody",
    title: "Step 1: Melody Input",
    focus: "Inputting the foundational Treble Clef ABC notation.",
    backLabel: "Back to Metadata",
    nextLabel: "Save & Harmonize",
  },
  {
    id: "harmony",
    number: 2,
    label: "Harmony",
    title: "Step 2: Harmonization",
    focus: "Generate and review chord progressions against the melody.",
    backLabel: "Back to Melody",
    nextLabel: "Save & Add Accompaniment",
  },
  {
    id: "accompaniment",
    number: 3,
    label: "Accompaniment",
    title: "Step 3: Accompaniment",
    focus: "Generate piano accompaniment or guitar fingerstyle from the harmonized melody.",
    backLabel: "Back to Harmony",
    nextLabel: "Save & Add Ensemble",
  },
  {
    id: "ensemble",
    number: 4,
    label: "Ensemble",
    title: "Step 4: Ensemble Expansion",
    focus: "Layer Djembe, Flute, and Violin support above the accompaniment.",
    backLabel: "Back to Accompaniment",
    nextLabel: "Save & Review",
  },
  {
    id: "review",
    number: 5,
    label: "Review",
    title: "Step 5: Review & Export",
    focus: "Review the final arrangement and export markdown for contribution.",
    backLabel: "Back to Ensemble",
    nextLabel: "Export Markdown/PR",
  },
] as const;

export type ComposerStepId = (typeof COMPOSER_STEPS)[number]["id"];

export function isComposerStepId(step: string): step is ComposerStepId {
  return COMPOSER_STEPS.some((candidate) => candidate.id === step);
}

export function getComposerStep(step: ComposerStepId) {
  return COMPOSER_STEPS.find((candidate) => candidate.id === step) ?? COMPOSER_STEPS[0];
}

export function getComposerStepIndex(step: ComposerStepId) {
  return COMPOSER_STEPS.findIndex((candidate) => candidate.id === step);
}

export function getPreviousComposerStep(step: ComposerStepId): ComposerStepId | null {
  const index = getComposerStepIndex(step);
  return index > 0 ? COMPOSER_STEPS[index - 1].id : null;
}

export function getNextComposerStep(step: ComposerStepId): ComposerStepId | null {
  const index = getComposerStepIndex(step);
  return index >= 0 && index < COMPOSER_STEPS.length - 1 ? COMPOSER_STEPS[index + 1].id : null;
}

export function getComposerStepHref(slug: string, step: ComposerStepId) {
  return `/compose/${slug}/${step}`;
}
