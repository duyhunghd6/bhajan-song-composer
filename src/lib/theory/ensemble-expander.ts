import { AccompanimentStage } from "./accompaniment-stage";
import { getBeatsPerMeasure } from "./arranger-utils";
import { normalizeAbcNote, parseAbcHeader, parseNoteDuration } from "./melody-analyzer";

export type EnsembleDensity = "open" | "supporting" | "busy";
export type MelodicGapType = "rest" | "sustain";

export interface EnsembleHandshakeOptions {
  accompaniment: AccompanimentStage;
}

export interface EnsembleLayerPrerequisites {
  layer1Melody: boolean;
  layer2Foundation: boolean;
}

export interface RhythmicDensitySlice {
  measureIndex: number;
  beat: number;
  startMs: number;
  durationMs: number;
  layer1Active: boolean;
  layer2Active: boolean;
  activeLayerCount: number;
  density: EnsembleDensity;
}

export interface EnsembleBassMapEvent {
  measureIndex: number;
  beat: number;
  startMs: number;
  note: string;
  sourceLayer: 2;
}

export interface EnsembleMelodicGapEvent {
  measureIndex: number;
  beat: number;
  startMs: number;
  durationBeats: number;
  durationMs: number;
  type: MelodicGapType;
}

export interface EnsembleIntegrationHandshake {
  layerPrerequisites: EnsembleLayerPrerequisites;
  rhythmicDensityGrid: RhythmicDensitySlice[];
  bassMap: EnsembleBassMapEvent[];
  melodicGapArray: EnsembleMelodicGapEvent[];
}

interface TimelineSymbol {
  kind: "note" | "rest";
  measureIndex: number;
  beat: number;
  durationBeats: number;
}

interface Layer2ActivityEvent {
  measureIndex: number;
  beat: number;
  durationBeats: number;
  active: boolean;
}

const MELODIC_GAP_THRESHOLD_BEATS = 1.5;

function parseTempoBpm(abcString: string): number {
  const tempoLine = abcString
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("Q:"));
  const match = tempoLine?.match(/=\s*(\d+(?:\.\d+)?)/);
  const bpm = match ? Number.parseFloat(match[1]) : 120;

  return Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
}

function beatToStartMs(measureIndex: number, beat: number, beatsPerMeasure: number, msPerBeat: number): number {
  return Math.round(((measureIndex * beatsPerMeasure) + beat - 1) * msPerBeat);
}

function beatsToMs(beats: number, msPerBeat: number): number {
  return Math.round(beats * msPerBeat);
}

function extractBodyMeasures(abcString: string): string[] {
  const body = abcString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Z]:/.test(line))
    .join(" ");

  return body
    .split(/[|\]]/)
    .map((measure) => measure.trim().replace(/^[:\s]+|[:\s]+$/g, ""))
    .filter((measure) => measure && measure !== ":" && measure !== "::");
}

