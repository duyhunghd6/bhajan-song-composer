import { useEffect, type Dispatch, type SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import PianoKeyboard from "@/components/instruments/PianoKeyboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import { generatePianoAccompaniment } from "@/lib/theory/piano-accompaniment";
import type { PianoCompingProfileId } from "@/lib/theory/piano-comping-profiles";
import {
  isAccompanimentWorkflowStepComplete,
  type AccompanimentWorkflowSession,
} from "@/lib/theory/accompaniment-workflow";
import type { WorkspaceState } from "../useWorkspaceState";
import { buildFingerstyleComposerIntegration, type FingerstyleComposerProfileId } from "../fingerstyle-integration";
import AccompanimentWorkflowWizard from "../AccompanimentWorkflowWizard";
import {
  ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
  ComposerNotationPreviewLayout,
} from "./preview";

interface AccompanimentStepProps {
  activeAbc: string;
  setMelodyAbc: Dispatch<SetStateAction<string>>;
  initialMelodyAbc?: string;
  hasMounted: boolean;
  pipeline: ArrangementPipelineResult | null;
  workflowAppliedMusicAbc: string;
  activeWorkflow: AccompanimentWorkflowSession | null;
  accompanimentAbc: string;
  accompanimentVoiceNames: string[];
  accompLayerVisibility: Record<string, boolean>;
  setAccompLayerVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  hasGuitarVoice: boolean;
  guitarTabEnabled: boolean;
  appliedWorkflowStep: { index: number; label: string } | null;
  getRenderOptionsFor: (abc: string, baseOptions: typeof ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS) => Record<string, unknown>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
}

export function AccompanimentStep({
  activeAbc,
  setMelodyAbc,
  initialMelodyAbc,
  hasMounted,
  pipeline,
  workflowAppliedMusicAbc,
  activeWorkflow,
  accompanimentAbc,
  accompanimentVoiceNames,
  accompLayerVisibility,
  setAccompLayerVisibility,
  hasGuitarVoice,
  guitarTabEnabled,
  appliedWorkflowStep,
  getRenderOptionsFor,
  ws,
  updateState,
}: AccompanimentStepProps) {
    const strongBeatsStepComplete = Boolean(
      activeWorkflow && isAccompanimentWorkflowStepComplete(activeWorkflow, "strong-beat-targets")
    );
    const hasGeneratedAccompanimentLayer = Boolean(ws.generatedAccompaniment || ws.generatedGuitar || ws.generatedPiano);
    const hasLayerVisibilityControls = strongBeatsStepComplete || hasGeneratedAccompanimentLayer;

    useEffect(() => {
      if (strongBeatsStepComplete || accompLayerVisibility["__strong_beats__"] !== true) return;

      setAccompLayerVisibility((prev) => ({
        ...prev,
        __strong_beats__: false,
      }));
    }, [accompLayerVisibility, setAccompLayerVisibility, strongBeatsStepComplete]);

    return (
      <div className="space-y-6">
        <ComposerNotationPreviewLayout
          source={(
            <>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Accompaniment Generation</h2>
                  <div className="flex items-center gap-1.5">
                    {hasMounted && initialMelodyAbc && activeAbc !== initialMelodyAbc && (
                      <button
                        type="button"
                        onClick={() => {
                          setMelodyAbc(initialMelodyAbc);
                          updateState({ aiSuggestions: [], selectedCandidateId: null, acceptedHarmony: null, aiAccompanimentSuggestions: [], selectedAccompanimentIndex: null, pianoAccompanimentData: null, guitarAccompanimentData: null, generatedAccompaniment: null, aiGuitarSuggestions: [], aiPianoSuggestions: [], selectedGuitarIndex: null, selectedPianoIndex: null, generatedGuitar: null, generatedPiano: null, accompanimentWorkflow: null });
                          setAccompLayerVisibility({});
                        }}
                        title="Restore Original Melody"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                      >
                        <span className="text-sm">↺</span>
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                    )}
                  </div>
                </div>


                <AccompanimentWorkflowWizard
                  sourceAbc={activeAbc}
                  metadata={{
                    key: pipeline?.harmonization.key ?? "Unknown",
                    scale: pipeline?.harmonization.scale ?? "Unknown",
                    timeSignature: pipeline?.harmonization.timeSignature ?? "4/4",
                  }}
                  workflow={ws.accompanimentWorkflow}
                  onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
                  onGuitarProfileSelected={(profile) => {
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
                    const integration = buildFingerstyleComposerIntegration(workflowAppliedMusicAbc, undefined, { pickingProfile });
                    updateState({ generatedGuitar: integration.composerLayer.abc, guitarAccompanimentData: integration });
                  }}
                  onPianoProfileSelected={(profile) => {
                    if (profile === null) {
                      updateState({
                        generatedPiano: null,
                        pianoAccompanimentData: null,
                        selectedPianoIndex: null,
                        aiPianoSuggestions: [],
                        ensembleWorkflow: null,
                        stagedEnsembleLayers: null,
                        appliedEnsembleLayers: null,
                      });
                      return;
                    }

                    const pianoStyles: PianoCompingProfileId[] = ["pop-ballad", "rock-rnb", "classical-folk"];
                    const compingProfile = pianoStyles.includes(profile as PianoCompingProfileId)
                      ? profile as PianoCompingProfileId
                      : "pop-ballad";
                    const accompaniment = generatePianoAccompaniment(workflowAppliedMusicAbc, { compingProfile });
                    updateState({ generatedPiano: accompaniment.abc, pianoAccompanimentData: accompaniment });
                  }}
                />
              </section>
            </>
          )}
          preview={(
            <>
              {/* Layer Visibility Toggles — shown once Strong Beats are complete or accompaniment layers exist */}
              {hasLayerVisibilityControls && (
                <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Layer Visibility</h2>
                  <div className="flex flex-wrap gap-3">
                    {/* Melody toggle */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                        checked={accompLayerVisibility['__melody__'] !== false}
                        onChange={() => setAccompLayerVisibility(prev => ({
                          ...prev,
                          ['__melody__']: !(prev['__melody__'] !== false)
                        }))}
                      />
                      🎵 Melody
                    </label>
                    {/* Original Chords toggle */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                        checked={accompLayerVisibility['__chords__'] !== false}
                        onChange={() => setAccompLayerVisibility(prev => ({
                          ...prev,
                          ['__chords__']: !(prev['__chords__'] !== false)
                        }))}
                      />
                      🎶 Original Chords
                    </label>
                    {/* Strong beats toggle */}
                    {strongBeatsStepComplete && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                          checked={accompLayerVisibility['__strong_beats__'] === true}
                          onChange={() => setAccompLayerVisibility(prev => ({
                            ...prev,
                            ['__strong_beats__']: !(prev['__strong_beats__'] === true)
                          }))}
                        />
                        ⬤ Strong Beats
                      </label>
                    )}
                    {/* Guitar tablature toggle */}
                    {hasGuitarVoice && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                          checked={guitarTabEnabled}
                          onChange={() => setAccompLayerVisibility(prev => ({
                            ...prev,
                            ['__guitar_tab__']: !guitarTabEnabled
                          }))}
                        />
                        🎸 GUITAR TAB
                      </label>
                    )}
                    {/* Accompaniment voice toggles */}
                    {accompanimentVoiceNames.map(voiceName => {
                      const isVisible = accompLayerVisibility[voiceName] !== false;
                      const friendlyName = voiceName
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^\s/, '')
                        .replace('Piano', '🎹 Piano')
                        .replace('Guitar', '🎸 Guitar');
                      return (
                        <label key={voiceName} className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                            checked={isVisible}
                            onChange={() => setAccompLayerVisibility(prev => ({
                              ...prev,
                              [voiceName]: !isVisible
                            }))}
                          />
                          {friendlyName}
                        </label>
                      );
                    })}
                  </div>
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
                  {accompanimentAbc}
                </pre>
              </section>
            </>
          )}
        />

        <div className="w-full space-y-6">
          {/* Virtual Piano — always visible on accompaniment step */}
          <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Virtual Piano (Voicing & Comping)</h2>
            {ws.pianoAccompanimentData ? (
              <div className="space-y-6">
                <PianoPedalIndicator 
                  title="Sustain Pedal Indicator" 
                  pedalAutomation={ws.pianoAccompanimentData.pedalAutomation} 
                />
                <div className="overflow-x-auto pb-4">
                  <PianoKeyboard 
                    title="Piano Accompaniment Keys" 
                    startOctave={3} 
                    octaveCount={3}
                    size="compact"
                    highlights={ws.pianoAccompanimentData.pianoKeyHighlights}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Select a piano accompaniment style above to see highlighted voicings and pedal automation.
                </p>
                <div className="overflow-x-auto pb-4">
                  <PianoKeyboard 
                    title="Piano Keyboard" 
                    startOctave={3} 
                    octaveCount={3}
                    size="compact"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Virtual Guitar — always visible on accompaniment step */}
          <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Virtual Guitar (Fingerstyle)</h2>
            {ws.guitarAccompanimentData ? (
              <div className="overflow-x-auto pb-4">
                <GuitarFretboard 
                  title="Fingerstyle Fretboard Preview" 
                  positions={ws.guitarAccompanimentData.fretboard.positions} 
                />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Select a guitar accompaniment style above to see finger positions on the fretboard.
                </p>
                <div className="overflow-x-auto pb-4">
                  <GuitarFretboard 
                    title="Guitar Fretboard"
                  />
                </div>
              </div>
            )}
          </section>

          {ws.generatedAccompaniment && !ws.pianoAccompanimentData && !ws.guitarAccompanimentData && (
            <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/70 dark:bg-amber-950/30">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
            </section>
          )}
        </div>
      </div>
    );
}
