import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import {
  buildAccompanimentWorkflowAbcAnnotation,
  getHarmonyValidationAbc,
  getSelectedWorkflowOption,
  getWorkflowAppliedMusicAbc,
  isAccompanimentWorkflowSourceCurrent,
  isAccompanimentWorkflowStepComplete,
  type AccompanimentWorkflowSession,
} from "@/lib/theory/accompaniment-workflow";
import { generateAccompanimentSupportLayers } from "@/lib/theory/accompaniment-workflow/support-layers";
import { generateArrangementPipeline, type ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { StrongBeatDirective } from "@/lib/theory/abc-beat-annotations";
import type { GeneratedGuitarOrigin } from "../../useWorkspaceState";
import type { ComposerPublishedNotationType } from "@/lib/songs/composer-notation";

/**
 * Source-current provenance and export-eligibility boundary for Composer branches.
 * This module derives eligible raw layers; preview transformations belong in
 * `arrangement-preview-model.ts` and must never become a new branch source.
 */
export type ComposerNotationLayerType = ComposerPublishedNotationType;

export interface ExportableNotationLayer {
  type: ComposerNotationLayerType;
  label: string;
  abc: string;
  provenance: string;
}

export interface ArrangementSourceWarning {
  code: "stale-workflow" | "harmony-required" | "fingerstyle-unavailable";
  message: string;
}

export interface ArrangementSourceGraph {
  pipeline: ArrangementPipelineResult | null;
  activeWorkflow: AccompanimentWorkflowSession | null;
  workflowAppliedMusicAbc: string;
  harmonyValidationAbc: string | null;
  harmonyStepComplete: boolean;
  strongBeatsStepComplete: boolean;
  strongBeatDirectives: StrongBeatDirective[] | undefined;
  accompanimentAbc: string;
  previewAbc: string;
  exportableLayers: ExportableNotationLayer[];
  warnings: ArrangementSourceWarning[];
}

export interface BuildArrangementSourceGraphInput {
  activeAbc: string;
  workflow: AccompanimentWorkflowSession | null;
  generatedAccompaniment: string | null;
  generatedGuitar: string | null;
  generatedGuitarOrigin: GeneratedGuitarOrigin;
  includeFingerstyle: boolean;
}

function generatePipelineSafely(abc: string, fallback: ArrangementPipelineResult | null = null): ArrangementPipelineResult | null {
  try {
    return generateArrangementPipeline(abc);
  } catch {
    return fallback;
  }
}

export function buildArrangementSourceGraph(input: BuildArrangementSourceGraphInput): ArrangementSourceGraph {
  const pipeline = generatePipelineSafely(input.activeAbc);
  const workflowIsCurrent = isAccompanimentWorkflowSourceCurrent(input.workflow, input.activeAbc);
  const activeWorkflow = workflowIsCurrent ? input.workflow : null;
  const harmonyValidationAbc = getHarmonyValidationAbc(activeWorkflow);
  const harmonyStepComplete = Boolean(
    activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "voice-leading-validation")
  );
  const strongBeatsStepComplete = Boolean(
    activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "key-beats")
  );
  const branchSourceAbc = harmonyValidationAbc ?? input.activeAbc;
  const workflowAppliedMusicAbc = getWorkflowAppliedMusicAbc(activeWorkflow, input.activeAbc);
  const workflowAppliedPipeline = generatePipelineSafely(branchSourceAbc, pipeline);
  const strongBeatDirectives = activeWorkflow
    ? (getSelectedWorkflowOption(activeWorkflow, "key-beats")?.data?.strongBeatDirectives as StrongBeatDirective[] | undefined)
    : undefined;
  const accompanimentSupportLayers = harmonyValidationAbc
    ? generateAccompanimentSupportLayers(branchSourceAbc, {
      accompaniment: workflowAppliedPipeline?.accompaniment ?? null,
      workflow: activeWorkflow,
    })
    : { djembe: null };
  const guitarClassicOption = activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "guitar-classic-abc-notation")
    ? getSelectedWorkflowOption(activeWorkflow, "guitar-classic-abc-notation")
    : null;
  const guitarClassicAbc = typeof guitarClassicOption?.data.guitarClassicAbc === "string"
    ? guitarClassicOption.data.guitarClassicAbc
    : null;
  const sharedAccompanimentInput = {
    baseAbc: branchSourceAbc,
    generatedAccompaniment: harmonyValidationAbc ? input.generatedAccompaniment : null,
    extraVoiceSources: [guitarClassicAbc, accompanimentSupportLayers.djembe],
    layerVisibility: {
      __melody__: true,
      __chords__: true,
      __strong_beats__: strongBeatsStepComplete,
    },
    strongBeatDirectives,
  };
  // `accompanimentAbc` remains the accompaniment-only layer. The optional
  // Fingerstyle inclusion below is final-preview composition, never an input
  // to either sibling branch or an accompaniment export replacement.
  const accompanimentBuild = buildAccompanimentAbc({
    ...sharedAccompanimentInput,
    generatedGuitar: null,
  });
  const previewBuild = buildAccompanimentAbc({
    ...sharedAccompanimentInput,
    generatedGuitar: harmonyValidationAbc && input.includeFingerstyle ? input.generatedGuitar : null,
  });
  const workflowAnnotationAbc = buildAccompanimentWorkflowAbcAnnotation(activeWorkflow);
  const appendWorkflowAnnotation = (abc: string) => workflowAnnotationAbc
    ? `${abc.trimEnd()}\n\n${workflowAnnotationAbc}`
    : abc;
  const accompanimentAbc = appendWorkflowAnnotation(accompanimentBuild.abc);
  const previewAbc = appendWorkflowAnnotation(previewBuild.abc);
  const exportableLayers: ExportableNotationLayer[] = [{
    type: "melody",
    label: "Melody Music Sheet",
    abc: input.activeAbc,
    provenance: "Composer melody draft",
  }];
  const warnings: ArrangementSourceWarning[] = [];

  if (input.workflow && !workflowIsCurrent) {
    warnings.push({
      code: "stale-workflow",
      message: "Harmony and accompaniment selections were created for an older melody draft and cannot be exported.",
    });
  }

  if (harmonyStepComplete && harmonyValidationAbc) {
    exportableLayers.push({
      type: "harmony",
      label: "Validated Harmony",
      abc: harmonyValidationAbc,
      provenance: "Harmony Step 3: voice-leading validation",
    });
    exportableLayers.push({
      type: "accompaniment",
      label: "Accompaniment Arrangement",
      abc: accompanimentAbc,
      provenance: "Validated harmony with completed accompaniment support",
    });
  } else {
    warnings.push({
      code: "harmony-required",
      message: "Complete and select Harmony Step 3 before accompaniment or Guitar Fingerstyle can be exported.",
    });
  }

  if (input.generatedGuitar && input.generatedGuitarOrigin === "fingerstyle-timegrid" && harmonyValidationAbc) {
    exportableLayers.push({
      type: "guitar-fingerstyle",
      label: "Guitar Fingerstyle",
      abc: input.generatedGuitar,
      provenance: "Independent Guitar Fingerstyle TimeGrid branch",
    });
  } else if (input.generatedGuitar || input.generatedGuitarOrigin === "fingerstyle-timegrid") {
    warnings.push({
      code: "fingerstyle-unavailable",
      message: "The saved Guitar Fingerstyle result is stale or incomplete and cannot be exported.",
    });
  }

  return {
    pipeline,
    activeWorkflow,
    workflowAppliedMusicAbc,
    harmonyValidationAbc,
    harmonyStepComplete,
    strongBeatsStepComplete,
    strongBeatDirectives,
    accompanimentAbc,
    previewAbc,
    exportableLayers,
    warnings,
  };
}
