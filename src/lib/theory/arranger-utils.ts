import { ChordInfo, getDiatonicChords } from "./chords";
import { generateProgression, parseRootAndMode } from "./harmonizer";
import { extractDurationTokens, extractMusicBodyLines, splitAbcMeasureSegments, stripAbcChordSymbols } from "./abc-duration";
import { normalizeAbcNote, parseAbcHeader } from "./melody-analyzer";
import { getNoteValue, spellNote } from "./scales";

export interface MelodyNoteEvent {
  note: string;
  duration: number;
}

export interface MelodyTimelineEvent {
  kind: "note" | "rest";
  token: string;
  durationUnits: number;
  onsetUnits: number;
  sourceEventId: string;
}

export interface MelodyMeasureTimeline {
  measureIndex: number;
  events: MelodyTimelineEvent[];
}

export interface ResolvedProgression {
  key: string;
  timeSignature: string;
  chords: ChordInfo[];
}

const ACCIDENTAL_TO_ABC: Record<string, string> = {
  "#": "^",
  b: "_",
};

const CHORD_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

function noteAtInterval(root: string, semitones: number, letterSteps: number): string {
  const rootValue = getNoteValue(root);
  const rootLetterIndex = CHORD_LETTERS.indexOf(root.charAt(0).toUpperCase());
  if (rootValue === undefined || rootLetterIndex === -1) return root;

  const preferredLetter = CHORD_LETTERS[(rootLetterIndex + letterSteps) % CHORD_LETTERS.length];
  return spellNote(rootValue + semitones, preferredLetter);
}

function chordInfoFromName(chordName: string, degree = 1): ChordInfo | null {
  const rootMatch = chordName.match(/^([A-G](?:#|b)?)/);
  if (!rootMatch) return null;

  const root = rootMatch[1];
  const descriptor = chordName.slice(root.length).split("/")[0].toLowerCase();
  const thirdInterval = descriptor.startsWith("m") && !descriptor.startsWith("maj") ? 3 : 4;
  const fifthInterval = descriptor.includes("dim") || descriptor.includes("b5") ? 6 : descriptor.includes("aug") ? 8 : 7;

  return {
    degree,
    chordName,
    notes: [
      root,
      noteAtInterval(root, thirdInterval, 2),
      noteAtInterval(root, fifthInterval, 4),
    ],
  };
}

export function resolveProgression(abcString: string, progression = generateProgression(abcString)): ResolvedProgression {
  const header = parseAbcHeader(abcString);
  const { root, mode } = parseRootAndMode(header.key);
  const diatonicChords = getDiatonicChords(root, mode);

  return {
    key: header.key,
    timeSignature: header.timeSignature,
    chords: progression.map((chordName) => {
      const chord = diatonicChords.find((candidate) => candidate.chordName === chordName);
      return chord ?? chordInfoFromName(chordName) ?? diatonicChords[0];
    }),
  };
}

export function getBeatsPerMeasure(timeSignature: string): number {
  const [beats] = timeSignature.split("/").map((part) => Number.parseInt(part, 10));
  return Number.isFinite(beats) && beats > 0 ? beats : 4;
}

export function noteNameToAbc(noteName: string, octaveMarks = ""): string {
  const normalized = normalizeAbcNote(noteName);
  const match = normalized.match(/^([A-G])([#b]?)$/);

  if (!match) return normalized + octaveMarks;

  const [, letter, accidental] = match;
  return `${ACCIDENTAL_TO_ABC[accidental] ?? ""}${letter}${octaveMarks}`;
}

function extractMelodyBodyLines(abcString: string): string[] {
  const lines = abcString.split(/\r?\n/);
  const inlineMelodyLines = lines.flatMap((line) => {
    const match = line.trim().match(/^\[V:([^\]]+)\]\s*(.*)$/);
    return match && match[1] === "Melody" && match[2].trim() ? [match[2].trim()] : [];
  });

  if (inlineMelodyLines.length > 0) return inlineMelodyLines;
  return extractMusicBodyLines(abcString);
}

export function extractMelodyMeasureTimeline(abcString: string): MelodyMeasureTimeline[] {
  const body = extractMelodyBodyLines(abcString).join(" ");
  const measures = splitAbcMeasureSegments(body);

  return measures.map((measure, measureIndex) => {
    let onsetUnits = 0;
    const events = extractDurationTokens(measure).map((token, eventIndex): MelodyTimelineEvent => {
      const kind = /^[zx]/.test(token.token) ? "rest" : "note";
      const event: MelodyTimelineEvent = {
        kind,
        token: token.token,
        durationUnits: token.durationUnits,
        onsetUnits,
        sourceEventId: `melody-${measureIndex}-${eventIndex}-${kind}-${token.token}-${onsetUnits}`,
      };
      onsetUnits += token.durationUnits;
      return event;
    });

    return { measureIndex, events };
  });
}

export function extractMelodyMeasures(abcString: string): MelodyNoteEvent[][] {
  return extractMelodyMeasureTimeline(abcString)
    .map((measure) => measure.events
      .filter((event) => event.kind === "note")
      .map((event) => ({ note: event.token, duration: event.durationUnits })))
    .filter((measure) => measure.length > 0);
}

export function melodyNoteToQuarterAbc(event: MelodyNoteEvent | undefined): string {
  if (!event) return "z2";
  return `${event.note}2`;
}
