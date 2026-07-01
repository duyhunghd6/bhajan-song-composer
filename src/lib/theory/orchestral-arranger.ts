import { AccompanimentStage, AccompanimentMeasure } from "./accompaniment-stage";
import { EnsembleIntegrationHandshake, generateEnsembleIntegrationHandshake } from "./ensemble-expander";
import { getNoteValue } from "./scales";

export type OrchestralInstrument = "flute" | "violin";
export type OrchestralSupportMode = "background" | "fill" | "silent";
export type OrchestralSupportRole = "flute-halo" | "violin-bed";
export type OrchestralSupportSource = "layer1-active" | "melodic-gap";

export interface OrchestralSupportOptions {
  accompaniment: AccompanimentStage;
  handshake?: EnsembleIntegrationHandshake;
}

export interface OrchestralSupportEvent {
  instrument: OrchestralInstrument;
  role: OrchestralSupportRole;
  mode: Exclude<OrchestralSupportMode, "silent">;
  source: OrchestralSupportSource;
  measureIndex: number;
  beat: number;
  startMs: number;
  durationMs: number;
  note: string;
  midiNote: number;
  velocity: number;
  preBreathVelocityDip?: boolean;
}

export interface FluteBreathEvent {
  instrument: "flute";
  measureIndex: number;
  beat: number;
  startMs: number;
  durationMs: number;
  reason: string;
}

export interface ViolinExpressionEvent {
  instrument: "violin";
  measureIndex: number;
  beat: number;
  startMs: number;
  controller: 1 | 11;
  value: number;
  purpose: "bow-expression-swell-start" | "bow-expression-swell-crest" | "delayed-vibrato";
}

export interface ViolinDroppedNote {
  midiNote: number;
  reason: string;
}

export interface ViolinDoubleStopValidation {
  playable: boolean;
  acceptedNotes: number[];
  droppedNotes: ViolinDroppedNote[];
  reason: string;
}

export interface OrchestralYieldDecision {
  measureIndex: number;
  beat: number;
  startMs: number;
  layer1Active: boolean;
  fluteMode: OrchestralSupportMode;
  violinMode: OrchestralSupportMode;
  reason: string;
}

export interface OrchestralSupportArrangement {
  fluteSupportMap: OrchestralSupportEvent[];
  violinSupportMap: OrchestralSupportEvent[];
  fluteBreathMap: FluteBreathEvent[];
  violinExpressionMap: ViolinExpressionEvent[];
  yieldDecisions: OrchestralYieldDecision[];
}

const BACKGROUND_VELOCITY = 64;
const FILL_VELOCITY = 80;
const PRE_BREATH_VELOCITY = 52;
const SIXTEENTH_NOTE_MS_AT_120_BPM = 125;
const FLUTE_BREATH_INTERVAL_MEASURES = 2;
const FLUTE_BREATH_BEAT = 4.75;
const VIOLIN_SWELL_START = 54;
const VIOLIN_SWELL_CREST = 76;
const VIOLIN_VIBRATO_VALUE = 42;
const VIOLIN_VIBRATO_DELAY_MS = 300;
const MAX_VIOLIN_DOUBLE_STOP_SPAN = 7;
const FLUTE_RANGE = { min: 72, max: 84 };
const VIOLIN_RANGE = { min: 55, max: 76 };

function midiToNoteName(midiNote: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midiNote / 12) - 1;
  return `${names[midiNote % 12]}${octave}`;
}

function chordToneInRange(noteName: string, range: { min: number; max: number }, preferredOctave: number): number {
  const pitchClass = getNoteValue(noteName);
  if (pitchClass === undefined) return range.min;

  const preferred = (preferredOctave + 1) * 12 + pitchClass;
  if (preferred >= range.min && preferred <= range.max) return preferred;

  for (let octave = 0; octave <= 8; octave += 1) {
    const midiNote = (octave + 1) * 12 + pitchClass;
    if (midiNote >= range.min && midiNote <= range.max) return midiNote;
  }

  return range.min;
}

