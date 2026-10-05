import { describe, expect, it } from 'vitest';
import { editScoreChord, validateManualHarmony } from './score-chord-edit';

const abc = 'X:1\nL:1/4\nM:4/4\nK:C\n"C"C D E F | "G7"G A B c |';
describe('canonical score chord editing', () => {
  it('edits exactly the temporal occurrence and preserves notes', () => {
    const candidate = editScoreChord(abc, 1, 1, 'Am');
    expect(candidate).toBe(abc.replace('"G7"', '"Am"'));
    expect(validateManualHarmony(candidate, abc)).toEqual([]);
  });
  it('rejects injection and stale targets', () => {
    expect(() => editScoreChord(abc, 0, 1, 'C"\nK:D')).toThrow();
    expect(() => editScoreChord(abc, 9, 1, 'Am')).toThrow();
  });
  it('removes a symbol without touching notes and blocks uncovered harmony', () => {
    const candidate = editScoreChord(abc, 0, 1, null);
    expect(candidate).toBe(abc.replace('"C"', ''));
    expect(validateManualHarmony(candidate, abc).length).toBeGreaterThan(0);
  });
  it('blocks a changed melody from entering manual Step 3', () => {
    expect(validateManualHarmony(abc.replace('C D E F', 'C D F F'), abc)).toContain('Chord editing must preserve the melody exactly.');
  });
});
