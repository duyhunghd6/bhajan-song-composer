import {
  buildAbcDurationContext,
  formatAbcDuration,
  type AbcDurationContext,
} from "../abc-duration";
import {
  frettingFingerForFret,
  midiForStringFret,
  resolveGuitarPlayabilityProfile,
  scientificPitchForStringFret,
  type GuitarPlayabilityProfileInput,
} from "../guitar-playability";
import type { ChordInfo } from "../chords";
import type { MelodyMeasureTimeline, MelodyTimelineEvent } from "../arranger-utils";
import { noteNameToAbc } from "../arranger-utils";
import type { FingerstyleCompressionOptions, FingerstylePhysicalHandEvent, GuitarStringNumber } from "../fingerstyle-compressor";
import { strictPimaFingerForString, type FingerstylePickingProfileId, type PickingFinger } from "../picking-profiles";
import { validateGuitarTab, type GuitarTabEvent, type GuitarTabValidationResult } from "../guitar-tab-validation";
import { getKeyAccidentalsFromAbc, abcNoteToMidiWithKey, type AbcKeyAccidentalMap } from "../abc-key-signature";
import { scientificPitchToAbc } from "./time-slice-abc-renderer";

export type FingerstyleCanonicalSection = "intro" | "body" | "interlude" | "outro";
export type FingerstyleCanonicalRole = "melody" | "bass" | "root" | "third" | "fifth" | "seventh" | "fill";

export interface FingerstyleCanonicalEvent {
  id: string;
  sourceEventId: string;
  sectionKind: FingerstyleCanonicalSection;
  measureIndex: number;
  onsetUnits: number;
  durationUnits: number;
  beat: number;
  simultaneousGroupId: string;
  role: FingerstyleCanonicalRole;
  abcToken: string;
  note: string;
  string: GuitarStringNumber;
  fret: number;
  pickingFinger: PickingFinger;
  frettingFinger: 1 | 2 | 3 | 4 | null;
  technique: FingerstylePhysicalHandEvent["technique"];
}

export interface FingerstyleRestSpan {
  sectionKind: FingerstyleCanonicalSection;
  measureIndex: number;
  onsetUnits: number;
  durationUnits: number;
  sourceEventId: string;
}

export interface FingerstyleCanonicalMeasure {
  sectionKind: FingerstyleCanonicalSection;
  measureIndex: number;
  chord: string;
  events: FingerstyleCanonicalEvent[];
  rests: FingerstyleRestSpan[];
}

export interface FingerstyleEventMatrix {
  durationContext: AbcDurationContext;
  measures: FingerstyleCanonicalMeasure[];
  tabEvents: GuitarTabEvent[];
  validation: GuitarTabValidationResult;
  appliedWorkflowOption: {
    pickingProfile: FingerstylePickingProfileId;
    bassStrategy?: string;
    usedCanonicalGuitarTabEvents: boolean;
  };
}