function findMeasure(accompaniment: AccompanimentStage, measureIndex: number): AccompanimentMeasure {
  return accompaniment.measures.find((measure) => measure.measureIndex === measureIndex) ?? accompaniment.measures[0];
}

export function validateViolinDoubleStop(midiNotes: number[]): ViolinDoubleStopValidation {
  const sortedNotes = [...midiNotes].sort((a, b) => a - b);

  if (sortedNotes.length > 2) {
    const acceptedNotes = sortedNotes.slice(-2);
    const droppedNote = sortedNotes[0];
    return {
      playable: false,
      acceptedNotes,
      droppedNotes: [{
        midiNote: droppedNote,
        reason: "Dropped lower note because Violin double-stops cannot exceed two simultaneous notes",
      }],
      reason: "Reduced Violin voicing to two-note double-stop",
    };
  }

  const span = sortedNotes.at(-1)! - sortedNotes[0];
  if (sortedNotes.length === 2 && span > MAX_VIOLIN_DOUBLE_STOP_SPAN) {
    const droppedNote = sortedNotes[0];
    return {
      playable: false,
      acceptedNotes: [sortedNotes[1]],
      droppedNotes: [{
        midiNote: droppedNote,
        reason: `Dropped lower note because ${span} semitones exceeds playable Violin double-stop span`,
      }],
      reason: "Unplayable Violin double-stop span reduced to upper note",
    };
  }

  return {
    playable: true,
    acceptedNotes: sortedNotes,
    droppedNotes: [],
    reason: "Playable two-note Violin double-stop span",
  };
}

function buildSupportEvent(
  instrument: OrchestralInstrument,
  measure: AccompanimentMeasure,
  beat: number,
  startMs: number,
  durationMs: number,
  mode: Exclude<OrchestralSupportMode, "silent">,
  source: OrchestralSupportSource,
  preBreathVelocityDip = false
): OrchestralSupportEvent {
  const role = instrument === "flute" ? "flute-halo" : "violin-bed";
  const range = instrument === "flute" ? FLUTE_RANGE : VIOLIN_RANGE;
  const chordTone = instrument === "flute" ? measure.notes[2] ?? measure.notes[0] : measure.notes[0];
  const midiNote = chordToneInRange(chordTone, range, instrument === "flute" ? 5 : 4);

  return {
    instrument,
    role,
    mode,
    source,
    measureIndex: measure.measureIndex,
    beat,
    startMs,
    durationMs,
    note: midiToNoteName(midiNote),
    midiNote,
    velocity: preBreathVelocityDip ? PRE_BREATH_VELOCITY : mode === "background" ? BACKGROUND_VELOCITY : FILL_VELOCITY,
    ...(preBreathVelocityDip ? { preBreathVelocityDip: true } : {}),
  };
}

function isPreBreathSlice(slice: EnsembleIntegrationHandshake["rhythmicDensityGrid"][number], totalMeasures: number): boolean {
  return totalMeasures >= FLUTE_BREATH_INTERVAL_MEASURES &&
    (slice.measureIndex + 1) % FLUTE_BREATH_INTERVAL_MEASURES === 0 &&
    slice.beat === 4;
}

function buildFluteBreathEvent(slice: EnsembleIntegrationHandshake["rhythmicDensityGrid"][number]): FluteBreathEvent {
  return {
    instrument: "flute",
    measureIndex: slice.measureIndex,
    beat: FLUTE_BREATH_BEAT,
    startMs: slice.startMs + Math.max(0, slice.durationMs - SIXTEENTH_NOTE_MS_AT_120_BPM),
    durationMs: SIXTEENTH_NOTE_MS_AT_120_BPM,
    reason: "Periodic 16th-note breath after two measures of continuous Flute support",
  };
}

