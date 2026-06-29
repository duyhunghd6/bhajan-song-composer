import { getNoteValue, getScaleNotes } from "./scales";

export interface ChordInfo {
  degree: number;
  chordName: string;
  notes: string[];
}

export function getDiatonicChords(root: string, scaleName: string): ChordInfo[] {
  const scaleNotes = getScaleNotes(root, scaleName);
  const chords: ChordInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const rootOfChord = scaleNotes[i];
    const thirdOfChord = scaleNotes[(i + 2) % 7];
    const fifthOfChord = scaleNotes[(i + 4) % 7];

    const rootVal = getNoteValue(rootOfChord);
    const thirdVal = getNoteValue(thirdOfChord);
    const fifthVal = getNoteValue(fifthOfChord);

    const thirdInterval = (thirdVal - rootVal + 12) % 12;
    const fifthInterval = (fifthVal - rootVal + 12) % 12;

    let suffix = "";
    if (thirdInterval === 4 && fifthInterval === 7) {
      suffix = ""; // Major
    } else if (thirdInterval === 3 && fifthInterval === 7) {
      suffix = "m"; // Minor
    } else if (thirdInterval === 3 && fifthInterval === 6) {
      suffix = "dim"; // Diminished
    } else if (thirdInterval === 4 && fifthInterval === 8) {
      suffix = "aug"; // Augmented
    } else if (thirdInterval === 4 && fifthInterval === 6) {
      suffix = "(b5)"; // Major flat 5
    } else if (thirdInterval === 2 && fifthInterval === 7) {
      suffix = "sus2";
    } else if (thirdInterval === 5 && fifthInterval === 7) {
      suffix = "sus4";
    } else {
      suffix = "5"; // Fallback power chord
    }

    chords.push({
      degree: i + 1,
      chordName: rootOfChord + suffix,
      notes: [rootOfChord, thirdOfChord, fifthOfChord],
    });
  }

  return chords;
}
