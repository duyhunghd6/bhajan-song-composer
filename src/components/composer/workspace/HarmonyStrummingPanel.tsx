import { Button } from '@/components/ui/Button';
import { STRUMMING_STYLES, OPTIONAL_STRUMMING_TECHNIQUES, normalizeStrummingTechniques, type StrummingCandidate, type StrummingSelection, type StrummingStyleId } from '@/lib/theory/harmony/strumming';
import styles from './harmony.module.css';

interface Props {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  enabled: boolean;
  meter: string;
  candidates: StrummingCandidate[];
  selected: StrummingSelection | null;
  saved: StrummingSelection | null;
  error: string;
  onStyle: (style: StrummingStyleId) => void;
  onSelect: (selection: StrummingSelection) => void;
  onSave: () => void;
  onCancel: () => void;
}
export function HarmonyStrummingPanel({ expanded, onExpandedChange, enabled, meter, candidates, selected, saved, error, onStyle, onSelect, onSave, onCancel }: Props) {
  const techniques = normalizeStrummingTechniques(selected?.techniques);
  const isSaved = Boolean(selected && saved?.styleId === selected.styleId && saved.variant === selected.variant && JSON.stringify(normalizeStrummingTechniques(saved.techniques)) === JSON.stringify(techniques));
  return <section className={styles.strumming} aria-label="Accompaniment style">
    <button type="button" className={styles.stepAccordionButton} aria-expanded={expanded} aria-controls="harmony-strumming-content" onClick={() => onExpandedChange(!expanded)}>
      <span><strong>3. Accompaniment Style</strong><small>{selected ? `${STRUMMING_STYLES.find(style => style.id === selected.styleId)?.label} · ${candidates[selected.variant]?.label ?? ''}` : 'Choose style & strumming type'}</small></span>
      <span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    <div id="harmony-strumming-content" hidden={!expanded}>
    <div className={styles.strummingBody}>
    <p>Choose a style and strumming type. Your choices are remembered after refresh.</p>
    {!enabled && <p role="status">Select a chord progression in Step 2 first. Validate any manual chord edits before continuing.</p>}
    <div className={styles.strummingColumns}>
      <fieldset className={styles.strummingCandidates}>
        <legend>Style · {meter}</legend>
        {STRUMMING_STYLES.map(style => {
          const compatible = (style.meters as readonly string[]).includes(meter);
          return <label key={style.id} data-selected={selected?.styleId === style.id} data-disabled={!enabled || !compatible}>
            <input type="radio" name="accompaniment-style" disabled={!enabled || !compatible} checked={selected?.styleId === style.id} onChange={() => onStyle(style.id)} />
            <span><strong>{style.label}</strong><small>{style.meters.join(' / ')}</small></span>
          </label>;
        })}
      </fieldset>
      <fieldset className={styles.strummingCandidates}>
        <legend>Strumming Type</legend>
        {!candidates.length && <p>Select a style to see seven strumming types.</p>}
        {candidates.map(candidate => <label key={candidate.selection.variant} data-selected={selected?.variant === candidate.selection.variant}>
          <input type="radio" name="strumming-result" disabled={!enabled} checked={selected?.variant === candidate.selection.variant} onChange={() => onSelect(candidate.selection)} />
          <span><strong>{candidate.label}</strong><small>{candidate.description}</small></span>
        </label>)}
      </fieldset>
    </div>
    <fieldset className={styles.strummingCandidates} disabled={!enabled || !selected}>
      <legend>Techniques you can play</legend>
      {OPTIONAL_STRUMMING_TECHNIQUES.map(technique => <label key={technique.id} data-selected={techniques.includes(technique.id)}>
        <input type="checkbox" checked={techniques.includes(technique.id)} onChange={event => {
          if (selected) onSelect({ ...selected, techniques: event.target.checked ? [...techniques, technique.id] : techniques.filter(id => id !== technique.id) });
        }} />
        <span><strong>{technique.label}</strong><small>{technique.description}</small></span>
      </label>)}
    </fieldset>
    <p>Allow techniques for all seven results. Each style uses its own rhythm. Disabled bass picking or palm mute becomes a normal strum; disabled percussion or choke becomes a rest. Down/up strokes and rests remain.</p>
    {selected && <p>{STRUMMING_STYLES.find(style => style.id === selected.styleId)?.description}</p>}
    {candidates.length > 0 && <p aria-label="Strumming technique legend">↓ Down: bass → treble · ↑ Up: treble → bass, lighter. PM: palm mute · Dead: dead strum · X: string slap · Choke: stop the strings · Rest: silence.</p>}
    {error && <p role="alert">{error}</p>}
    {candidates.length > 0 && <>
      <p>Choose a result, then press Play above the score to listen. The Strumming layer controls its visibility and volume.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={isSaved} onClick={onSave}>{isSaved ? 'Saved' : 'Save accompaniment'}</Button>
        {!isSaved && <Button type="button" onClick={onCancel}>Cancel preview</Button>}
      </div>
      <p role="status">{isSaved ? 'Saved to this song’s workspace. TimeGrid and ABC notation are up to date.' : 'Preview remembered — save to use this arrangement in your project.'}</p>
    </>}
    </div>
    </div>
  </section>;
}
