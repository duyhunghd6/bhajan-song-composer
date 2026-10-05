import { Note } from '@tonaljs/tonal';
import type { TimeSliceMeasure, TimeSliceGridStep } from '../fingerstyle-arranger/time-slice';
import { buildMetricTimeline, type MetricMeasure } from './metric-timeline';

export interface HarmonyTimeGrid {
  /** Derived analysis only; the selected Step 3 remains the Guitar branch source. */
  sourceAbc: string;
  measures: TimeSliceMeasure[];
  timeline: MetricMeasure[];
  diagnostics: string[];
}

/** Reuses the existing four-steps-per-notated-beat TimeGrid contract for harmonic analysis. */
export function buildHarmonyTimeGrid(sourceAbc: string): HarmonyTimeGrid {
  const timeline = buildMetricTimeline(sourceAbc);
  const diagnostics: string[] = [];
  let carriedChord = '';
  const measures = timeline.map(measure => {
    const denominator = Number(measure.meter.split('/')[1]);
    const stepsPerWhole = denominator * 4;
    const count = Math.round(measure.expectedDuration * stepsPerWhole);
    const pickupSteps = measure.pickupOffset * stepsPerWhole;
    const strongByStep = new Map(measure.strongBeats.map(b => [Math.round(b.onset * stepsPerWhole), b.weight]));
    if (measure.events.some(e => Math.abs(e.onset * stepsPerWhole - Math.round(e.onset * stepsPerWhole)) > 1e-6 || Math.abs(e.duration * stepsPerWhole - Math.round(e.duration * stepsPerWhole)) > 1e-6)) {
      diagnostics.push(`Measure ${measure.measureIndex + 1}: sub-grid rhythms are sampled; exact timing is retained in timeline.`);
    }
    const grid: TimeSliceGridStep[] = Array.from({ length: count }, (_, index) => {
      const onset = index / stepsPerWhole;
      const event = measure.events.find(e => e.onset <= onset + 1e-7 && e.onset + e.duration > onset + 1e-7);
      const changes = measure.events.filter(e => e.chords.length && e.onset <= onset + 1e-7);
      const chord = changes.at(-1)?.chords.at(-1) ?? carriedChord;
      const primary = strongByStep.get(index);
      const inSource = onset < measure.duration - 1e-7;
      const weight = !inSource ? null : primary === 3 ? '⬤' : primary === 2 ? '●' : Math.abs((index + pickupSteps) % 4) < 1e-6 ? '*' : null;
      return {
        step: index + 1, chord, weight, lyric: null,
        melody: {
          pitch: event?.pitches.length ? Note.fromMidi(event.pitches[0]) : null,
          state: !event?.pitches.length ? 'rest' : Math.abs(event.onset - onset) < 1e-7 ? 'attack' : 'sustain',
        },
      };
    });
    carriedChord = measure.events.flatMap(e => e.chords).at(-1) ?? carriedChord;
    return {
      measure: measure.measureIndex + 1,
      lineIndex: sourceAbc.slice(0, measure.events[0].startChar).split('\n').length - 1,
      style_profile: { key: measure.key, comping_style: '', voicing_plan: '' },
      grid,
    };
  });
  return { sourceAbc, measures, timeline, diagnostics };
}

/** Match Accompaniment's beat-lyric row, leaving melody characters and normal lyrics intact. */
export function renderHarmonyBeatLyrics(document: HarmonyTimeGrid): string {
  const rows = new Map<number, string[]>();
  for (const measure of document.timeline) {
    const denominator = Number(measure.meter.split('/')[1]);
    for (const event of measure.events) {
      if (!event.pitches.length) continue;
      const offset = event.startChar + (document.sourceAbc.slice(event.startChar).search(/\S/) || 0);
      const line = document.sourceAbc.slice(0, offset).split('\n').length - 1;
      const index = event.onset * denominator * 4;
      const weight = Math.abs(index - Math.round(index)) < 1e-6 ? document.measures[measure.measureIndex].grid[Math.round(index)]?.weight : null;
      const glyph = weight === '*' ? '•' : weight ?? '*';
      rows.set(line, [...(rows.get(line) ?? []), glyph]);
    }
  }
  const lines = document.sourceAbc.split('\n');
  const output: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    output.push(lines[index]);
    const row = rows.get(index);
    if (!row) continue;
    while (index + 1 < lines.length && /^\s*w:/.test(lines[index + 1])) output.push(lines[++index]);
    output.push(`w: ${row.join(' ')}`);
  }
  return output.join('\n');
}
