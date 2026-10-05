import { Button, buttonStyles } from "@/components/ui/Button";
import { type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import GuitarChordAccompaniment from "@/components/music-sheet/guitar-chords/GuitarChordAccompaniment";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import styles from "./harmony.module.css";
import studio from "./studio.module.css";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import {
  ChordVoicingInspector,
  type VoicingAuditionRequest,
  type VoicingCandidate,
  type VoicingOverrideScope,
} from "../ChordVoicingInspector";
import type { InspectorIntegration, VoicingAuditionPreview } from "./voicing-inspector-integration";
import type { AccompanimentPreviewModel, ComposerPreviewRenderOptions } from "./arrangement-preview-model";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import AccompanimentWorkflowWizard from "../AccompanimentWorkflowWizard";
import {
  ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
  COMPOSER_STAFF_PLAYBACK_PROPS,
} from "./preview";

interface AccompanimentStepProps {
  slug: string;
  selectedInstrument: "guitar-classic" | "piano" | null;
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
    onAuditionRequest: (target: InspectorIntegration, request: VoicingAuditionRequest) => void;
    auditionPreview: VoicingAuditionPreview | null;
  };
  projectPersistence?: {
    status: "idle" | "saving" | "saved" | "conflict" | "error";
    detail?: string;
    onCheckpoint: () => void;
  };
}

export function AccompanimentStep({
  slug,
  selectedInstrument,
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

    const accompanimentReady = Boolean(branchSourceAbc && appliedWorkflowStep?.id === "guitar-classic-abc-notation");

    return (
      <div className={styles.workspace}>
        <section className={styles.score} aria-label="Accompaniment score preview">
          <GuitarChordAccompaniment
            sourceAbc={branchSourceAbc ?? activeAbc}
            overrides={ws.voicingOverrides}
            onOverridesChange={(voicingOverrides) => updateState({ voicingOverrides })}
            chordVolume={accompLayerVolumes.ChordProgression ?? 100}
            abcString={accompanimentAbc}
            title={appliedWorkflowStep ? `Resulting ABC Staff Preview: Step ${appliedWorkflowStep.label}` : "Accompaniment Music Sheet"}
            canvasId="composer-accompaniment-preview"
            {...COMPOSER_STAFF_PLAYBACK_PROPS}
            renderOptions={getRenderOptionsFor(accompanimentAbc, ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS)}
          />

        </section>
        <aside className={styles.tools} aria-label="Accompaniment tools">
          <div className={styles.toolHeading}>
            <h1>Accompaniment</h1>
            <span className={styles.status}>{accompanimentReady ? "Accompaniment applied" : branchSourceAbc ? "Harmony ready" : "Source melody"}</span>
          </div>
          <Link href={`/compose/${slug}/harmony`} className={buttonStyles({ variant: "ghost", size: "sm", className: styles.editLink })}>← Review harmony</Link>
          {hasLayerVisibilityControls && (
            <details className={styles.disclosure} open><summary>Layers & volume <span>Adjust what you see and hear</span></summary>
              <div className={styles.mixer}><LayerVisibilityControls items={layerVisibilityItems} visibility={accompLayerVisibility} onVisibilityChange={setAccompLayerVisibility} volumes={accompLayerVolumes} onVolumeChange={setAccompLayerVolumes} /></div>
            </details>
          )}
              {projectPersistence && (
                <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/50" aria-live="polite">
                  <span>
                    Project: <strong>{projectPersistence.status === "saving" ? "Saving" : projectPersistence.status === "saved" ? "Saved" : projectPersistence.status === "conflict" ? "Conflict saved for review" : projectPersistence.status === "error" ? "Save failed" : "Ready"}</strong>
                    {projectPersistence.detail ? ` · ${projectPersistence.detail}` : ""}
                  </span>
                  <Button variant="secondary" size="sm" type="button" onClick={projectPersistence.onCheckpoint} >Save checkpoint</Button>
                </section>
              )}
        </aside>
        <aside className={styles.assistant} aria-label="Accompaniment assistant">
          <div className={styles.assistantHeading}><span className={styles.spark} aria-hidden="true">♫</span><div><h2>Accompaniment assistant</h2><p>Choose the support for your melody.</p></div></div>
          <div className={styles.panelBody}>
              <details className={styles.disclosure}><summary>ABC notation <span>{accompanimentReady ? "View the generated arrangement" : "View the current source"}</span></summary>
                <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 font-mono text-xs leading-6 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{rawAccompanimentAbc}</pre>
              </details>
              {voicingInspector && voicingInspector.targets.length > 0 && (() => {
                const target = voicingInspector.targets[voicingInspector.selectedTargetIndex] ?? voicingInspector.targets[0];
                if (!target) return null;
                return (
                  <details className={styles.disclosure}><summary>Strong-beat voicing <span>Refine chord shapes</span></summary><div className="pt-4">
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
                      onAuditionRequest={(request) => voicingInspector.onAuditionRequest(target, request)}
                      onApplyCandidate={(candidate, scope) => voicingInspector.onApplyCandidate(target, candidate, scope)}
                    />
                    {voicingInspector.auditionPreview && (
                      <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/20">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{voicingInspector.auditionPreview.title}</h3>
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Audition preview only — the Harmony source remains unchanged. Use Play in this player to hear the selected realization.</p>
                        <div className="mt-3">
                          <AbcjsPlaybackController
                            abcString={voicingInspector.auditionPreview.abc}
                            title={voicingInspector.auditionPreview.title}
                            canvasId={`composer-voicing-audition-${target.target.context.chordWindowId}`}
                            controls
                            synthOptions={{ chordsOff: true }}
                            showLoopControls={false}
                            allowPdfDownload={false}
                            minWidthClassName="min-w-0"
                            sheetViewportClassName="p-2"
                          />
                        </div>
                      </section>
                    )}
                  </div></details>
                );
              })()}
          </div>
          {!branchSourceAbc ? (
            <div className={studio.prerequisite}>
              <span className={studio.eyebrow}>Before you begin</span>
              <h3>Start with a harmony you love</h3>
              <p>Your accompaniment follows the chords you choose. Complete the three harmony steps and select a validated result to begin.</p>
              <Link className={buttonStyles({ variant: "primary" })} href={`/compose/${slug}/harmony`}>Choose your harmony →</Link>
              <p className={studio.hint}>Your melody is available to preview here.</p>
            </div>
          ) : (
            <>
              {selectedInstrument === "piano" && <p className={studio.prerequisite}>Piano is available in the experimental mockups. This workspace creates guitar accompaniment.</p>}
              <AccompanimentWorkflowWizard
                mode="accompaniment"
                presentation="studio"
                sourceAbc={activeAbc}
                branchSourceAbc={branchSourceAbc}
                metadata={{ key: pipeline?.harmonization.key ?? "Unknown", scale: pipeline?.harmonization.scale ?? "Unknown", timeSignature: pipeline?.harmonization.timeSignature ?? "4/4" }}
                workflow={ws.accompanimentWorkflow}
                workflowSetup={ws.accompanimentWorkflowSetup}
                onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
                onWorkflowSetupChange={(accompanimentWorkflowSetup) => updateState({ accompanimentWorkflowSetup })}
              />
              <div className={styles.nextStep}>
                <p>{accompanimentReady ? "Review your selected layers when you are happy with the sound." : "Generate suggestions, then choose an accompaniment to hear it in your score."}</p>
                {accompanimentReady && <Link className={buttonStyles({ variant: "primary" })} href={`/compose/${slug}/review`}>Review & export →</Link>}
              </div>
            </>
          )}
        </aside>
      </div>
    );
}
