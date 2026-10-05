import { applyAbcLayerVisibility, isAbcLayerVisible, type AbcLayerVisibilityItem } from '../abc-layer-visibility';
import { stripBeatAnnotations, stripStrongBeatLyricLines } from '../abc-beat-annotations';
import { fillMissingMeasureChords } from './auto-chords';
import { buildMetricTimeline } from './metric-timeline';
import { buildHarmonyTimeGrid, renderHarmonyBeatLyrics, type HarmonyTimeGrid } from './time-grid';

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
export function buildHarmonyLayerProjection(source: string, visibility: Record<string, boolean>): HarmonyLayerProjection {
  const clean = stripBeatAnnotations(stripStrongBeatLyricLines(source));
  let display = applyAbcLayerVisibility(clean, visibility);
  const strong = isAbcLayerVisible('StrongBeats', visibility, false);
  const missing = isAbcLayerVisible('MissingChord', visibility, false);
  try {
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
