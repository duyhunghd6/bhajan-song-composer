import { buildAbcDurationContext } from '../abc-duration';
import { assignActiveChordsToMelodyNotes, extractInlineChordEventsByMelodyMeasure } from '../fingerstyle-arranger/melody-chord-timeline';

/** Shared deterministic Step 3 timeline contract for generated and manually edited candidates. */
export function validateHarmonyTimelineAbc(abc: string): string[] {
  if (!extractInlineChordEventsByMelodyMeasure(abc).flat().length) return ['has no valid inline chord events.'];
  const meter = buildAbcDurationContext(abc).meter;
  return assignActiveChordsToMelodyNotes(abc).flatMap((item) => {
    const strong = Math.abs(item.beat - 1) < 0.001 || meter.numerator === 4 && meter.denominator === 4 && Math.abs(item.beat - 3) < 0.001;
    return strong && !item.chord ? [`measure ${item.measureIndex + 1} beat ${item.beat} note ${item.token} has no active chord.`] : [];
  });
}