function extractMelodyTimeline(abcString: string): TimelineSymbol[] {
  const symbolRegex = /([_^=]*[A-Ga-gz][,']*)([0-9]*\/?[0-9]*)/g;

  return extractBodyMeasures(abcString).flatMap((measure, measureIndex) => {
    const symbols: TimelineSymbol[] = [];
    let beat = 1;
    let match: RegExpExecArray | null;
    symbolRegex.lastIndex = 0;

    while ((match = symbolRegex.exec(measure)) !== null) {
      const durationBeats = parseNoteDuration(match[2]) / 2;
      const kind = normalizeAbcNote(match[1]) === "Z" ? "rest" : "note";
      symbols.push({ kind, measureIndex, beat, durationBeats });
      beat += durationBeats;
    }

    return symbols;
  });
}

function extractLayer2Activity(accompaniment: AccompanimentStage): Layer2ActivityEvent[] {
  const tokenRegex = /(\[[^\]]+\]|z|[\^_=]*[A-Ga-g][,']*)([0-9]*\/?[0-9]*)/g;

  return accompaniment.measures.flatMap((measure) => {
    const events: Layer2ActivityEvent[] = [];
    let beat = 1;
    let match: RegExpExecArray | null;
    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(measure.abc)) !== null) {
      const token = match[1];
      const durationBeats = parseNoteDuration(match[2]) / 2;
      events.push({
        measureIndex: measure.measureIndex,
        beat,
        durationBeats,
        active: normalizeAbcNote(token) !== "Z",
      });
      beat += durationBeats;
    }

    return events;
  });
}

function overlaps(startA: number, durationA: number, startB: number, durationB: number): boolean {
  return startA < startB + durationB && startB < startA + durationA;
}

function hasActiveLayer1(event: Layer2ActivityEvent, melody: TimelineSymbol[]): boolean {
  return melody.some((symbol) =>
    symbol.measureIndex === event.measureIndex &&
    symbol.kind === "note" &&
    overlaps(event.beat, event.durationBeats, symbol.beat, symbol.durationBeats)
  );
}

function classifyDensity(activeLayerCount: number): EnsembleDensity {
  if (activeLayerCount <= 1) return "open";
  if (activeLayerCount === 2) return "supporting";
  return "busy";
}

function validatePrerequisites(melody: TimelineSymbol[], accompaniment: AccompanimentStage): EnsembleLayerPrerequisites {
  const layerPrerequisites = {
    layer1Melody: melody.some((symbol) => symbol.kind === "note"),
    layer2Foundation: accompaniment.layer.number === 2 && accompaniment.measures.length > 0,
  };

  if (!layerPrerequisites.layer1Melody || !layerPrerequisites.layer2Foundation) {
    throw new Error("Ensemble integration handshake requires Layer 1 melody and Layer 2 accompaniment foundation");
  }

  return layerPrerequisites;
}

export function generateEnsembleIntegrationHandshake(
  melodyAbc: string,
  options: EnsembleHandshakeOptions
): EnsembleIntegrationHandshake {
  const accompaniment = options.accompaniment;
  const melody = extractMelodyTimeline(melodyAbc);
  const layerPrerequisites = validatePrerequisites(melody, accompaniment);
  const { timeSignature } = parseAbcHeader(melodyAbc);
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);
  const msPerBeat = 60000 / parseTempoBpm(melodyAbc);
  const layer2Activity = extractLayer2Activity(accompaniment);

  const rhythmicDensityGrid = layer2Activity.map<RhythmicDensitySlice>((event) => {
    const layer1Active = hasActiveLayer1(event, melody);
    const layer2Active = event.active;
    const activeLayerCount = Number(layer1Active) + Number(layer2Active);

    return {
      measureIndex: event.measureIndex,
      beat: event.beat,
      startMs: beatToStartMs(event.measureIndex, event.beat, beatsPerMeasure, msPerBeat),
      durationMs: beatsToMs(event.durationBeats, msPerBeat),
      layer1Active,
      layer2Active,
      activeLayerCount,
      density: classifyDensity(activeLayerCount),
    };
  });

  const bassMap = accompaniment.measures.map<EnsembleBassMapEvent>((measure) => ({
    measureIndex: measure.measureIndex,
    beat: 1,
    startMs: beatToStartMs(measure.measureIndex, 1, beatsPerMeasure, msPerBeat),
    note: measure.bassNote,
    sourceLayer: 2,
  }));

  const melodicGapArray = melody
    .filter((symbol) => symbol.durationBeats > MELODIC_GAP_THRESHOLD_BEATS)
    .map<EnsembleMelodicGapEvent>((symbol) => ({
      measureIndex: symbol.measureIndex,
      beat: symbol.beat,
      startMs: beatToStartMs(symbol.measureIndex, symbol.beat, beatsPerMeasure, msPerBeat),
      durationBeats: symbol.durationBeats,
      durationMs: beatsToMs(symbol.durationBeats, msPerBeat),
      type: symbol.kind === "rest" ? "rest" : "sustain",
    }));

  return {
    layerPrerequisites,
    rhythmicDensityGrid,
    bassMap,
    melodicGapArray,
  };
}
