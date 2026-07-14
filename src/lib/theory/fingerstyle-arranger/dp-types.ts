import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  FingerstyleDiagnosticCollector,
  type FingerstyleDiagnosticEventInput,
  type FingerstyleDiagnosticRun,
  type FingerstyleDiagnosticScope,
  type DPCandidateOrigin,
} from "./dp-diagnostics";

// ---------------------------------------------------------------------------
// Extended Technique Vocabulary
// ---------------------------------------------------------------------------

/**
 * Complete technique vocabulary for DP-based fingerstyle optimization.
 * Extends the original 5-technique set with left-hand legato, fretting,
 * right-hand articulation, and expressive ornament techniques.
 */
export type FingerstyleTechnique =
  // -- Existing (backward-compatible) --
  | "thumb-clock"
  | "pinch"
  | "guide-tone"
  | "syncopation"
  | "string-slap"
  // -- Left-hand legato --
  | "hammer-on"
  | "pull-off"
  | "slide-shift"    // audible glide between frets
  | "slide-guide"    // silent/quick repositional slide
  | "vibrato"
  | "natural-harmonic"
  // -- Left-hand fretting --
  | "barre"
  | "partial-barre"
  | "guide-finger-pivot"
  | "left-hand-mute"
  // -- Right-hand articulation --
  | "rest-stroke"
  | "free-stroke"
  | "palm-mute"
  // -- Expressive / ornamental --
  | "grace-note"
  | "bend";

// ---------------------------------------------------------------------------
// Skill Level
// ---------------------------------------------------------------------------

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface SkillLevelConstraints {
  maxFret: number;
  maxFretSpan: number;
  allowBarre: boolean;
  maxBarreMeasures: number;
  maxHandJumpPerBeat: number;
  forbiddenTechniques: FingerstyleTechnique[];
}

export const SKILL_LEVEL_CONSTRAINTS: Record<SkillLevel, SkillLevelConstraints> = {
  beginner: {
    maxFret: 5,
    maxFretSpan: 3,
    allowBarre: false,
    maxBarreMeasures: 0,
    maxHandJumpPerBeat: 2,
    forbiddenTechniques: [
      "hammer-on", "pull-off", "bend", "vibrato",
      "barre", "partial-barre", "palm-mute",
      "rest-stroke", "natural-harmonic",
    ],
  },
  intermediate: {
    maxFret: 9,
    maxFretSpan: 4,
    allowBarre: true,
    maxBarreMeasures: 4,
    maxHandJumpPerBeat: 5,
    forbiddenTechniques: ["bend"],
  },
  advanced: {
    maxFret: 19,
    maxFretSpan: 5,
    allowBarre: true,
    maxBarreMeasures: Infinity,
    maxHandJumpPerBeat: 12,
    forbiddenTechniques: [],
  },
};

// ---------------------------------------------------------------------------
// DP State & Events
// ---------------------------------------------------------------------------

/**
 * Represents the physical left-hand state at a given time step.
 * Tracked across the Viterbi trellis to compute transition costs.
 */
export interface DPHandState {
  /** Center fret of the left-hand position (0–19). */
  handPosition: number;
  /**
   * Frets held on each string. Index 0 = string 6 (low E), index 5 = string 1 (high E).
   * null = string not fretted / muted.
   */
  frets: (number | null)[];
  /**
   * Time-step index until which each string is ringing.
   * Index 0 = string 6, index 5 = string 1. null = not ringing.
   */
  ringingUntil: (number | null)[];
  /** Active barre fret, or null if no barre. */
  barreFret: number | null;
  /** How many consecutive measures the hand has been in a barre shape. */
  consecutiveBarreMeasures: number;
}

/**
 * A note event extracted from the ABC/time-slice grid for DP processing.
 * Each event represents one "decision point" where the DP must choose a hand shape.
 */
export interface DPNoteEvent {
  /** Index in the flattened event sequence. */
  index: number;
  /** Absolute onset in quantized grid steps across the optimized input. */
  absoluteOnsetStep?: number;
  /** Simultaneous string/fret assignments that this DP event must not move. */
  fixedFrets?: (number | null)[];
  /** Melody pitch as MIDI number, or null for bass-only / rest. */
  melodyMidi: number | null;
  /** Role-specific melody ceiling; discretionary notes still use the selected skill limit. */
  maxMelodyFret?: number;
  /** Bass pitch as MIDI number, or null for melody-only / rest. */
  bassMidi: number | null;
  /** Chord symbol at this point. */
  chord: string;
  /** Duration in time-slice steps (1 step = 1/16th note in 4/4). */
  durationSteps: number;
  /** Grid steps available to move from the preceding event into this event. */
  movementSteps?: number;
  /** BPM for computing real-time constraints. */
  bpm: number;
  /** Whether this is a rest (no sound required). */
  isRest: boolean;
}

/**
 * A candidate hand shape + string assignment for a single event.
 * The DP optimizer picks the best candidate at each step.
 */
