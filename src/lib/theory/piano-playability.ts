export type PianoHand = "left" | "right";
export type PianoPlaybackArticulation = "block" | "rolled";
export type PianoPhysicalResolution = "none" | "rolled-articulation" | "left-hand-shift-down-octave" | "left-hand-thinned";

export interface PianoPlayableNote {
  note: string;
  midi: number;
  abc: string;
}

export interface PianoHandEvent {
  measureIndex: number;
  beat: number;
  hand: PianoHand;
  notes: PianoPlayableNote[];
  abc: string;
}

export interface PianoPhysicalMeasureReport {
  measureIndex: number;
  beat: number;
  hand: PianoHand;
  spanSemitones: number;
  maxSpanSemitones: 16;
  rolled: boolean;
  collisionKeys: string[];
  resolution: PianoPhysicalResolution;
}

export interface PianoPlaybackEvent {
  measureIndex: number;
  beat: number;
  hand: PianoHand;
  articulation: PianoPlaybackArticulation;
  midi: number[];
  abc: string;
}

export interface PianoPlayabilityReport {
  valid: boolean;
  measures: PianoPhysicalMeasureReport[];
  playbackEvents: PianoPlaybackEvent[];
}

const MAX_HAND_SPAN_SEMITONES = 16;
const LOWEST_LEFT_HAND_MIDI = 36;

function spanSemitones(notes: PianoPlayableNote[]): number {
  if (notes.length < 2) return 0;
  const midis = notes.map((note) => note.midi);
  return Math.max(...midis) - Math.min(...midis);
}

function playbackAbcFor(event: PianoHandEvent, rolled: boolean): string {
  if (rolled) return event.notes.map((note) => note.abc).join(" ");
  return event.abc;
}

function slotKey(event: PianoHandEvent): string {
  return `${event.measureIndex}:${event.beat}`;
}

function collisionKeysFor(event: PianoHandEvent, events: PianoHandEvent[]): string[] {
  if (event.hand !== "left") return [];

  const rightHandNotes = events
    .filter((candidate) => candidate.hand === "right" && slotKey(candidate) === slotKey(event))
    .flatMap((candidate) => candidate.notes);
  if (rightHandNotes.length === 0) return [];

  const rightHandMidis = new Set(rightHandNotes.map((note) => note.midi));
  const rightHandLow = Math.min(...rightHandNotes.map((note) => note.midi));
  const rightHandHigh = Math.max(...rightHandNotes.map((note) => note.midi));

  return event.notes
    .filter((note) => rightHandMidis.has(note.midi) || (note.midi >= rightHandLow && note.midi <= rightHandHigh))
    .map((note) => note.note);
}

function shiftAbcNoteDownOctave(abc: string): string {
  return abc.replace(/^([_^=]?[A-Ga-g])([,']*)$/, (_, letter: string, octaveMarks: string) => {
    if (octaveMarks.includes("'")) {
      return `${letter}${octaveMarks.replace(/'$/, "")}`;
    }
    return `${letter}${octaveMarks},`;
  });
}

function shiftChordAbcDownOctave(abc: string): string {
  return abc.replace(/([_^=]?[A-Ga-g][,']*)/g, (note) => shiftAbcNoteDownOctave(note));
}

function shiftEventDownOctave(event: PianoHandEvent): PianoHandEvent {
  return {
    ...event,
    notes: event.notes.map((note) => ({
      ...note,
      midi: note.midi - 12,
      abc: shiftAbcNoteDownOctave(note.abc),
    })),
    abc: shiftChordAbcDownOctave(event.abc),
  };
}

function canShiftDownOctave(event: PianoHandEvent): boolean {
  return event.notes.every((note) => note.midi - 12 >= LOWEST_LEFT_HAND_MIDI);
}

function durationSuffixFor(abc: string): string {
  return abc.match(/\]([0-9]+(?:\/[0-9]+)?)$/)?.[1] ?? "";
}

function thinLeftHandEvent(event: PianoHandEvent): PianoHandEvent {
  const root = event.notes[0];
  return {
    ...event,
    notes: [root],
    abc: `${root.abc}${durationSuffixFor(event.abc)}`,
  };
}

export function validatePianoPlayability(events: PianoHandEvent[]): PianoPlayabilityReport {
  const measures = events.map((event): PianoPhysicalMeasureReport => {
    const span = spanSemitones(event.notes);
    const rolled = span > MAX_HAND_SPAN_SEMITONES;
    const collisionKeys = collisionKeysFor(event, events);
    const resolution = collisionKeys.length > 0
      ? canShiftDownOctave(event)
        ? "left-hand-shift-down-octave"
        : "left-hand-thinned"
      : rolled
        ? "rolled-articulation"
        : "none";

    return {
      measureIndex: event.measureIndex,
      beat: event.beat,
      hand: event.hand,
      spanSemitones: span,
      maxSpanSemitones: MAX_HAND_SPAN_SEMITONES,
      rolled,
      collisionKeys,
      resolution,
    };
  });

  return {
    valid: true,
    measures,
    playbackEvents: events.map((event, index) => {
      const playableEvent = measures[index].resolution === "left-hand-shift-down-octave"
        ? shiftEventDownOctave(event)
        : measures[index].resolution === "left-hand-thinned"
          ? thinLeftHandEvent(event)
          : event;

      return {
        measureIndex: playableEvent.measureIndex,
        beat: playableEvent.beat,
        hand: playableEvent.hand,
        articulation: measures[index].rolled ? "rolled" : "block",
        midi: playableEvent.notes.map((note) => note.midi),
        abc: playbackAbcFor(playableEvent, measures[index].rolled),
      };
    }),
  };
}
