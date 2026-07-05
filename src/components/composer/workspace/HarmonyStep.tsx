import type { Dispatch, SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { harmonizeMelody } from "@/app/actions/harmonize";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import TheoryAssistant from "../TheoryAssistant";
import { buildTheoryAssistantLayerProposal, type TheoryAssistantArrangementSuggestion } from "../theory-assistant-layer";
import {
  COMPOSER_PREVIEW_PROPS,
  ComposerNotationPreviewLayout,
  formatCandidateConfidence,
  harmonizationOptionAbc,
  harmonizationOptionId,
  harmonizationOptionLabel,
} from "./preview";

interface HarmonyStepProps {
  melodyAbc: string;
  setMelodyAbc: Dispatch<SetStateAction<string>>;
  initialMelodyAbc?: string;
  activeAbc: string;
  hasMounted: boolean;
  isHarmonizing: boolean;
  setIsHarmonizing: Dispatch<SetStateAction<boolean>>;
  pipeline: ArrangementPipelineResult | null;
  layerVisibility: { melody: boolean; harmony: boolean };
  setLayerVisibility: Dispatch<SetStateAction<{ melody: boolean; harmony: boolean }>>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
  currentSuggestion: TheoryAssistantArrangementSuggestion | null;
  setCurrentSuggestion: Dispatch<SetStateAction<TheoryAssistantArrangementSuggestion | null>>;
}

export function HarmonyStep({
  melodyAbc,
  setMelodyAbc,
  initialMelodyAbc,
  activeAbc,
  hasMounted,
  isHarmonizing,
  setIsHarmonizing,
  pipeline,
  layerVisibility,
  setLayerVisibility,
  ws,
  updateState,
  currentSuggestion,
  setCurrentSuggestion,
}: HarmonyStepProps) {
  let harmonyPreviewAbc = "";
  if (ws.acceptedHarmony) {
    harmonyPreviewAbc = `${activeAbc.trimEnd()}

${ws.acceptedHarmony.abc}`;
  } else {
    harmonyPreviewAbc = activeAbc;
  }

  const harmonySynthOptions: { voicesOff?: boolean; chordsOff?: boolean } = {};
  if (!layerVisibility.melody) {
    harmonySynthOptions.voicesOff = true;
  }
  if (!layerVisibility.harmony) {
    harmonySynthOptions.chordsOff = true;
  }

    return (
      <div className="space-y-6">
        <ComposerNotationPreviewLayout
          source={(
            <>
              <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Analysis Settings</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">
                    Detect Key
                  </button>
                  <button type="button" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                    Set Raga
                  </button>
                  <button
                    type="button"
                    disabled={isHarmonizing || !pipeline}
                    onClick={async () => {
                      if (!pipeline) return;
                      setIsHarmonizing(true);
                      try {
                        const result = await harmonizeMelody(melodyAbc, {
                          key: pipeline.harmonization.key,
                          scale: pipeline.harmonization.scale,
                          timeSignature: pipeline.harmonization.timeSignature
                        });
                        updateState({ aiSuggestions: result.options });
                        updateState({ selectedCandidateId: null });
                      } catch (err) {
                        console.error(err);
                        alert("Failed to harmonize using AI.");
                      } finally {
                        setIsHarmonizing(false);
                      }
                    }}
                    className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-600 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
                  >
                    {isHarmonizing ? "Generating Options..." : "✨ Suggest AI Harmonization"}
                  </button>
                  {hasMounted && initialMelodyAbc && activeAbc !== initialMelodyAbc && (
                    <button
                      type="button"
                      onClick={() => {
                        setMelodyAbc(initialMelodyAbc);
                        updateState({ aiSuggestions: [], selectedCandidateId: null, acceptedHarmony: null });
                      }}
                      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      ↺ Restore Original Melody
                    </button>
                  )}
                </div>
                
                {ws.aiSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Suggested Progressions</h3>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {ws.aiSuggestions.map((option, idx) => {
                        const candidateId = harmonizationOptionId(option, idx);
                        const candidateLabel = harmonizationOptionLabel(option);
                        const candidateAbc = harmonizationOptionAbc(option);
                        const isSelected = ws.selectedCandidateId === candidateId;

                        return (
                          <button
                            key={candidateId}
                            onClick={() => {
                              updateState({ selectedCandidateId: candidateId });

                              // Automatically accept it as a harmony layer to generate the separate V:Chords staff
                              try {
                                const proposal = buildTheoryAssistantLayerProposal(candidateAbc, { skillLevel: "intermediate", capoFret: 0 });
                                proposal.name = `AI Option: ${candidateLabel}`;
                                updateState({ acceptedHarmony: proposal });
                              } catch (e) {
                                console.error("Failed to build layer proposal for AI option", e);
                              }
                            }}
                            className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                              isSelected
                                ? "border-amber-400 bg-amber-500/10 shadow-sm"
                                : "border-zinc-200 bg-white hover:border-amber-300/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Option {idx + 1}: {candidateLabel}</h4>
                              {isSelected && (
                                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Active</span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              <span>{option.style}</span>
                              <span>Confidence {formatCandidateConfidence(option.confidence)}</span>
                            </div>
                            {option.progression.length > 0 && (
                              <p className="mt-2 font-mono text-xs text-amber-700 dark:text-amber-300">
                                {option.progression.join(" → ")}
                              </p>
                            )}
                            {option.romanNumerals.length > 0 && (
                              <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                {option.romanNumerals.join(" → ")}
                              </p>
                            )}
                            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                              {option.explanation}
                            </p>
                            {option.warnings.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                                {option.warnings.map((warning) => (
                                  <li key={warning}>{warning}</li>
                                ))}
                              </ul>
                            )}
                            {option.validationNotes.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
                                {option.validationNotes.map((note) => (
                                  <li key={note}>{note}</li>
                                ))}
                              </ul>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
              <TheoryAssistant abc={activeAbc} onAcceptArrangement={(val) => updateState({ acceptedHarmony: val })} onAnalysisChange={setCurrentSuggestion} />
            </>
          )}
          preview={(
            <>
              <section className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Layer Visibility</h2>
                <div className="mt-3 flex gap-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                      checked={layerVisibility.melody} 
                      onChange={e => setLayerVisibility(v => ({ ...v, melody: e.target.checked }))} 
                    /> 
                    Melody Layer
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                      checked={layerVisibility.harmony} 
                      onChange={e => setLayerVisibility(v => ({ ...v, harmony: e.target.checked }))} 
                    /> 
                    Harmonic Chord Progression Layer
                  </label>
                </div>
              </section>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Harmonization Preview</h3>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Bounded preview
                  </span>
                </div>
                <AbcjsPlaybackController
                  abcString={harmonyPreviewAbc}
                  title="Harmonization Audio Preview"
                  canvasId="composer-harmony-preview"
                  synthOptions={harmonySynthOptions}
                  {...COMPOSER_PREVIEW_PROPS}
                />
              </div>

              <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Current ABCNotation of the Song</h2>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {activeAbc}
                </pre>
              </section>
            </>
          )}
        />

        <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="composer-step-responsive-grid grid gap-0">
            <div className="border-b border-zinc-100 p-5 dark:border-zinc-800 min-[1280px]:border-r min-[1280px]:border-b-0">
              <section className="h-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                <h2 className="mb-2 text-lg font-bold text-emerald-900 dark:text-emerald-100">Composer Layer Note</h2>
                {currentSuggestion ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white/60 p-3 text-xs leading-5 text-emerald-900 dark:bg-zinc-900/50 dark:text-emerald-200">
                    {currentSuggestion.abcBlock}
                  </pre>
                ) : (
                  <p>Accept an arrangement from the Theory Assistant to see the composer layer note.</p>
                )}
              </section>
            </div>
            <div className="p-5">
              <section className="h-full rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Chord Track Editor (Ghosted Melody below)</h2>
                <pre className="mt-3 max-h-[min(54vh,640px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {`% Ghosted melody context\n${activeAbc}\n\n% Chord Track Editor\n${ws.acceptedHarmony ? ws.acceptedHarmony.abc : "% Accept an arrangement from the Theory Assistant to see the chord track here."}`}
                </pre>
              </section>
            </div>
          </div>
        </section>

      </div>
    );
}
