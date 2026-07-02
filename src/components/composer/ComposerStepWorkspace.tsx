"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import PianoKeyboard from "@/components/instruments/PianoKeyboard";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { buildArrangementLayerProposals, generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";
import { harmonizeMelody, type HarmonizationOption } from "@/app/actions/harmonize";
import { buildFingerstyleComposerIntegration, FINGERSTYLE_PROFILE_OPTIONS, type FingerstyleComposerProfileId } from "./fingerstyle-integration";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import TheoryAssistant from "./TheoryAssistant";
import type { ComposerStepId } from "./composer-steps";
import { buildTheoryAssistantLayerProposal, type TheoryAssistantArrangementSuggestion, type TheoryAssistantLayerProposal } from "./theory-assistant-layer";

interface ComposerStepWorkspaceProps {
  slug: string;
  step: ComposerStepId;
  initialMelodyAbc?: string;
}

interface ComposerNotationPreviewLayoutProps {
  source: ReactNode;
  preview: ReactNode;
}

const COMPOSER_PREVIEW_RENDER_OPTIONS = {
  staffwidth: 720,
  wrap: {
    minSpacing: 1.7,
    maxSpacing: 2.5,
    preferredMeasuresPerLine: 4,
    lastLineLimit: 0.6,
  },
  paddingright: 32,
};

const COMPOSER_PREVIEW_PROPS = {
  minWidthClassName: "min-w-[520px] max-w-[760px]",
  sheetViewportClassName: "max-h-[min(72vh,780px)] overflow-auto p-4",
  renderOptions: COMPOSER_PREVIEW_RENDER_OPTIONS,
};

function ComposerNotationPreviewLayout({ source, preview }: ComposerNotationPreviewLayoutProps) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="composer-step-responsive-grid grid gap-0 min-[1536px]:grid-cols-2">
        <div className="composer-step-source-panel min-w-0 space-y-5 border-b border-zinc-100 p-5 dark:border-zinc-800 min-[1536px]:border-r min-[1536px]:border-b-0">
          {source}
        </div>
        <div className="min-w-0 space-y-3 p-5">
          {preview}
        </div>
      </div>
    </section>
  );
}

