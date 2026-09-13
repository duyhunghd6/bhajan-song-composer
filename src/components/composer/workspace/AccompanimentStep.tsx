import { type Dispatch, type SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import {
  ChordVoicingInspector,
  type VoicingAuditionRequest,
  type VoicingCandidate,
  type VoicingOverrideScope,
} from "../ChordVoicingInspector";
import type { InspectorIntegration } from "./voicing-inspector-integration";
import type { AccompanimentPreviewModel, ComposerPreviewRenderOptions } from "./arrangement-preview-model";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import AccompanimentWorkflowWizard from "../AccompanimentWorkflowWizard";
import {
  ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
  COMPOSER_STAFF_PLAYBACK_PROPS,
  ComposerNotationPreviewLayout,
} from "./preview";

interface AccompanimentStepProps {
  activeAbc: string;
  branchSourceAbc: string | null;
  pipeline: ArrangementPipelineResult | null;
  accompanimentPreview: AccompanimentPreviewModel;
  accompLayerVisibility: Record<string, boolean>;
  setAccompLayerVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  accompLayerVolumes: Record<string, number>;
  setAccompLayerVolumes: Dispatch<SetStateAction<Record<string, number>>>;
  getRenderOptionsFor: (abc: string, baseOptions: ComposerPreviewRenderOptions) => Record<string, unknown>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
  voicingInspector?: {
    targets: InspectorIntegration[];
    selectedTargetIndex: number;
    onSelectTarget: (index: number) => void;
    onApplyCandidate: (target: InspectorIntegration, candidate: VoicingCandidate, scope: VoicingOverrideScope) => void;
    onAuditionRequest: (request: VoicingAuditionRequest) => void;
  };
  projectPersistence?: {
    status: "idle" | "saving" | "saved" | "conflict" | "error";
    detail?: string;
    onCheckpoint: () => void;
  };
}

export function AccompanimentStep({
  activeAbc,
  branchSourceAbc,
  pipeline,
  accompanimentPreview,
  accompLayerVisibility,
  setAccompLayerVisibility,
  accompLayerVolumes,
  setAccompLayerVolumes,
  getRenderOptionsFor,
  ws,
  updateState,
  voicingInspector,
  projectPersistence,
}: AccompanimentStepProps) {
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
                <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Accompaniment Generation</h2>

                {!branchSourceAbc && (
                  <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Original melody reference</h3>
                    <AbcjsPlaybackController
                      abcString={activeAbc}
                      title="Original Melody Reference"
                      canvasId="composer-accompaniment-prerequisite"
                      renderOptions={ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS}
                    />
                  </section>
                )}
                <AccompanimentWorkflowWizard
                  mode="accompaniment"
                  sourceAbc={activeAbc}
                  branchSourceAbc={branchSourceAbc}
                  metadata={{
                    key: pipeline?.harmonization.key ?? "Unknown",
                    scale: pipeline?.harmonization.scale ?? "Unknown",
                    timeSignature: pipeline?.harmonization.timeSignature ?? "4/4",
                  }}
                  workflow={ws.accompanimentWorkflow}
                  workflowSetup={ws.accompanimentWorkflowSetup}
                  onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
                  onWorkflowSetupChange={(accompanimentWorkflowSetup) => updateState({ accompanimentWorkflowSetup })}
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
                title={appliedWorkflowStep ? `Resulting ABC Staff Preview: Step ${appliedWorkflowStep.label}` : "Accompaniment Music Sheet"}
                canvasId="composer-accompaniment-preview"
                {...COMPOSER_STAFF_PLAYBACK_PROPS}
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

              {voicingInspector && voicingInspector.targets.length > 0 && (() => {
                const target = voicingInspector.targets[voicingInspector.selectedTargetIndex] ?? voicingInspector.targets[0];
                if (!target) return null;
                return (
                  <section className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Strong-beat voicing</h2>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">Choose a realization of the locked harmony; this never edits the chord progression.</p>
                      </div>
                      <label className="text-sm text-zinc-700 dark:text-zinc-200">
                        Strong beat
                        <select
                          value={voicingInspector.selectedTargetIndex}
                          onChange={(event) => voicingInspector.onSelectTarget(Number(event.target.value))}
                          className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                          aria-label="Selected strong beat"
                        >
                          {voicingInspector.targets.map((candidate, index) => (
                            <option key={candidate.target.context.chordWindowId} value={index}>
                              m.{candidate.target.context.measure} · {candidate.target.context.chordIdentity}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <ChordVoicingInspector
                      context={target.target.context}
                      candidates={target.candidates}
                      onAuditionRequest={voicingInspector.onAuditionRequest}
                      onApplyCandidate={(candidate, scope) => voicingInspector.onApplyCandidate(target, candidate, scope)}
                    />
                  </section>
                );
              })()}

              {projectPersistence && (
                <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/50" aria-live="polite">
                  <span>
                    Project: <strong>{projectPersistence.status === "saving" ? "Saving" : projectPersistence.status === "saved" ? "Saved" : projectPersistence.status === "conflict" ? "Conflict saved for review" : projectPersistence.status === "error" ? "Save failed" : "Ready"}</strong>
                    {projectPersistence.detail ? ` · ${projectPersistence.detail}` : ""}
                  </span>
                  <button type="button" onClick={projectPersistence.onCheckpoint} className="rounded border px-3 py-1.5 text-sm">Save checkpoint</button>
                </section>
              )}
            </>
          )}
        />

        {ws.generatedAccompaniment && !ws.guitarAccompanimentData && (
          <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/70 dark:bg-amber-950/30">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
          </section>
        )}
      </div>
    );
}
