import { getKeyAccidentalsFromAbc } from './abc-key-signature';

export type ScoreNoteEdit = { kind: 'steps'; steps: number } | { kind: 'accidental'; accidental: '^' | '_' | '=' } | { kind: 'rest' };
export interface NoteRange { start: number; end: number }
const NOTE = /^(\s*(?:(?:"[^"]*"|![^!]*!)\s*)*)([_^=]{0,2})([A-Ga-g])([,']*)(\d*(?:\/+\d*)?)(\s*)$/;

/** Tied chains commit together; accidental repairs preserve surrounding sounding pitches. */
export function applyScoreNoteEdit(source: string, range: NoteRange, edit: ScoreNoteEdit): string {
  const note = "[_^=]{0,2}[A-Ga-g][,']*\\d*(?:\\/+\\d*)?";
  const ranges: NoteRange[] = [{ ...range }];
  let left = range.start; let right = range.end;
  const bridge = '(?:\\s|[|:,\\[\\]0-9]|"[^"]*"|![^!]*!|%[^\\n]*\\n)*';
  const incoming = new RegExp(`(${note})-${bridge}$`);
  const outgoing = new RegExp(`^\\s*-${bridge}(${note})`);
  for (;;) {
    const m = source.slice(0, left).match(incoming); if (!m) break;
    const start = m.index!; ranges.unshift({ start, end: start + m[1].length }); left = start;
  }
  for (;;) {
    const m = source.slice(right).match(outgoing); if (!m) break;
    const start = right + m[0].length - m[1].length; ranges.push({ start, end: start + m[1].length }); right = start + m[1].length;
  }
  if (ranges.length === 1) return editSingleNote(source, range, edit, false);
  if (edit.kind === 'rest') throw new Error('A tied chain cannot be converted to rests; use the ABC editor.');
  const names = ranges.map(r => source.slice(r.start, r.end).match(/([A-Ga-g][,']*)/)?.[1]);
  if (names.some(name => name !== names[0])) throw new Error('This tie chain changes pitch; use the ABC editor.');
  const first = source.slice(ranges[0].start, ranges[0].end).match(/^([_^=]{0,2})([A-Ga-g])/)!;
  const beforeFirst = source.slice(0, ranges[0].start);
  const carried = new Map<string, string>(getKeyAccidentalsFromAbc(source));
  for (const m of beforeFirst.slice(beforeFirst.lastIndexOf('|') + 1).replace(/"[^"]*"|![^!]*!|%[^\n]*|^\s*[A-Za-z]:.*$/gm, '').matchAll(/([_^=]{1,2})([A-Ga-g])[,']*/g)) carried.set(m[2].toUpperCase(), m[1]);
  const originalAccidental = first[1] || carried.get(first[2].toUpperCase()) || '=';
  if (ranges.some(r => { const acc = source.slice(r.start, r.end).match(/^([_^=]{0,2})/)![1]; return acc && acc !== originalAccidental; })) throw new Error('This tie chain changes sounding pitch; use the ABC editor.');
  const index = 'CDEFGAB'.indexOf(first[2].toUpperCase());
  const targetLetter = edit.kind === 'steps' ? 'CDEFGAB'[((index + edit.steps) % 7 + 7) % 7] : first[2].toUpperCase();
  const chainAccidental = edit.kind === 'accidental' ? edit.accidental : targetLetter === first[2].toUpperCase() ? originalAccidental : carried.get(targetLetter) || '=';
  let result = source;
  for (const r of [...ranges].reverse()) result = editSingleNote(result, r, edit, true, chainAccidental);
  return result;
}

function editSingleNote(source: string, range: NoteRange, edit: ScoreNoteEdit, tied: boolean, forcedAccidental?: string): string {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end > source.length || range.end <= range.start) throw new Error('Invalid note source range.');
  const token = source.slice(range.start, range.end);
  const match = token.match(NOTE);
  if (!match) throw new Error('Select a single note; chords, grace notes and ties require the ABC editor.');
  const before = source.slice(0, range.start);
  const after = source.slice(range.end);
  if (!tied && (/-\s*$/.test(before) || /^\s*-/.test(after))) throw new Error('Tied notes must be edited together in the ABC editor.');
  if (/\[K:|\[V:|%%propagate-accidentals|^K:.*(?:exp|none|[_^=])/m.test(source)) throw new Error('This key or accidental mode requires the ABC editor.');
  const linePrefix = before.slice(before.lastIndexOf('\n') + 1);
  if (/^\s*[A-Za-z]:/.test(linePrefix) && !/^\s*\[V:/.test(linePrefix)) throw new Error('This range is not a music note.');
  const [ , prefix, accidental, letter, marks, duration, suffix] = match;
  const letters = 'CDEFGAB';
  const octave = (letter === letter.toLowerCase() ? 5 : 4) + [...marks].reduce((n, c) => n + (c === "'" ? 1 : -1), 0);
  let pitch = octave * 7 + letters.indexOf(letter.toUpperCase());
  if (edit.kind === 'steps') pitch += Math.trunc(edit.steps);
  const nextOctave = Math.floor(pitch / 7);
  if (nextOctave < 0 || nextOctave > 9) throw new Error('Pitch is outside the supported octave range.');
  const nextLetter = letters[((pitch % 7) + 7) % 7];
  const nextPitch = nextOctave >= 5 ? nextLetter.toLowerCase() + "'".repeat(nextOctave - 5) : nextLetter + ','.repeat(4 - nextOctave);
  const previousBar = before.slice(before.lastIndexOf('|') + 1).replace(/"[^"]*"|![^!]*!|%[^\n]*|^\s*[A-Za-z]:.*$/gm, '');
  const state = new Map<string, string>(getKeyAccidentalsFromAbc(source));
  for (const m of previousBar.matchAll(/([_^=]{1,2})([A-Ga-g])[,']*/g)) state.set(m[2].toUpperCase(), m[1]);
  const nextAccidental = forcedAccidental ?? (edit.kind === 'accidental' ? edit.accidental : edit.kind === 'steps' ? (nextLetter === letter.toUpperCase() ? accidental || state.get(nextLetter) || '=' : state.get(nextLetter) || '=') : '');
  const oldState = new Map(state); const newState = new Map(state);
  if (accidental) oldState.set(letter.toUpperCase(), accidental);
  if (edit.kind !== 'rest') newState.set(nextLetter, nextAccidental);
  const remainder = after.split('|')[0];
  if (/[\[{}]/.test(remainder) && (edit.kind === 'rest' || nextLetter !== letter.toUpperCase() || accidental !== nextAccidental)) throw new Error('Accidental carry through chords or grace notes requires the ABC editor.');
  const preserved = remainder.replace(/"[^"]*"|![^!]*!|%[^\n]*|^\s*[A-Za-z]:.*$|([_^=]{0,2})([A-Ga-g])([,']*)(\d*(?:\/+\d*)?)/gm, (token, acc: string | undefined, name: string | undefined, oct: string, length: string) => {
    if (!name || acc === undefined) return token;
    const key = name.toUpperCase();
    if (acc) { oldState.set(key, acc); newState.set(key, acc); return token; }
    const original = oldState.get(key) ?? '=';
    if (original === (newState.get(key) ?? '=')) return token;
    newState.set(key, original);
    return original + name + oct + length;
  });
  return before + prefix + (edit.kind === 'rest' ? 'z' : nextAccidental + nextPitch) + duration + suffix + preserved + after.slice(remainder.length);
}
