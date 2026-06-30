import { ChordInfo, getDiatonicChords } from "./chords";
import { generateProgression, parseRootAndMode } from "./harmonizer";
import { normalizeAbcNote, parseAbcHeader, parseNoteDuration } from "./melody-analyzer";

export interface MelodyNoteEvent {
  note: string;
  duration: number;
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

export function resolveProgression(abcString: string, progression = generateProgression(abcString)): ResolvedProgression {
  const header = parseAbcHeader(abcString);
  const { root, mode } = parseRootAndMode(header.key);
  const diatonicChords = getDiatonicChords(root, mode);

  return {
    key: header.key,
    timeSignature: header.timeSignature,
    chords: progression.map((chordName) => {
      const chord = diatonicChords.find((candidate) => candidate.chordName === chordName);
      return chord ?? diatonicChords[0];
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

export function extractMelodyMeasures(abcString: string): MelodyNoteEvent[][] {
  const body = abcString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Z]:/.test(line))
    .join(" ");

  const rawMeasures = body.split(/[|\]]/);
  const measures: MelodyNoteEvent[][] = [];
  const noteRegex = /([_^=]?[A-Ga-g][,']*)([0-9]*\/?[0-9]*)/g;

  for (const rawMeasure of rawMeasures) {
    const trimmed = rawMeasure.trim().replace(/^[:\s]+|[:\s]+$/g, "");
    if (!trimmed || trimmed === ":" || trimmed === "::") continue;

    const notes: MelodyNoteEvent[] = [];
    let match: RegExpExecArray | null;
    noteRegex.lastIndex = 0;

    while ((match = noteRegex.exec(trimmed)) !== null) {
      notes.push({
        note: match[1],
        duration: parseNoteDuration(match[2]),
      });
    }

    if (notes.length > 0) {
      measures.push(notes);
    }
  }

  return measures;
}

export function melodyNoteToQuarterAbc(event: MelodyNoteEvent | undefined): string {
  if (!event) return "z2";
  return `${event.note}2`;
}
