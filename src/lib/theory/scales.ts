const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface ScaleType {
  name: string;
  offsets: number[];
}

export const SCALE_TYPES: Record<string, ScaleType> = {
  major: { name: "Major Scale", offsets: [0, 2, 4, 5, 7, 9, 11] },
  "natural minor": { name: "Natural Minor Scale", offsets: [0, 2, 3, 5, 7, 8, 10] },
  "harmonic minor": { name: "Harmonic Minor Scale", offsets: [0, 2, 3, 5, 7, 8, 11] },
  "melodic minor": { name: "Melodic Minor Scale", offsets: [0, 2, 3, 5, 7, 9, 11] },
  // Modes
  ionian: { name: "Ionian Mode", offsets: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { name: "Dorian Mode", offsets: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: "Phrygian Mode", offsets: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: "Lydian Mode", offsets: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian Mode", offsets: [0, 2, 4, 5, 7, 9, 10] },
  aeolian: { name: "Aeolian Mode", offsets: [0, 2, 3, 5, 7, 8, 10] },
  locrian: { name: "Locrian Mode", offsets: [0, 1, 3, 5, 6, 8, 10] },
  // Ragas
  bhairav: { name: "Raga Bhairav", offsets: [0, 1, 4, 5, 7, 8, 11] },
  yaman: { name: "Raga Yaman", offsets: [0, 2, 4, 6, 7, 9, 11] },
  kafi: { name: "Raga Kafi", offsets: [0, 2, 3, 5, 7, 9, 10] },
  bhairavi: { name: "Raga Bhairavi", offsets: [0, 1, 3, 5, 7, 8, 10] },
  khamaj: { name: "Raga Khamaj", offsets: [0, 2, 4, 5, 7, 9, 10] },
  bilawal: { name: "Raga Bilawal", offsets: [0, 2, 4, 5, 7, 9, 11] },
};

export interface RagaMapping {
  raga: string;
  westernEquivalent: string;
  scaleKey: string;
}

export const RAGA_MAPPINGS: Record<string, RagaMapping> = {
  bhairav: { raga: "Bhairav", westernEquivalent: "Double Harmonic Major", scaleKey: "bhairav" },
  yaman: { raga: "Yaman", westernEquivalent: "Lydian Mode", scaleKey: "yaman" },
  kafi: { raga: "Kafi", westernEquivalent: "Dorian Mode", scaleKey: "kafi" },
  bhairavi: { raga: "Bhairavi", westernEquivalent: "Phrygian Mode", scaleKey: "bhairavi" },
  khamaj: { raga: "Khamaj", westernEquivalent: "Mixolydian Mode", scaleKey: "khamaj" },
  bilawal: { raga: "Bilawal", westernEquivalent: "Major Scale (Ionian)", scaleKey: "bilawal" },
};

export function getNoteValue(noteName: string): number {
  const norm = noteName.trim();
  const values: Record<string, number> = {
    C: 0, "C#": 1, Db: 1,
    D: 2, "D#": 3, Eb: 3,
    E: 4,
    F: 5, "F#": 6, Gb: 6,
    G: 7, "G#": 8, Ab: 8,
    A: 9, "A#": 10, Bb: 10,
    B: 11
  };
  return values[norm];
}

export function spellNote(targetValue: number, preferredLetter: string): string {
  const value = (targetValue + 12) % 12;
  if (getNoteValue(preferredLetter) === value) {
    return preferredLetter;
  }
  const sharpName = preferredLetter + "#";
  if (getNoteValue(sharpName) === value) {
    return sharpName;
  }
  const flatName = preferredLetter + "b";
  if (getNoteValue(flatName) === value) {
    return flatName;
  }
  return CHROMATIC[value];
}

export function getScaleNotes(root: string, scaleName: string): string[] {
  const key = scaleName.toLowerCase();
  const scale = SCALE_TYPES[key];
  if (!scale) {
    throw new Error(`Unsupported scale: ${scaleName}`);
  }

  // Parse root note and letter
  const rootValue = getNoteValue(root);
  const rootLetter = root.charAt(0).toUpperCase();
  const rootLetterIdx = LETTERS.indexOf(rootLetter);

  if (rootValue === undefined || rootLetterIdx === -1) {
    throw new Error(`Invalid root note: ${root}`);
  }

  return scale.offsets.map((offset, index) => {
    const val = (rootValue + offset) % 12;
    const preferredLetter = LETTERS[(rootLetterIdx + index) % 7];
    return spellNote(val, preferredLetter);
  });
}

export function getRagaMapping(ragaName: string): RagaMapping | null {
  return RAGA_MAPPINGS[ragaName.toLowerCase()] || null;
}
