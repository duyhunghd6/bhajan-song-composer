import { applyScoreNoteEdit, type ScoreNoteEdit } from '@/lib/theory/score-note-edit';
import { buildAbcSourceMap, trimSourceRange, type SourceRange } from '../abcjs-playback/source-map';
import type { NoteTimingEvent, VisualObj } from '../abcjs-playback/types';

export interface ScoreEditingOptions {
  mode: 'explore' | 'edit';
  sourceAbc?: string;
  onCommit: (abc: string) => void;
  onError?: (message: string) => void;
}
function musicBody(abc: string) {
  return abc.split('\n').filter(line => !/^\s*(?:[A-Za-z]:|%)/.test(line)).join('\n')
    .replace(/\[V:[^\]]*\]|"[^"]*"|![^!]*!/g, '').replace(/\s/g, '');
}
/** Editing never trusts the approximate selection map: every token character must roundtrip. */
export function exactNoteSourceRange(source: string, prepared: string, range: SourceRange): SourceRange {
  if (source.match(/^\s*K:.*$/m)?.[0]?.trim() !== prepared.match(/^\s*K:.*$/m)?.[0]?.trim()) throw new Error('Reset the preview key before editing source notes.');
  if (musicBody(source) !== musicBody(prepared)) throw new Error('The preview music differs from its editable source. Use the ABC editor.');
  const map = buildAbcSourceMap(source, prepared);
  const trimmed = trimSourceRange(prepared, range);
  // Added harmony quotes are renderer context, not part of the canonical note token.
  const text = prepared.slice(trimmed.start, trimmed.end);
  const note = text.match(/([_^=]{0,2}[A-Ga-g][,']*\d*(?:\/+\d*)?)\s*-?\s*$/);
  if (!note || /[\[\]{}]/.test(text)) throw new Error('Select a single untied note to edit.');
  const startPrepared = trimmed.start + note.index!;
  const start = map.toSource(startPrepared);
  if (musicBody(source.slice(0, start)) !== musicBody(prepared.slice(0, startPrepared))) throw new Error('The source mapping points to a different note occurrence.');
  for (let i = 0; i < note[1].length; i++) {
    if (map.toSource(startPrepared + i) !== start + i || map.toPrepared(start + i) !== startPrepared + i || source[start + i] !== prepared[startPrepared + i]) throw new Error('This note has no exact source mapping. Use the ABC editor.');
  }
  return { start, end: start + note[1].length };
}

export function attachNoteInteractions(canvas: HTMLElement, prepared: string, source: string, timings: NoteTimingEvent[], options: ScoreEditingOptions, select: (start: number, end: number) => void, playFrom: (seconds: number) => void, pause: () => void, visualObj: VisualObj) {
  const cleanups: (() => void)[] = [];
  const status = document.createElement('div'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.className = 'mb-2 text-xs text-zinc-600'; status.hidden = true;
  canvas.parentElement?.insertBefore(status, canvas);
  let menu: HTMLElement | null = null;
  const close = () => { menu?.remove(); menu = null; };
  const fail = (error: unknown) => options.onError?.(error instanceof Error ? error.message : String(error));
  const commit = (timing: NoteTimingEvent, edit: ScoreNoteEdit) => {
    try {
      if (timing.startChar === undefined || timing.endChar === undefined) throw new Error('Note source is unavailable.');
      const range = exactNoteSourceRange(source, prepared, { start: timing.startChar, end: timing.endChar });
      options.onCommit(applyScoreNoteEdit(source, range, edit));
    } catch (error) { fail(error); }
    close();
  };
  const audition = (timing: NoteTimingEvent) => {
    const pitch = (timing as NoteTimingEvent & { midiPitches?: { pitch: number }[] }).midiPitches?.[0]?.pitch;
    if (pitch === undefined) { fail(new Error('This note has no audition pitch.')); return; }
    const context = new AudioContext();
    void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.36);
    oscillator.onended = () => { void context.close(); };
  };
  canvas.querySelectorAll<HTMLElement>('.abcjs-note[data-score-item]').forEach(element => {
    element.style.pointerEvents = 'bounding-box';
    const eventTiming = timings.find(event => event.elements?.flat().some(node => node === element || node.contains(element) || element.contains(node)));
    type Engraved = { elemset?: Element[]; abcelem?: { startChar?: number; endChar?: number; midiPitches?: { pitch: number }[] } };
    const engraving = visualObj as VisualObj & { engraver?: { staffgroups?: { voices?: { children?: Engraved[] }[] }[] } };
    const note = engraving.engraver?.staffgroups?.flatMap(group => group.voices?.flatMap(voice => voice.children ?? []) ?? []).find(child => child.elemset?.some(node => node === element || node.contains(element) || element.contains(node)))?.abcelem;
    const timing = eventTiming && note ? { ...eventTiming, startChar: note.startChar, endChar: note.endChar, midiPitches: note.midiPitches } : eventTiming;
    if (!timing || timing.startChar === undefined || timing.endChar === undefined) return;
    element.dataset.scoreSourceStart = String(timing.startChar);
    element.dataset.scoreSourceEnd = String(timing.endChar);
    cleanups.push(() => { delete element.dataset.scoreSourceStart; delete element.dataset.scoreSourceEnd; });
    const inspect = () => {
      status.hidden = false;
      const range = timing.startChar !== undefined && timing.endChar !== undefined ? trimSourceRange(prepared, { start: timing.startChar, end: timing.endChar }) : null;
      const token = range ? prepared.slice(range.start, range.end).match(/[_^=]{0,2}[A-Ga-g][,']*\d*(?:\/+\d*)?/)?.[0] : null;
      const measure = (timing as NoteTimingEvent & { measureNumber?: number }).measureNumber;
      const pitch = (timing as NoteTimingEvent & { midiPitches?: { pitch: number }[] }).midiPitches?.[0]?.pitch;
      const name = pitch === undefined ? token ?? 'note' : ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][pitch % 12] + (Math.floor(pitch / 12) - 1);
      const unit = prepared.match(/^L:\s*(\S+)/m)?.[1] ?? 'default'; const duration = token?.match(/[A-Ga-g][,']*(\d*(?:\/+\d*)?)/)?.[1] || '1';
      status.textContent = `${name} · Duration ${duration} × ${unit} · ABC ${token ?? 'note'} · Measure ${(measure ?? 0) + 1} · ${(timing.milliseconds / 1000).toFixed(2)}s`;
    };
    element.addEventListener('click', inspect); element.addEventListener('focus', inspect);
    cleanups.push(() => { element.removeEventListener('click', inspect); element.removeEventListener('focus', inspect); });
    const open = (x: number, y: number) => {
      inspect();
      close(); select(timing.startChar!, timing.endChar!);
      menu = document.createElement('div'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Note actions');
      menu.className = 'fixed z-[2000] flex flex-col rounded-lg border border-zinc-600 bg-zinc-900 p-1 text-sm text-white shadow-xl';
      menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 320)}px`;
      const action = (label: string, run: () => void) => {
        const button = document.createElement('button'); button.type = 'button'; button.role = 'menuitem'; button.textContent = label;
        button.className = 'rounded px-3 py-2 text-left hover:bg-zinc-700 focus:bg-zinc-700';
        button.onclick = () => { run(); close(); element.focus(); }; menu!.append(button);
      };
      action('Audition note', () => audition(timing));
      action('Play from here', () => playFrom(timing.milliseconds / 1000));
      if (options.mode === 'edit') {
        for (const [label, accidental] of [['Sharp ♯', '^'], ['Flat ♭', '_'], ['Natural ♮', '=']] as const) action(label, () => commit(timing, { kind: 'accidental', accidental }));
        action('Octave up', () => commit(timing, { kind: 'steps', steps: 7 }));
        action('Octave down', () => commit(timing, { kind: 'steps', steps: -7 }));
        action('Convert to rest', () => commit(timing, { kind: 'rest' }));
      }
      menu.onkeydown = event => {
        event.stopPropagation();
        if (event.key === 'Escape') { close(); element.focus(); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); const buttons = Array.from(menu!.querySelectorAll('button'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next]?.focus();
        }
      };
      document.body.append(menu); menu.querySelector('button')?.focus();
    };
    const context = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); open(event.clientX, event.clientY); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); const box = element.getBoundingClientRect(); open(box.left, box.bottom); }
    };
    let drag: { y: number; id: number } | null = null;
    let tooltip: HTMLElement | null = null;
    let ghost: Element | null = null;
    const clearDrag = () => { if (drag) element.releasePointerCapture?.(drag.id); drag = null; canvas.removeAttribute('data-score-note-dragging'); tooltip?.remove(); tooltip = null; ghost?.remove(); ghost = null; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); clearDrag(); } };
    const move = (event: PointerEvent) => {
      if (!drag) return;
      const svg = element.closest('svg'); const scale = svg?.viewBox.baseVal.width ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
      const steps = Math.round((drag.y - event.clientY) / (3.875 * scale));
      if (!tooltip) { tooltip = document.createElement('div'); tooltip.className = 'fixed z-[2001] pointer-events-none rounded bg-zinc-900 px-2 py-1 text-xs text-white'; document.body.append(tooltip); }
      if (!ghost) { ghost = element.cloneNode(true) as Element; ghost.removeAttribute('data-score-item'); ghost.removeAttribute('tabindex'); ghost.setAttribute('aria-hidden', 'true'); (ghost as HTMLElement).style.pointerEvents = 'none'; (ghost as HTMLElement).style.opacity = '0.45'; element.parentElement?.append(ghost); }
      ghost.setAttribute('transform', `${element.getAttribute('transform') ?? ''} translate(0,${-steps * 3.875})`);
      let label = `${steps > 0 ? '+' : ''}${steps} staff steps`;
      try { const r = exactNoteSourceRange(source, prepared, { start: timing.startChar!, end: timing.endChar! }); const current = source.slice(r.start, r.end); const next = applyScoreNoteEdit(source, r, { kind: 'steps', steps }).slice(r.start).match(/^[_^=]{0,2}[A-Ga-g][,']*/)![0]; label = `${current} → ${next}`; } catch { /* Preview remains visual when a source edit needs the ABC editor. */ }
      tooltip.textContent = `${label} · Escape cancels`; tooltip.style.left = `${event.clientX + 12}px`; tooltip.style.top = `${event.clientY - 28}px`;
    };
    const down = (event: PointerEvent) => {
      if (options.mode !== 'edit' || event.defaultPrevented || canvas.closest('[data-score-hand="true"], [data-score-panning="true"]') || event.button !== 0 || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      inspect(); pause();
      event.preventDefault();
      canvas.setAttribute('data-score-note-dragging', 'true');
      drag = { y: event.clientY, id: event.pointerId }; element.setPointerCapture?.(event.pointerId); event.stopPropagation();
    };
    const up = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const svg = element.closest('svg');
      const scale = svg?.viewBox.baseVal.width ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
      const steps = Math.round((drag.y - event.clientY) / (3.875 * scale)); clearDrag();
      if (steps) { event.preventDefault(); event.stopPropagation(); commit(timing, { kind: 'steps', steps }); }
    };
    const cancel = clearDrag;
    element.addEventListener('pointermove', move); document.addEventListener('keydown', escape); element.addEventListener('contextmenu', context); element.addEventListener('keydown', key); element.addEventListener('pointerdown', down); element.addEventListener('pointerup', up); element.addEventListener('pointercancel', cancel); element.addEventListener('lostpointercapture', cancel);
    cleanups.push(() => { clearDrag(); element.removeEventListener('pointermove', move); document.removeEventListener('keydown', escape); element.removeEventListener('contextmenu', context); element.removeEventListener('keydown', key); element.removeEventListener('pointerdown', down); element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', cancel); element.removeEventListener('lostpointercapture', cancel); });
  });
  const outside = (event: PointerEvent) => { if (menu && !menu.contains(event.target as Node)) close(); };
  const workspace = canvas.closest('[data-score-workspace-viewport]');
  const selectSingle = (event: Event) => {
    if ((event as CustomEvent<{ transient?: boolean }>).detail?.transient) return;
    const selected = canvas.querySelectorAll<HTMLElement>('[data-score-marquee-selected="true"]');
    if (selected.length !== 1) return;
    const start = selected[0].dataset.scoreSourceStart;
    const end = selected[0].dataset.scoreSourceEnd;
    if (start !== undefined && end !== undefined) select(Number(start), Number(end));
  };
  workspace?.addEventListener('score-workspace-selection-change', selectSingle);
  document.addEventListener('pointerdown', outside);
  return () => { close(); status.remove(); workspace?.removeEventListener('score-workspace-selection-change', selectSingle); document.removeEventListener('pointerdown', outside); cleanups.forEach(cleanup => cleanup()); };
}
