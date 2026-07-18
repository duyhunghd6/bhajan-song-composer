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
import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import {
  buildAccompanimentWorkflowAbcAnnotation,
  getLatestSelectedWorkflowStep,
  getSelectedWorkflowOption,
  getWorkflowAppliedMusicAbc,
  isAccompanimentWorkflowSourceCurrent,
  isAccompanimentWorkflowStepComplete,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepDefinition,
} from "@/lib/theory/accompaniment-workflow";
import { generateAccompanimentSupportLayers } from "@/lib/theory/accompaniment-workflow/support-layers";
import { generateArrangementPipeline, type ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { StrongBeatDirective } from "@/lib/theory/abc-beat-annotations";
import { normalizeAbcVoiceId } from "@/lib/theory/abc-voice-normalization";
import type { ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS, COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";

export type HarmonyLayerVisibility = Record<string, boolean>;
export type AccompanimentLayerVisibility = Record<string, boolean>;
export type ComposerPreviewRenderOptions = typeof ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS | typeof COMPOSER_PREVIEW_RENDER_OPTIONS;

export interface HarmonyPreviewModel {
  abc: string;
  rawAbc: string;
  layerVisibilityItems: AbcLayerVisibilityItem[];
  synthOptions: { voicesOff?: boolean; chordsOff?: boolean };
  harmonyStepComplete: boolean;
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
  pipeline: ArrangementPipelineResult | null;
  activeWorkflow: AccompanimentWorkflowSession | null;
  workflowAppliedMusicAbc: string;
  harmony: HarmonyPreviewModel;
  accompaniment: AccompanimentPreviewModel;
  getRenderOptionsFor: (abc: string, baseOptions: ComposerPreviewRenderOptions) => Record<string, unknown>;
}

export interface BuildArrangementPreviewModelInput {
  activeAbc: string;
  workflow: AccompanimentWorkflowSession | null;
  generatedAccompaniment: string | null;
  generatedGuitar: string | null;
  generatedPiano: string | null;
  harmonyLayerVisibility: HarmonyLayerVisibility;
  harmonyLayerVolumes: Record<string, number>;
  accompanimentLayerVisibility: AccompanimentLayerVisibility;
  accompanimentLayerVolumes: Record<string, number>;
}

function generatePipelineSafely(abc: string, fallback: ArrangementPipelineResult | null = null): ArrangementPipelineResult | null {
  try {
    return generateArrangementPipeline(abc);
  } catch {
    return fallback;
  }
}

export function buildArrangementSynthOptions(
  layerVisibility: Record<string, boolean>,
  abcString?: string
): { voicesOff?: boolean; chordsOff?: boolean } {
  const normalizedVisibility = normalizeAbcLayerVisibility(layerVisibility);
  const synthOptions: { voicesOff?: boolean; chordsOff?: boolean } = {};
  // Only set voicesOff if Melody is hidden AND the ABC still has a V:Melody voice.
  // When Melody is promoted away (replaced by an instrument as primary voice),
  // voicesOff would silence the promoted instrument since it's now the first voice.
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
  if (groupedStaffs && groupedStaffs.length > 0) {
    return groupedStaffs.findIndex((group) => group
      .replace(/[(){}\[\]]/g, " ")
      .split(/\s+/)
      .map(normalizeAbcVoiceId)
      .includes("Guitar"));
  }

  const bareVoices = scoreLine
    .split(/\s+/)
    .map((voice) => voice.trim())
    .filter(Boolean)
    .map(normalizeAbcVoiceId);
  return bareVoices.indexOf("Guitar");
}

export function getArrangementRenderOptionsFor(
  abc: string,
  baseOptions: ComposerPreviewRenderOptions,
  guitarTabEnabled: boolean
): Record<string, unknown> {
  if (!guitarTabEnabled) return baseOptions;

  let guitarIndex = getScoreGuitarStaffIndex(abc);

  if (guitarIndex === -1) {
    guitarIndex = extractAbcVoiceIds(abc, false).indexOf("Guitar");
  }

  if (guitarIndex >= 0) {
    return {
      staffwidth: baseOptions.staffwidth,
      paddingright: baseOptions.paddingright,
      stafftopmargin: 35,
      tablature: [
        ...Array.from({ length: guitarIndex }, () => ({ instrument: "" as const })),
        {
          instrument: "guitar" as const,
          label: "",
          tuning: ["E,", "A,", "D", "G", "B", "e"],
          capo: 0,
          hideTabSymbol: false,
        },
      ],
    };
  }

  return baseOptions;
}

export function buildArrangementPreviewModel(input: BuildArrangementPreviewModelInput): ArrangementPreviewModel {
  const pipeline = generatePipelineSafely(input.activeAbc);
  const activeWorkflow = isAccompanimentWorkflowSourceCurrent(input.workflow, input.activeAbc)
    ? input.workflow
    : null;
  const strongBeatsStepComplete = Boolean(
    activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "strong-beat-targets")
  );
  const harmonyVisibility = normalizeAbcLayerVisibility(input.harmonyLayerVisibility);
  const effectiveLayerVisibility = effectiveAccompanimentLayerVisibility(
    input.accompanimentLayerVisibility,
    strongBeatsStepComplete
  );
  const workflowAppliedMusicAbc = getWorkflowAppliedMusicAbc(activeWorkflow, input.activeAbc);
  const workflowAppliedPipeline = generatePipelineSafely(workflowAppliedMusicAbc, pipeline);
  const strongBeatDirectives = activeWorkflow
    ? (getSelectedWorkflowOption(activeWorkflow, "strong-beat-targets")?.data?.strongBeatDirectives as StrongBeatDirective[] | undefined)
    : undefined;
  const accompanimentSupportLayers = generateAccompanimentSupportLayers(workflowAppliedMusicAbc, {
    accompaniment: workflowAppliedPipeline?.accompaniment ?? null,
    workflow: activeWorkflow,
  });
  const accompanimentSupportSources = [
    accompanimentSupportLayers.djembe,
    accompanimentSupportLayers.flute,
    accompanimentSupportLayers.violin,
  ];
  const accompanimentBuild = buildAccompanimentAbc({
    baseAbc: workflowAppliedMusicAbc,
    generatedAccompaniment: input.generatedAccompaniment,
    generatedGuitar: input.generatedGuitar,
    generatedPiano: input.generatedPiano,
    extraVoiceSources: accompanimentSupportSources,
    layerVisibility: {
      __melody__: true,
      __chords__: true,
      __strong_beats__: strongBeatsStepComplete,
    },
    strongBeatDirectives,
  });
  const workflowAnnotationAbc = buildAccompanimentWorkflowAbcAnnotation(activeWorkflow);
  const rawAccompanimentWithoutVolumes = workflowAnnotationAbc
    ? `${accompanimentBuild.abc.trimEnd()}\n\n${workflowAnnotationAbc}`
    : accompanimentBuild.abc;
  const rawAccompanimentAbc = applyAbcLayerVolumes(rawAccompanimentWithoutVolumes, input.accompanimentLayerVolumes);
  const accompanimentVisibleVoices = getVisibleAbcVoiceIds(rawAccompanimentAbc, effectiveLayerVisibility);
  const hasGuitarVoice = accompanimentVisibleVoices.includes("Guitar");
  const guitarTabEnabled = Boolean(
    hasGuitarVoice && isAbcLayerVisible(ABC_LAYER_IDS.tab, effectiveLayerVisibility, false)
  );
  const rawHarmonyAbc = applyAbcLayerVolumes(workflowAppliedMusicAbc, input.harmonyLayerVolumes);
  const harmonyLayerVisibilityItems = extractAbcLayerVisibilityItems(rawHarmonyAbc, {
    tabEnabled: getVisibleAbcVoiceIds(rawHarmonyAbc, harmonyVisibility).includes("Guitar"),
  });
  const accompanimentLayerVisibilityItems = extractAbcLayerVisibilityItems(rawAccompanimentAbc, {
    includeStrongBeats: strongBeatsStepComplete,
    tabEnabled: hasGuitarVoice,
  });

  return {
    pipeline,
    activeWorkflow,
    workflowAppliedMusicAbc,
    harmony: {
      abc: applyAbcLayerVisibility(rawHarmonyAbc, harmonyVisibility),
      rawAbc: rawHarmonyAbc,
      layerVisibilityItems: harmonyLayerVisibilityItems,
      synthOptions: buildArrangementSynthOptions(harmonyVisibility),
      harmonyStepComplete: Boolean(
        activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "voice-leading-validation")
      ),
    },
    accompaniment: {
      abc: applyAbcLayerVisibility(rawAccompanimentAbc, effectiveLayerVisibility),
      rawAbc: rawAccompanimentAbc,
      layerVisibilityItems: accompanimentLayerVisibilityItems,
      voiceNames: extractAbcVoiceIds(rawAccompanimentAbc),
      visibleVoiceNames: accompanimentVisibleVoices,
      hasGuitarVoice,
      guitarTabEnabled,
      strongBeatsStepComplete,
      appliedWorkflowStep: getLatestSelectedWorkflowStep(activeWorkflow),
      effectiveLayerVisibility,
      hasLayerVisibilityControls: accompanimentLayerVisibilityItems.length > 0,
    },
    getRenderOptionsFor: (abc, baseOptions) => getArrangementRenderOptionsFor(abc, baseOptions, guitarTabEnabled),
  };
}
