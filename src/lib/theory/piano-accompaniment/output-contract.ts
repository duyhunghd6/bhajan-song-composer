import { getNoteValue } from "../scales";
import type { PianoHandEvent } from "../piano-playability";
import type {
  PianoAccompaniment,
  PianoBassEvent,
  PianoBassRole,
  PianoFingeringMetadata,
  PianoLeftHandBassMeasure,
  PianoRightHandVoicingMeasure,
} from "./types";

function normalizeNoteName(note: string): string {
  const match = note.match(/[_^=]?([A-Ga-g])/);
  if (!match) return note;
  return match[1].toUpperCase();
}

function midiForBassEvent(event: PianoBassEvent): number {
  const pitchClass = getNoteValue(normalizeNoteName(event.note)) ?? 0;
  const baseOctave = event.role === "octave" ? 48 : 36;
  return baseOctave + pitchClass;
}

const MIDI_PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteWithOctave(midi: number): string {
  const pitchClass = MIDI_PITCH_CLASSES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${pitchClass}${octave}`;
}

function fingerForBassRole(role: PianoBassRole): number {
  if (role === "root") return 5;
  if (role === "fifth") return 2;
  return 1;
}

function fingerForRightHandTone(index: number, toneCount: number): number {
  if (toneCount === 1) return 2;
  if (toneCount === 2) return index === 0 ? 1 : 3;
  return [1, 2, 4, 5][index] ?? 5;
}

export function buildPianoOutputContract(
  leftHandBassMap: PianoLeftHandBassMeasure[],
  rightHandVoicingMap: PianoRightHandVoicingMeasure[]
): Pick<PianoAccompaniment, "pianoKeyHighlights" | "fingeringMetadata"> {
  const fingeringMetadata: PianoFingeringMetadata[] = [];

  leftHandBassMap.forEach((measure) => {
    fingeringMetadata.push({
      measureIndex: measure.measureIndex,
      beat: 1,
      hand: "left",
      source: "left-hand-bass",
      chord: measure.chord,
      notes: measure.events.map((event) => {
        const midi = midiForBassEvent(event);
        const finger = fingerForBassRole(event.role);
        return {
          note: noteWithOctave(midi),
          pitchClass: normalizeNoteName(event.note),
          midi,
          abc: event.abc,
          finger,
          role: event.role,
        };
      }),
    });
  });

  rightHandVoicingMap.forEach((measure) => {
    fingeringMetadata.push({
      measureIndex: measure.measureIndex,
      beat: 1,
      hand: "right",
      source: "right-hand-voicing",
      chord: measure.chord,
      notes: measure.tones.map((tone, index) => {
        const finger = fingerForRightHandTone(index, measure.tones.length);
        return {
          note: noteWithOctave(tone.midi),
          pitchClass: normalizeNoteName(tone.note),
          midi: tone.midi,
          abc: tone.abc,
          finger,
          role: tone.role,
        };
      }),
    });
  });

  const pianoKeyHighlights = fingeringMetadata.flatMap((event) =>
    event.notes.map((note) => ({
      measureIndex: event.measureIndex,
      beat: event.beat,
      hand: event.hand,
      note: note.note,
      midi: note.midi,
      abc: note.abc,
      finger: note.finger,
      role: note.role,
      label: String(note.finger),
    }))
  );

  return { pianoKeyHighlights, fingeringMetadata };
}

export function buildPhysicalHandEvents(
  leftHandBassMap: PianoLeftHandBassMeasure[],
  rightHandVoicingMap: PianoRightHandVoicingMeasure[]
): PianoHandEvent[] {
  const leftHandEvents = leftHandBassMap.map((measure): PianoHandEvent => ({
    measureIndex: measure.measureIndex,
    beat: 1,
    hand: "left",
    notes: measure.events.map((event) => ({
      note: event.note,
      midi: midiForBassEvent(event),
      abc: event.abc,
    })),
    abc: measure.abc,
  }));
  const rightHandEvents = rightHandVoicingMap.map((measure): PianoHandEvent => ({
    measureIndex: measure.measureIndex,
    beat: 1,
    hand: "right",
    notes: measure.tones.map((tone) => ({
      note: tone.note,
      midi: tone.midi,
      abc: tone.abc,
    })),
    abc: measure.abc,
  }));

  return [...leftHandEvents, ...rightHandEvents].sort((a, b) =>
    a.measureIndex - b.measureIndex || a.beat - b.beat || a.hand.localeCompare(b.hand)
  );
}