export default function ComposerStepWorkspace({ slug, step, initialMelodyAbc }: ComposerStepWorkspaceProps) {
  const [melodyAbc, setMelodyAbc] = useState(initialMelodyAbc ?? DEFAULT_ABC);
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  // --- AI HARMONIZATION STATE ---
  // aiSuggestions: Stores the 5 options returned by the LLM Harmonization action.
  const [aiSuggestions, setAiSuggestions] = useState<HarmonizationOption[]>([]);
  // selectedSuggestionIndex: Tracks which of the 5 options is currently being previewed by the user.
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  
  // --- LAYER ARCHITECTURE STATE ---
  // acceptedHarmony: Stores the isolated chord progression as a separate ABC layer (e.g. V:Chords).
  // This is used to render the separate piano/guitar highlights and the dedicated ABCJS chord staff.
  const [acceptedHarmony, setAcceptedHarmony] = useState<TheoryAssistantLayerProposal | null>(null);
  // layerVisibility: Toggles to independently show/hide the melody staff and the chord staff in the preview.
  const [layerVisibility, setLayerVisibility] = useState({ melody: true, harmony: true });
  // currentSuggestion: Tracks the theory assistant's real-time localized analysis of the active chords.
  const [currentSuggestion, setCurrentSuggestion] = useState<TheoryAssistantArrangementSuggestion | null>(null);
  const [engine, setEngine] = useState<"piano" | "fingerstyle">("piano");
  const [profileId, setProfileId] = useState<FingerstyleComposerProfileId>("strict-pima");
  const [generatedAccompaniment, setGeneratedAccompaniment] = useState<string | null>(null);
  const [ensembleEnabled, setEnsembleEnabled] = useState({ djembe: true, flute: true, violin: false });
  const [copyStatus, setCopyStatus] = useState("Copy Markdown");

  const pipeline = useMemo(() => {
    try {
      return generateArrangementPipeline(melodyAbc);
    } catch {
      return null;
    }
  }, [melodyAbc]);

  if (step === "melody") {
    return (
      <div className="space-y-5">
        <AbcEditor
          title="ABC Notation Editor"
          value={melodyAbc}
          initialAbc={initialMelodyAbc ?? DEFAULT_ABC}
          storageKey={`bhajan-song-composer:compose:${slug}:melody`}
          onChange={setMelodyAbc}
        />
      </div>
    );
  }

  if (step === "harmony") {
    // --- PREVIEW RENDERER LOGIC ---
    // Dynamically assembles the ABC notation string based on the active Layer Visibility toggles.
    // If melody is disabled but harmony is enabled, we extract the structural headers (K:, M:, etc.) 
    // from the melody string so the chord layer remains syntactically valid in ABCJS.
    let harmonyPreviewAbc = "";
    if (layerVisibility.melody && layerVisibility.harmony && acceptedHarmony) {
      harmonyPreviewAbc = `${melodyAbc.trimEnd()}\n\n${acceptedHarmony.abc}`;
    } else if (layerVisibility.melody) {
      harmonyPreviewAbc = melodyAbc;
    } else if (layerVisibility.harmony && acceptedHarmony) {
      // Extract header from melodyAbc to make the chord track valid on its own
      const headerLines = melodyAbc.split('\n').filter(line => /^[A-Z]:/.test(line));
      harmonyPreviewAbc = `${headerLines.join('\n')}\n\n${acceptedHarmony.abc}`;
    } else {
      // If both are hidden, just show an empty score with headers
      const headerLines = melodyAbc.split('\n').filter(line => /^[A-Z]:/.test(line));
      harmonyPreviewAbc = headerLines.join('\n');
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
                        setAiSuggestions(result.options);
                        setSelectedSuggestionIndex(null);
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
                </div>
                
                {aiSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Suggested Progressions</h3>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {aiSuggestions.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedSuggestionIndex(idx);
                            setMelodyAbc(option.abc);
                            
                            // Automatically accept it as a harmony layer to generate the separate V:Chords staff
                            try {
                              const proposal = buildTheoryAssistantLayerProposal(option.abc, { skillLevel: "intermediate", capoFret: 0 });
                              proposal.name = `AI Option: ${option.progression_name}`;
                              setAcceptedHarmony(proposal);
                            } catch (e) {
                              console.error("Failed to build layer proposal for AI option", e);
                            }
                          }}
                          className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                            selectedSuggestionIndex === idx
                              ? "border-amber-400 bg-amber-500/10 shadow-sm"
                              : "border-zinc-200 bg-white hover:border-amber-300/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Option {idx + 1}: {option.progression_name}</h4>
                            {selectedSuggestionIndex === idx && (
                              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Active</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                            {option.explanation}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <TheoryAssistant abc={melodyAbc} onAcceptArrangement={setAcceptedHarmony} onAnalysisChange={setCurrentSuggestion} />
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
                  title="Harmonization Preview"
                  canvasId="composer-harmony-preview"
                  {...COMPOSER_PREVIEW_PROPS}
                />
              </div>

              <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Current ABCNotation of the Song</h2>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {melodyAbc}
                </pre>
              </section>
            </>
          )}
        />

        <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <div className="composer-step-responsive-grid grid gap-0 min-[1536px]:grid-cols-2">
            <div className="border-b border-zinc-100 p-5 dark:border-zinc-800 min-[1536px]:border-r min-[1536px]:border-b-0">
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
                  {`% Ghosted melody context\n${melodyAbc}\n\n% Chord Track Editor\n${acceptedHarmony ? acceptedHarmony.abc : "% Accept an arrangement from the Theory Assistant to see the chord track here."}`}
                </pre>
              </section>
            </div>
          </div>
        </section>

        {currentSuggestion && (
          <section className="w-full space-y-6">
            <PianoKeyboard
              title="Piano review"
              subtitle={`First-chord voicing for ${currentSuggestion.progression[0] ?? "—"}`}
              highlights={currentSuggestion.pianoHighlights}
              startOctave={3}
              octaveCount={2}
              className="w-full"
            />
            <GuitarFretboard
              title="Guitar review"
              subtitle={`${currentSuggestion.progression[0] ?? "—"} shape${currentSuggestion.capoFret > 0 ? ` with capo ${currentSuggestion.capoFret}` : ""}`}
              positions={currentSuggestion.guitarPositions}
              openStrings={currentSuggestion.guitarOpenStrings}
              mutedStrings={currentSuggestion.guitarMutedStrings}
              startFret={currentSuggestion.guitarStartFret}
              capoFret={currentSuggestion.capoFret || undefined}
              className="w-full"
            />
          </section>
        )}
      </div>
    );
  }

  if (step === "accompaniment") {
    const generateAccompaniment = () => {
      if (engine === "fingerstyle") {
        setGeneratedAccompaniment(buildFingerstyleComposerIntegration(melodyAbc, undefined, { pickingProfile: profileId }).composerLayer.abc);
      } else {
        setGeneratedAccompaniment(pipeline?.accompaniment.abc ?? "V:Piano clef=treble name=\"Generated Piano\"\n| [EGB]4 [DFA]4 |");
      }
    };
    const accompanimentAbc = generatedAccompaniment ?? pipeline?.accompaniment.abc ?? melodyAbc;

    return (
      <ComposerNotationPreviewLayout
        source={(
          <>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Engine Toggle</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <label className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <input type="radio" checked={engine === "piano"} onChange={() => setEngine("piano")} /> Piano Accomp.
                </label>
                <label className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <input type="radio" checked={engine === "fingerstyle"} onChange={() => setEngine("fingerstyle")} /> Fingerstyle
                </label>
                <select
                  aria-label="Profile"
                  value={profileId}
                  onChange={(event) => setProfileId(event.target.value as FingerstyleComposerProfileId)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {FINGERSTYLE_PROFILE_OPTIONS.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.label}</option>
                  ))}
                </select>
                <button type="button" onClick={generateAccompaniment} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">
                  Generate Accompaniment Matrix
                </button>
              </div>
            </section>
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
            </section>
            <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Generated ABC Source</h2>
              <pre className="mt-3 max-h-[min(54vh,640px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                {accompanimentAbc}
              </pre>
            </section>
          </>
        )}
        preview={(
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Resulting ABC Staff Preview</h3>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Bounded preview
              </span>
            </div>
            <AbcjsPlaybackController
              abcString={accompanimentAbc}
              title="Resulting ABC Staff Preview"
              canvasId="composer-accompaniment-preview"
              {...COMPOSER_PREVIEW_PROPS}
            />
          </>
        )}
      />
    );
  }

  if (step === "ensemble") {
    const proposals = pipeline ? buildArrangementLayerProposals(pipeline) : [];
    const ensembleAbc = pipeline?.finalAbc ?? (proposals.map((proposal) => proposal.abc).join("\n\n") || melodyAbc);

    return (
      <ComposerNotationPreviewLayout
        source={(
          <>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Enable Layers</h2>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {(["djembe", "flute", "violin"] as const).map((layer) => (
                  <label key={layer} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 capitalize dark:border-zinc-800 dark:bg-zinc-900">
                    <input
                      type="checkbox"
                      checked={ensembleEnabled[layer]}
                      onChange={() => setEnsembleEnabled((current) => ({ ...current, [layer]: !current[layer] }))}
                    /> {layer}
                  </label>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/30">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Conflict Resolution Hierarchy Log</h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Flute yielded in m.8 due to active melody; Djembe follows bass/kick alignment.</p>
            </section>
            <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Multi-track ABC Source</h2>
              <pre className="mt-3 max-h-[min(54vh,640px)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                {ensembleAbc}
              </pre>
            </section>
          </>
        )}
        preview={(
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Multi-track ABCJS Render (Full Score View)</h3>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Bounded preview
              </span>
            </div>
            <AbcjsPlaybackController
              abcString={ensembleAbc}
              title="Multi-track ABCJS Render (Full Score View)"
              canvasId="composer-ensemble-preview"
              {...COMPOSER_PREVIEW_PROPS}
            />
          </>
        )}
      />
    );
  }

  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\nabcNotations:\n  - type: "melody"\n    label: "Melody Music Sheet"\n---\n\n## Lyrics\n\nDraft lyrics...\n\n## ABC\n\n\`\`\`abc\n${melodyAbc}\n\`\`\``;
  const reviewAbc = pipeline?.finalAbc ?? melodyAbc;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdown)
      .then(() => {
        setCopyStatus("Copied!");
        setTimeout(() => setCopyStatus("Copy Markdown"), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        setCopyStatus("Failed to copy");
        setTimeout(() => setCopyStatus("Copy Markdown"), 2000);
      });
  };

  return (
    <ComposerNotationPreviewLayout
      source={(
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Raw Markdown Output File Preview</h2>
          <textarea readOnly value={markdown} className="mt-3 min-h-72 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleCopyMarkdown} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">{copyStatus}</button>
            <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Submit as PR</button>
          </div>
        </section>
      )}
      preview={(
        <>
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Playback Simulation: Test Full Audio & Sync</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Play All Layers</button>
              <PianoPedalIndicator
                title="Sustain Pedal Indicator"
                pedalAutomation={{
                  controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
                  events: [{ measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 }],
                }}
              />
            </div>
          </section>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review Music Staff Playback</h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Bounded preview
            </span>
          </div>
          <AbcjsPlaybackController
            abcString={reviewAbc}
            title="Review Music Staff Playback"
            canvasId="composer-review-preview"
            {...COMPOSER_PREVIEW_PROPS}
          />
        </>
      )}
    />
  );
}
