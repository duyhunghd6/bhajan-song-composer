import { strummingPattern, normalizeStrummingTechniques, type OptionalStrummingTechnique, type StrummingTechnique } from './patterns';
import type { GuitarStringNumber } from '../../fingerstyle-compressor';
import { buildGuitarChordScore } from '../../guitar-chord-score';
import { extractAbcVoiceIds } from '../../abc-layer-visibility';
import type { VoicingOverride } from '../../voicing-override';
import { buildHarmonyTimeGrid, type HarmonyTimeGrid } from '../time-grid';
import { renderStrummingAbc } from './abc';
import { STRUMMING_STYLES, STRUMMING_VARIANTS, type StrummingStyleId } from './styles';
export { STRUMMING_STYLES, STRUMMING_VARIANTS, type StrummingStyleId } from './styles';

export { OPTIONAL_STRUMMING_TECHNIQUES, normalizeStrummingTechniques, type OptionalStrummingTechnique } from './patterns';

export interface StrummingSelection { sourceAbc: string; styleId: StrummingStyleId; variant: number; techniques?: OptionalStrummingTechnique[] }
export interface StrummingEvent {
  measureIndex: number;
  /** Exact whole-note timing; fractional grid positions are never rounded. */
  onset: number;
  duration: number;
  step: number;
  durationSteps: number;
  chord: string;
  direction: 'down' | 'up';
  velocity: number;
  technique: StrummingTechnique;
  notes: { string: GuitarStringNumber; fret: number; midi: number }[];
}
export interface StrummingCandidate {
  selection: StrummingSelection;
  label: string;
  description: string;
  abc: string;
  timeGrid: HarmonyTimeGrid & { strumming: { version: 2; styleId: StrummingStyleId; variant: number; techniques: OptionalStrummingTechnique[]; events: StrummingEvent[] } };
}

export function currentStrummingSelection(value: StrummingSelection | null | undefined, sourceAbc: string): StrummingSelection | null {
  return value?.sourceAbc === sourceAbc && STRUMMING_STYLES.some(style => style.id === value.styleId)
    && Number.isInteger(value.variant) && value.variant >= 0 && value.variant < 7 ? value : null;
}

