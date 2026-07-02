"use client";

import { useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import PianoKeyboard from "@/components/instruments/PianoKeyboard";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { buildArrangementLayerProposals, generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";
import { harmonizeMelody } from "@/app/actions/harmonize";
import { type HarmonizationOption } from "@/lib/theory/harmonization-candidates";
import { generateAccompanimentOptions } from "@/app/actions/accompaniment";
import type { AccompanimentOption } from "@/lib/theory/accompaniment-candidates";
import { generatePianoAccompaniment, type PianoAccompaniment } from "@/lib/theory/piano-accompaniment";
import type { PianoCompingProfileId } from "@/lib/theory/piano-comping-profiles";
import { buildFingerstyleComposerIntegration, type FingerstyleComposerIntegration, type FingerstyleComposerProfileId } from "./fingerstyle-integration";
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

function harmonizationOptionId(option: HarmonizationOption, index: number): string {
  return option.id || `candidate-${index + 1}`;
}

function harmonizationOptionLabel(option: HarmonizationOption): string {
  return option.label || option.progression_name;
}

function harmonizationOptionAbc(option: HarmonizationOption): string {
  return option.harmonizedAbc || option.abc;
}

function formatCandidateConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function buildAccompanimentPreviewAbc(baseAbc: string, generatedAccompaniment: string | null): string {
  const headerLines = baseAbc.split("\n").filter((line) => /^[A-Z]:/.test(line));
  const bodyLines = baseAbc.split("\n").filter((line) => !/^[A-Z]:/.test(line) && line.trim() !== "");

  if (!generatedAccompaniment) {
    return [
      ...headerLines,
      "%%playchord 0",
      ...bodyLines,
    ].join("\n");
  }

  let accompanimentBody = generatedAccompaniment.replace(/^[A-Z]:.*(\r?\n|$)/gm, (match) => {
    if (match.startsWith("V:")) return match;
    return "";
  });

  accompanimentBody = accompanimentBody.replace(/V:Guitar clef=treble-8/g, 'V:Guitar clef=bass name="Layer 2 Guitar Accompaniment"');

  const voices = Array.from(accompanimentBody.matchAll(/V:([^\s]+)/g)).map((match) => match[1]);
  const scoreVoices = ["(Melody)", ...voices.map((voice) => `(${voice})`)].join(" ");

  return [
    ...headerLines,
    `%%score ${scoreVoices}`,
    "%%playchord 0",
    "V:Melody name=\"Original Melody\"",
    ...bodyLines,
    accompanimentBody,
  ].join("\n");
}

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
  // selectedCandidateId: Tracks which validated candidate is currently being previewed by the user.
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // --- AI ACCOMPANIMENT STATE ---
  const [isGeneratingAccompaniment, setIsGeneratingAccompaniment] = useState(false);
  const [aiAccompanimentSuggestions, setAiAccompanimentSuggestions] = useState<AccompanimentOption[]>([]);
  const [selectedAccompanimentIndex, setSelectedAccompanimentIndex] = useState<number | null>(null);
  const [pianoAccompanimentData, setPianoAccompanimentData] = useState<PianoAccompaniment | null>(null);
  const [guitarAccompanimentData, setGuitarAccompanimentData] = useState<FingerstyleComposerIntegration | null>(null);
  
  // --- LAYER ARCHITECTURE STATE ---
  // acceptedHarmony: Stores the isolated chord progression as a separate ABC layer (e.g. V:Chords).
  // This is used to render the separate piano/guitar highlights and the dedicated ABCJS chord staff.
  const [acceptedHarmony, setAcceptedHarmony] = useState<TheoryAssistantLayerProposal | null>(null);
  // layerVisibility: Toggles to independently show/hide the melody staff and the chord staff in the preview.
  const [layerVisibility, setLayerVisibility] = useState({ melody: true, harmony: true });
  // currentSuggestion: Tracks the theory assistant's real-time localized analysis of the active chords.
  const [currentSuggestion, setCurrentSuggestion] = useState<TheoryAssistantArrangementSuggestion | null>(null);
  const [generatedAccompaniment, setGeneratedAccompaniment] = useState<string | null>(null);
  const [ensembleEnabled, setEnsembleEnabled] = useState({ djembe: true, flute: true, violin: false });
  const [copyStatus, setCopyStatus] = useState("Copy Markdown");

  // Derive the active ABC to use across steps. If a harmony option is selected, use it; otherwise fallback to the pure melody.
  const activeHarmonyOption = useMemo(() => {
    if (!aiSuggestions || !selectedCandidateId) return null;
    return aiSuggestions.find((opt, idx) => harmonizationOptionId(opt, idx) === selectedCandidateId) || null;
  }, [aiSuggestions, selectedCandidateId]);

  const activeAbc = activeHarmonyOption ? harmonizationOptionAbc(activeHarmonyOption) : melodyAbc;

  // --- LOCAL STORAGE HYDRATION & PERSISTENCE ---
  const storageKey = `bhajan-song-composer:compose:${slug}:workspace`;
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.aiSuggestions) setAiSuggestions(parsed.aiSuggestions);
        if (parsed.selectedCandidateId !== undefined) setSelectedCandidateId(parsed.selectedCandidateId);
        if (parsed.acceptedHarmony) setAcceptedHarmony(parsed.acceptedHarmony);
        if (parsed.aiAccompanimentSuggestions) setAiAccompanimentSuggestions(parsed.aiAccompanimentSuggestions);
        if (parsed.selectedAccompanimentIndex !== undefined) setSelectedAccompanimentIndex(parsed.selectedAccompanimentIndex);
        if (parsed.pianoAccompanimentData !== undefined) setPianoAccompanimentData(parsed.pianoAccompanimentData);
        if (parsed.guitarAccompanimentData !== undefined) setGuitarAccompanimentData(parsed.guitarAccompanimentData);
        if (parsed.generatedAccompaniment !== undefined) setGeneratedAccompaniment(parsed.generatedAccompaniment);
      }
      
      const savedMelody = window.localStorage.getItem(`bhajan-song-composer:compose:${slug}:melody`);
      if (savedMelody && !savedMelody.includes("T:Untitled Bhajan")) {
        setMelodyAbc(savedMelody);
      }
    } catch (e) {
      console.error("Failed to restore workspace state from localStorage", e);
    } finally {
      setIsHydrated(true);
    }
  }, [slug, storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      const stateToSave = {
        aiSuggestions,
        selectedCandidateId,
        acceptedHarmony,
        aiAccompanimentSuggestions,
        selectedAccompanimentIndex,
        pianoAccompanimentData,
        guitarAccompanimentData,
        generatedAccompaniment,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Failed to save workspace state to localStorage", e);
    }
  }, [
    isHydrated,
    storageKey,
    aiSuggestions,
    selectedCandidateId,
    acceptedHarmony,
    aiAccompanimentSuggestions,
    selectedAccompanimentIndex,
    pianoAccompanimentData,
    guitarAccompanimentData,
    generatedAccompaniment
  ]);

  const pipeline = useMemo(() => {
    try {
      return generateArrangementPipeline(activeAbc);
    } catch {
      return null;
    }
  }, [activeAbc]);

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
      harmonyPreviewAbc = `${activeAbc.trimEnd()}\n\n${acceptedHarmony.abc}`;
    } else if (layerVisibility.melody) {
      harmonyPreviewAbc = activeAbc;
    } else if (layerVisibility.harmony && acceptedHarmony) {
      // Extract header from activeAbc to make the chord track valid on its own
      const headerLines = activeAbc.split('\n').filter(line => /^[A-Z]:/.test(line));
      harmonyPreviewAbc = `${headerLines.join('\n')}\n\n${acceptedHarmony.abc}`;
    } else {
      // If both are hidden, just show an empty score with headers
      const headerLines = activeAbc.split('\n').filter(line => /^[A-Z]:/.test(line));
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
                        setSelectedCandidateId(null);
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
                  {initialMelodyAbc && activeAbc !== initialMelodyAbc && (
                    <button
                      type="button"
                      onClick={() => {
                        setMelodyAbc(initialMelodyAbc);
                        setAiSuggestions([]);
                        setSelectedCandidateId(null);
                        setAcceptedHarmony(null);
                      }}
                      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      ↺ Restore Original Melody
                    </button>
                  )}
                </div>
                
                {aiSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Suggested Progressions</h3>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {aiSuggestions.map((option, idx) => {
                        const candidateId = harmonizationOptionId(option, idx);
                        const candidateLabel = harmonizationOptionLabel(option);
                        const candidateAbc = harmonizationOptionAbc(option);
                        const isSelected = selectedCandidateId === candidateId;

                        return (
                          <button
                            key={candidateId}
                            onClick={() => {
                              setSelectedCandidateId(candidateId);

                              // Automatically accept it as a harmony layer to generate the separate V:Chords staff
                              try {
                                const proposal = buildTheoryAssistantLayerProposal(candidateAbc, { skillLevel: "intermediate", capoFret: 0 });
                                proposal.name = `AI Option: ${candidateLabel}`;
                                setAcceptedHarmony(proposal);
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
              <TheoryAssistant abc={activeAbc} onAcceptArrangement={setAcceptedHarmony} onAnalysisChange={setCurrentSuggestion} />
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
                  {activeAbc}
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
                  {`% Ghosted melody context\n${activeAbc}\n\n% Chord Track Editor\n${acceptedHarmony ? acceptedHarmony.abc : "% Accept an arrangement from the Theory Assistant to see the chord track here."}`}
                </pre>
              </section>
            </div>
          </div>
        </section>

      </div>
    );
  }

  if (step === "accompaniment") {
    const accompanimentAbc = useMemo(() => {
      const baseAbc = pipeline?.accompaniment.abc ?? activeAbc;

      // Extract headers from baseAbc
      const headerLines = baseAbc.split('\n').filter(line => /^[A-Z]:/.test(line));
      // Extract body lines (skip empty lines)
      const bodyLines = baseAbc.split('\n').filter(line => !/^[A-Z]:/.test(line) && line.trim() !== '');

      if (!generatedAccompaniment) {
        // Default loading phase: Melody ABC but with hidden chord progression
        return [
          ...headerLines,
          "%%playchord 0",
          ...bodyLines
        ].join('\n');
      }

      // Strip headers from generated accompaniment to prevent creating a second tune
      let accompanimentBody = generatedAccompaniment.replace(/^[A-Z]:.*(\r?\n|$)/gm, (match) => {
        if (match.startsWith('V:')) return match; // Keep voice declarations
        return '';
      });
      
      // Enforce Bass clef for guitar as requested
      accompanimentBody = accompanimentBody.replace(/V:Guitar clef=treble-8/g, 'V:Guitar clef=bass name="Layer 2 Guitar Accompaniment"');

      // Extract voice names to build a safe %%score directive
      const voices = Array.from(accompanimentBody.matchAll(/V:([^\s]+)/g)).map(m => m[1]);
      const scoreVoices = ["(Melody)", ...voices.map(v => `(${v})`)].join(" ");

      // Combine original melody as Voice 1, and the generated accompaniment layers
      return [
        ...headerLines,
        `%%score ${scoreVoices}`,
        "%%playchord 0",
        "V:Melody name=\"Original Melody\"",
        ...bodyLines,
        accompanimentBody
      ].join('\n');
    }, [generatedAccompaniment, pipeline?.accompaniment.abc, activeAbc]);

    return (
      <ComposerNotationPreviewLayout
        source={(
          <>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Accompaniment Generation</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isGeneratingAccompaniment || !pipeline}
                    onClick={async () => {
                      if (!pipeline) return;
                      setIsGeneratingAccompaniment(true);
                      try {
                        const result = await generateAccompanimentOptions(activeAbc, {
                          key: pipeline.harmonization.key,
                          scale: pipeline.harmonization.scale,
                          timeSignature: pipeline.harmonization.timeSignature
                        });
                        setAiAccompanimentSuggestions(result.options);
                        setSelectedAccompanimentIndex(null);
                      } catch (err) {
                        console.error(err);
                        alert("Failed to generate accompaniment options.");
                      } finally {
                        setIsGeneratingAccompaniment(false);
                      }
                    }}
                    className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-600 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-400"
                  >
                    {isGeneratingAccompaniment ? "Generating Options..." : "✨ Suggest AI Accompaniment"}
                  </button>
                  {aiAccompanimentSuggestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiAccompanimentSuggestions([]);
                        setSelectedAccompanimentIndex(null);
                        setPianoAccompanimentData(null);
                        setGuitarAccompanimentData(null);
                        setGeneratedAccompaniment(null);
                      }}
                      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      ↺ Clear Accompaniment
                    </button>
                  )}
                  {initialMelodyAbc && activeAbc !== initialMelodyAbc && (
                    <button
                      type="button"
                      onClick={() => {
                        setMelodyAbc(initialMelodyAbc);
                        setAiSuggestions([]);
                        setSelectedCandidateId(null);
                        setAcceptedHarmony(null);
                        setAiAccompanimentSuggestions([]);
                        setSelectedAccompanimentIndex(null);
                        setPianoAccompanimentData(null);
                        setGuitarAccompanimentData(null);
                        setGeneratedAccompaniment(null);
                      }}
                      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      ↺ Restore Original Melody
                    </button>
                  )}
                </div>
              
              {aiAccompanimentSuggestions.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Suggested Accompaniments</h3>
                  <div className="grid gap-3 sm:grid-cols-1">
                    {aiAccompanimentSuggestions.map((option, idx) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSelectedAccompanimentIndex(idx);
                          // Apply Rule Engine to generate ABC
                          if (option.instrument === "guitar") {
                            const integration = buildFingerstyleComposerIntegration(activeAbc, undefined, { pickingProfile: option.style as FingerstyleComposerProfileId });
                            setGeneratedAccompaniment(integration.composerLayer.abc);
                            setGuitarAccompanimentData(integration);
                            setPianoAccompanimentData(null);
                          } else {
                            const pianoStyles = ["pop-ballad", "rock-rnb", "classical-folk"];
                            const compingProfile = pianoStyles.includes(option.style) ? option.style as any : "pop-ballad";
                            
                            const accompaniment = generatePianoAccompaniment(activeAbc, { compingProfile });
                            setGeneratedAccompaniment(accompaniment.abc);
                            setPianoAccompanimentData(accompaniment);
                            setGuitarAccompanimentData(null);
                          }
                        }}
                        className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                          selectedAccompanimentIndex === idx
                            ? "border-amber-400 bg-amber-500/10 shadow-sm"
                            : "border-zinc-200 bg-white hover:border-amber-300/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {option.label} ({option.instrument})
                          </h4>
                          {selectedAccompanimentIndex === idx && (
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
            
            {pianoAccompanimentData && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Virtual Piano (Voicing & Comping)</h2>
                <div className="space-y-4">
                  <PianoPedalIndicator 
                    title="Sustain Pedal Indicator" 
                    pedalAutomation={pianoAccompanimentData.pedalAutomation} 
                  />
                  <div className="overflow-x-auto pb-2">
                    <PianoKeyboard 
                      title="Piano Accompaniment Keys" 
                      startOctave={2} 
                      octaveCount={4} 
                      highlights={pianoAccompanimentData.pianoKeyHighlights} 
                    />
                  </div>
                </div>
              </section>
            )}

            {guitarAccompanimentData && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Virtual Guitar (Fingerstyle)</h2>
                <div className="overflow-x-auto pb-2">
                  <GuitarFretboard 
                    title="Fingerstyle Fretboard Preview" 
                    positions={guitarAccompanimentData.fretboard.positions} 
                  />
                </div>
              </section>
            )}

            {generatedAccompaniment && !pianoAccompanimentData && !guitarAccompanimentData && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
              </section>
            )}

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
    const ensembleAbc = pipeline?.finalAbc ?? (proposals.map((proposal) => proposal.abc).join("\n\n") || activeAbc);

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

  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\nabcNotations:\n  - type: "melody"\n    label: "Melody Music Sheet"\n---\n\n## Lyrics\n\nDraft lyrics...\n\n## ABC\n\n\`\`\`abc\n${activeAbc}\n\`\`\``;
  const reviewAbc = pipeline?.finalAbc ?? activeAbc;

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
