"use client";

import { useMemo, useState } from "react";
import { GuitarFretboard, PianoKeyboard } from "@/components/instruments";
import type { GuitarFretPosition, PianoHighlightedNote } from "@/components/instruments";
import { getDiatonicChords } from "@/lib/theory/chords";
import { generateProgression, parseRootAndMode } from "@/lib/theory/harmonizer";
import { parseAbcHeader } from "@/lib/theory/melody-analyzer";

type SkillLevel = "beginner" | "intermediate" | "advanced";

interface TheoryAssistantProps {
  abc: string;
  onAcceptArrangement: (nextAbc: string) => void;
}

interface ArrangementSuggestion {
  progression: string[];
  key: string;
  timeSignature: string;
  pianoHighlights: PianoHighlightedNote[];
  guitarPositions: GuitarFretPosition[];
  guitarOpenStrings: number[];
  guitarMutedStrings: number[];
  guitarStartFret: number;
  abcBlock: string;
}

const SKILL_DESCRIPTIONS: Record<SkillLevel, string> = {
  beginner: "Simple tonic/dominant guidance with low-risk voicings.",
  intermediate: "Adds movement notes and fuller accompaniment prompts.",
  advanced: "Keeps richer reharmonization notes and performance prompts.",
};

const SKILL_LAYER_LABELS: Record<SkillLevel, string> = {
  beginner: "gentle learning layer",
  intermediate: "practice arrangement layer",
  advanced: "performance arrangement layer",
};

const GUITAR_SHAPES: Record<
  string,
  {
    positions: GuitarFretPosition[];
    openStrings?: number[];
    mutedStrings?: number[];
    startFret?: number;
  }
