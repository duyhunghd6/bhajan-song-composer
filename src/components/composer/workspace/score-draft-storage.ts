import { fingerprintAccompanimentSource } from '@/lib/theory/accompaniment-workflow';

export function serializeScoreHarmonyDraft(abc: string, melody: string, harmonySource: string): string {
  return JSON.stringify({ abc, melodyFingerprint: fingerprintAccompanimentSource(melody), sourceFingerprint: fingerprintAccompanimentSource(harmonySource) });
}
export function restoreScoreHarmonyDraft(serialized: string | null, melody: string, harmonySource: string): string | null {
  try {
    const saved = JSON.parse(serialized ?? 'null');
    return saved?.melodyFingerprint === fingerprintAccompanimentSource(melody) && saved?.sourceFingerprint === fingerprintAccompanimentSource(harmonySource) && typeof saved.abc === 'string' ? saved.abc : null;
  } catch { return null; }
}
