import { type Dispatch, type SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import { generatePianoAccompaniment } from "@/lib/theory/piano-accompaniment";
import type { PianoCompingProfileId } from "@/lib/theory/piano-comping-profiles";
import type { WorkspaceState } from "../useWorkspaceState";
import type { AccompanimentPreviewModel, ComposerPreviewRenderOptions } from "./arrangement-preview-model";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import { buildFingerstyleComposerIntegration, type FingerstyleComposerProfileId } from "../fingerstyle-integration";
import AccompanimentWorkflowWizard from "../AccompanimentWorkflowWizard";
import type { AccompanimentWorkflowOption } from "@/lib/theory/accompaniment-workflow";
import {
  ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
  ComposerNotationPreviewLayout,
} from "./preview";

interface GuitarFingerstyleStepProps {
  activeAbc: string;
  hasMounted: boolean;
  pipeline: ArrangementPipelineResult | null;
  workflowAppliedMusicAbc: string;
  accompanimentPreview: AccompanimentPreviewModel;
  accompLayerVisibility: Record<string, boolean>;
  setAccompLayerVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  accompLayerVolumes: Record<string, number>;
  setAccompLayerVolumes: Dispatch<SetStateAction<Record<string, number>>>;
  getRenderOptionsFor: (abc: string, baseOptions: ComposerPreviewRenderOptions) => Record<string, unknown>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
  canResetGuitarBranchWork: boolean;
  onResetGuitarBranchWork: () => void;
}

export function GuitarFingerstyleStep({
  activeAbc,
  hasMounted,
  pipeline,
  workflowAppliedMusicAbc,
  accompanimentPreview,
  accompLayerVisibility,
  setAccompLayerVisibility,
  accompLayerVolumes,
  setAccompLayerVolumes,
  getRenderOptionsFor,
  ws,
  updateState,
  canResetGuitarBranchWork,
  onResetGuitarBranchWork,
}: GuitarFingerstyleStepProps) {
    const {
      abc: accompanimentAbc,
      rawAbc: rawAccompanimentAbc,
      layerVisibilityItems,
      appliedWorkflowStep,
      hasLayerVisibilityControls,
    } = accompanimentPreview;

    return (
      <div className="space-y-6">
        <ComposerNotationPreviewLayout
          source={(
            <>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Guitar Fingerstyle Generation</h2>
                  <div className="flex items-center gap-1.5">
                    {hasMounted && canResetGuitarBranchWork && (
                      <button
                        type="button"
                        onClick={onResetGuitarBranchWork}
                        title="Clear Guitar Branch Work"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                      >
                        <span className="text-sm">↺</span>
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                    )}
                  </div>
                </div>


                <AccompanimentWorkflowWizard
                  mode="guitar"
                  sourceAbc={activeAbc}
                  metadata={{
                    key: pipeline?.harmonization.key ?? "Unknown",
                    scale: pipeline?.harmonization.scale ?? "Unknown",
                    timeSignature: pipeline?.harmonization.timeSignature ?? "4/4",
                  }}
                  workflow={ws.accompanimentWorkflow}
                  workflowSetup={ws.accompanimentWorkflowSetup}
                  onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
                  onWorkflowSetupChange={(accompanimentWorkflowSetup) => updateState({ accompanimentWorkflowSetup })}
                  onReset={onResetGuitarBranchWork}
                  onGuitarProfileSelected={(profile, option?: AccompanimentWorkflowOption) => {
                    if (profile === null) {
                      updateState({
                        generatedGuitar: null,
                        guitarAccompanimentData: null,
                        selectedGuitarIndex: null,
                        aiGuitarSuggestions: [],
                        ensembleWorkflow: null,
                        stagedEnsembleLayers: null,
                        appliedEnsembleLayers: null,
                      });
                      return;
                    }

                    const guitarProfiles: FingerstyleComposerProfileId[] = ["strict-pima", "folk-travis"];
                    const pickingProfile = guitarProfiles.includes(profile as FingerstyleComposerProfileId)
                      ? profile as FingerstyleComposerProfileId
                      : "strict-pima";
                    const integration = buildFingerstyleComposerIntegration(workflowAppliedMusicAbc, undefined, {
                      pickingProfile,
                      workflowOptionData: option?.data,
                    });
                    updateState({ generatedGuitar: integration.composerLayer.abc, guitarAccompanimentData: integration });
                    setAccompLayerVisibility((prev) => ({ ...prev, TAB: true }));
                  }}
                />
              </section>
            </>
          )}
          preview={(
            <>
              {hasLayerVisibilityControls && (
                <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Layer Visibility</h2>
                  <LayerVisibilityControls
                    items={layerVisibilityItems}
                    visibility={accompLayerVisibility}
                    onVisibilityChange={setAccompLayerVisibility}
                    volumes={accompLayerVolumes}
                    onVolumeChange={setAccompLayerVolumes}
                  />
                </section>
              )}

              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Resulting ABC Staff Preview</h3>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Bounded preview
                </span>
              </div>
              <AbcjsPlaybackController
                abcString={accompanimentAbc}
                title={appliedWorkflowStep ? `Resulting ABC Staff Preview: Step ${appliedWorkflowStep.label}` : "Guitar Fingerstyle Music Sheet"}
                canvasId="composer-guitar-preview"
                minWidthClassName="min-w-[520px]"
                sheetViewportClassName="max-h-[min(76vh,860px)] overflow-auto p-4"
                renderOptions={getRenderOptionsFor(accompanimentAbc, ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS)}
              />
              {appliedWorkflowStep && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ABCNotation applied after Step {appliedWorkflowStep.index}: {appliedWorkflowStep.label}
                </p>
              )}

              <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Generated ABC Source</h2>
                <pre className="mt-3 max-h-[min(30vh,300px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {rawAccompanimentAbc}
                </pre>
              </section>
            </>
          )}
        />

        {ws.generatedAccompaniment && !ws.pianoAccompanimentData && !ws.guitarAccompanimentData && (
          <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/70 dark:bg-amber-950/30">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
          </section>
        )}
      </div>
    );
}
