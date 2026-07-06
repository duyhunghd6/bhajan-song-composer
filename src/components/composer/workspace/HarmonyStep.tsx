import type { Dispatch, SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import AccompanimentWorkflowWizard from "../AccompanimentWorkflowWizard";
import type { HarmonyPreviewModel } from "./arrangement-preview-model";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import {
  COMPOSER_PREVIEW_PROPS,
  ComposerNotationPreviewLayout,
} from "./preview";

interface HarmonyStepProps {
  melodyAbc: string;
  initialMelodyAbc?: string;
  hasMounted: boolean;
  pipeline: ArrangementPipelineResult | null;
  harmonyPreview: HarmonyPreviewModel;
  layerVisibility: Record<string, boolean>;
  setLayerVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  layerVolumes: Record<string, number>;
  setLayerVolumes: Dispatch<SetStateAction<Record<string, number>>>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
  onRestore: () => void;
}

export function HarmonyStep({
  melodyAbc,
  initialMelodyAbc,
  hasMounted,
  pipeline,
  harmonyPreview,
  layerVisibility,
  setLayerVisibility,
  layerVolumes,
  setLayerVolumes,
  ws,
  updateState,
  onRestore,
}: HarmonyStepProps) {
  return (
    <div className="space-y-6">
      <ComposerNotationPreviewLayout
        source={
          <>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-sans">AI Harmonization Workflow</h2>
                <div className="flex items-center gap-1.5">
                  {hasMounted && initialMelodyAbc && melodyAbc !== initialMelodyAbc && (
                    <button
                      type="button"
                      onClick={onRestore}
                      title="Reset Original Melody"
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      <span className="text-sm">↺</span>
                      <span className="hidden sm:inline font-sans">Reset Original Melody</span>
                    </button>
                  )}
                </div>
              </div>

              <AccompanimentWorkflowWizard
                mode="harmony"
                sourceAbc={melodyAbc}
                metadata={{
                  key: pipeline?.harmonization.key ?? "Unknown",
                  scale: pipeline?.harmonization.scale ?? "Unknown",
                  timeSignature: pipeline?.harmonization.timeSignature ?? "4/4",
                }}
                workflow={ws.accompanimentWorkflow}
                workflowSetup={ws.accompanimentWorkflowSetup}
                onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
                onWorkflowSetupChange={(accompanimentWorkflowSetup) => updateState({ accompanimentWorkflowSetup })}
                onReset={onRestore}
              />
            </section>
          </>
        }
        preview={
          <>
            <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 font-sans">Layer Visibility</h2>
              <LayerVisibilityControls
                items={harmonyPreview.layerVisibilityItems}
                visibility={layerVisibility}
                onVisibilityChange={setLayerVisibility}
                volumes={layerVolumes}
                onVolumeChange={setLayerVolumes}
              />
            </section>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">Resulting ABC Staff Preview</h3>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-sans">
                  {harmonyPreview.harmonyStepComplete ? "Harmonized Melody" : "Source Melody"}
                </span>
              </div>
              <AbcjsPlaybackController
                abcString={harmonyPreview.abc}
                title="Harmonization Audio Preview"
                canvasId="composer-harmony-preview"
                synthOptions={harmonyPreview.synthOptions}
                {...COMPOSER_PREVIEW_PROPS}
              />
            </div>

            <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-sans">Current ABCNotation of the Song</h2>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 font-mono">
                {harmonyPreview.rawAbc}
              </pre>
            </section>
          </>
        }
      />
    </div>
  );
}
