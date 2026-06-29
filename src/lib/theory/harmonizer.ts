import { getDiatonicChords } from "./chords";
import { analyzeMelody, normalizeAbcNote } from "./melody-analyzer";

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

export function generateProgression(abcString: string): string[] {
  const analysis = analyzeMelody(abcString);
  const { root, mode } = parseRootAndMode(analysis.key);
  const chords = getDiatonicChords(root, mode);

  const progression: string[] = [];

  for (let m = 0; m < analysis.measures.length; m++) {
    const measure = analysis.measures[m];
    const isFirst = m === 0;
    const isLast = m === analysis.measures.length - 1;

    let bestChord = chords[0];
    let maxScore = -1;

    for (const chord of chords) {
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

      if (score > maxScore) {
        maxScore = score;
        bestChord = chord;
      }
    }

    progression.push(bestChord.chordName);
  }

  return progression;
}
