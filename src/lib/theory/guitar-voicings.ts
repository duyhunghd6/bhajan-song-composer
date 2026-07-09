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

const GUITAR_TUNING_MIDI = [
  40, // 6: E2 (0)
  45, // 5: A2 (1)
  50, // 4: D3 (2)
  55, // 3: G3 (3)
  59, // 2: B3 (4)
  64  // 1: E4 (5)
];

function planFingersAndBarre(frets: (number | "X")[]): { fingers?: (number | "X")[]; barre?: { fret: number; fromString: number; toString: number } } {
  const frettedIndices = frets.map((f, i) => f !== "X" && f > 0 ? { fret: f as number, stringIdx: i } : null).filter((item): item is { fret: number; stringIdx: number } => item !== null);
  
  if (frettedIndices.length === 0) return {};

  const frettedFrets = frettedIndices.map(item => item.fret);
  
  const fretCounts: Record<number, number[]> = {};
  frettedIndices.forEach(item => {
    if (!fretCounts[item.fret]) fretCounts[item.fret] = [];
    fretCounts[item.fret].push(item.stringIdx);
  });

  let barre: { fret: number; fromString: number; toString: number } | undefined;
  let barreFretValue = -1;
  const sortedFretsWithMultiple = Object.keys(fretCounts)
    .map(Number)
    .filter(f => fretCounts[f].length > 1)
    .sort((a, b) => a - b);

  if (sortedFretsWithMultiple.length > 0) {
    const bf = sortedFretsWithMultiple[0];
    barreFretValue = bf;
    const stringIndices = fretCounts[bf];
    const stringNums = stringIndices.map(idx => 6 - idx);
    barre = {
      fret: bf,
      fromString: Math.max(...stringNums),
      toString: Math.min(...stringNums),
    };
  }

  const fingers: (number | "X")[] = frets.map(f => {
    if (f === "X") return "X";
    if (f === 0) return "X";
    return "X";
  });

  let currentFinger = barre ? 2 : 1;
  frettedIndices.forEach(item => {
    if (item.fret === barreFretValue) {
      fingers[item.stringIdx] = 1;
    } else {
      fingers[item.stringIdx] = currentFinger as any;
      currentFinger = Math.min(4, currentFinger + 1);
    }
  });

  return { fingers, barre };
}

export function generateAlgorithmicVoicings(chordSymbol: string): GuitarVoicing[] {
  const parsed = Chord.get(chordSymbol);
  if (parsed.empty || !parsed.tonic || parsed.notes.length === 0) return [];

  const chordNotes = parsed.notes;
  const tonic = parsed.tonic;

  const chordChromas = new Set(chordNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined && c !== null));
  const tonicChroma = Note.chroma(tonic);
  if (tonicChroma === undefined) return [];

  const possibleFretsPerString: number[][] = [];
  for (let s = 0; s < 6; s++) {
    const stringFrets: number[] = [];
    for (let fret = 0; fret <= 12; fret++) { // standard fret range up to 12
      const midi = GUITAR_TUNING_MIDI[s] + fret;
      const chroma = midi % 12;
      if (chordChromas.has(chroma)) {
        stringFrets.push(fret);
      }
    }
    stringFrets.push(-1); // allow mute
    possibleFretsPerString.push(stringFrets);
  }

  const candidates: { frets: (number | "X")[]; score: number }[] = [];

  function evaluateVoicing(frets: number[]) {
    const activeStrings: number[] = [];
    const frettedFrets: number[] = [];
    const soundingChromas = new Set<number>();
    let lowestStringIdx = -1;

    for (let s = 0; s < 6; s++) {
      const fret = frets[s];
      if (fret !== -1) {
        activeStrings.push(s);
        if (lowestStringIdx === -1) lowestStringIdx = s;
        if (fret > 0) frettedFrets.push(fret);
        
        const midi = GUITAR_TUNING_MIDI[s] + fret;
        soundingChromas.add(midi % 12);
      }
    }

    const minStrings = chordSymbol.endsWith("5") ? 2 : 3;
    if (activeStrings.length < minStrings) return { valid: false, score: 0 };

    if (!soundingChromas.has(tonicChroma!)) return { valid: false, score: 0 };

    const missingCount = Array.from(chordChromas).filter(c => !soundingChromas.has(c)).length;
    if (chordChromas.size <= 4 && missingCount > 0) return { valid: false, score: 0 };
    if (chordChromas.size > 4 && missingCount > 1) return { valid: false, score: 0 };

    const fretSpan = frettedFrets.length > 0 ? Math.max(...frettedFrets) - Math.min(...frettedFrets) : 0;

    // Calculate usability score for sorting
    let score = 0;

    const lowestMidi = GUITAR_TUNING_MIDI[lowestStringIdx] + frets[lowestStringIdx];
    if (lowestMidi % 12 === tonicChroma) {
      score += 100;
      if (lowestStringIdx === 0 || lowestStringIdx === 1) {
        score += 30;
      }
    } else {
      score -= 30;
    }

    const maxFret = frettedFrets.length > 0 ? Math.max(...frettedFrets) : 0;
    if (maxFret > 9) score -= 40;

    // Heavy penalty for extreme fret stretches so standard shapes stay at the top
    score -= fretSpan * 15;
    score += activeStrings.length * 15;
    const openCount = frets.filter(f => f === 0).length;
    score += openCount * 12;

    return { valid: true, score };
  }

  function search(stringIdx: number, currentFrets: number[]) {
    if (stringIdx === 6) {
      const evaluation = evaluateVoicing(currentFrets);
      if (evaluation.valid) {
        candidates.push({
          frets: currentFrets.map(f => f === -1 ? "X" : f),
          score: evaluation.score
        });
      }
      return;
    }

    for (const fret of possibleFretsPerString[stringIdx]) {
      currentFrets.push(fret);
      search(stringIdx + 1, currentFrets);
      currentFrets.pop();
    }
  }

  search(0, []);

  candidates.sort((a, b) => b.score - a.score);

  const uniqueVoicings: GuitarVoicing[] = [];
  const seenFrets = new Set<string>();

  for (const c of candidates) {
    const key = c.frets.join(",");
    if (!seenFrets.has(key)) {
      seenFrets.add(key);
      const planned = planFingersAndBarre(c.frets);
      uniqueVoicings.push({
        frets: c.frets,
        fingers: planned.fingers,
        barre: planned.barre,
        isPrimary: uniqueVoicings.length === 0
      });
    }
  }

  return uniqueVoicings;
}

