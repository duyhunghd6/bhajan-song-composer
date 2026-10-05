import { describe, expect, it } from 'vitest';
import { createAccompanimentWorkflowSession, getSelectedWorkflowOption, mergeRun, selectOption, type AccompanimentWorkflowOption } from '@/lib/theory/accompaniment-workflow';
import { selectManualScoreHarmony } from '../score-harmony-selection';
const abc = 'X:1\nL:1/4\nM:4/4\nK:C\n"C"C D E F |';
const candidate = abc.replace('"C"', '"Am"');
const option: AccompanimentWorkflowOption = { id: 'choice', label: 'Choice', summary: '', justification: '', data: {}, warnings: [], validationNotes: [] };
function preparedWorkflow() {
  let workflow = createAccompanimentWorkflowSession(abc);
  for (const stepId of ['key-beats', 'chord-roles-progression'] as const) {
    const run = { id: stepId, stepId, createdAt: '', requestPrompt: '', userNote: '', options: [option] };
    workflow = selectOption(mergeRun(workflow, run, ''), stepId, option, '', run.id);
  }
  return workflow;
}
describe('manual harmony selection authority', () => {
  it('requires the small Harmony steps before Step 3', () => {
    expect(() => selectManualScoreHarmony(null, candidate, abc)).toThrow('Steps 1 and 2');
    expect(() => selectManualScoreHarmony(createAccompanimentWorkflowSession(abc), candidate, abc)).toThrow('Steps 1 and 2');
  });
  it('selects validated candidate while preserving canonical melody source', () => {
    const workflow = preparedWorkflow();
    const selected = selectManualScoreHarmony(workflow, candidate, abc);
    expect(selected.sourceAbc).toBe(abc);
    expect(getSelectedWorkflowOption(selected, 'voice-leading-validation')?.data.validatedAbc).toBe(candidate);
    expect(getSelectedWorkflowOption(workflow, 'voice-leading-validation')).toBeNull();
  });
  it('never selects an edited note or uncovered chord timeline', () => {
    expect(() => selectManualScoreHarmony(preparedWorkflow(), candidate.replace('C D', 'G D'), abc)).toThrow('preserve the melody');
    expect(() => selectManualScoreHarmony(preparedWorkflow(), abc.replace('"C"', ''), abc)).toThrow('no valid inline chord');
  });
});
