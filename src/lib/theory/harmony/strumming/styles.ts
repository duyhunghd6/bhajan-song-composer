export const STRUMMING_STYLES = [
  { id: 'waltz', label: 'Waltz (Valse)', meters: ['3/4'], description: 'Triple-time bass and light strokes, with a clipped ending.' },
  { id: 'blues', label: 'Blues', meters: ['4/4'], description: 'Straight blues: palm-muted bass, upstrokes and dead/slap backbeats.' },
  { id: 'slow-rock', label: 'Slow Rock', meters: ['6/8', '12/8'], description: 'Compound pulse with a string slap on the second main beat.' },
  { id: 'bolero', label: 'Bolero', meters: ['4/4', '2/4'], description: 'Bass-led syncopation, muted strokes and an end-of-bar choke.' },
  { id: 'ballad', label: 'Ballad', meters: ['4/4', '3/4', '6/8'], description: 'Gentle support with deliberate rests and restrained muted hits.' },
  { id: 'folk', label: 'Folk', meters: ['4/4', '2/4'], description: 'Down/up strokes with dead-strum and slap backbeats, then a choke.' },
  { id: 'bossa-nova', label: 'Bossa Nova', meters: ['4/4', '2/4'], description: 'Bass and syncopated short chords; quiet choke gaps, no heavy slap.' },
] as const;
export type StrummingStyleId = typeof STRUMMING_STYLES[number]['id'];
export const STRUMMING_VARIANTS = [
  { label: 'Classic', description: 'The characteristic groove.', gate: 1, volume: 76 },
  { label: 'Gentle', description: 'Softer upper-string chords.', gate: 1, volume: 54 },
  { label: 'Crisp', description: 'Palm-muted downstrokes and short, separated chords.', gate: 0.5, volume: 72 },
  { label: 'Bass & chord', description: 'Alternate bass notes and chord strokes.', gate: 1, volume: 78 },
  { label: 'Offbeat lift', description: 'Lighter, clipped upstrokes around the groove’s muted hits.', gate: 0.75, volume: 70 },
  { label: 'Spacious', description: 'Fewer attacks and longer breathing spaces.', gate: 0.75, volume: 64 },
  { label: 'Full', description: 'Full downstrokes, bright upstrokes and stronger percussive accents.', gate: 1, volume: 94 },
] as const;
