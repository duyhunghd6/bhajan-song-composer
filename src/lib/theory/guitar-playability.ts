export type FrettingFinger = 1 | 2 | 3 | 4;
export type GuitarPlayabilityStringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const MAX_FRET_STRETCH = 5;

export type GuitarPlayabilityProfileId = "guitar-classic" | "guitar-acoustic" | "standard-six-string";

export interface GuitarPlayabilityProfile {
  id: GuitarPlayabilityProfileId;
  label: string;
  maxFret: number;
  maxFretStretch: number;
  maxFrettingFingerCount: number;
  allowSingleBarre: boolean;
}

export interface GuitarVoicingPlayabilityProfile {
  id: string;
  label?: string;
  maxFretStretch?: number;
  allowBarre?: boolean;
}

export type GuitarPlayabilityProfileInput = GuitarPlayabilityProfileId | GuitarPlayabilityProfile | undefined;
export type GuitarVoicingPlayabilityProfileInput = string | GuitarVoicingPlayabilityProfile | undefined;

export interface ScientificPitch {
  pitchClass: string;
  octave: number;
  midi: number;
}

export const GUITAR_PLAYABILITY_PROFILES: Record<GuitarPlayabilityProfileId, GuitarPlayabilityProfile> = {
  "guitar-classic": {
    id: "guitar-classic",
    label: "Guitar Classic",
    maxFret: 19,
    maxFretStretch: MAX_FRET_STRETCH,
    maxFrettingFingerCount: 4,
    allowSingleBarre: true,
  },
  "guitar-acoustic": {
    id: "guitar-acoustic",
    label: "Guitar Acoustic",
    maxFret: 20,
    maxFretStretch: MAX_FRET_STRETCH,
    maxFrettingFingerCount: 4,
    allowSingleBarre: true,
  },
  "standard-six-string": {
    id: "standard-six-string",
    label: "Standard six-string guitar",
    maxFret: 20,
    maxFretStretch: MAX_FRET_STRETCH,
    maxFrettingFingerCount: 4,
    allowSingleBarre: true,
  },
};

export const STANDARD_TUNING_OPEN_MIDI: Record<GuitarPlayabilityStringNumber, number> = {
  1: 64, // E4
  2: 59, // B3
  3: 55, // G3
  4: 50, // D3
  5: 45, // A2
  6: 40, // E2
};

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

const SEMITONE_TO_SHARP_PITCH_CLASS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function resolveGuitarPlayabilityProfile(profile?: GuitarPlayabilityProfileInput): GuitarPlayabilityProfile {
  if (!profile) return GUITAR_PLAYABILITY_PROFILES["standard-six-string"];
  if (typeof profile === "string") return GUITAR_PLAYABILITY_PROFILES[profile] ?? GUITAR_PLAYABILITY_PROFILES["standard-six-string"];
  return profile;
}

export function resolveGuitarVoicingProfile(profile?: GuitarVoicingPlayabilityProfileInput): GuitarVoicingPlayabilityProfile {
  if (!profile) return { id: "default", allowBarre: true, maxFretStretch: MAX_FRET_STRETCH };
  if (typeof profile === "string") {
    if (profile === "open-position") return { id: profile, allowBarre: false, maxFretStretch: MAX_FRET_STRETCH };
    if (profile === "barre") return { id: profile, allowBarre: true, maxFretStretch: MAX_FRET_STRETCH };
    if (profile === "fingerstyle-melody-bass") return { id: profile, allowBarre: true, maxFretStretch: MAX_FRET_STRETCH };
    if (profile === "power-chord") return { id: profile, allowBarre: false, maxFretStretch: 4 };
    return { id: profile, allowBarre: true, maxFretStretch: MAX_FRET_STRETCH };
  }
  return profile;
}

export function parseScientificPitch(note: string): ScientificPitch | null {
  const match = note.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const pitchClass = `${match[1].toUpperCase()}${match[2] ?? ""}`;
  const semitone = PITCH_CLASS_TO_SEMITONE[pitchClass];
  if (semitone === undefined) return null;
  const octave = Number(match[3]);
  if (!Number.isInteger(octave)) return null;
  return {
    pitchClass,
    octave,
    midi: (octave + 1) * 12 + semitone,
  };
}

export function midiForStringFret(string: GuitarPlayabilityStringNumber, fret: number): number {
  return STANDARD_TUNING_OPEN_MIDI[string] + fret;
}

export function scientificPitchForStringFret(
  string: GuitarPlayabilityStringNumber,
  fret: number,
  _profile?: GuitarPlayabilityProfileInput
): string {
  const midi = midiForStringFret(string, fret);
  const semitone = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SEMITONE_TO_SHARP_PITCH_CLASS[semitone]}${octave}`;
}

export function frettingFingerForFret(fret: number): FrettingFinger | null {
  if (fret === 0) return null;
  if (fret <= 2) return 1;
  if (fret <= 4) return 2;
  if (fret <= MAX_FRET_STRETCH) return 3;
  return 4;
}

export function isFretPlayable(fret: number): boolean {
  return fret <= MAX_FRET_STRETCH;
}
