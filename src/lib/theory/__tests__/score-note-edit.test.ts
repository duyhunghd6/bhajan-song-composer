import { readFileSync } from 'node:fs';
import { noteEditKeepsRhythm, retainedScorePosition } from '@/components/music-sheet/score-workspace/note-transport';
import { describe, expect, it } from 'vitest';
import { applyScoreNoteEdit } from '../score-note-edit';
import { exactNoteSourceRange } from '@/components/music-sheet/score-workspace/note-interactions';
const header = 'X:1\nL:1/8\nK:G\n';
const edit = (music: string, token: string, action: Parameters<typeof applyScoreNoteEdit>[2]) => {
  const source = header + music;
  const start = source.indexOf(token, header.length);
  return applyScoreNoteEdit(source, { start, end: start + token.length }, action);
};
describe('canonical note edits', () => {
  it('moves a note diatonically respecting the key and duration', () => expect(edit('E2 |', 'E2', { kind: 'steps', steps: 1 })).toBe(header + '^F2 |'));
  it('preserves accidental on octave moves', () => expect(edit('^C3/2 |', '^C3/2', { kind: 'steps', steps: 7 })).toBe(header + '^c3/2 |'));
  it('preserves an incoming accidental carry on octave moves', () => expect(edit('^F F2 |', 'F2', { kind: 'steps', steps: 7 })).toBe(header + '^F ^f2 |'));
  it('sets natural explicitly in a sharp key', () => expect(edit('F2 |', 'F2', { kind: 'accidental', accidental: '=' })).toBe(header + '=F2 |'));
  it('converts notes to rests with duration intact', () => expect(edit('D/2 |', 'D/2', { kind: 'rest' })).toBe(header + 'z/2 |'));
  it('preserves accidental spill into later notes across line breaks', () => expect(edit('F2\nF |', 'F2', { kind: 'accidental', accidental: '=' })).toBe(header + '=F2\n^F |'));
  it('edits repeated ordinary notes without changing the other pitch', () => expect(edit('C D C |', 'C', { kind: 'steps', steps: 1 })).toBe(header + '=D D C |'));
  it('rest removal restores the original accidental on following notes', () => expect(edit('=F F |', '=F', { kind: 'rest' })).toBe(header + 'z =F |'));
  it('uses target letter accidental carry for a drag', () => expect(edit('=F E F |', 'E', { kind: 'steps', steps: 1 })).toBe(header + '=F =F F |'));
  it('edits every note in a simple tie chain across bars', () => expect(edit('C2-|C2-C2 |', 'C2', { kind: 'steps', steps: 1 })).toBe(header + '=D2-|=D2-=D2 |'));
  it('preserves sharp tie sound across a bar on octave edits', () => {
    const source = 'X:1\nK:C\n^F-|F |'; const start = source.indexOf('^F');
    expect(applyScoreNoteEdit(source, { start, end: start + 2 }, { kind: 'steps', steps: 7 })).toBe('X:1\nK:C\n^f-|^f |');
  });
  it('rejects a tie that changes sounding pitch', () => expect(() => edit('^F-=F |', '^F', { kind: 'steps', steps: 7 })).toThrow('sounding pitch'));
  it('rejects rest conversion of ties and simultaneous chords', () => {
    expect(() => edit('C2-C2 |', 'C2', { kind: 'rest' })).toThrow('tied chain');
    expect(() => edit('[CE]2 |', '[CE]2', { kind: 'rest' })).toThrow('single note');
  });
});
describe('edit source mapping', () => {
  it('maps an inserted harmony annotation to exact canonical note', () => {
    const source = header + 'C2 D2 |'; const prepared = header + '"G"C2 D2 |';
    const start = prepared.indexOf('"G"');
    expect(exactNoteSourceRange(source, prepared, { start, end: start + 5 })).toEqual({ start: header.length, end: header.length + 2 });
  });
  it('maps repeated notes to their original occurrence with inserted chords', () => {
    const source = header + 'C C C | C C |'; const prepared = header + '"C"C C "G"C | "C"C C |';
    const selected = prepared.indexOf('C |');
    expect(exactNoteSourceRange(source, prepared, { start: selected, end: selected + 1 })).toEqual({ start: header.length + 4, end: header.length + 5 });
  });
  it('rejects preview-only key transposition', () => expect(() => exactNoteSourceRange(header + 'C |', header.replace('K:G', 'K:D') + 'C |', { start: header.length, end: header.length + 1 })).toThrow('preview key'));
  it('rejects a preview with changed musical content', () => expect(() => exactNoteSourceRange(header + 'C2 |', header + 'D2 |', { start: header.length, end: header.length + 2 })).toThrow('differs'));
});

describe('Ganesha source regressions', () => {
  const source = readFileSync('data/songs/sanskrit/ganesha.melody.abc', 'utf8');
  it('edits repeated E E2 without changing the remaining melody', () => {
    const start = source.indexOf('"Em" E E2') + 5;
    const result = applyScoreNoteEdit(source, { start, end: start + 1 }, { kind: 'steps', steps: 1 });
    expect(result).toBe(source.slice(0, start) + '^F' + source.slice(start + 1));
  });
  it('edits a tie through a chord annotation from its continuation', () => {
    const start = source.indexOf('F4', source.indexOf('F- "B7" F4'));
    const result = applyScoreNoteEdit(source, { start, end: start + 2 }, { kind: 'steps', steps: 7 });
    expect(result).toContain('^f- "B7" ^f4');
  });
  it('ignores comment accidentals while preserving following note sound', () => {
    const abc = 'X:1\nK:C\nC % ^D fake comment\nD |'; const start = abc.indexOf('C %');
    expect(applyScoreNoteEdit(abc, { start, end: start + 1 }, { kind: 'accidental', accidental: '^' })).toBe('X:1\nK:C\n^C % ^D fake comment\nD |');
  });
});
describe('note edit transport anchors', () => {
  it('keeps rhythm when pitches and harmony labels change', () => expect(noteEditKeepsRhythm(header + '"C" C2 D |', header + '"G" ^F2 E |')).toBe(true));
  it('resets rhythm anchor for changed durations', () => expect(noteEditKeepsRhythm(header + 'C2 D |', header + 'C D2 |')).toBe(false));
  it('retains measure and fraction when tempo changes', () => expect(retainedScorePosition(5, 2, 3, 20)).toBe(7.5));
  it('clamps the retained anchor to the new score duration', () => expect(retainedScorePosition(12, 2, 2, 10)).toBe(10));
});
