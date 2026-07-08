import { Note, Chord } from "@tonaljs/tonal";
import guitarDb from "@tombatossals/chords-db/lib/guitar.json";

export type GuitarVoicing = {
  frets: (number | "X")[];
  fingers?: (number | "X")[];
  barre?: { fret: number; fromString: number; toString: number };
  isPrimary?: boolean;
};

function getDbSuffix(parsed: ReturnType<typeof Chord.get>): string {
  if (parsed.empty) return "major";

  const aliases = parsed.aliases;
  const symbol = parsed.symbol;
  const quality = parsed.quality;

  if (symbol.includes("sus4")) return "sus4";
  if (symbol.includes("sus2")) return "sus2";

  if (quality === "Major") {
    if (aliases.includes("maj7") || symbol.endsWith("maj7") || symbol.endsWith("M7")) return "maj7";
    if (aliases.includes("maj9") || symbol.endsWith("maj9")) return "maj9";
    if (aliases.includes("maj11") || symbol.endsWith("maj11")) return "maj11";
    if (aliases.includes("maj13") || symbol.endsWith("maj13")) return "maj13";
    if (aliases.includes("add9")) return "add9";
    if (aliases.includes("6") && !aliases.includes("69")) return "6";
    if (aliases.includes("69")) return "69";
    return "major";
  }

  if (quality === "Minor") {
    if (aliases.includes("m7") || symbol.endsWith("m7")) return "m7";
    if (aliases.includes("m9") || symbol.endsWith("m9")) return "m9";
    if (aliases.includes("m11") || symbol.endsWith("m11")) return "m11";
    if (aliases.includes("mM7") || symbol.endsWith("mM7") || symbol.endsWith("mmaj7")) return "mmaj7";
    if (aliases.includes("m6")) return "m6";
    if (aliases.includes("m69")) return "m69";
    if (aliases.includes("madd9")) return "madd9";
    return "minor";
  }

  if (quality === "Diminished") {
    if (symbol.includes("dim7") || aliases.includes("dim7") || aliases.includes("o7")) return "dim7";
    if (aliases.includes("m7b5") || symbol.includes("m7b5") || aliases.includes("h7")) return "m7b5";
    return "dim";
  }

  if (quality === "Augmented") {
    if (symbol.includes("aug7") || aliases.includes("aug7")) return "aug7";
    if (symbol.includes("aug9") || aliases.includes("aug9")) return "aug9";
    return "aug";
  }

  // Dominant/7
  if (aliases.includes("7") || symbol.endsWith("7")) return "7";
  if (aliases.includes("9") || symbol.endsWith("9")) return "9";
  if (aliases.includes("11") || symbol.endsWith("11")) return "11";
  if (aliases.includes("13") || symbol.endsWith("13")) return "13";
  if (aliases.includes("7b5")) return "7b5";
  if (aliases.includes("7b9")) return "7b9";
  if (aliases.includes("7#9")) return "7#9";

  // Fallback
  return "major";
}

