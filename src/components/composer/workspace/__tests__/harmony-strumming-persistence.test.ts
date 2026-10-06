import { expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_STATE } from '../../useWorkspaceState';
import { buildAccompanimentProjectPayload } from '../voicing-inspector-integration';
import { buildHarmonyValidationBranchResetState } from '../accompaniment-guitar-reset';
import { serializeForStorage } from '../storage-pruning';
import { generateStrummingCandidates } from '@/lib/theory/harmony/strumming';

it('persists the selected canonical ABC and TimeGrid in the project, excluding stale decisions', () => {
  const source = 'X:1\nM:4/4\nL:1/8\nK:C\n"C" C8 |';
  const result = generateStrummingCandidates(source, 'folk', [], ['slap'])[2];
  const workspace = { ...DEFAULT_WORKSPACE_STATE, harmonyStrumming: result.selection };
  const input = { slug: 'strumming-test', activeAbc: source, branchSourceAbc: source, workspace };
  const payload = buildAccompanimentProjectPayload(input);
  expect(payload.decisions?.harmonyStrumming).toEqual(JSON.parse(JSON.stringify(result)));
  expect(JSON.parse(serializeForStorage(workspace)!).harmonyStrumming).toEqual(result.selection);
  expect(buildAccompanimentProjectPayload({ ...input, branchSourceAbc: source + '\n% changed' }).decisions?.harmonyStrumming).toBeNull();
  expect(buildAccompanimentProjectPayload({ ...input, branchSourceAbc: null }).decisions?.harmonyStrumming).toBeNull();
  expect(buildHarmonyValidationBranchResetState(workspace).harmonyStrumming).toBeNull();
});

it('retains preview choices and layer controls through workspace serialization without publishing the preview', () => {
  const source = 'X:1\nM:4/4\nL:1/8\nK:C\n"C" C8 |';
  const preview = generateStrummingCandidates(source, 'ballad', [], [])[4].selection;
  const workspace = {
    ...DEFAULT_WORKSPACE_STATE,
    harmonyStrummingPreview: preview,
    harmonyStrummingExpanded: false,
    harmonyLayerVisibility: { Melody: true, StrongBeats: false, GuitarStrumming: false },
    harmonyLayerVolumes: { Melody: 35, GuitarStrumming: 62 },
  };
  const restored = JSON.parse(serializeForStorage(workspace)!);
  expect(restored.harmonyStrummingPreview).toEqual(preview);
  expect(restored.harmonyStrummingExpanded).toBe(false);
  expect(restored.harmonyLayerVisibility).toEqual(workspace.harmonyLayerVisibility);
  expect(restored.harmonyLayerVolumes).toEqual(workspace.harmonyLayerVolumes);
  expect(buildAccompanimentProjectPayload({ slug: 'preview-test', activeAbc: source, branchSourceAbc: source, workspace }).decisions?.harmonyStrumming).toBeNull();
  expect(buildHarmonyValidationBranchResetState(workspace).harmonyStrummingPreview).toBeNull();
});
