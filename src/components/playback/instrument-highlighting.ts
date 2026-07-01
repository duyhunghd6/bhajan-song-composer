import type { SvgHandFingeringEvent } from "@/components/instruments/SvgHandsOverlay";
import {
  getGuitarFretY,
  getGuitarStringX,
  type GuitarFretPosition,
} from "@/components/instruments/GuitarFretboard";
import {
  buildPianoKeys,
  findPianoHighlight,
  type PianoHighlightedNote,
} from "@/components/instruments/PianoKeyboard";
import { normalizeAbcNote } from "@/lib/theory/melody-analyzer";

interface PlaybackCursorLike {
  cursorSeconds: number;
  startChar?: number;
  endChar?: number;
  abcEvent?: { milliseconds: number };
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
  guitarHandOverlayEvents: SvgHandFingeringEvent[];
  pianoHandOverlayEvents: SvgHandFingeringEvent[];
  statusText: string;
}

const EMPTY_STATUS = "Start playback or click a note to highlight matching keys and frets.";
const SYNCHRONIZED_PIANO_START_OCTAVE = 3;
const SYNCHRONIZED_PIANO_OCTAVE_COUNT = 3;
const PIANO_HAND_TARGET_Y = 80;

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

function getGuitarHandFinger(position: GuitarFretPosition): string {
  if (position.finger) return String(position.finger);
  return position.string >= 4 ? "p" : "i";
}

function buildGuitarHandOverlayEvents(
  positions: GuitarFretPosition[],
  cursor: PlaybackCursorLike,
  startFret: number
): SvgHandFingeringEvent[] {
  return positions.map((position) => ({
    id: `guitar-${position.string}-${position.fret}-${cursor.cursorSeconds.toFixed(1)}`,
    instrument: "guitar",
    hand: "right",
    finger: getGuitarHandFinger(position),
    target: {
      x: getGuitarStringX(position.string),
      y: position.fret === 0 ? 28 : getGuitarFretY(position.fret, startFret),
      label: position.note,
    },
    cursorSeconds: cursor.cursorSeconds,
  }));
}

function buildPianoHandOverlayEvents(
  highlights: PianoHighlightedNote[],
  cursor: PlaybackCursorLike
): SvgHandFingeringEvent[] {
  const keys = buildPianoKeys(SYNCHRONIZED_PIANO_START_OCTAVE, SYNCHRONIZED_PIANO_OCTAVE_COUNT);

  return highlights.flatMap((highlight, index) => {
    const key = keys.find((candidate) => findPianoHighlight(candidate, [highlight]));
    if (!key) return [];

    const hand = highlight.hand ?? (key.octave < 4 ? "left" : "right");
    const finger = highlight.finger ?? (hand === "left" ? 5 : 1);

    return [
      {
        id: `piano-${key.note}-${cursor.cursorSeconds.toFixed(1)}`,
        instrument: "piano",
        hand,
        finger,
        target: {
          x: key.x + key.width / 2,
          y: Math.min(PIANO_HAND_TARGET_Y + index * 8, key.height - 12),
          label: key.note,
        },
        cursorSeconds: cursor.cursorSeconds,
      },
    ];
  });
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
      guitarHandOverlayEvents: [],
      pianoHandOverlayEvents: [],
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
  const guitarStartFret = getGuitarStartFret(guitarPositions);

  return {
    pianoHighlights,
    guitarPositions,
    guitarOpenStrings,
    guitarStartFret,
    guitarHandOverlayEvents: buildGuitarHandOverlayEvents(guitarPositions, cursor, guitarStartFret),
    pianoHandOverlayEvents: buildPianoHandOverlayEvents(pianoHighlights, cursor),
    statusText: `Highlighting ${noteNames} at ${cursor.cursorSeconds.toFixed(1)}s`,
  };
}