const TREBLE_STRINGS: GuitarStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarStringNumber[] = [6, 5, 4];
const PITCH_CLASS_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function canonicalPitchClass(note: string): string {
  const normalized = note.replace(/^\^/, "#").replace(/^_/, "b").replace(/^=/, "");
  const match = normalized.match(/^([A-Ga-g])([#b]?)/);
  if (!match) return note;
  return `${match[1].toUpperCase()}${match[2] ?? ""}`;
}

/**
 * Convert an ABC note token to MIDI number, applying key signature accidentals
 * when no explicit accidental is present on the note.
 */
function abcNoteToMidi(note: string, keyAccidentals?: AbcKeyAccidentalMap): number | null {
  return abcNoteToMidiWithKey(note, keyAccidentals);
}

function routeMidiToStrings(midi: number, strings: GuitarStringNumber[], profileInput?: GuitarPlayabilityProfileInput): { string: GuitarStringNumber; fret: number } {
  const profile = resolveGuitarPlayabilityProfile(profileInput);
  const candidates = strings
    .map((string) => ({ string, fret: midi - midiForStringFret(string, 0) }))
    .filter((candidate) => candidate.fret >= 0 && candidate.fret <= profile.maxFret);

  if (candidates.length === 0) {
    return strings
      .map((string) => ({ string, fret: Math.max(0, Math.min(profile.maxFret, midi - midiForStringFret(string, 0))) }))
      .sort((left, right) => Math.abs(left.fret) - Math.abs(right.fret))[0];
  }

  return candidates.sort((left, right) => left.fret - right.fret || left.string - right.string)[0];
}

function routePitchClassToStrings(note: string, strings: GuitarStringNumber[], profileInput?: GuitarPlayabilityProfileInput): { string: GuitarStringNumber; fret: number } {
  const profile = resolveGuitarPlayabilityProfile(profileInput);
  const target = PITCH_CLASS_TO_SEMITONE[canonicalPitchClass(note)] ?? 0;
  return strings
    .flatMap((string) => {
      const open = midiForStringFret(string, 0) % 12;
      const fret = (target - open + 12) % 12;
      return fret <= profile.maxFret ? [{ string, fret }] : [];
    })
    .sort((left, right) => left.fret - right.fret || right.string - left.string)[0] ?? { string: strings[0], fret: 0 };
}

function beatFor(onsetUnits: number, context: AbcDurationContext): number {
  return onsetUnits / context.unitsPerBeat + 1;
}

function bassAnchorOffsets(context: AbcDurationContext): number[] {
  if (context.meter.numerator <= 1) return [0];
  if (context.meter.numerator === 3 && context.meter.denominator === 4) return [0, 2 * context.unitsPerBeat];
  if (context.meter.numerator === 6 && context.meter.denominator === 8) return [0, 3 * context.unitsPerBeat];
  return [0, Math.floor(context.meter.numerator / 2) * context.unitsPerBeat]
    .filter((offset, index, offsets) => offset < context.fullMeasureUnits && offsets.indexOf(offset) === index);
}

/**
 * Compute weak-beat subdivision offsets for inner voice chord fill events.
 * These land on the "and" of each beat (halfway between beat onsets),
 * cycling through chord tones (3rd → 5th → root) to give harmonic color.
 *
 * For 4/4 with L:1/8 (unitsPerBeat=2): offsets 1, 3, 5, 7
 * For 3/4 with L:1/8 (unitsPerBeat=2): offsets 1, 3, 5
 */
function chordFillOffsets(context: AbcDurationContext): number[] {
  const offsets: number[] = [];
  const halfBeat = context.unitsPerBeat / 2;
  if (halfBeat < 0.5) return offsets; // too small to subdivide

  for (let beat = 0; beat < context.meter.numerator; beat += 1) {
    const offset = beat * context.unitsPerBeat + halfBeat;
    if (offset < context.fullMeasureUnits) offsets.push(offset);
  }
  return offsets;
}

/** Chord tone cycle for inner voice fills: 3rd, 5th, root (repeat). */
const CHORD_FILL_TONE_CYCLE: { noteIndex: number; role: FingerstyleCanonicalRole }[] = [
  { noteIndex: 1, role: "third" },   // 3rd — most important guide tone
  { noteIndex: 2, role: "fifth" },   // 5th — harmonic support
  { noteIndex: 0, role: "root" },    // root — reinforcement
];

function pickingFingerFor(role: FingerstyleCanonicalRole, string: GuitarStringNumber, profile: FingerstylePickingProfileId, eventIndex: number): PickingFinger {
  // Thumb for bass-string events (strings 4-6) with bass/root/fifth role
  if ((role === "bass" || role === "root" || role === "fifth") && string >= 4) return "p";
  if (profile === "folk-travis") return eventIndex % 2 === 0 ? "i" : "m";
  return strictPimaFingerForString(string);
}

function eventFromRoute(input: {
  sectionKind: FingerstyleCanonicalSection;
  measureIndex: number;
  onsetUnits: number;
  durationUnits: number;
  role: FingerstyleCanonicalRole;
  abcToken: string;
  string: GuitarStringNumber;
  fret: number;
  sourceEventId: string;
  durationContext: AbcDurationContext;
  pickingProfile: FingerstylePickingProfileId;
  eventIndex: number;
}): FingerstyleCanonicalEvent {
  const beat = beatFor(input.onsetUnits, input.durationContext);
  const note = scientificPitchForStringFret(input.string, input.fret);
  const technique = input.role === "melody" && input.onsetUnits === 0 ? "pinch" : input.role === "melody" ? "guide-tone" : "thumb-clock";
  return {
    id: `${input.sectionKind}-${input.measureIndex}-${input.onsetUnits}-${input.role}-${input.string}-${input.fret}`,
    sourceEventId: input.sourceEventId,
    sectionKind: input.sectionKind,
    measureIndex: input.measureIndex,
    onsetUnits: input.onsetUnits,
    durationUnits: input.durationUnits,
    beat,
    simultaneousGroupId: `${input.sectionKind}:${input.measureIndex}:${beat}`,
    role: input.role,
    abcToken: input.abcToken,
    note,
    string: input.string,
    fret: input.fret,
    pickingFinger: pickingFingerFor(input.role, input.string, input.pickingProfile, input.eventIndex),
    frettingFinger: frettingFingerForFret(input.fret),
    technique,
  };
}

function buildBodyMeasure(input: {
  timeline: MelodyMeasureTimeline;
  chord: ChordInfo;
  durationContext: AbcDurationContext;
  pickingProfile: FingerstylePickingProfileId;
  profileInput?: GuitarPlayabilityProfileInput;
  keyAccidentals?: AbcKeyAccidentalMap;
}): FingerstyleCanonicalMeasure {
  const events: FingerstyleCanonicalEvent[] = [];
  const rests: FingerstyleRestSpan[] = [];
  let eventIndex = 0;

  // --- Phase 1: Melody events on treble strings ---
  for (const item of input.timeline.events) {
    if (item.kind === "rest") {
      rests.push({
        sectionKind: "body",
        measureIndex: input.timeline.measureIndex,
        onsetUnits: item.onsetUnits,
        durationUnits: item.durationUnits,
        sourceEventId: item.sourceEventId,
      });
      continue;
    }

    const writtenMidi = abcNoteToMidi(item.token, input.keyAccidentals);
    // Guitar is a transposing instrument (treble-8): the source melody is written
    // in standard treble clef, but guitar sounds one octave lower. Subtract 12
    // so routeMidiToStrings maps to the physical fret that produces the intended
    // concert pitch. Without this, lowercase 'd' (D5 written, MIDI 74) would
    // route to string 1 fret 10 instead of the correct D4 at string 2 fret 3.
    const midi = writtenMidi != null ? writtenMidi - 12 : null;
    const route = routeMidiToStrings(midi ?? midiForStringFret(1, 0), TREBLE_STRINGS, input.profileInput);
    events.push(eventFromRoute({
      sectionKind: "body",
      measureIndex: input.timeline.measureIndex,
      onsetUnits: item.onsetUnits,
      durationUnits: item.durationUnits,
      role: "melody",
      abcToken: item.token,
      string: route.string,
      fret: route.fret,
      sourceEventId: item.sourceEventId,
      durationContext: input.durationContext,
      pickingProfile: input.pickingProfile,
      eventIndex: eventIndex++,
    }));
  }

  // --- Phase 2: Bass anchors (root + 5th) on bass strings ---
  for (const [anchorIndex, onsetUnits] of bassAnchorOffsets(input.durationContext).entries()) {
    const note = input.chord.notes[anchorIndex === 0 ? 0 : 2] ?? input.chord.notes[0] ?? input.chord.chordName;
    const route = routePitchClassToStrings(note, BASS_STRINGS, input.profileInput);
    events.push(eventFromRoute({
      sectionKind: "body",
      measureIndex: input.timeline.measureIndex,
      onsetUnits,
      durationUnits: input.durationContext.unitsPerBeat,
      role: anchorIndex === 0 ? "bass" : "fifth",
      abcToken: noteNameToAbc(note, ","),
      string: route.string,
      fret: route.fret,
      sourceEventId: `chord-${input.timeline.measureIndex}-${anchorIndex === 0 ? "root" : "fifth"}-${input.chord.chordName}`,
      durationContext: input.durationContext,
      pickingProfile: input.pickingProfile,
      eventIndex: eventIndex++,
    }));
  }

  // --- Phase 3: Inner voice chord fills at weak-beat subdivisions ---
  // Cycle through 3rd → 5th → root of the current chord, placed on treble
  // strings that are not already used by melody at the same onset.
  const melodyOnsets = new Set(
    events.filter((e) => e.role === "melody").map((e) => e.onsetUnits)
  );
  const bassOnsets = new Set(
    events.filter((e) => e.role === "bass" || e.role === "fifth").map((e) => e.onsetUnits)
  );
  const fillPositions = chordFillOffsets(input.durationContext);

  for (const [fillIndex, onsetUnits] of fillPositions.entries()) {
    // Skip if a melody note attacks at this exact onset (preserve melody clarity)
    if (melodyOnsets.has(onsetUnits)) continue;
    // Skip if a bass anchor lands here (already occupied)
    if (bassOnsets.has(onsetUnits)) continue;

    const toneEntry = CHORD_FILL_TONE_CYCLE[fillIndex % CHORD_FILL_TONE_CYCLE.length];
    const note = input.chord.notes[toneEntry.noteIndex] ?? input.chord.notes[0] ?? input.chord.chordName;

    // Find a treble string not used by melody at this onset
    const melodyStringsAtOnset = new Set(
      events
        .filter((e) => e.role === "melody" && Math.abs(e.onsetUnits - onsetUnits) < 1e-6)
        .map((e) => e.string)
    );
    const availableTrebleStrings = TREBLE_STRINGS.filter((s) => !melodyStringsAtOnset.has(s));
    const targetStrings = availableTrebleStrings.length > 0 ? availableTrebleStrings : TREBLE_STRINGS;
    const route = routePitchClassToStrings(note, targetStrings, input.profileInput);

    events.push(eventFromRoute({
      sectionKind: "body",
      measureIndex: input.timeline.measureIndex,
      onsetUnits,
      durationUnits: input.durationContext.unitsPerBeat / 2,
      role: toneEntry.role,
      abcToken: noteNameToAbc(note),
      string: route.string,
      fret: route.fret,
      sourceEventId: `chord-fill-${input.timeline.measureIndex}-${fillIndex}-${toneEntry.role}-${input.chord.chordName}`,
      durationContext: input.durationContext,
      pickingProfile: input.pickingProfile,
      eventIndex: eventIndex++,
    }));
  }

  return {
    sectionKind: "body",
    measureIndex: input.timeline.measureIndex,
    chord: input.chord.chordName,
    events: events.sort((left, right) => left.onsetUnits - right.onsetUnits || left.string - right.string),
    rests,
  };
}

/**
 * ABCJS Tablature Rendering and String Mapping Rules:
 * 1. String Forcing: We prepend ABC notes with the !N! string decoration (e.g. !1!b, !6!B)
 *    to explicitly assign the note to string N (1-6). This instructs ABCJS's
 *    getStringDecoration() to bypass its default lowest-fret auto-assignment algorithm.
 * 2. Duplicate Pitches: Because string forcing bypasses auto-assignment, it is valid to
 *    output the same concert pitch on multiple strings simultaneously. We do not deduplicate.
 * 3. Octave Convention: We write ABC tokens one octave above concert pitch for the
 *    treble-8 clef. ABCJS internally applies clefTranspose = -12 to the written ABC
 *    pitch before computing the fret against its un-transposed tuning stringPitches,
 *    arriving at the correct sounding pitch and fret number.
 */
function tokenForEvent(event: FingerstyleCanonicalEvent, keyAccidentals?: AbcKeyAccidentalMap): string {
  // Pass treble8Shift = true when the event targets a guitar string, because
  // the Guitar voice uses clef=treble-8 and ABCJS subtracts 12 from written pitch.
  const hasStringAssignment = event.string !== undefined && event.string !== null;
  const baseToken = event.string !== undefined && event.fret !== undefined
    ? scientificPitchToAbc(scientificPitchForStringFret(event.string, event.fret), keyAccidentals, hasStringAssignment)
    : event.role === "melody"
      ? event.abcToken
      : noteNameToAbc(event.note.replace(/-?\d+$/, ""), event.role === "bass" || event.role === "fifth" ? "," : "");

  if (hasStringAssignment) {
    return `!${event.string}!${baseToken}`;
  }
  return baseToken;
}

function activeEventsAt(measure: FingerstyleCanonicalMeasure, at: number): FingerstyleCanonicalEvent[] {
  return measure.events.filter((event) => event.onsetUnits <= at && at < event.onsetUnits + Math.max(event.durationUnits, 0.000001));
}

function startingEventsAt(measure: FingerstyleCanonicalMeasure, at: number): FingerstyleCanonicalEvent[] {
  return measure.events.filter((event) => Math.abs(event.onsetUnits - at) < 1e-6);
}

export function renderCanonicalMeasureAbc(
  measure: FingerstyleCanonicalMeasure,
  context: AbcDurationContext,
  keyAccidentals?: AbcKeyAccidentalMap,
): string {
  const boundaries = new Set<number>([0, context.fullMeasureUnits]);
  for (const event of measure.events) {
    boundaries.add(event.onsetUnits);
    boundaries.add(Math.min(context.fullMeasureUnits, event.onsetUnits + event.durationUnits));
  }
  for (const rest of measure.rests) {
    boundaries.add(rest.onsetUnits);
    boundaries.add(Math.min(context.fullMeasureUnits, rest.onsetUnits + rest.durationUnits));
  }
  const sorted = [...boundaries].filter((value) => value >= 0 && value <= context.fullMeasureUnits).sort((left, right) => left - right);
  const rendered: string[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const at = sorted[index];
    const duration = sorted[index + 1] - at;
    if (duration <= 0) continue;

    const active = activeEventsAt(measure, at);
    const starting = startingEventsAt(measure, at);
    const sounding = [...new Map([...active, ...starting].map((event) => [event.id, event])).values()]
      .sort((left, right) => {
        const roleRank = (event: FingerstyleCanonicalEvent) => event.role === "bass" || event.role === "fifth" || event.role === "root" ? 0 : 1;
        return roleRank(left) - roleRank(right) || right.string - left.string;
      });
    const suffix = formatAbcDuration(duration);

    if (sounding.length === 0) rendered.push(`z${suffix}`);
    else if (sounding.length === 1) rendered.push(`${tokenForEvent(sounding[0], keyAccidentals)}${suffix}`);
    else rendered.push(`[${sounding.map((event) => tokenForEvent(event, keyAccidentals)).join("")}]${suffix}`);
  }

  return rendered.join(" ");
}

function selectedTabEvents(options: FingerstyleCompressionOptions): GuitarTabEvent[] | null {
  const raw = options.workflowOptionData?.guitarTab;
  const events = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as { events?: unknown }).events
    : undefined;
  if (!Array.isArray(events) || events.length === 0) return null;
  return events.filter((event): event is GuitarTabEvent => Boolean(
    event && typeof event === "object" &&
    typeof (event as GuitarTabEvent).measureIndex === "number" &&
    typeof (event as GuitarTabEvent).beat === "number" &&
    typeof (event as GuitarTabEvent).note === "string" &&
    typeof (event as GuitarTabEvent).string === "number" &&
    typeof (event as GuitarTabEvent).fret === "number" &&
    typeof (event as GuitarTabEvent).role === "string"
  ));
}

export function canonicalEventsToTabEvents(events: FingerstyleCanonicalEvent[], options: FingerstyleCompressionOptions = {}): GuitarTabEvent[] {
  const selected = selectedTabEvents(options);
  if (selected) return selected;
  return events.map((event) => ({
    measureIndex: event.measureIndex,
    beat: event.beat,
    simultaneousGroupId: event.simultaneousGroupId,
    sourceEventId: event.sourceEventId,
    note: event.note,
    string: event.string,
    fret: event.fret,
    role: event.role,
  }));
}

export function buildFingerstyleEventMatrix(input: {
  abcString: string;
  timelines: MelodyMeasureTimeline[];
  chords: ChordInfo[];
  options?: FingerstyleCompressionOptions;
}): FingerstyleEventMatrix {
  const durationContext = buildAbcDurationContext(input.abcString);
  const keyAccidentals = getKeyAccidentalsFromAbc(input.abcString);
  const options = input.options ?? {};
  const pickingProfile = options.pickingProfile ?? (options.workflowOptionData?.pickingProfile === "folk-travis" ? "folk-travis" : "strict-pima");
  const measures = input.chords.map((chord, measureIndex) => buildBodyMeasure({
    timeline: input.timelines[measureIndex] ?? { measureIndex, events: [] as MelodyTimelineEvent[] },
    chord,
    durationContext,
    pickingProfile,
    keyAccidentals,
  }));
  const generatedTabEvents = canonicalEventsToTabEvents(measures.flatMap((measure) => measure.events));
  const selected = selectedTabEvents(options);
  const selectedValidation = selected
    ? validateGuitarTab(selected, { requireScientificPitch: true, requireSourceEventIds: true, voicingProfile: "fingerstyle-melody-bass" })
    : null;
  const useSelected = Boolean(selected && selectedValidation?.valid && selected.length >= generatedTabEvents.length);
  const tabEvents = useSelected && selected ? selected : generatedTabEvents;
  const validation = validateGuitarTab(tabEvents, { requireScientificPitch: true, requireSourceEventIds: true, voicingProfile: "fingerstyle-melody-bass" });

  return {
    durationContext,
    measures,
    tabEvents,
    validation,
    appliedWorkflowOption: {
      pickingProfile,
      bassStrategy: typeof options.workflowOptionData?.bassStrategy === "string" ? options.workflowOptionData.bassStrategy : undefined,
      usedCanonicalGuitarTabEvents: useSelected,
    },
  };
}
