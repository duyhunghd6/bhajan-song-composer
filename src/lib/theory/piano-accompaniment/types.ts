import type { CadenceRole } from "../harmonizer";
import type { PianoCompingProfileId, PianoCompingProfileMeasure } from "../piano-comping-profiles";
import type { PianoPlaybackEvent, PianoPlayabilityReport } from "../piano-playability";

export type PianoBassFoundation = "root" | "octave" | "open-fifth" | "1-5-8";
export type PianoMelodyRole = "root" | "third" | "fifth" | "seventh" | "non-chord-tone";
export type PianoBassRole = "root" | "fifth" | "octave";
export type PianoRightHandRole = "root" | "third" | "fifth" | "seventh";

export interface PianoAccompanimentOptions {
  progression?: string[];
  bassFoundation?: PianoBassFoundation;
  compingProfile?: PianoCompingProfileId;
}

export interface PianoCadencePoint {
  measureIndex: number;
  beat: number;
  type: "phrase-ending";
}

export interface PianoSourceAnalysis {
  key: string;
  timeSignature: string;
  cadencePoints: PianoCadencePoint[];
  strongBeatTargets: Array<{
    measureIndex: number;
    beat: number;
    note: string;
  }>;
}

export interface PianoHarmonicFrameworkMeasure {
  measureIndex: number;
  chord: string;
  chordNotes: string[];
  targetMelodyNote: string | null;
  targetBeat: number | null;
  melodyRole: PianoMelodyRole;
  cadenceRole: CadenceRole;
}

export interface PianoBassEvent {
  note: string;
  abc: string;
  register: "C2-C3";
  role: PianoBassRole;
}

export interface PianoLowIntervalLimitReport {
  valid: boolean;
  rejectedIntervals: string[];
}

export interface PianoLeftHandBassMeasure {
  measureIndex: number;
  chord: string;
  root: string;
  foundation: PianoBassFoundation;
  events: PianoBassEvent[];
  lowIntervalLimit: PianoLowIntervalLimitReport;
  abc: string;
}

export interface PianoRightHandTone {
  note: string;
  abc: string;
  midi: number;
  register: "C3-C5";
  role: PianoRightHandRole;
  retainedFromPrevious: boolean;
  semitoneMovement: number | null;
  masksMelody: boolean;
}

export interface PianoRightHandVoicingMeasure {
  measureIndex: number;
  chord: string;
  targetMelodyNote: string | null;
  inversion: "root" | "first" | "second" | "third";
  guideTones: string[];
  tones: PianoRightHandTone[];
  commonTones: string[];
  totalSemitoneMovement: number;
  melodyMaskingAvoided: boolean;
  abc: string;
}

export interface PianoMelodicGapEvent {
  measureIndex: number;
  startBeat: number;
  endBeat: number;
  durationBeats: number;
  safe: boolean;
  resumedBy: string | null;
}

export interface PianoGapFillEvent {
  measureIndex: number;
  beat: number;
  role: "passing-fill";
  notes: string[];
  abc: string;
  yieldsToMelodyAt: number | null;
}

export interface PianoGapFillMeasure {
  measureIndex: number;
  chord: string;
  gap: PianoMelodicGapEvent | null;
  events: PianoGapFillEvent[];
  abc: string;
}

export type PianoPedalEventType = "pedal-down" | "pedal-flush" | "pedal-up";

export interface PianoPedalEvent {
  measureIndex: number;
  beat: number;
  chord: string;
  type: PianoPedalEventType;
  value: 0 | 127;
  previousChord?: string;
}

export interface PianoPedalAutomation {
  controller: {
    midiControlChange: 64;
    downValue: 127;
    upValue: 0;
  };
  events: PianoPedalEvent[];
}

export interface PianoPedalEventMetadata {
  measureIndex: number;
  beat: number;
  chord: string;
  controller: "sustain";
  midiControlChange: 64;
  state: "down" | "flush" | "up";
  value: 0 | 127;
  previousChord?: string;
  label: "Pedal Down" | "Pedal Flush" | "Pedal Up";
}

export type PianoFingeringRole = PianoBassRole | PianoRightHandRole;

export interface PianoKeyHighlight {
  measureIndex: number;
  beat: number;
  hand: "left" | "right";
  note: string;
  midi: number;
  abc: string;
  finger: number;
  role: PianoFingeringRole;
  label: string;
}

export interface PianoFingeringNote {
  note: string;
  pitchClass: string;
  midi: number;
  abc: string;
  finger: number;
  role: PianoFingeringRole;
}

export interface PianoFingeringMetadata {
  measureIndex: number;
  beat: number;
  hand: "left" | "right";
  source: "left-hand-bass" | "right-hand-voicing";
  chord: string;
  notes: PianoFingeringNote[];
}

export interface PianoAccompaniment {
  sourceAnalysis: PianoSourceAnalysis;
  harmonicFramework: PianoHarmonicFrameworkMeasure[];
  leftHandBassMap: PianoLeftHandBassMeasure[];
  rightHandVoicingMap: PianoRightHandVoicingMeasure[];
  compingProfileMap: PianoCompingProfileMeasure[];
  gapFillMap: PianoGapFillMeasure[];
  physicalValidation: PianoPlayabilityReport;
  playbackEvents: PianoPlaybackEvent[];
  pedalAutomation: PianoPedalAutomation;
  pedalEventMetadata: PianoPedalEventMetadata[];
  grandStaffAbc: string;
  pianoKeyHighlights: PianoKeyHighlight[];
  fingeringMetadata: PianoFingeringMetadata[];
  abc: string;
}

export interface MelodyTimelineEvent {
  type: "note" | "rest";
  note: string | null;
  startBeat: number;
  endBeat: number;
}
