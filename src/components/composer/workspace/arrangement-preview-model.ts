import {
  ABC_LAYER_IDS,
  applyAbcLayerVisibility,
  applyAbcLayerVolumes,
  extractAbcLayerVisibilityItems,
  extractAbcVoiceIds,
  getVisibleAbcVoiceIds,
  isAbcLayerVisible,
  normalizeAbcLayerVisibility,
  type AbcLayerVisibilityItem,
} from "@/lib/theory/abc-layer-visibility";
import {
  getLatestSelectedWorkflowStep,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepDefinition,
} from "@/lib/theory/accompaniment-workflow";
import { normalizeAbcVoiceId } from "@/lib/theory/abc-voice-normalization";
import { isTabCapableGuitarVoiceId } from "@/lib/theory/guitar-string-forcing";
import type { GeneratedGuitarOrigin } from "../useWorkspaceState";
import type { ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS, COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";
import { buildArrangementSourceGraph, type ArrangementSourceGraph } from "./arrangement-source/arrangement-source-graph";

/**
 * Preview-only adapter over the source-current arrangement graph. It composes
 * visibility, volume, synth, and ABCJS options; its ABC output is not a source
 * artifact to persist, export, or feed into either arrangement branch.
 */
export type HarmonyLayerVisibility = Record<string, boolean>;
export type AccompanimentLayerVisibility = Record<string, boolean>;
export type ComposerPreviewRenderOptions = typeof ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS | typeof COMPOSER_PREVIEW_RENDER_OPTIONS;

export interface HarmonyPreviewModel {
  abc: string;
  rawAbc: string;
  layerVisibilityItems: AbcLayerVisibilityItem[];
  synthOptions: { voicesOff?: boolean; chordsOff?: boolean };
  harmonyStepComplete: boolean;
  getRenderOptionsFor: (abc: string, baseOptions: ComposerPreviewRenderOptions) => Record<string, unknown>;
}

export interface AccompanimentPreviewModel {
  abc: string;
  rawAbc: string;
  layerVisibilityItems: AbcLayerVisibilityItem[];
  voiceNames: string[];
  visibleVoiceNames: string[];
  hasGuitarVoice: boolean;
  guitarTabEnabled: boolean;
  strongBeatsStepComplete: boolean;
  appliedWorkflowStep: AccompanimentWorkflowStepDefinition | null;
  effectiveLayerVisibility: AccompanimentLayerVisibility;
  hasLayerVisibilityControls: boolean;
}

export interface ArrangementPreviewModel {
  sourceGraph: ArrangementSourceGraph;
  pipeline: ArrangementSourceGraph["pipeline"];
  activeWorkflow: AccompanimentWorkflowSession | null;
  workflowAppliedMusicAbc: string;
  harmonyValidationAbc: string | null;
  harmony: HarmonyPreviewModel;
  accompaniment: AccompanimentPreviewModel;
  getRenderOptionsFor: (abc: string, baseOptions: ComposerPreviewRenderOptions) => Record<string, unknown>;
}

export interface BuildArrangementPreviewModelInput {
  activeAbc: string;
  workflow: AccompanimentWorkflowSession | null;
  generatedAccompaniment: string | null;
  generatedGuitar: string | null;
  generatedGuitarOrigin: GeneratedGuitarOrigin;
  previewPurpose: "accompaniment" | "final";
  harmonyLayerVisibility: HarmonyLayerVisibility;
  harmonyLayerVolumes: Record<string, number>;
  accompanimentLayerVisibility: AccompanimentLayerVisibility;
  accompanimentLayerVolumes: Record<string, number>;
}

export function buildArrangementSynthOptions(
  layerVisibility: Record<string, boolean>,
  abcString?: string
): { voicesOff?: boolean; chordsOff?: boolean } {
  const normalizedVisibility = normalizeAbcLayerVisibility(layerVisibility);
  const synthOptions: { voicesOff?: boolean; chordsOff?: boolean } = {};
  const melodyHidden = !isAbcLayerVisible("Melody", normalizedVisibility, true);
  const abcHasMelodyVoice = abcString ? /\bV:Melody\b/.test(abcString) : true;
  if (melodyHidden && abcHasMelodyVoice) synthOptions.voicesOff = true;
  if (!isAbcLayerVisible(ABC_LAYER_IDS.chordProgression, normalizedVisibility, true)) synthOptions.chordsOff = true;
  return synthOptions;
}

function effectiveAccompanimentLayerVisibility(
  layerVisibility: AccompanimentLayerVisibility,
  strongBeatsStepComplete: boolean
): AccompanimentLayerVisibility {
  const normalizedVisibility = normalizeAbcLayerVisibility(layerVisibility);
  const strongBeatsVisible = strongBeatsStepComplete
    && isAbcLayerVisible(ABC_LAYER_IDS.strongBeats, normalizedVisibility, true);

  return {
    ...normalizedVisibility,
    [ABC_LAYER_IDS.strongBeats]: strongBeatsVisible,
    __strong_beats__: strongBeatsVisible,
  };
}

function getScoreGuitarStaffIndex(abc: string): number {
  const scoreMatch = abc.match(/^%%score\s+(.+)$/m);
  if (!scoreMatch) return -1;
  const scoreLine = scoreMatch[1];
  const groupedStaffs = scoreLine.match(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g);
  if (groupedStaffs?.length) {
    return groupedStaffs.findIndex((group) => group
      .replace(/[(){}\[\]]/g, " ")
      .split(/\s+/)
      .map(normalizeAbcVoiceId)
      .some(isTabCapableGuitarVoiceId));
  }
  return scoreLine
    .split(/\s+/)
    .map((voice) => voice.trim())
    .filter(Boolean)
    .map(normalizeAbcVoiceId)
    .findIndex(isTabCapableGuitarVoiceId);
}

export function getArrangementRenderOptionsFor(
  abc: string,
  baseOptions: ComposerPreviewRenderOptions,
  guitarTabEnabled: boolean
): Record<string, unknown> {
  if (!guitarTabEnabled) return baseOptions;
  let guitarIndex = getScoreGuitarStaffIndex(abc);
  if (guitarIndex === -1) guitarIndex = extractAbcVoiceIds(abc, false).findIndex(isTabCapableGuitarVoiceId);
  if (guitarIndex < 0) return baseOptions;

  return {
    staffwidth: baseOptions.staffwidth,
    paddingright: baseOptions.paddingright,
    stafftopmargin: 35,
    tablature: [
      ...Array.from({ length: guitarIndex }, () => ({ instrument: "" as const })),
      { instrument: "guitar" as const, label: "", tuning: ["E,", "A,", "D", "G", "B", "e"], capo: 0, hideTabSymbol: false },
    ],
  };
}

export function buildArrangementPreviewModel(input: BuildArrangementPreviewModelInput): ArrangementPreviewModel {
  const sourceGraph = buildArrangementSourceGraph({
    activeAbc: input.activeAbc,
    workflow: input.workflow,
    generatedAccompaniment: input.generatedAccompaniment,
    generatedGuitar: input.generatedGuitar,
    generatedGuitarOrigin: input.generatedGuitarOrigin,
    includeFingerstyle: input.previewPurpose === "final",
  });
  const harmonyVisibility = normalizeAbcLayerVisibility(input.harmonyLayerVisibility);
  const effectiveLayerVisibility = effectiveAccompanimentLayerVisibility(
    input.accompanimentLayerVisibility,
    sourceGraph.strongBeatsStepComplete
  );
  const harmonyDisplayAbc = sourceGraph.harmonyStepComplete && sourceGraph.harmonyValidationAbc
    ? sourceGraph.harmonyValidationAbc
    : input.activeAbc;
  const rawHarmonyAbc = applyAbcLayerVolumes(harmonyDisplayAbc, input.harmonyLayerVolumes);
  const rawAccompanimentAbc = applyAbcLayerVolumes(sourceGraph.previewAbc, input.accompanimentLayerVolumes);
  const accompanimentVisibleVoices = getVisibleAbcVoiceIds(rawAccompanimentAbc, effectiveLayerVisibility);
  // TAB is an ABCJS render option, not a textual layer: enable it only when a
  // currently visible Guitar voice can supply physical notation.
  const hasGuitarVoice = accompanimentVisibleVoices.some(isTabCapableGuitarVoiceId);
  const guitarTabEnabled = hasGuitarVoice && isAbcLayerVisible(ABC_LAYER_IDS.tab, effectiveLayerVisibility, false);
  const harmonyVisibleVoices = getVisibleAbcVoiceIds(rawHarmonyAbc, harmonyVisibility);
  const hasHarmonyGuitarVoice = harmonyVisibleVoices.some(isTabCapableGuitarVoiceId);
  const harmonyTabEnabled = hasHarmonyGuitarVoice && isAbcLayerVisible(ABC_LAYER_IDS.tab, harmonyVisibility, false);
  const harmonyLayerVisibilityItems = extractAbcLayerVisibilityItems(rawHarmonyAbc, { tabEnabled: hasHarmonyGuitarVoice });
  const accompanimentLayerVisibilityItems = extractAbcLayerVisibilityItems(rawAccompanimentAbc, {
    includeStrongBeats: sourceGraph.strongBeatsStepComplete,
    tabEnabled: hasGuitarVoice,
  });

  return {
    sourceGraph,
    pipeline: sourceGraph.pipeline,
    activeWorkflow: sourceGraph.activeWorkflow,
    workflowAppliedMusicAbc: sourceGraph.workflowAppliedMusicAbc,
    harmonyValidationAbc: sourceGraph.harmonyValidationAbc,
    harmony: {
      abc: applyAbcLayerVisibility(rawHarmonyAbc, harmonyVisibility),
      rawAbc: rawHarmonyAbc,
      layerVisibilityItems: harmonyLayerVisibilityItems,
      synthOptions: buildArrangementSynthOptions(harmonyVisibility),
      harmonyStepComplete: sourceGraph.harmonyStepComplete,
      getRenderOptionsFor: (abc, baseOptions) => getArrangementRenderOptionsFor(abc, baseOptions, harmonyTabEnabled),
    },
    accompaniment: {
      abc: applyAbcLayerVisibility(rawAccompanimentAbc, effectiveLayerVisibility),
      rawAbc: rawAccompanimentAbc,
      layerVisibilityItems: accompanimentLayerVisibilityItems,
      voiceNames: extractAbcVoiceIds(rawAccompanimentAbc),
      visibleVoiceNames: accompanimentVisibleVoices,
      hasGuitarVoice,
      guitarTabEnabled,
      strongBeatsStepComplete: sourceGraph.strongBeatsStepComplete,
      appliedWorkflowStep: getLatestSelectedWorkflowStep(sourceGraph.activeWorkflow),
      effectiveLayerVisibility,
      hasLayerVisibilityControls: accompanimentLayerVisibilityItems.length > 0,
    },
    getRenderOptionsFor: (abc, baseOptions) => getArrangementRenderOptionsFor(abc, baseOptions, guitarTabEnabled),
  };
}
