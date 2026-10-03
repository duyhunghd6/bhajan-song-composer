import abcjs from "abcjs";
import { Chord, Note } from "@tonaljs/tonal";
import { getGuitarVoicings, type GuitarVoicing } from "./guitar-voicings";
import { isAbcChordSymbol, normalizeAbcChordSymbol } from "./abc-chord-symbol";
import { extractAbcVoiceIds } from "./abc-layer-visibility";
import { fingerprintAccompanimentSource } from "./accompaniment-workflow";
import { selectNarrowestApplicableOverride, type VoicingOverride, type VoicingWindowRange } from "./voicing-override";

export interface GuitarChordShape extends GuitarVoicing {
  id: string;
  label: string;
  midi: number[];
}
export interface GuitarChordOccurrence {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  measureIndex: number;
  beat: number;
  startChar: number;
  range: VoicingWindowRange;
  shapes: GuitarChordShape[];
  selected: GuitarChordShape | undefined;
}
export interface GuitarAudioEvent {
  cmd: string;
  start?: number;
  duration?: number;
  pitch?: number;
  volume?: number;
  instrument?: number;
  [key: string]: unknown;
}
export interface GuitarAudioSequence {
  tracks: GuitarAudioEvent[][];
  totalDuration: number;
  [key: string]: unknown;
}
interface ParsedElement {
  el_type: string;
  duration?: number;
  startChar?: number;
  chord?: { name: string; position: string }[];
  type?: string;
  startEnding?: string;
  startTriplet?: number;
  tripletMultiplier?: number;
  endTriplet?: boolean;
  value?: { num: string; den: string }[];
  abselem?: { elemset?: Element[] };
}
export interface GuitarParsedTune {
  lines: { staff?: { voices: ParsedElement[][]; meter?: { value?: { num: string; den: string }[] } }[] }[];
  setUpAudio: (options: Record<string, unknown>) => GuitarAudioSequence;
}
export interface GuitarChordScore {
  occurrences: GuitarChordOccurrence[];
  sourceRevisionId: string;
  carrierAbc: string;
  guitarVoiceIndices: number[];
}

const TUNING = [40, 45, 50, 55, 59, 64];
const shapeCache = new Map<string, GuitarChordShape[]>();
export function normalizedGuitarChord(symbol: string): string {
  const chord = Chord.get(normalizeAbcChordSymbol(symbol));
  return chord.empty ? symbol.trim().toLowerCase() : chord.name.toLowerCase().replace(/\s+/g, "");
}