export function getGuitarVoicings(chordSymbol: string): GuitarVoicing[] {
  const parsed = Chord.get(chordSymbol);
  if (parsed.empty || !parsed.tonic) return [];

  // Tonal.js returns tonic like "C", "C#", "Db", etc.
  // chords-db uses "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"
  const chroma = Note.chroma(parsed.tonic);
  const CHORDS_DB_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const dbKey = chroma !== undefined ? CHORDS_DB_KEYS[chroma] : parsed.tonic;

  const dbSuffix = getDbSuffix(parsed);

  // Hardcode 5 (power chords) if not found in db
  if (parsed.symbol.endsWith("5")) {
    const rootFret6 = chroma !== undefined ? (chroma >= 4 ? chroma - 4 : chroma + 8) : 0;
    const rootFret5 = chroma !== undefined ? (chroma >= 9 ? chroma - 9 : chroma + 3) : 0;
    
    const voicings: GuitarVoicing[] = [];
    if (rootFret6 > 0) {
      const frets = [rootFret6, rootFret6 + 2, rootFret6 + 2, "X", "X", "X"];
      voicings.push({ frets: frets as (number | "X")[], isPrimary: true });
    }
    if (rootFret5 > 0) {
      const frets = ["X", rootFret5, rootFret5 + 2, rootFret5 + 2, "X", "X"];
      voicings.push({ frets: frets as (number | "X")[], isPrimary: voicings.length === 0 });
    }
    if (voicings.length > 0) return voicings;
  }

  const dbChords = (guitarDb.chords as any)[dbKey];
  if (!dbChords) return [];

  const chordData = dbChords.find((c: any) => c.suffix === dbSuffix);
  if (!chordData) return [];

  const voicings: GuitarVoicing[] = chordData.positions.map((pos: any, index: number) => {
    // chords-db frets array is [E, A, D, G, B, e].
    // Note: frets > 0 are relative to pos.baseFret.
    // e.g., if baseFret=3, fret=1 means actual fret 3. fret=3 means actual fret 5.
    const frets = pos.frets.map((f: number) => {
      if (f === -1) return "X";
      if (f === 0) return 0;
      return f + pos.baseFret - 1;
    });

    const fingers = pos.fingers ? pos.fingers.map((f: number) => (f === 0 ? "X" : f)) : undefined;
    
    let barre;
    if (pos.barres && pos.barres.length > 0) {
      // Barres are also relative to baseFret in chords-db? Let's check.
      // E.g. baseFret=3, barres=[1], it means the barre is on actual fret 3.
      const barreRelativeFret = pos.barres[0];
      const barreActualFret = barreRelativeFret + pos.baseFret - 1;

      const barredStrings = [];
      for (let i = 0; i < 6; i++) {
         if (frets[i] === barreActualFret || (typeof frets[i] === "number" && frets[i] > barreActualFret)) {
           barredStrings.push(6 - i);
         }
      }
      
      if (barredStrings.length > 0) {
         barre = {
           fret: barreActualFret,
           fromString: Math.max(...barredStrings),
           toString: 1
         };
      }
    }

    return {
      frets,
      fingers,
      barre,
      isPrimary: index === 0
    };
  });

  return voicings;
}

export type GuitarVoicingQueryMatch = {
  bass: { string: number; fret: number };
  melody?: { string: number; fret: number };
  available_inner_strings: number[];
  frets: (number | "X")[];
  barre?: { fret: number; fromString: number; toString: number };
};

const GUITAR_TUNING_MIDI = [
  40, // 6: E2 (0)
  45, // 5: A2 (1)
  50, // 4: D3 (2)
  55, // 3: G3 (3)
  59, // 2: B3 (4)
  64  // 1: E4 (5)
];

export function query_guitar_voicings(
  chordSymbol: string,
  melodyPitch?: string,
  targetPosition?: "open" | "barre" | "any"
): GuitarVoicingQueryMatch[] {
  const voicings = getGuitarVoicings(chordSymbol);
  
  const melodyMidi = melodyPitch ? Note.midi(melodyPitch) : undefined;
  
  const results: GuitarVoicingQueryMatch[] = [];
  
  for (const v of voicings) {
    if (targetPosition === "open") {
      const isOpen = v.frets.some(f => f === 0);
      if (!isOpen) continue;
    } else if (targetPosition === "barre") {
      if (!v.barre) continue;
    }
    
    // Find bass
    let bass: { string: number; fret: number } | undefined;
    for (let i = 0; i < 6; i++) {
      if (v.frets[i] !== "X") {
        bass = { string: 6 - i, fret: v.frets[i] as number };
        break; // Lowest string is the first non-X
      }
    }
    if (!bass) continue;
    
    // Find melody match
    let melody: { string: number; fret: number } | undefined;
    if (melodyMidi !== undefined && melodyMidi !== null) {
      for (let i = 0; i < 6; i++) {
        if (v.frets[i] !== "X") {
          const stringMidi = GUITAR_TUNING_MIDI[i] + (v.frets[i] as number);
          if (stringMidi === melodyMidi) {
            melody = { string: 6 - i, fret: v.frets[i] as number };
          }
        }
      }
      if (!melody) continue; // If melody pitch requested but not found, filter out
    }
    
    // Available inner strings
    const innerStrings: number[] = [];
    for (let i = 0; i < 6; i++) {
      if (v.frets[i] !== "X") {
        const stringNum = 6 - i;
        if (stringNum !== bass.string && (!melody || stringNum !== melody.string)) {
          innerStrings.push(stringNum);
        }
      }
    }
    
    results.push({
      bass,
      melody,
      available_inner_strings: innerStrings,
      frets: v.frets,
      barre: v.barre
    });
  }
  
  return results;
}
