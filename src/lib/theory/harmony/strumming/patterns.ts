import type { StrummingStyleId } from './styles';

export type StrummingTechnique = 'strum' | 'bass' | 'palm-mute' | 'dead-strum' | 'slap' | 'choke' | 'rest';
export const OPTIONAL_STRUMMING_TECHNIQUES = [
  { id: 'bass', label: 'Bass picking', description: 'Pick an individual bass string.' },
  { id: 'palm-mute', label: 'Palm mute', description: 'Dampen pitched strokes with the picking-hand palm.' },
  { id: 'dead-strum', label: 'Dead strum', description: 'Brush muted strings for a percussive click.' },
  { id: 'slap', label: 'String slap', description: 'Hit the strings for a rhythmic accent.' },
  { id: 'choke', label: 'Choke', description: 'Stop ringing strings at marked points.' },
] as const;
export type OptionalStrummingTechnique = typeof OPTIONAL_STRUMMING_TECHNIQUES[number]['id'];
/** Missing settings preserve older arrangements; an empty list enables no extras. */
export function normalizeStrummingTechniques(value?: readonly OptionalStrummingTechnique[]): OptionalStrummingTechnique[] {
  return OPTIONAL_STRUMMING_TECHNIQUES.map(item => item.id).filter(id => value === undefined || value.includes(id));
}
export interface StrummingGesture {
  /** Zero-based subdivisions: four steps per notated beat. */
  step: number;
  technique: StrummingTechnique;
  direction: 'down' | 'up';
  gate: number;
}
const d = (step: number, gate = 1): StrummingGesture => ({ step, technique: 'strum', direction: 'down', gate });
const u = (step: number, gate = 1): StrummingGesture => ({ step, technique: 'strum', direction: 'up', gate });
const t = (step: number, technique: StrummingTechnique): StrummingGesture => ({ step, technique, direction: 'down', gate: 1 });

// Authored accompaniment examples, not universal definitions of the genres.
// Triple/compound meters have their own gestures rather than cropped 4/4 loops.
const PATTERNS: Record<StrummingStyleId, Record<string, StrummingGesture[]>> = {
  waltz: { '3/4': [t(0, 'bass'), d(4), t(7, 'choke'), u(8), t(11, 'rest')] },
  blues: { '4/4': [t(0, 'palm-mute'), u(2), t(4, 'dead-strum'), u(6), t(8, 'palm-mute'), u(10), t(12, 'slap'), t(14, 'rest')] },
  'slow-rock': { '6/8': [t(0, 'bass'), t(4, 'palm-mute'), u(8), t(12, 'slap'), u(16), d(20), t(23, 'choke')] },
  bolero: {
    '2/4': [t(0, 'bass'), u(3), t(4, 'dead-strum'), u(6), t(7, 'choke')],
    '4/4': [t(0, 'bass'), u(3), t(4, 'dead-strum'), u(6), t(8, 'bass'), u(11), t(12, 'palm-mute'), u(14), t(15, 'choke')],
  },
  ballad: {
    '3/4': [t(0, 'bass'), u(4), t(6, 'rest'), d(8), t(10, 'choke')],
    '4/4': [d(0), t(4, 'dead-strum'), u(6), d(8), t(10, 'rest'), t(12, 'slap'), u(14), t(15, 'choke')],
    '6/8': [d(0), u(4), t(8, 'rest'), t(12, 'dead-strum'), u(16), t(20, 'choke')],
  },
  folk: {
    '2/4': [d(0), t(4, 'dead-strum'), u(6), t(7, 'rest')],
    '4/4': [d(0), t(4, 'dead-strum'), u(6), t(8, 'rest'), u(10), t(12, 'slap'), u(14), t(15, 'choke')],
  },
  'bossa-nova': {
    '2/4': [t(0, 'bass'), u(3), t(5, 'choke'), d(6, 0.65)],
    '4/4': [t(0, 'bass'), u(3), t(5, 'choke'), d(6), t(8, 'bass'), u(11), t(13, 'choke'), d(14, 0.65)],
  },
};
export function strummingPattern(style: StrummingStyleId, meter: string, variant: number): StrummingGesture[] {
  const base = style === 'slow-rock' && meter === '12/8'
    ? [...PATTERNS[style]['6/8'], ...PATTERNS[style]['6/8'].map(event => ({ ...event, step: event.step + 24 }))]
    : PATTERNS[style][meter];
  if (!base) throw new Error(`No ${style} pattern for ${meter}.`);
  return base.map((event, index) => {
    // Rests, choke points and percussive hits are protected from density variants.
    if (!['strum', 'bass', 'palm-mute'].includes(event.technique)) return { ...event };
    if (variant === 2 && event.technique === 'strum' && event.direction === 'down') return { ...event, technique: 'palm-mute' };
    if (variant === 3 && (index === 0 || index === base.findIndex(item => item.direction === 'up'))) return { ...event, technique: 'bass', direction: 'down' };
    if (variant === 5 && event.direction === 'up') return { ...event, technique: 'rest' };
    if (variant === 4 && event.technique === 'strum') return { ...event, gate: Math.min(event.gate, 0.65) };
    return { ...event };
  });

}
