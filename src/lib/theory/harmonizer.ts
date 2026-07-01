import { ChordInfo, getDiatonicChords } from "./chords";
import { analyzeMelody, MeasureInfo, normalizeAbcNote } from "./melody-analyzer";

export type HarmonicFunction = "tonic" | "subdominant" | "dominant";

export type CadenceRole =
  | "opening-tonic"
  | "cadential-dominant"
  | "final-tonic-resolution"
  | "pre-dominant"
  | "continuation";

export interface FunctionalChordAnnotation {
  degree: number;
  name: string;
  notes: string[];
  romanNumeral: string;
  function: HarmonicFunction;
  diatonic: boolean;
}

export interface HarmonizedMeasure {
  measureIndex: number;
  strongBeatNotes: string[];
  chord: FunctionalChordAnnotation;
  cadenceRole: CadenceRole;
}

export interface HarmonizationStage {
  key: string;
  scale: string;
  timeSignature: string;
  progression: string[];
  measures: HarmonizedMeasure[];
}

export function parseRootAndMode(keyStr: string): { root: string; mode: string } {
  let root = "";
  let mode = "major";

  const trim = keyStr.trim();

  let idx = 0;
  if (idx < trim.length) {
    root += trim[idx];
    idx++;
  }
  if (idx < trim.length && (trim[idx] === "#" || trim[idx] === "b")) {
    root += trim[idx];
    idx++;
  }

  const rest = trim.substring(idx).toLowerCase();
  if (rest.startsWith("m") || rest.startsWith("min") || rest.includes("minor")) {
    mode = "natural minor";
  }

  return { root, mode };
}

function scoreChordForMeasure(chord: ChordInfo, measure: MeasureInfo, isFirst: boolean, isLast: boolean): number {
  let score = 0;

  const normChordNotes = chord.notes.map(normalizeAbcNote);
  const normChordRoot = normalizeAbcNote(chord.notes[0]);

  for (const note of measure.strongBeatNotes) {
    const normNote = normalizeAbcNote(note);
    if (normChordNotes.includes(normNote)) {
      score += 2;
      if (normNote === normChordRoot) {
        score += 1; // Root match bonus
      }
    }
  }

  // Preference weights based on scale degree
  if (chord.degree === 1) score += 0.3; // Tonic
  else if (chord.degree === 5) score += 0.2; // Dominant
  else if (chord.degree === 4) score += 0.15; // Subdominant
  else if (chord.degree === 6) score += 0.1; // Relative minor/major

  // Structural progression rules
  if (chord.degree === 1) {
    if (isFirst) score += 2.0;
    if (isLast) score += 2.0;
  }

  return score;
}

function chooseChordForMeasure(chords: ChordInfo[], measure: MeasureInfo, isFirst: boolean, isLast: boolean): ChordInfo {
  let bestChord = chords[0];
  let maxScore = -1;

  for (const chord of chords) {
    const score = scoreChordForMeasure(chord, measure, isFirst, isLast);

    if (score > maxScore) {
      maxScore = score;
      bestChord = chord;
    }
  }

  return bestChord;
}

function getRomanNumeral(degree: number, mode: string): string {
  const romanByMode: Record<string, string[]> = {
    major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    ionian: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
    "natural minor": ["i", "ii°", "III", "iv", "v", "VI", "VII"],
    aeolian: ["i", "ii°", "III", "iv", "v", "VI", "VII"],
  };

  const numerals = romanByMode[mode.toLowerCase()] ?? romanByMode.major;
  return numerals[degree - 1] ?? `${degree}`;
}

function getHarmonicFunction(degree: number): HarmonicFunction {
  if (degree === 5 || degree === 7) return "dominant";
  if (degree === 2 || degree === 4) return "subdominant";
  return "tonic";
}

function getCadenceRole(chord: ChordInfo, measureIndex: number, measureCount: number): CadenceRole {
  const isFirst = measureIndex === 0;
  const isLast = measureIndex === measureCount - 1;
  const isPenultimate = measureIndex === measureCount - 2;
  const harmonicFunction = getHarmonicFunction(chord.degree);

  if (isFirst && chord.degree === 1) return "opening-tonic";
  if (isLast && chord.degree === 1) return "final-tonic-resolution";
  if (isPenultimate && harmonicFunction === "dominant") return "cadential-dominant";
  if (harmonicFunction === "subdominant") return "pre-dominant";
  return "continuation";
}

function annotateChord(chord: ChordInfo, mode: string): FunctionalChordAnnotation {
  return {
    degree: chord.degree,
    name: chord.chordName,
    notes: chord.notes,
    romanNumeral: getRomanNumeral(chord.degree, mode),
    function: getHarmonicFunction(chord.degree),
    diatonic: true,
  };
}

export function generateHarmonizationStage(abcString: string): HarmonizationStage {
  const analysis = analyzeMelody(abcString);
  const { root, mode } = parseRootAndMode(analysis.key);
  const chords = getDiatonicChords(root, mode);

  const measures = analysis.measures.map((measure, index) => {
    const chord = chooseChordForMeasure(
      chords,
      measure,
      index === 0,
      index === analysis.measures.length - 1
    );

    return {
      measureIndex: measure.measureIndex,
      strongBeatNotes: measure.strongBeatNotes,
      chord: annotateChord(chord, mode),
      cadenceRole: getCadenceRole(chord, index, analysis.measures.length),
    };
  });

  return {
    key: root,
    scale: mode,
    timeSignature: analysis.timeSignature,
    progression: measures.map((measure) => measure.chord.name),
    measures,
  };
}

export function generateProgression(abcString: string): string[] {
  return generateHarmonizationStage(abcString).progression;
}
