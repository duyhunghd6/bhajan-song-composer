import { describe, expect, it } from 'vitest';
import { restoreScoreHarmonyDraft, serializeScoreHarmonyDraft } from '../score-draft-storage';
describe('manual score draft persistence', () => {
  it('roundtrips only against the same melody and selected Harmony source', () => {
    const saved = serializeScoreHarmonyDraft('candidate', 'melody', 'step3');
    expect(restoreScoreHarmonyDraft(saved, 'melody', 'step3')).toBe('candidate');
    expect(restoreScoreHarmonyDraft(saved, 'new melody', 'step3')).toBeNull();
    expect(restoreScoreHarmonyDraft(saved, 'melody', 'new step3')).toBeNull();
  });
  it('ignores deleted, malformed and unbound persisted drafts', () => {
    expect(restoreScoreHarmonyDraft(null, 'melody', 'step3')).toBeNull();
    expect(restoreScoreHarmonyDraft('{', 'melody', 'step3')).toBeNull();
    expect(restoreScoreHarmonyDraft('{"abc":"candidate"}', 'melody', 'step3')).toBeNull();
  });
});