export function getGuitarVoicings(chordSymbol: string): GuitarVoicing[] {
  const parsed = Chord.get(chordSymbol);
  if (parsed.empty || !parsed.tonic) return [];

  const chroma = Note.chroma(parsed.tonic);
  const CHORDS_DB_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const dbKey = chroma !== undefined ? CHORDS_DB_KEYS[chroma] : parsed.tonic;

  const dbSuffix = getDbSuffix(parsed);

  let voicings: GuitarVoicing[] = [];

  const dbChords = (guitarDb.chords as any)[dbKey];
  if (dbChords) {
    const chordData = dbChords.find((c: any) => c.suffix === dbSuffix);
    if (chordData) {
      voicings = chordData.positions.map((pos: any, index: number) => {
        const frets = pos.frets.map((f: number) => {
          if (f === -1) return "X";
          if (f === 0) return 0;
          return f + pos.baseFret - 1;
        });

        const fingers = pos.fingers ? pos.fingers.map((f: number) => (f === 0 ? "X" : f)) : undefined;
        
        let barre;
        if (pos.barres && pos.barres.length > 0) {
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
    }
  }

  // Hardcode 5 (power chords) if not found in db
  if (voicings.length === 0 && parsed.symbol.endsWith("5")) {
    const rootFret6 = chroma !== undefined ? (chroma >= 4 ? chroma - 4 : chroma + 8) : 0;
    const rootFret5 = chroma !== undefined ? (chroma >= 9 ? chroma - 9 : chroma + 3) : 0;
    
    if (rootFret6 > 0) {
      const frets = [rootFret6, rootFret6 + 2, rootFret6 + 2, "X", "X", "X"];
      voicings.push({ frets: frets as (number | "X")[], isPrimary: true });
    }
    if (rootFret5 > 0) {
      const frets = ["X", rootFret5, rootFret5 + 2, rootFret5 + 2, "X", "X"];
      voicings.push({ frets: frets as (number | "X")[], isPrimary: voicings.length === 0 });
    }
  }

  // Supplement / Fallback with Algorithmic Voicings
  const algoVoicings = generateAlgorithmicVoicings(chordSymbol);
  if (voicings.length === 0) {
    return algoVoicings;
  }

  const seenFrets = new Set<string>(voicings.map(v => v.frets.join(",")));
  for (const av of algoVoicings) {
    const key = av.frets.join(",");
    if (!seenFrets.has(key)) {
      seenFrets.add(key);
      voicings.push({
        ...av,
        isPrimary: false
      });
    }
  }

  return voicings;
}

export type GuitarVoicingQueryMatch = {
  bass: { string: number; fret: number };
  melody?: { string: number; fret: number };
  fretDistance?: number;
  available_inner_strings: number[];
  frets: (number | "X")[];
  barre?: { fret: number; fromString: number; toString: number };
};

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
    
    let fretDistance = 0;
    if (melody) {
      // Distance between melody fret and bass fret (0 if open strings involved)
      const maxFret = Math.max(melody.fret, bass.fret);
      const minFret = Math.min(melody.fret, bass.fret);
      fretDistance = maxFret > 0 && minFret > 0 ? maxFret - minFret : 0;
    }
    
    results.push({
      bass,
      melody,
      fretDistance,
      available_inner_strings: innerStrings,
      frets: v.frets,
      barre: v.barre
    });
  }
  
  // Sort by fret distance (closest first)
  results.sort((a, b) => (a.fretDistance || 0) - (b.fretDistance || 0));
  
  return results.slice(0, 15);
}