function buildViolinExpressionEvents(event: OrchestralSupportEvent): ViolinExpressionEvent[] {
  const swellCrestOffset = Math.min(250, Math.floor(event.durationMs / 2));

  return [
    {
      instrument: "violin",
      measureIndex: event.measureIndex,
      beat: event.beat,
      startMs: event.startMs,
      controller: 11,
      value: VIOLIN_SWELL_START,
      purpose: "bow-expression-swell-start",
    },
    {
      instrument: "violin",
      measureIndex: event.measureIndex,
      beat: event.beat,
      startMs: event.startMs + swellCrestOffset,
      controller: 11,
      value: VIOLIN_SWELL_CREST,
      purpose: "bow-expression-swell-crest",
    },
    {
      instrument: "violin",
      measureIndex: event.measureIndex,
      beat: event.beat,
      startMs: event.startMs + VIOLIN_VIBRATO_DELAY_MS,
      controller: 1,
      value: VIOLIN_VIBRATO_VALUE,
      purpose: "delayed-vibrato",
    },
  ];
}

export function generateOrchestralSupport(
  melodyAbc: string,
  options: OrchestralSupportOptions
): OrchestralSupportArrangement {
  const accompaniment = options.accompaniment;
  const handshake = options.handshake ?? generateEnsembleIntegrationHandshake(melodyAbc, { accompaniment });
  const fluteSupportMap: OrchestralSupportEvent[] = [];
  const violinSupportMap: OrchestralSupportEvent[] = [];
  const fluteBreathMap: FluteBreathEvent[] = [];
  const violinExpressionMap: ViolinExpressionEvent[] = [];
  const yieldDecisions: OrchestralYieldDecision[] = [];
  const totalMeasures = accompaniment.measures.length;

  for (const slice of handshake.rhythmicDensityGrid) {
    const fillZone = handshake.melodicGapArray.find((gap) =>
      gap.measureIndex === slice.measureIndex && gap.beat === slice.beat
    );

    if (fillZone) {
      const measure = findMeasure(accompaniment, slice.measureIndex);
      const preBreathVelocityDip = isPreBreathSlice(slice, totalMeasures);
      if (preBreathVelocityDip) fluteBreathMap.push(buildFluteBreathEvent(slice));
      fluteSupportMap.push(buildSupportEvent("flute", measure, fillZone.beat, fillZone.startMs, fillZone.durationMs, "fill", "melodic-gap", preBreathVelocityDip));
      const violinEvent = buildSupportEvent("violin", measure, fillZone.beat, fillZone.startMs, fillZone.durationMs, "fill", "melodic-gap");
      violinSupportMap.push(violinEvent);
      violinExpressionMap.push(...buildViolinExpressionEvents(violinEvent));
      yieldDecisions.push({
        measureIndex: slice.measureIndex,
        beat: slice.beat,
        startMs: slice.startMs,
        layer1Active: slice.layer1Active,
        fluteMode: "fill",
        violinMode: "fill",
        reason: "Melodic Fill Zone available; auxiliary instruments may answer the singer with short counter-melodies",
      });
    } else if (slice.layer1Active) {
      const measure = findMeasure(accompaniment, slice.measureIndex);
      const preBreathVelocityDip = isPreBreathSlice(slice, totalMeasures);
      if (preBreathVelocityDip) fluteBreathMap.push(buildFluteBreathEvent(slice));
      fluteSupportMap.push(buildSupportEvent("flute", measure, slice.beat, slice.startMs, slice.durationMs, "background", "layer1-active", preBreathVelocityDip));
      const violinEvent = buildSupportEvent("violin", measure, slice.beat, slice.startMs, slice.durationMs, "background", "layer1-active");
      violinSupportMap.push(violinEvent);
      violinExpressionMap.push(...buildViolinExpressionEvents(violinEvent));
      yieldDecisions.push({
        measureIndex: slice.measureIndex,
        beat: slice.beat,
        startMs: slice.startMs,
        layer1Active: true,
        fluteMode: "background",
        violinMode: "background",
        reason: "Layer 1 melody active; auxiliary melodic instruments yield into sustained chord tones",
      });
    } else {
      yieldDecisions.push({
        measureIndex: slice.measureIndex,
        beat: slice.beat,
        startMs: slice.startMs,
        layer1Active: false,
        fluteMode: "silent",
        violinMode: "silent",
        reason: "No melodic support needed outside active melody or Fill Zones",
      });
    }
  }

  return { fluteSupportMap, violinSupportMap, fluteBreathMap, violinExpressionMap, yieldDecisions };
}
