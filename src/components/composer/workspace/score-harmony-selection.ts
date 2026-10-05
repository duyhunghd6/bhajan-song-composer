import { getSelectedWorkflowOption, mergeRun, selectOption, type AccompanimentWorkflowRun, type AccompanimentWorkflowSession } from '@/lib/theory/accompaniment-workflow';
import { validateManualHarmony } from '@/lib/theory/score-chord-edit';

/** Selecting a manual candidate uses the same Step 3 authority as the wizard. */
export function selectManualScoreHarmony(workflow: AccompanimentWorkflowSession | null, candidate: string, reference: string, createdAt = new Date().toISOString()): AccompanimentWorkflowSession {
  if (!workflow || !getSelectedWorkflowOption(workflow, 'key-beats') || !getSelectedWorkflowOption(workflow, 'chord-roles-progression')) {
    throw new Error('Complete Harmony Steps 1 and 2 before selecting a manual Step 3 candidate.');
  }
  const issues = validateManualHarmony(candidate, reference);
  if (issues.length) throw new Error(issues.join(' '));
  const run: AccompanimentWorkflowRun = {
    id: `manual-harmony-${createdAt}`, createdAt, stepId: 'voice-leading-validation', requestPrompt: 'Manual score chord edit', userNote: 'Manual score chord edit',
    options: [{ id: 'manual', label: 'Manual harmony', summary: 'Chord symbols edited on score', justification: 'Explicit user selection after deterministic validation', data: { validatedAbc: candidate }, warnings: [], validationNotes: ['Melody preserved; shared Step 3 strong-beat timeline validated.'] }],
  };
  const updated = mergeRun(workflow, run, 'Manual score edit');
  return selectOption(updated, run.stepId, run.options[0], 'Manual score edit', run.id);
}
