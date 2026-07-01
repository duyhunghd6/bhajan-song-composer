export type FrettingFinger = 1 | 2 | 3 | 4;

export const MAX_FRET_STRETCH = 5;

export function frettingFingerForFret(fret: number): FrettingFinger | null {
  if (fret === 0) return null;
  if (fret <= 2) return 1;
  if (fret <= 4) return 2;
  if (fret <= MAX_FRET_STRETCH) return 3;
  return 4;
}

export function isFretPlayable(fret: number): boolean {
  return fret <= MAX_FRET_STRETCH;
}
