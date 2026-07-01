import { ChordInfo } from "./chords";
import { getBeatsPerMeasure, noteNameToAbc, resolveProgression } from "./arranger-utils";
import { getNoteValue } from "./scales";

export type AccompanimentInstrument = "piano" | "rhythm-guitar";
export type CompingPattern = "block" | "arpeggio" | "syncopation";
export type ChordInversion = "root" | "first" | "second";
export type StrumDirection = "down" | "up" | "rest";
export type StrumRole = "bass-emphasis" | "syncopated-space" | "off-beat-chord" | "backbeat-chord" | "steady-chord";

export interface StrumEvent {
  beat: number;
  direction: StrumDirection;
  role: StrumRole;
}

export interface AccompanimentOptions {
  instrument?: AccompanimentInstrument;
  progression?: string[];
  compingPattern?: CompingPattern;
}

export interface VoiceMovement {
  from: string;
  to: string;
  semitoneDistance: number;
}

export interface AccompanimentMeasure {
  measureIndex: number;
  chord: string;
  bassNote: string;
  inversion: ChordInversion;
  compingPattern: CompingPattern;
  voiceLeading: {
    previousBassNote: string | null;
    semitoneDistance: number;
    stableNotes: string[];
    voiceMovements: VoiceMovement[];
  };
  notes: string[];
  abc: string;
  strums?: StrumEvent[];
}

export interface AccompanimentStage {
  layer: {
    number: 2;
    name: "Accompaniment";
    instrument: AccompanimentInstrument;
  };
  key: string;
  timeSignature: string;
  measures: AccompanimentMeasure[];
  abc: string;
}

const INVERSION_BY_INDEX: ChordInversion[] = ["root", "first", "second"];

function semitoneDistance(fromNote: string, toNote: string): number {
  const from = getNoteValue(fromNote);
  const to = getNoteValue(toNote);

  if (from === undefined || to === undefined) return 0;

  const clockwise = Math.abs(to - from);
  return Math.min(clockwise, 12 - clockwise);
}

function chooseBassTone(chord: ChordInfo, previousBassNote: string | null) {
  if (!previousBassNote) {
    return { bassNote: chord.notes[0], inversion: "root" as ChordInversion, distance: 0 };
  }

  const candidates = chord.notes.map((note, index) => ({
    bassNote: note,
    inversion: INVERSION_BY_INDEX[index] ?? "root",
    distance: semitoneDistance(previousBassNote, note),
    chordToneIndex: index,
  }));

  candidates.sort((a, b) => a.distance - b.distance || a.chordToneIndex - b.chordToneIndex);
  return candidates[0];
}

function buildVoiceMovements(previousNotes: string[] | null, currentNotes: string[]) {
  if (!previousNotes) {
    return { stableNotes: [], voiceMovements: [] };
  }

  const stableNotes = previousNotes.filter((note) => currentNotes.includes(note));
  const remainingCurrent = currentNotes.filter((note) => !stableNotes.includes(note));
  const voiceMovements = previousNotes
    .filter((note) => !stableNotes.includes(note))
    .map((from) => {
      const closest = remainingCurrent
        .map((to) => ({ to, semitoneDistance: semitoneDistance(from, to) }))
        .sort((a, b) => a.semitoneDistance - b.semitoneDistance)[0];

      if (closest) {
        remainingCurrent.splice(remainingCurrent.indexOf(closest.to), 1);
        return { from, ...closest };
      }

      return { from, to: from, semitoneDistance: 0 };
    });

  return { stableNotes, voiceMovements };
}

function buildPianoTokens(chord: ChordInfo, bassNote: string, pattern: CompingPattern, beatCount: number): string[] {
  const bass = noteNameToAbc(bassNote, ",,");
  const third = noteNameToAbc(chord.notes[1], ",");
  const fifth = noteNameToAbc(chord.notes[2], ",,");
  const upperRoot = noteNameToAbc(chord.notes[0], ",");

  if (pattern === "block") {
    const block = `[${bass}${third}${upperRoot}]2`;
    return Array.from({ length: beatCount }, () => block);
  }

  if (pattern === "syncopation") {
    const syncopated = [`${bass}2`, "z2", `[${third}${upperRoot}]2`, `${fifth}2`];
    return Array.from({ length: beatCount }, (_, index) => syncopated[index % syncopated.length]);
  }

  const arpeggio = [bass, fifth, third, fifth];
  return Array.from({ length: beatCount }, (_, index) => `${arpeggio[index % arpeggio.length]}2`);
}

