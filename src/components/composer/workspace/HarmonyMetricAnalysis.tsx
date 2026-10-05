import { useMemo } from 'react';
import { buildMetricTimeline } from '@/lib/theory/harmony/metric-timeline';
import styles from './harmony.module.css';

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function HarmonyMetricAnalysis({ abc }: { abc: string }) {
  const analysis = useMemo(() => {
    try { return { measures: buildMetricTimeline(abc), error: '' }; }
    catch (cause) { return { measures: [], error: cause instanceof Error ? cause.message : 'Unable to analyze this ABC.' }; }
  }, [abc]);
  return <details className={styles.disclosure}>
    <summary>Detected strong beats <span>Sounding notes used for auto chords</span></summary>
    <div className="max-h-80 overflow-auto p-3 text-sm">
      <p className="mb-3 text-zinc-500">Beat numbers count the meter denominator. Held notes count; rests have no pitch. Auto chords fill one symbol per empty measure, preserving existing harmony.</p>
      {analysis.error ? <p>{analysis.error}</p> : <table className="w-full text-left" aria-label="Detected strong beats">
        <thead><tr><th>Bar</th><th>Meter</th><th>Beat: notes</th></tr></thead>
        <tbody>{analysis.measures.map(m => <tr key={m.measureIndex}>
          <td className="py-1">{m.measureIndex + 1}</td><td>{m.meter}</td>
          <td>{m.strongBeats.length ? m.strongBeats.map(b => `${b.beat}: ${b.pitches.map(p => NAMES[p % 12]).join('/') || 'rest'}`).join(' · ') : m.pickupOffset ? 'Pickup — no strong beat' : 'No strong beat'}</td>
        </tr>)}</tbody>
      </table>}
    </div>
  </details>;
}
