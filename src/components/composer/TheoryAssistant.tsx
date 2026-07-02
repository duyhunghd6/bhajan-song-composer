"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analyzeTheoryAssistantArrangement,
  buildTheoryAssistantLayerProposal,
  THEORY_ASSISTANT_SKILL_DESCRIPTIONS,
  type TheoryAssistantArrangementSuggestion,
  type TheoryAssistantLayerProposal,
  type TheoryAssistantSkillLevel,
} from "./theory-assistant-layer";

interface TheoryAssistantProps {
  abc: string;
  onAcceptArrangement: (proposal: TheoryAssistantLayerProposal) => void;
  onAnalysisChange?: (suggestion: TheoryAssistantArrangementSuggestion | null) => void;
}

export default function TheoryAssistant({ abc, onAcceptArrangement, onAnalysisChange }: TheoryAssistantProps) {
  const [skillLevel, setSkillLevel] = useState<TheoryAssistantSkillLevel>("beginner");
  const [capoFret, setCapoFret] = useState(0);
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);

  const analysis = useMemo(() => {
    try {
      return { suggestion: analyzeTheoryAssistantArrangement(abc, { skillLevel, capoFret }), error: null };
    } catch (error) {
      console.error("Could not generate theory assistant suggestion:", error);
      return {
        suggestion: null,
        error: "Add a valid K: key header and at least one parseable measure to generate suggestions.",
      };
    }
  }, [abc, capoFret, skillLevel]);

  const suggestion = analysis.suggestion;
  const primaryChord = suggestion?.progression[0] ?? "—";

  useEffect(() => {
    onAnalysisChange?.(suggestion);
  }, [suggestion, onAnalysisChange]);

  const acceptArrangement = () => {
    if (!suggestion) return;

    onAcceptArrangement(buildTheoryAssistantLayerProposal(abc, { skillLevel, capoFret }));
    setAcceptedMessage("Arrangement layer was accepted into the Composer stack.");
  };

  return (
    <aside
      id="theory-assistant"
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/20"
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
          Theory Assistant
        </p>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Review an auto-harmonized layer
        </h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Tune the constraints, preview a chord path, then accept the suggestion into the current
          Composer stack as a separate editable layer.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <label className="space-y-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span>Capo</span>
          <select
            id="theory-assistant-capo"
            value={capoFret}
            onChange={(event) => setCapoFret(Number(event.target.value))}
            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-amber-900 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {Array.from({ length: 8 }, (_, fret) => (
              <option key={fret} value={fret}>
                {fret === 0 ? "No capo" : `Capo ${fret}`}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span>Skill level</span>
          <select
            id="theory-assistant-skill-level"
            value={skillLevel}
            onChange={(event) => setSkillLevel(event.target.value as TheoryAssistantSkillLevel)}
            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-amber-900 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      <p className="mt-3 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs leading-5 text-zinc-600 dark:border-amber-900/70 dark:bg-zinc-950/50 dark:text-zinc-400">
        {THEORY_ASSISTANT_SKILL_DESCRIPTIONS[skillLevel]}
      </p>

      {analysis.error ? (
        <div
          id="theory-assistant-error"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {analysis.error}
        </div>
      ) : (
        suggestion && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    Suggested progression
                  </p>
                  <p id="theory-assistant-progression" className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {suggestion.progression.join(" | ")}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {suggestion.key}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Starts on <strong>{primaryChord}</strong> and follows the strong-beat melody tones
                detected in {suggestion.timeSignature}.
              </p>
            </div>


            <button
              id="theory-assistant-accept"
              type="button"
              onClick={acceptArrangement}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
            >
              Accept as Composer layer
            </button>

            {acceptedMessage && (
              <p
                id="theory-assistant-accepted-message"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
              >
                {acceptedMessage}
              </p>
            )}
          </div>
        )
      )}
    </aside>
  );
}