function buildRhythmGuitarTokens(chord: ChordInfo, pattern: CompingPattern, beatCount: number): string[] {
  const chordTone = `[${chord.notes.map((note) => noteNameToAbc(note)).join("")}]2`;

  if (pattern === "arpeggio") {
    const arpeggio = chord.notes.map((note) => `${noteNameToAbc(note)}2`);
    return Array.from({ length: beatCount }, (_, index) => arpeggio[index % arpeggio.length]);
  }

  if (pattern === "syncopation") {
    const syncopated = [chordTone, "z2", chordTone, chordTone];
    return Array.from({ length: beatCount }, (_, index) => syncopated[index % syncopated.length]);
  }

  return Array.from({ length: beatCount }, () => chordTone);
}

function buildMeasureAbc(
  instrument: AccompanimentInstrument,
  chord: ChordInfo,
  bassNote: string,
  compingPattern: CompingPattern,
  beatCount: number
): string {
  const tokens = instrument === "piano"
    ? buildPianoTokens(chord, bassNote, compingPattern, beatCount)
    : buildRhythmGuitarTokens(chord, compingPattern, beatCount);

  return tokens.join(" ");
}

function buildStrumEvents(pattern: CompingPattern, beatCount: number): StrumEvent[] {
  const syncopation: StrumEvent[] = [
    { beat: 1, direction: "down", role: "bass-emphasis" },
    { beat: 2, direction: "rest", role: "syncopated-space" },
    { beat: 3, direction: "up", role: "off-beat-chord" },
    { beat: 4, direction: "down", role: "backbeat-chord" },
  ];

  const steady: StrumEvent[] = Array.from({ length: beatCount }, (_, index) => ({
    beat: index + 1,
    direction: index % 2 === 0 ? "down" : "up",
    role: "steady-chord",
  }));

  const events = pattern === "syncopation" ? syncopation : steady;
  return events.slice(0, beatCount);
}

function buildVoiceHeader(instrument: AccompanimentInstrument): string {
  if (instrument === "piano") {
    return "V:Accompaniment clef=bass name=\"Layer 2 Piano Accompaniment\"";
  }

  return "V:Accompaniment clef=treble-8 name=\"Layer 2 Rhythm Guitar Accompaniment\"";
}

export function generateAccompanimentStage(
  abcString: string,
  options: AccompanimentOptions = {}
): AccompanimentStage {
  const instrument = options.instrument ?? "piano";
  const compingPattern = options.compingPattern ?? (instrument === "piano" ? "arpeggio" : "block");
  const resolved = resolveProgression(abcString, options.progression);
  if (resolved.chords.length === 0) {
    throw new Error("Accompaniment stage requires at least one harmonized chord");
  }

  const beatCount = getBeatsPerMeasure(resolved.timeSignature);
  let previousBassNote: string | null = null;
  let previousChordNotes: string[] | null = null;

  const measures = resolved.chords.map((chord, measureIndex) => {
    const selectedBass = chooseBassTone(chord, previousBassNote);
    const upperVoiceLeading = buildVoiceMovements(previousChordNotes, chord.notes);
    const measure: AccompanimentMeasure = {
      measureIndex,
      chord: chord.chordName,
      bassNote: selectedBass.bassNote,
      inversion: selectedBass.inversion,
      compingPattern,
      voiceLeading: {
        previousBassNote,
        semitoneDistance: selectedBass.distance,
        ...upperVoiceLeading,
      },
      notes: chord.notes,
      abc: buildMeasureAbc(instrument, chord, selectedBass.bassNote, compingPattern, beatCount),
      ...(instrument === "rhythm-guitar" ? { strums: buildStrumEvents(compingPattern, beatCount) } : {}),
    };

    previousBassNote = selectedBass.bassNote;
    previousChordNotes = chord.notes;
    return measure;
  });

  return {
    layer: { number: 2, name: "Accompaniment", instrument },
    key: resolved.key,
    timeSignature: resolved.timeSignature,
    measures,
    abc: `${buildVoiceHeader(instrument)}\n| ${measures.map((measure) => measure.abc).join(" | ")} |`,
  };
}