export function guitarChordShapes(symbol: string): GuitarChordShape[] {
  const normalized = normalizeAbcChordSymbol(symbol);
  const cached = shapeCache.get(normalized);
  if (cached) return cached;
  const baseSymbol = normalized.replace(/\/[A-G][#b]?$/, "");
  const chord = Chord.get(baseSymbol);
  if (chord.empty) return [];
  const allowed = new Set(chord.notes.map((note) => Note.chroma(note)));
  const slashBass = normalized.includes("/") ? Note.chroma(normalized.split("/")[1]) : null;
  const database = getGuitarVoicings(baseSymbol, { databaseOnly: true });
  const known = database.length ? database : getGuitarVoicings(baseSymbol);
  // Muting bass strings before the root yields the usual root-position variant
  // of a database inversion, e.g. Em/B 779987 → Em x79987.
  const variants = known.flatMap((shape) => {
    const rootIndex = shape.frets.findIndex((fret, index) => typeof fret === "number" && (TUNING[index] + fret) % 12 === (slashBass ?? Note.chroma(chord.tonic ?? "")));
    if (rootIndex <= 0 || shape.frets.slice(0, rootIndex).every((fret) => fret === "X")) return [shape];
    const frets = shape.frets.map((fret, index) => index < rootIndex ? "X" as const : fret);
    const fingers = shape.fingers?.map((finger, index) => index < rootIndex ? "X" as const : finger);
    const barre = shape.barre ? { ...shape.barre, fromString: Math.min(shape.barre.fromString, 6 - rootIndex) } : undefined;
    return [shape, { ...shape, frets, fingers, barre }];
  });
  const seen = new Set<string>();
  const shapes = variants.flatMap((shape) => {
    const fretted = shape.frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
    const midi = shape.frets.flatMap((fret, index) => typeof fret === "number" ? [TUNING[index] + fret] : []);
    if (!midi.length || midi.some((pitch) => !allowed.has(pitch % 12))) return [];
    if (allowed.size <= 4 && [...allowed].some((chroma) => !midi.some((pitch) => pitch % 12 === chroma))) return [];
    if (shape.barre && shape.frets.some((fret, index) => 6 - index <= shape.barre!.fromString && 6 - index >= shape.barre!.toString && typeof fret === "number" && fret < shape.barre!.fret)) return [];
    const key = shape.frets.join(",");
    if (seen.has(key)) return [];
    seen.add(key);
    if (slashBass != null && Math.min(...midi) % 12 !== slashBass) return [];
    if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 4) return [];
    const label = shape.barre ? `Barre · fret ${shape.barre.fret}` : shape.frets.includes(0) ? "Open shape" : `Position · fret ${Math.min(...fretted)}`;
    return [{ ...shape, id: `guitar:${normalizedGuitarChord(symbol)}:${shape.frets.join("-")}`, label, midi }];
  }).sort((left, right) => {
    const cost = (shape: GuitarChordShape) => Math.max(...shape.frets.filter((fret): fret is number => typeof fret === "number"))
      + (shape.barre ? 2 : 0) + (Math.min(...shape.midi) % 12 === Note.chroma(chord.tonic ?? "") ? 0 : 3);
    return cost(left) - cost(right);
  }).slice(0, 24);
  shapeCache.set(normalized, shapes);
  return shapes;
}

export function primaryVoiceElements(tune: GuitarParsedTune): ParsedElement[] {
  return tune.lines.flatMap((line) => line.staff?.[0]?.voices?.[0] ?? []);
}
function symbolOf(element: ParsedElement): string | undefined {
  return element.chord?.find((chord) => chord.position === "default" && isAbcChordSymbol(chord.name))?.name;
}
function durationFraction(duration: number): string {
  // ABC tuplet ratios and binary note lengths fit this denominator exactly.
  const denominator = 2580480;
  let numerator = Math.round(duration * denominator);
  let divisor = denominator;
  let a = numerator;
  let b = divisor;
  while (b) [a, b] = [b, a % b];
  numerator /= a || 1;
  divisor /= a || 1;
  return `${numerator}/${divisor}`;
}
function midiToAbc(pitch: number): string {
  const names = ["=C", "^C", "=D", "^D", "=E", "=F", "^F", "=G", "^G", "=A", "^A", "=B"];
  const octave = Math.floor(pitch / 12) - 1;
  return names[pitch % 12] + (octave < 4 ? ",".repeat(4 - octave) : "'".repeat(octave - 4));
}
const BARS: Record<string, string> = {
  bar_thin: "|", bar_thin_thin: "||", bar_thin_thick: "|]", bar_thick_thin: "[|",
  bar_left_repeat: "|:", bar_right_repeat: ":|", bar_dbl_repeat: ":|:", bar_invisible: "[|]",
};

/** The first score voice owns chord timing; all projections use its exact chord windows. */
export function buildGuitarChordScore(abc: string, sourceAbc: string, overrides: readonly VoicingOverride[] = []): GuitarChordScore {
  const tune = abcjs.parseOnly(abc)[0] as unknown as GuitarParsedTune | undefined;
  const sourceRevisionId = fingerprintAccompanimentSource(sourceAbc);
  const elements = tune ? primaryVoiceElements(tune) : [];
  const occurrences: GuitarChordOccurrence[] = [];
  let measureIndex = 0;
  let offset = 0;
  let denominator = Number(tune?.lines.find((line) => line.staff)?.staff?.[0]?.meter?.value?.[0]?.den ?? 4);
  let multiplier = 1;
  const durations = new Map<ParsedElement, number>();
  for (const element of elements) {
    if (element.el_type === "meter") denominator = Number(element.value?.[0]?.den ?? denominator);
    if (element.el_type === "bar" && offset > 0) { measureIndex++; offset = 0; }
    if (element.el_type !== "note") continue;
    if (element.startTriplet) multiplier = element.tripletMultiplier ?? 2 / 3;
    const duration = (element.duration ?? 0) * multiplier;
    durations.set(element, duration);
    if (element.endTriplet) multiplier = 1;
    const symbol = symbolOf(element);
    if (symbol) {
      const beat = 1 + Math.round(offset * denominator * 1e6) / 1e6;
      const normalizedSymbol = normalizedGuitarChord(symbol);
      const id = `m${measureIndex + 1}-beat${beat}-${normalizedSymbol}`;
      const shapes = guitarChordShapes(symbol);
      occurrences.push({ id, symbol, normalizedSymbol, measureIndex, beat, startChar: element.startChar ?? -1,
        range: { scope: "chord-window", chordWindowId: id, start: { measureIndex, beat }, end: { measureIndex: measureIndex + 1, beat: 1 } },
        shapes, selected: shapes[0] });
    }
    offset += duration;
  }
  occurrences.forEach((occurrence, index) => {
    const next = occurrences[index + 1];
    occurrence.range.end = next ? { ...next.range.start } : { measureIndex: measureIndex + (offset > 0 ? 1 : 0), beat: 1 };
    const override = selectNarrowestApplicableOverride(overrides.filter((item) => item.sourceRevisionId === sourceRevisionId), "guitar-classic", occurrence.range,
      { symbol: occurrence.symbol, normalizedSymbol: occurrence.normalizedSymbol, chordWindowIds: [occurrence.id] });
    occurrence.selected = occurrence.shapes.find((shape) => shape.id === override?.voicingId) ?? occurrence.shapes[0];
  });

  let active: GuitarChordShape | undefined;
  let occurrenceIndex = 0;
  const tokens: string[] = [];
  const notes = elements.filter((element) => element.el_type === "note");
  let noteIndex = 0;
  for (const element of elements) {
    if (element.el_type === "bar") {
      tokens.push((BARS[element.type ?? ""] ?? "|") + (element.startEnding ? `[${element.startEnding}` : ""));
    } else if (element.el_type === "note") {
      if (symbolOf(element)) active = occurrences[occurrenceIndex++]?.selected;
      const duration = durationFraction(durations.get(element) ?? 0);
      const next = notes[++noteIndex];
      const tie = active && next && !symbolOf(next) ? "-" : "";
      tokens.push(active ? `[${active.midi.map(midiToAbc).join("")}]${duration}${tie}` : `z${duration}`);
    }
  }
  const meter = abc.match(/^M:\s*(.+)$/m)?.[1] ?? "4/4";
  const tempo = abc.match(/^Q:\s*(.+)$/m)?.[1] ?? "1/4=120";
  return { occurrences, sourceRevisionId,
    carrierAbc: `X:1\nM:${meter}\nL:1/1\nQ:${tempo}\nK:C\n%%MIDI program 24\n${tokens.join(" ")}`,
    guitarVoiceIndices: extractAbcVoiceIds(abc).flatMap((voice, index) => /^Guitar/i.test(voice) ? [index] : []),
  };
}

export function createGuitarChordOverride(score: GuitarChordScore, occurrence: GuitarChordOccurrence, shape: GuitarChordShape): VoicingOverride {
  const valid = { valid: true, reasons: [] };
  const createdAt = new Date().toISOString();
  return { id: `guitar-choice-${occurrence.id}-${Date.now()}`, instrument: "guitar-classic", windowRange: occurrence.range,
    baseChordIdentity: { symbol: occurrence.symbol, normalizedSymbol: occurrence.normalizedSymbol, chordWindowIds: [occurrence.id] },
    voicingId: shape.id, sourceRevisionId: score.sourceRevisionId, createdFromPlanRevisionId: score.sourceRevisionId,
    createdAt, status: "valid", validation: { evaluatedAt: createdAt, candidateAvailable: true, chordIdentity: valid,
      singerYield: valid, physical: valid, leftEdgeTransition: valid, rightEdgeTransition: valid, diagnostics: [] } };
}

/** Transform before sample loading, so every selected pitch uses the guitar soundfont. */
export function realizeGuitarChordAudio(base: GuitarAudioSequence, score: GuitarChordScore, options: Record<string, unknown> = {}): GuitarAudioSequence {
  if (!score.occurrences.length) return base;
  const tune = abcjs.parseOnly(score.carrierAbc)[0] as unknown as GuitarParsedTune;
  const carrier = tune.setUpAudio({ qpm: options.qpm, chordsOff: true });
  const guitarNotes = carrier.tracks[0]?.filter((event) => event.cmd === "note") ?? [];
  const tracks = base.tracks.map((track) => track.map((event) => ({ ...event })));
  const guitarIndices = score.guitarVoiceIndices.filter((index) => tracks[index]);
  if (guitarIndices.length) {
    // Existing support retains its picking rhythm. Each attack is projected onto
    // the selected strings, rather than adding a second guitar accompaniment.
    for (const index of guitarIndices) {
      const usedAtAttack = new Map<number, Set<GuitarAudioEvent>>();
      tracks[index] = tracks[index].flatMap((event) => {
        if (event.cmd === "program") return [{ ...event, instrument: 24 }];
        if (event.cmd !== "note" || event.start === undefined || event.pitch === undefined) return [event];
        const used = usedAtAttack.get(event.start) ?? new Set<GuitarAudioEvent>();
        usedAtAttack.set(event.start, used);
        const sounding = guitarNotes.filter((note) => !used.has(note) && note.start! <= event.start! + 1e-7 && note.start! + note.duration! > event.start! + 1e-7);
        if (!sounding.length) return [];
        const nearest = sounding.reduce((best, note) => Math.abs(note.pitch! - event.pitch!) < Math.abs(best.pitch! - event.pitch!) ? note : best);
        used.add(nearest);
        return [{ ...event, pitch: nearest.pitch, instrument: 24,
          duration: Math.min(event.duration ?? 0, nearest.start! + nearest.duration! - event.start) }];
      });
    }
  } else {
    tracks.push([{ cmd: "program", instrument: 24, channel: tracks.length }, ...guitarNotes.map((event) => ({ ...event, instrument: 24, volume: 75 }))]);
  }
  return { ...base, tracks };
}

export function guitarShapeAuditionAbc(shape: GuitarChordShape): string {
  return `X:1\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n%%MIDI program 24\n[${shape.midi.map(midiToAbc).join("")}]4 |`;
}