export interface DPCandidate {
  /** Diagnostic origin; omitted remains compatible with legacy generated candidates. */
  origin?: DPCandidateOrigin;
  /** String assignment for melody (1–6), null if rest. */
  melodyString: GuitarStringNumber | null;
  /** Fret for melody on the assigned string. */
  melodyFret: number;
  /** String assignment for bass (1–6), null if rest. */
  bassString: GuitarStringNumber | null;
  /** Fret for bass on the assigned string. */
  bassFret: number;
  /** The technique used to produce the melody note. */
  melodyTechnique: FingerstyleTechnique;
  /**
   * Full fret layout across all 6 strings.
   * Index 0 = string 6, index 5 = string 1. null = not fretted.
   */
  shapeFrets: (number | null)[];
  /** Center fret of the hand for this shape. */
  handPosition: number;
  /** Whether this candidate uses a barre. */
  usesBarre: boolean;
}

/**
 * The result of the DP optimization over the entire song.
 */
export interface DPResult {
  /** Optimal path of candidates, one per event. */
  path: DPCandidate[];
  /** Total cost of the optimal path. */
  totalCost: number;
  /** Recommended capo position (0 = no capo). */
  capo: number;
  /** Skill level used for gating. */
  skillLevel: SkillLevel;
  /** Diagnostic log lines produced during optimization. */
  logs: string[];
  /** Typed, versioned diagnostics collected during optimization. */
  diagnostics?: FingerstyleDiagnosticRun;
}

/**
 * Options for running the DP optimizer.
 */
export interface DPOptions {
  skillLevel?: SkillLevel;
  /** Allow exact authoritative melody notes above the selected skill's discretionary fret ceiling. */
  maxMelodyFret?: number;
  bpm?: number;
  capo?: number;
  maxCapo?: number;
  /** If true, sweep all capo positions and pick the best. */
  autoCapo?: boolean;
}

// ---------------------------------------------------------------------------
// Diagnostic Logger
// ---------------------------------------------------------------------------

/**
 * Collects structured diagnostic log lines from the DP pipeline.
 * Each module pushes messages via `log()`. The collected logs are
 * surfaced in the UI "LLM Diagnostic Logs" panel.
 */
export class DPDiagnosticLogger {
  private lines: string[] = [];
  readonly collector: FingerstyleDiagnosticCollector;

  constructor(input: FingerstyleDiagnosticCollector | { runId?: string; scope?: FingerstyleDiagnosticScope } = {}) {
    this.collector = input instanceof FingerstyleDiagnosticCollector
      ? input
      : new FingerstyleDiagnosticCollector(input);
  }

  log(message: string): void {
    this.lines.push(message);
  }

  /** Collect a typed event without altering the compatibility text view. */
  event(event: FingerstyleDiagnosticEventInput): void {
    this.collector.emit(event);
  }

  /** Log a section header. */
  section(title: string): void {
    this.lines.push(`\n=== DP: ${title} ===`);
  }

  /** Log a table-like row: label → value. */
  entry(label: string, value: string | number | boolean): void {
    this.lines.push(`  ${label}: ${value}`);
  }

  /** Log a numbered list item. */
  item(index: number, text: string): void {
    this.lines.push(`  [${index}] ${text}`);
  }

  /** Return all collected log lines. */
  getLines(): string[] {
    return [...this.lines];
  }

  /** Return the typed diagnostic run collected so far. */
  getDiagnostics(): FingerstyleDiagnosticRun {
    return this.collector.getRun();
  }

  /** Return a single string with all logs joined. */
  toString(): string {
    return this.lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Guitar Constants
// ---------------------------------------------------------------------------

/** Standard tuning MIDI values. Index 0 = string 6 (low E). */
export const STANDARD_TUNING_MIDI: readonly number[] = [
  40, // String 6: E2
  45, // String 5: A2
  50, // String 4: D3
  55, // String 3: G3
  59, // String 2: B3
  64, // String 1: E4
] as const;

/** Map string number (1–6) to array index (0–5). String 6 → index 0, String 1 → index 5. */
export function stringToIndex(stringNum: GuitarStringNumber): number {
  return 6 - stringNum;
}

/** Map array index (0–5) to string number. Index 0 → String 6, Index 5 → String 1. */
export function indexToString(index: number): GuitarStringNumber {
  return (6 - index) as GuitarStringNumber;
}

/** MIDI value of a string at a given fret, with optional capo offset. */
export function midiAt(stringIndex: number, fret: number, capo: number = 0): number {
  return STANDARD_TUNING_MIDI[stringIndex] + fret + capo;
}

/** Initial (empty) hand state — all strings open, nothing ringing. */
export function initialHandState(): DPHandState {
  return {
    handPosition: 0,
    frets: [null, null, null, null, null, null],
    ringingUntil: [null, null, null, null, null, null],
    barreFret: null,
    consecutiveBarreMeasures: 0,
  };
}

/** MIDI number to human-readable note name (e.g., 64 → "E4"). */
export function midiToNoteName(midi: number | null): string {
  if (midi === null) return "—";
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

