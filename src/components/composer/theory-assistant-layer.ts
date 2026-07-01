import type { GuitarFretPosition, PianoHighlightedNote } from "@/components/instruments";
import { getDiatonicChords } from "@/lib/theory/chords";
import { generateProgression, parseRootAndMode } from "@/lib/theory/harmonizer";
import { parseAbcHeader } from "@/lib/theory/melody-analyzer";

export type TheoryAssistantSkillLevel = "beginner" | "intermediate" | "advanced";

export interface TheoryAssistantConstraints {
  skillLevel: TheoryAssistantSkillLevel;
  capoFret: number;
}

export interface TheoryAssistantArrangementSuggestion {
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

export interface TheoryAssistantLayerProposal {
  id: string;
  name: string;
  role: "harmony";
  abc: string;
  visible: true;
}

export const THEORY_ASSISTANT_SKILL_DESCRIPTIONS: Record<TheoryAssistantSkillLevel, string> = {
  beginner: "Simple tonic/dominant guidance with low-risk voicings.",
  intermediate: "Adds movement notes and fuller accompaniment prompts.",
  advanced: "Keeps richer reharmonization notes and performance prompts.",
};

export const THEORY_ASSISTANT_SKILL_LAYER_LABELS: Record<TheoryAssistantSkillLevel, string> = {
  beginner: "gentle learning layer",
  intermediate: "practice arrangement layer",
  advanced: "performance arrangement layer",
};

const THEORY_ASSISTANT_LAYER_NAMES: Record<TheoryAssistantSkillLevel, string> = {
  beginner: "Theory Assistant Arrangement (Beginner)",
  intermediate: "Theory Assistant Arrangement (Intermediate)",
  advanced: "Theory Assistant Arrangement (Advanced)",
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
  skillLevel: TheoryAssistantSkillLevel,
  capoFret: number,
  key: string,
  timeSignature: string
): string {
  const uniqueChords = uniq(progression);
  const capoText = capoFret === 0 ? "no capo" : `capo ${capoFret}`;

  return [
    `% --- Theory Assistant: ${THEORY_ASSISTANT_SKILL_LAYER_LABELS[skillLevel]} ---`,
    `% Key: ${key} · Meter: ${timeSignature} · ${capoText}`,
    `% Chord progression: ${progression.join(" | ")}`,
    `% Chords to practice: ${uniqueChords.join(", ")}`,
    `%%text Theory Assistant (${skillLevel}, ${capoText}): ${progression.join(" | ")}`,
  ].join("\n");
}

export function analyzeTheoryAssistantArrangement(
  abc: string,
  constraints: TheoryAssistantConstraints
): TheoryAssistantArrangementSuggestion {
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
    abcBlock: buildArrangementBlock(
      progression,
      constraints.skillLevel,
      constraints.capoFret,
      header.key,
      header.timeSignature
    ),
  };
}

export function appendTheoryAssistantArrangementBlock(abc: string, abcBlock: string): string {
  return `${abc.trimEnd()}\n\n${abcBlock}\n`;
}

export function buildTheoryAssistantLayerProposal(
  abc: string,
  constraints: TheoryAssistantConstraints
): TheoryAssistantLayerProposal {
  const suggestion = analyzeTheoryAssistantArrangement(abc, constraints);

  return {
    id: `theory-assistant-${constraints.skillLevel}-capo-${constraints.capoFret}`,
    name: THEORY_ASSISTANT_LAYER_NAMES[constraints.skillLevel],
    role: "harmony",
    visible: true,
    abc: suggestion.abcBlock,
  };
}