export function generateStrummingCandidates(sourceAbc: string, styleId: StrummingStyleId, overrides: readonly VoicingOverride[] = [], allowedTechniques?: readonly OptionalStrummingTechnique[]): StrummingCandidate[] {
  const techniques = normalizeStrummingTechniques(allowedTechniques);
  const style = STRUMMING_STYLES.find(item => item.id === styleId);
  if (!style) throw new Error('Choose an accompaniment style.');
  const grid = buildHarmonyTimeGrid(sourceAbc);
  if (!grid.timeline.length) throw new Error('The selected harmony contains no measures.');
  if (extractAbcVoiceIds(sourceAbc).length > 1) throw new Error('Choose a single melody with validated chords in Step 3.');
  const meters = new Set(grid.timeline.map(measure => measure.meter));
  if (meters.size > 1 || ![...meters].every(meter => (style.meters as readonly string[]).includes(meter))) {
    throw new Error(`${style.label} supports ${style.meters.join(', ')}. The melody meter is preserved; choose a compatible style.`);
  }
  if (new Set(grid.timeline.map(measure => measure.key)).size > 1) throw new Error('Strumming currently requires a single key signature.');
  if (grid.timeline.some(measure => measure.events.some(event => sourceAbc.slice(0, event.startChar).split('\n').length - 1 !== grid.measures[measure.measureIndex].lineIndex))) {
    throw new Error('Keep each measure on one ABC music line before generating strumming.');
  }
  const score = buildGuitarChordScore(sourceAbc, sourceAbc, overrides);
  if (!score.occurrences.length) throw new Error('Select harmony with chord symbols in Step 3 first.');
  const unavailable = score.occurrences.find(item => !item.selected);
  if (unavailable) throw new Error(`No playable guitar shape is available for ${unavailable.symbol}. Change that chord before generating.`);
  return STRUMMING_VARIANTS.map((variant, variantIndex) => {
    const events: StrummingEvent[] = [];
    for (const measure of grid.timeline) {
      const denominator = Number(measure.meter.split('/')[1]);
      const stepsPerWhole = denominator * 4;
      const pattern = strummingPattern(styleId, measure.meter, variantIndex).map(gesture => {
        if (gesture.technique === 'strum' || gesture.technique === 'rest' || techniques.includes(gesture.technique)) return gesture;
        // Keep rhythmic slots and silence intact; disabled pitched effects become ordinary strokes.
        return { ...gesture, technique: (gesture.technique === 'bass' || gesture.technique === 'palm-mute' ? 'strum' : 'rest') as StrummingTechnique };
      });
      const plannedGestures = pattern.map(gesture => ({ ...gesture, onset: gesture.step / stepsPerWhole - measure.pickupOffset }));
      const gestures = plannedGestures.filter(gesture => gesture.onset >= -1e-7 && gesture.onset < measure.duration - 1e-7);
      // Chord changes terminate sounding notes, but never override an authored
      // rest/mute window by injecting an unwanted chord attack.
      const changes = measure.events.filter(event => event.chords.length).map(event => event.onset);
      for (const onset of [0, ...changes]) {
        if (gestures.some(event => Math.abs(event.onset - onset) < 1e-7)) continue;
        const previous = gestures.filter(event => event.onset < onset).at(-1) ?? plannedGestures.filter(event => event.onset < onset).at(-1);
        const technique = previous && ['rest', 'choke', 'dead-strum', 'slap'].includes(previous.technique) ? 'rest' : 'strum';
        gestures.push({ step: onset * stepsPerWhole, onset, technique, direction: 'down', gate: 1 });
        gestures.sort((a, b) => a.onset - b.onset);
      }
      gestures.forEach((gesture, attackIndex) => {
        const { onset, direction, technique } = gesture;
        const beat = 1 + onset * denominator;
        const occurrence = score.occurrences.filter(item => item.measureIndex < measure.measureIndex || item.measureIndex === measure.measureIndex && item.beat <= beat + 1e-6).at(-1);
        const shape = occurrence?.selected;
        let notes = shape?.frets.flatMap((fret, index) => typeof fret === 'number' ? [{ string: (6 - index) as GuitarStringNumber, fret, midi: [40, 45, 50, 55, 59, 64][index] + fret }] : []) ?? [];
        const silent = ['rest', 'choke', 'dead-strum', 'slap'].includes(technique);
        if (silent) notes = [];
        else if (technique === 'bass') notes = notes.slice(0, 1);
        else if (direction === 'up' || variantIndex === 1) notes = notes.slice(-3);
        else if (variantIndex !== 6) notes = notes.slice(0, Math.min(4, notes.length));
        // Preserve physical string order, including doubled pitches on different strings.
        notes.sort((a, b) => direction === 'up' ? a.string - b.string : b.string - a.string);
        const next = gestures[attackIndex + 1]?.onset ?? measure.duration;
        const gate = silent ? 1 : Math.min(gesture.gate, variant.gate, technique === 'palm-mute' ? 0.4 : 1);
        const duration = (next - onset) * gate;
        const velocity = Math.round(variant.volume * (direction === 'up' ? 0.78 : technique === 'palm-mute' ? 0.72 : 1));
        events.push({ measureIndex: measure.measureIndex, onset, duration, step: onset * stepsPerWhole + 1,
          durationSteps: duration * stepsPerWhole, chord: occurrence?.symbol ?? '', notes,
          direction, technique: !shape && !silent ? 'rest' : technique, velocity });
      });
    }
    const timeGrid: StrummingCandidate['timeGrid'] = { ...grid,
      measures: grid.measures.map(measure => ({ ...measure, style_profile: { ...measure.style_profile, comping_style: style.id },
        grid: measure.grid.map(step => ({ ...step, tablature: events.filter(event => event.measureIndex === measure.measure - 1 && Math.abs(event.step - step.step) < 1e-7)
          .flatMap(event => event.notes.map(note => ({ string: note.string, fret: note.fret, finger: null, role: 'harmony' as const, durationSteps: event.durationSteps }))) })) })),
      strumming: { version: 2, styleId, variant: variantIndex, techniques, events } };
    return { selection: { sourceAbc, styleId, variant: variantIndex, techniques }, label: `${variantIndex + 1}. ${variant.label}`,
      description: variantIndex === 2 && !techniques.includes('palm-mute') ? 'Short, separated chords with ordinary downstrokes.' : variantIndex === 3 && !techniques.includes('bass') ? 'Chord strokes in place of bass picking.' : variant.description, timeGrid, abc: renderStrummingAbc(grid, events) };
  });
}