> = {
  A: {
    positions: [
      { string: 4, fret: 2, finger: 1, note: "E", tone: "chord" },
      { string: 3, fret: 2, finger: 2, note: "A", tone: "root" },
      { string: 2, fret: 2, finger: 3, note: "C#", tone: "chord" },
    ],
    openStrings: [1, 5],
    mutedStrings: [6],
  },
  Am: {
    positions: [
      { string: 4, fret: 2, finger: 2, note: "E", tone: "chord" },
      { string: 3, fret: 2, finger: 3, note: "A", tone: "root" },
      { string: 2, fret: 1, finger: 1, note: "C", tone: "chord" },
    ],
    openStrings: [1, 5],
    mutedStrings: [6],
  },
  Bm: {
    positions: [
      { string: 5, fret: 2, finger: 1, note: "B", tone: "root" },
      { string: 4, fret: 4, finger: 3, note: "F#", tone: "chord" },
      { string: 3, fret: 4, finger: 4, note: "B", tone: "root" },
      { string: 2, fret: 3, finger: 2, note: "D", tone: "chord" },
      { string: 1, fret: 2, finger: 1, note: "F#", tone: "chord" },
    ],
    mutedStrings: [6],
    startFret: 2,
  },
  C: {
    positions: [
      { string: 5, fret: 3, finger: 3, note: "C", tone: "root" },
      { string: 4, fret: 2, finger: 2, note: "E", tone: "chord" },
      { string: 2, fret: 1, finger: 1, note: "C", tone: "root" },
    ],
    openStrings: [1, 3],
    mutedStrings: [6],
  },
  D: {
    positions: [
      { string: 3, fret: 2, finger: 1, note: "A", tone: "chord" },
      { string: 2, fret: 3, finger: 3, note: "D", tone: "root" },
      { string: 1, fret: 2, finger: 2, note: "F#", tone: "chord" },
    ],
    openStrings: [4],
    mutedStrings: [5, 6],
  },
  E: {
    positions: [
      { string: 5, fret: 2, finger: 2, note: "B", tone: "chord" },
      { string: 4, fret: 2, finger: 3, note: "E", tone: "root" },
      { string: 3, fret: 1, finger: 1, note: "G#", tone: "chord" },
    ],
    openStrings: [1, 2, 6],
  },
  Em: {
    positions: [
      { string: 5, fret: 2, finger: 2, note: "B", tone: "chord" },
      { string: 4, fret: 2, finger: 3, note: "E", tone: "root" },
    ],
    openStrings: [1, 2, 3, 6],
  },
  F: {
    positions: [
      { string: 6, fret: 1, finger: 1, note: "F", tone: "root" },
      { string: 5, fret: 3, finger: 3, note: "C", tone: "chord" },
      { string: 4, fret: 3, finger: 4, note: "F", tone: "root" },
      { string: 3, fret: 2, finger: 2, note: "A", tone: "chord" },
      { string: 2, fret: 1, finger: 1, note: "C", tone: "chord" },
      { string: 1, fret: 1, finger: 1, note: "F", tone: "root" },
    ],
  },
  G: {
    positions: [
      { string: 6, fret: 3, finger: 2, note: "G", tone: "root" },
      { string: 5, fret: 2, finger: 1, note: "B", tone: "chord" },
      { string: 1, fret: 3, finger: 3, note: "G", tone: "root" },
    ],
    openStrings: [2, 3, 4],
  },
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function chordBaseName(chordName: string): string {
  return chordName.replace("dim", "").replace("7", "");
}

function buildPianoHighlights(chordNotes: string[]): PianoHighlightedNote[] {
  return chordNotes.map((note, index) => ({
    note: `${note}${index === 0 ? 3 : 4}`,
    hand: index === 0 ? "left" : "right",
    label: index === 0 ? "R" : String(index + 1),
  }));
}

function buildFallbackGuitarPositions(chordNotes: string[]): GuitarFretPosition[] {
  return chordNotes.slice(0, 3).map((note, index) => ({
    string: 4 - index,
    fret: index + 1,
    finger: index + 1,
    note,
    tone: index === 0 ? "root" : "chord",
  }));
}

function buildArrangementBlock(
  progression: string[],
  skillLevel: SkillLevel,
  capoFret: number,
  key: string,
  timeSignature: string
): string {
  const uniqueChords = uniq(progression);
  const capoText = capoFret === 0 ? "no capo" : `capo ${capoFret}`;

  return [
    `% --- Theory Assistant: ${SKILL_LAYER_LABELS[skillLevel]} ---`,
    `% Key: ${key} · Meter: ${timeSignature} · ${capoText}`,
    `% Chord progression: ${progression.join(" | ")}`,
    `% Chords to practice: ${uniqueChords.join(", ")}`,
    `%%text Theory Assistant (${skillLevel}, ${capoText}): ${progression.join(" | ")}`,
  ].join("\n");
}

function analyzeArrangement(abc: string, skillLevel: SkillLevel, capoFret: number): ArrangementSuggestion {
  const header = parseAbcHeader(abc);
  const progression = generateProgression(abc);
  const { root, mode } = parseRootAndMode(header.key);
  const diatonicChords = getDiatonicChords(root, mode);
  const firstChordName = progression[0] ?? diatonicChords[0]?.chordName ?? root;
  const firstChord = diatonicChords.find((chord) => chord.chordName === firstChordName);
  const chordNotes = firstChord?.notes ?? [root];
  const guitarShape = GUITAR_SHAPES[chordBaseName(firstChordName)];

  return {
    progression,
    key: header.key,
    timeSignature: header.timeSignature,
    pianoHighlights: buildPianoHighlights(chordNotes),
    guitarPositions: guitarShape?.positions ?? buildFallbackGuitarPositions(chordNotes),
    guitarOpenStrings: guitarShape?.openStrings ?? [],
    guitarMutedStrings: guitarShape?.mutedStrings ?? [],
    guitarStartFret: guitarShape?.startFret ?? 1,
    abcBlock: buildArrangementBlock(progression, skillLevel, capoFret, header.key, header.timeSignature),
  };
}

function appendArrangementBlock(abc: string, abcBlock: string): string {
  return `${abc.trimEnd()}\n\n${abcBlock}\n`;
}

export default function TheoryAssistant({ abc, onAcceptArrangement }: TheoryAssistantProps) {
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("beginner");
  const [capoFret, setCapoFret] = useState(0);
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);

  const analysis = useMemo(() => {
    try {
      return { suggestion: analyzeArrangement(abc, skillLevel, capoFret), error: null };
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

  const acceptArrangement = () => {
    if (!suggestion) return;

    onAcceptArrangement(appendArrangementBlock(abc, suggestion.abcBlock));
    setAcceptedMessage("Arrangement notes were accepted into the Composer draft.");
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
          Composer draft as a layer note.
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
            onChange={(event) => setSkillLevel(event.target.value as SkillLevel)}
            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-amber-900 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>

      <p className="mt-3 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs leading-5 text-zinc-600 dark:border-amber-900/70 dark:bg-zinc-950/50 dark:text-zinc-400">
        {SKILL_DESCRIPTIONS[skillLevel]}
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

            <PianoKeyboard
              title="Piano review"
              subtitle={`First-chord voicing for ${primaryChord}`}
              highlights={suggestion.pianoHighlights}
              className="bg-white/90 dark:bg-zinc-900/90"
            />

            <GuitarFretboard
              title="Guitar review"
              subtitle={`${primaryChord} shape${capoFret > 0 ? ` with capo ${capoFret}` : ""}`}
              positions={suggestion.guitarPositions}
              openStrings={suggestion.guitarOpenStrings}
              mutedStrings={suggestion.guitarMutedStrings}
              startFret={suggestion.guitarStartFret}
              capoFret={capoFret || undefined}
              className="bg-white/90 dark:bg-zinc-900/90"
            />

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Composer layer note
              </p>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {suggestion.abcBlock}
              </pre>
            </div>

            <button
              id="theory-assistant-accept"
              type="button"
              onClick={acceptArrangement}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
            >
              Accept into Composer draft
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
