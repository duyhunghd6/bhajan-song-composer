import { describe, expect, it, vi } from 'vitest';
import { generateHarmonyWorkflowStep } from './workflow';
import type { AccompanimentWorkflowSelectedContext } from '../accompaniment-workflow/definition';
vi.mock('@/app/actions/ai-config', () => ({
  requestOpenAiCompatibleTool: vi.fn(() => { throw new Error('LLM must not run'); }),
  requestOpenAiCompatibleToolLoop: vi.fn(() => { throw new Error('LLM must not run'); }),
}));
import { generateAccompanimentWorkflowStep } from '@/app/actions/accompaniment-workflow';
const abc = (body: string, meter = '4/4') => `X:1\nM:${meter}\nL:1/8\nK:C\n${body}`;
const key: AccompanimentWorkflowSelectedContext = { stepId: 'key-beats', label: '', summary: '', justification: '', data: { strongBeatEmphasis: 'primary-strong-beats' } };
const chords = (sourceAbc: string) => generateHarmonyWorkflowStep({ stepId: 'chord-roles-progression', sourceAbc, previousSelections: [key] });
describe('algorithmic harmony workflow', () => {
  it('ranks repeatable distinct complete progressions and preserves source text', () => {
    const source = abc('C2 E2 G2 E2 | F2 A2 c2 A2 | G2 B2 d2 B2 | C8 |');
    const result = chords(source);
    expect(result.options).toHaveLength(3);
    expect(result.options).toEqual(chords(source).options);
    expect(new Set(result.options.map(o => o.data.harmonizedAbc)).size).toBe(3);
    for (const o of result.options) expect((o.data.harmonizedAbc as string).replace(/"[^"]*"/g, '')).toBe(source);
  });
  it('retains explicit split chords and N.C.', () => {
    const source = abc('"C"C4 "G"G4 | "N.C."z8 |');
    expect(chords(source).options[0].data.harmonizedAbc).toBe(source);
  });
  it('aligns lyric chord annotations to their notes', () => {
    const source = abc('C4 G4 |\nw: [C]Hari [G]Bol');
    expect(chords(source).options[0].data.harmonizedAbc).toContain('"C"C4 "G"G4');
  });
  it('handles compound pulses, pickups and tuplets', () => {
    const source = abc('G2 | (3CDE F2 G2 |', '6/8');
    const result = generateHarmonyWorkflowStep({ stepId: 'key-beats', sourceAbc: source, previousSelections: [] });
    expect(JSON.stringify(result.options[0].data)).toContain('"beat":4');
    expect(chords(source).options.length).toBeGreaterThan(0);
  });
  it('generates and validates harmony without requiring an opening pickup chord', () => {
    const sourceAbc = abc('B, |: C8 | G8 :|');
    for (const selected of chords(sourceAbc).options) {
      expect(selected.data.harmonizedAbc).toContain('B, |:');
      expect((selected.data.harmonizedAbc as string).split('|:')[0]).not.toContain('"');
      const validated = generateHarmonyWorkflowStep({ stepId: 'voice-leading-validation', sourceAbc, previousSelections: [{ ...selected, stepId: 'chord-roles-progression' }] });
      expect(validated.options[0].data.validatedAbc).toBe(selected.data.harmonizedAbc);
    }
  });
  it('rejects missing selections, changed melodies and irregular interior measures', () => {
    expect(() => generateHarmonyWorkflowStep({ stepId: 'voice-leading-validation', sourceAbc: abc('C8 |'), previousSelections: [] })).toThrow('Select');
    expect(() => generateHarmonyWorkflowStep({ stepId: 'voice-leading-validation', sourceAbc: abc('C8 |'), previousSelections: [{ ...key, stepId: 'chord-roles-progression', data: { harmonizedAbc: abc('"G"G8 |') } }] })).toThrow('changed');
    expect(() => chords(abc('C8 | D2 | C8 |'))).toThrow('irregular');
  });
  it('executes all three server actions without the LLM transport', async () => {
    const sourceAbc = abc('C8 | G8 | C8 |');
    const base = { sourceAbc, metadata: { key: 'C', scale: 'major', timeSignature: '4/4' } };
    const one = await generateAccompanimentWorkflowStep({ ...base, stepId: 'key-beats', previousSelections: [] });
    const selectedKey = { ...one.options[0], stepId: 'key-beats' as const };
    const two = await generateAccompanimentWorkflowStep({ ...base, stepId: 'chord-roles-progression', previousSelections: [selectedKey] });
    const three = await generateAccompanimentWorkflowStep({ ...base, stepId: 'voice-leading-validation', previousSelections: [selectedKey, { ...two.options[0], stepId: 'chord-roles-progression' }] });
    expect(three.options[0].data.validatedAbc).toBe(two.options[0].data.harmonizedAbc);
  });
});
