export const COMPOSER_PUBLISHED_NOTATION_TYPES = [
  "melody",
  "harmony",
  "accompaniment",
  "guitar-fingerstyle",
] as const;

export type ComposerPublishedNotationType = (typeof COMPOSER_PUBLISHED_NOTATION_TYPES)[number];

export const COMPOSER_PUBLISHED_NOTATION_LABELS: Record<ComposerPublishedNotationType, string> = {
  melody: "Melody Music Sheet",
  harmony: "Validated Harmony",
  accompaniment: "Accompaniment Arrangement",
  "guitar-fingerstyle": "Guitar Fingerstyle",
};

export function isComposerPublishedNotationType(value: string): value is ComposerPublishedNotationType {
  return COMPOSER_PUBLISHED_NOTATION_TYPES.includes(value as ComposerPublishedNotationType);
}

export function getPracticeNotationPriority(type: string): number {
  const priority: Record<string, number> = {
    accompaniment: 0,
    "guitar-fingerstyle": 1,
    harmony: 2,
    melody: 3,
  };
  return priority[type] ?? Number.MAX_SAFE_INTEGER;
}
