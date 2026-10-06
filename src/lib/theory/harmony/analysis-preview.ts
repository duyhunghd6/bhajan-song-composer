import { applyAbcLayerVisibility, isAbcLayerVisible, type AbcLayerVisibilityItem } from '../abc-layer-visibility';
import { stripBeatAnnotations, stripStrongBeatLyricLines } from '../abc-beat-annotations';
import { fillMissingMeasureChords } from './auto-chords';
import { buildMetricTimeline } from './metric-timeline';
import { buildHarmonyTimeGrid, renderHarmonyBeatLyrics, type HarmonyTimeGrid } from './time-grid';
import { isAbcChordSymbol } from '../abc-chord-symbol';

/** Older selected progressions filled pickups; only remove additions absent from the melody source. */
export function omitGeneratedPickupChords(source: string, melodySource: string): string {
  const original = buildMetricTimeline(melodySource)[0];
  const measures = buildMetricTimeline(source);
  const pickup = measures[0];
  if (!original?.pickupOffset || !pickup?.pickupOffset || original.events.some(e => e.chords.length || e.lyricChords?.length)) return source;
  const facts = (m: typeof original) => JSON.stringify(m.events.map(e => [e.onset, e.duration, e.pitches]));
  if (facts(original) !== facts(pickup)) return source;
  const start = pickup.events[0].startChar;
  const end = measures[1]?.events[0].startChar ?? source.length;
  if (start < 0 || end < start) return source;
  const cleaned = source.slice(start, end).replace(/"([^"\n]*)"/g, (annotation, name: string) => isAbcChordSymbol(name) ? '' : annotation);
  return source.slice(0, start) + cleaned + source.slice(end);
}

export const HARMONY_ANALYSIS_LAYERS: AbcLayerVisibilityItem[] = [
  { id: 'StrongBeats', label: 'Strong Beats', kind: 'render', defaultVisible: false, enabled: true, supportsVolume: false },
  { id: 'MissingChord', label: 'Missing Chord', kind: 'render', defaultVisible: false, enabled: true, supportsVolume: false },
];

export interface HarmonyLayerProjection {
  abc: string;
  timeGrid: HarmonyTimeGrid | null;
  issues: string[];
}

/** Rebuild from the source; visibility never accumulates edits or replaces the Guitar branch grid. */
export function buildHarmonyLayerProjection(source: string, visibility: Record<string, boolean>, melodySource?: string): HarmonyLayerProjection {
  const clean = stripBeatAnnotations(stripStrongBeatLyricLines(source));
  let display = applyAbcLayerVisibility(clean, visibility);
  const strong = isAbcLayerVisible('StrongBeats', visibility, false);
  const missing = isAbcLayerVisible('MissingChord', visibility, false);
  try {
    if (melodySource) {
      source = omitGeneratedPickupChords(clean, melodySource);
      return buildHarmonyLayerProjection(source, visibility);
    }
    const filled = missing ? fillMissingMeasureChords(clean) : null;
    const timeGrid = buildHarmonyTimeGrid(filled?.abc ?? clean);
    // Keep original and generated chord visibility independent.
    const displayMeasures = buildMetricTimeline(display);
    const insertions = (filled?.suggestions ?? []).flatMap(suggestion => {
      const measure = displayMeasures[suggestion.measureIndex];
      return measure ? [{ offset: measure.events[0].startChar, text: `"${suggestion.symbol}"` }] : [];
    });
    for (const { offset, text } of insertions.sort((a, b) => b.offset - a.offset)) {
      display = display.slice(0, offset) + text + display.slice(offset);
    }
    if (strong) display = renderHarmonyBeatLyrics(buildHarmonyTimeGrid(display));
    return { abc: display, timeGrid, issues: [...(filled?.issues ?? []), ...timeGrid.diagnostics] };
  } catch (cause) {
    return { abc: display, timeGrid: null, issues: [cause instanceof Error ? cause.message : 'Unable to analyze this ABC.'] };
  }
}

export function buildHarmonyAnalysisPreview(source: string, visibility: Record<string, boolean>): string {
  return buildHarmonyLayerProjection(source, visibility).abc;
}
