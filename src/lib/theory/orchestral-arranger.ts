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
  yieldDecisions: OrchestralYieldDecision[];
}

const BACKGROUND_VELOCITY = 64;
const FILL_VELOCITY = 80;
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

function buildSupportEvent(
  instrument: OrchestralInstrument,
  measure: AccompanimentMeasure,
  beat: number,
  startMs: number,
  durationMs: number,
  mode: Exclude<OrchestralSupportMode, "silent">,
  source: OrchestralSupportSource
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
    velocity: mode === "background" ? BACKGROUND_VELOCITY : FILL_VELOCITY,
  };
}

export function generateOrchestralSupport(
  melodyAbc: string,
  options: OrchestralSupportOptions
): OrchestralSupportArrangement {
  const accompaniment = options.accompaniment;
  const handshake = options.handshake ?? generateEnsembleIntegrationHandshake(melodyAbc, { accompaniment });
  const fluteSupportMap: OrchestralSupportEvent[] = [];
  const violinSupportMap: OrchestralSupportEvent[] = [];
  const yieldDecisions: OrchestralYieldDecision[] = [];

  for (const slice of handshake.rhythmicDensityGrid) {
    const fillZone = handshake.melodicGapArray.find((gap) =>
      gap.measureIndex === slice.measureIndex && gap.beat === slice.beat
    );

    if (fillZone) {
      const measure = findMeasure(accompaniment, slice.measureIndex);
      fluteSupportMap.push(buildSupportEvent("flute", measure, fillZone.beat, fillZone.startMs, fillZone.durationMs, "fill", "melodic-gap"));
      violinSupportMap.push(buildSupportEvent("violin", measure, fillZone.beat, fillZone.startMs, fillZone.durationMs, "fill", "melodic-gap"));
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
      fluteSupportMap.push(buildSupportEvent("flute", measure, slice.beat, slice.startMs, slice.durationMs, "background", "layer1-active"));
      violinSupportMap.push(buildSupportEvent("violin", measure, slice.beat, slice.startMs, slice.durationMs, "background", "layer1-active"));
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

  return { fluteSupportMap, violinSupportMap, yieldDecisions };
}
