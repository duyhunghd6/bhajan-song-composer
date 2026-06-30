import { getScaleNotes } from "./scales";

export interface AbcHeader {
  key: string;
  timeSignature: string;
}

export interface MeasureInfo {
  measureIndex: number;
  strongBeatNotes: string[];
}

export interface MelodyAnalysis {
  key: string;
  timeSignature: string;
  measures: MeasureInfo[];
}

export function parseAbcHeader(abcString: string): AbcHeader {
  const lines = abcString.split("\n");
  let key = "C";
  let timeSignature = "4/4";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("K:")) {
      key = trimmed.substring(2).trim();
    } else if (trimmed.startsWith("M:")) {
      timeSignature = trimmed.substring(2).trim();
    }
  }

  return { key, timeSignature };
}

export function normalizeAbcNote(note: string): string {
  let accidental = "";
  let name = "";

  // 1. Check if prefix accidental (ABC format)
  let idx = 0;
  if (note[idx] === "^") {
    accidental = "#";
    idx++;
  } else if (note[idx] === "_") {
    accidental = "b";
    idx++;
  } else if (note[idx] === "=") {
    idx++;
  }

  // 2. Extract base note name
  if (idx < note.length) {
    name = note[idx].toUpperCase();
    idx++;
  }

  // 3. Check if suffix accidental (standard format, e.g. F#, Bb)
  if (idx < note.length) {
    if (note[idx] === "#") {
      accidental = "#";
    } else if (note[idx] === "b") {
      accidental = "b";
    }
  }

  const mapped = name + accidental;
  const values: Record<string, string> = {
    "C#": "C#", Db: "C#",
    "D#": "D#", Eb: "D#",
    "F#": "F#", Gb: "F#",
    "G#": "G#", Ab: "G#",
    "A#": "A#", Bb: "A#",
  };
  return values[mapped] || mapped;
}

export function parseNoteDuration(durStr: string): number {
  if (!durStr) return 1; // Default length
  if (durStr === "/") return 0.5;
  if (durStr.startsWith("/")) {
    const den = parseInt(durStr.substring(1));
    return isNaN(den) ? 0.5 : 1 / den;
  }
  if (durStr.includes("/")) {
    const parts = durStr.split("/");
    const num = parseInt(parts[0]);
    const den = parseInt(parts[1]);
    return isNaN(num) || isNaN(den) ? 1 : num / den;
  }
  return parseInt(durStr) || 1;
}

export function detectKeyFromNotes(
  notes: string[],
  finalNote: string
): { root: string; scaleName: string } {
  const normalizedNotes = notes.map(normalizeAbcNote);
  const normalizedFinal = normalizeAbcNote(finalNote);

  const roots = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const modes = ["major", "natural minor"];

  let bestRoot = "C";
  let bestMode = "major";
  let maxScore = -1;

  for (const root of roots) {
    for (const mode of modes) {
      let score = 0;
      try {
        const scaleNotes = getScaleNotes(root, mode).map(normalizeAbcNote);

        // Count overlap
        for (const note of normalizedNotes) {
          if (scaleNotes.includes(note)) {
            score++;
          }
        }

        // High priority for the resolution note matching the tonic
        if (root === normalizedFinal) {
          score += 5;
        }

        if (score > maxScore) {
          maxScore = score;
          bestRoot = root;
          bestMode = mode;
        }
      } catch {
        // Skip invalid root/mode combinations
      }
    }
  }

  return { root: bestRoot, scaleName: bestMode };
}

export function analyzeMelody(abcString: string): MelodyAnalysis {
  const { key, timeSignature } = parseAbcHeader(abcString);

  // Extract body lines (exclude headers and comments)
  const lines = abcString.split("\n");
  const bodyLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false; // Comments
    // Headers are single uppercase character followed by colon
    if (/^[A-Z]:/.test(trimmed)) return false;
    return true;
  });

  const body = bodyLines.join(" ");

  // Split by measures |
  // Filter out empty strings or basic repeat symbols
  const rawMeasures = body.split(/[|\]]/);
  const measures: MeasureInfo[] = [];

  let measureIdx = 0;
  const noteRegex = /([_^+]?[A-Ga-g],*'*)([0-9]*\/?[0-9]*)/g;

  for (const rawMeasure of rawMeasures) {
    const trimmed = rawMeasure.trim().replace(/^[:\s]+|[:\s]+$/g, "");
    if (!trimmed || trimmed === ":" || trimmed === "::") continue;

    let currentBeat = 0;
    const strongBeatNotes: string[] = [];
    let match;

    // Reset regex lastIndex
    noteRegex.lastIndex = 0;

    while ((match = noteRegex.exec(trimmed)) !== null) {
      const noteSymbol = match[1];
      const durSymbol = match[2];

      const duration = parseNoteDuration(durSymbol);
      const normalized = normalizeAbcNote(noteSymbol);

      // In 4/4 meter (with L:1/8 default note), strong beats are at 0 and 4.
      // In 3/4 meter, strong beat is at 0.
      // If we assume default note length is 1/8:
      const isStrong4_4 = timeSignature === "4/4" && (currentBeat === 0 || currentBeat === 4);
      const isStrongOther = timeSignature !== "4/4" && currentBeat === 0;

      if (isStrong4_4 || isStrongOther) {
        strongBeatNotes.push(normalized);
      }

      currentBeat += duration;
    }

    if (strongBeatNotes.length > 0) {
      measures.push({
        measureIndex: measureIdx++,
        strongBeatNotes,
      });
    }
  }

  return {
    key,
    timeSignature,
    measures,
  };
}
