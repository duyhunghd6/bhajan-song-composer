import type { GuitarFretPosition } from "@/components/instruments/GuitarFretboard";
import type { PianoHighlightedNote } from "@/components/instruments/PianoKeyboard";
import { normalizeAbcNote } from "@/lib/theory/melody-analyzer";

interface PlaybackCursorLike {
  cursorSeconds: number;
  startChar?: number;
  endChar?: number;
}

interface ParsedAbcNote {
  pitchClass: string;
  octave: number;
  pianoNote: string;
}

export interface SynchronizedInstrumentHighlights {
  pianoHighlights: PianoHighlightedNote[];
  guitarPositions: GuitarFretPosition[];
  guitarOpenStrings: number[];
  guitarStartFret: number;
  statusText: string;
}

const EMPTY_STATUS = "Start playback or click a note to highlight matching keys and frets.";

const FIRST_POSITION_GUITAR_NOTES: Record<string, GuitarFretPosition> = {
  C: { string: 5, fret: 3, note: "C", tone: "melody" },
  "C#": { string: 5, fret: 4, note: "C#", tone: "melody" },
  D: { string: 4, fret: 0, note: "D", tone: "melody" },
  "D#": { string: 4, fret: 1, note: "D#", tone: "melody" },
  E: { string: 4, fret: 2, note: "E", tone: "melody" },
  F: { string: 4, fret: 3, note: "F", tone: "melody" },
  "F#": { string: 6, fret: 2, note: "F#", tone: "melody" },
  G: { string: 6, fret: 3, note: "G", tone: "melody" },
  "G#": { string: 6, fret: 4, note: "G#", tone: "melody" },
  A: { string: 5, fret: 0, note: "A", tone: "melody" },
  "A#": { string: 5, fret: 1, note: "A#", tone: "melody" },
  B: { string: 5, fret: 2, note: "B", tone: "melody" },
};

function uniqueBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function parseAbcNoteToken(token: string): ParsedAbcNote | null {
  const match = token.match(/^([\^_=]*)([A-Ga-g])([,']*)$/);
  if (!match) return null;

  const [, accidental, noteName, octaveMarks] = match;
  const pitchClass = normalizeAbcNote(`${accidental}${noteName}`);
  const baseOctave = noteName === noteName.toLowerCase() ? 5 : 4;
  const octaveOffset = Array.from(octaveMarks).reduce((offset, mark) => {
    if (mark === "'") return offset + 1;
    if (mark === ",") return offset - 1;
    return offset;
  }, 0);
  const octave = baseOctave + octaveOffset;

  return {
    pitchClass,
    octave,
    pianoNote: `${pitchClass}${octave}`,
  };
}

export function extractAbcCursorNotes(
  abcString: string,
  cursor: PlaybackCursorLike | null
): ParsedAbcNote[] {
  if (!cursor || cursor.startChar === undefined || cursor.endChar === undefined) return [];
  if (cursor.startChar < 0 || cursor.endChar <= cursor.startChar) return [];

  const slice = abcString.slice(cursor.startChar, cursor.endChar);
  const tokens = slice.match(/[\^_=]*[A-Ga-g][,']*/g) ?? [];

  return tokens
    .map(parseAbcNoteToken)
    .filter((note): note is ParsedAbcNote => note !== null);
}

function buildGuitarPositions(notes: ParsedAbcNote[]): GuitarFretPosition[] {
  return uniqueBy(
    notes
      .map((note) => FIRST_POSITION_GUITAR_NOTES[note.pitchClass])
      .filter((position): position is GuitarFretPosition => Boolean(position)),
    (position) => `${position.string}:${position.fret}`
  );
}

function getGuitarStartFret(positions: GuitarFretPosition[]): number {
  const frettedPositions = positions.filter((position) => position.fret > 0);
  if (frettedPositions.length === 0) return 1;

  const minFret = Math.min(...frettedPositions.map((position) => position.fret));
  return Math.max(1, Math.min(minFret, 4));
}

export function buildSynchronizedInstrumentHighlights(
  abcString: string,
  cursor: PlaybackCursorLike | null
): SynchronizedInstrumentHighlights {
  const notes = extractAbcCursorNotes(abcString, cursor);
  if (notes.length === 0 || !cursor) {
    return {
      pianoHighlights: [],
      guitarPositions: [],
      guitarOpenStrings: [],
      guitarStartFret: 1,
      statusText: EMPTY_STATUS,
    };
  }

  const pianoHighlights = uniqueBy(
    notes.map<PianoHighlightedNote>((note) => ({ note: note.pianoNote, label: "♪" })),
    (highlight) => highlight.note
  );
  const guitarPositions = buildGuitarPositions(notes);
  const guitarOpenStrings = uniqueBy(
    guitarPositions.filter((position) => position.fret === 0),
    (position) => String(position.string)
  ).map((position) => position.string);
  const noteNames = pianoHighlights.map((highlight) => highlight.note).join(", ");

  return {
    pianoHighlights,
    guitarPositions,
    guitarOpenStrings,
    guitarStartFret: getGuitarStartFret(guitarPositions),
    statusText: `Highlighting ${noteNames} at ${cursor.cursorSeconds.toFixed(1)}s`,
  };
}
