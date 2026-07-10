/**
 * ABC Key Signature Utilities
 *
 * Maps ABC `K:` header values to the implied accidentals they carry, following
 * the ABC 2.1 standard and the circle-of-fifths convention.
 *
 * Example:
 *   K:Em → 1 sharp (F#)  → Map { "F" => "^" }
 *   K:D  → 2 sharps (F#, C#) → Map { "F" => "^", "C" => "^" }
 *   K:F  → 1 flat  (Bb)  → Map { "B" => "_" }
 */

export type AbcKeyAccidental = "^" | "_";
export type AbcKeyAccidentalMap = Map<string, AbcKeyAccidental>;

// Order of sharps: F C G D A E B
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
// Order of flats: B E A D G C F
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

/**
 * Number of sharps (positive) or flats (negative) for each major key root.
 * Minor keys are mapped through their relative major.
 */
const MAJOR_KEY_SHARPS: Record<string, number> = {
  "C": 0,
  "G": 1,
  "D": 2,
  "A": 3,
  "E": 4,
  "B": 5,
  "F#": 6,
  "Gb": -6,
  "Db": -5,
  "C#": 7,
  "Ab": -4,
  "Eb": -3,
  "Bb": -2,
  "F": -1,
  "Cb": -7,
};

/**
 * Minor root → relative major root, so we can reuse the MAJOR_KEY_SHARPS table.
 */
const MINOR_TO_RELATIVE_MAJOR: Record<string, string> = {
  "A": "C",
  "E": "G",
  "B": "D",
  "F#": "A",
  "C#": "E",
  "G#": "B",
  "D#": "F#",
  "D": "F",
  "G": "Bb",
  "C": "Eb",
  "F": "Ab",
  "Bb": "Db",
  "Eb": "Gb",
  "Ab": "Cb",
};

function parseKeyRoot(keyStr: string): string {
  const trimmed = keyStr.trim();
  let idx = 0;
  let root = "";
  if (idx < trimmed.length) {
    root += trimmed[idx].toUpperCase();
    idx++;
  }
  if (idx < trimmed.length && (trimmed[idx] === "#" || trimmed[idx] === "b")) {
    root += trimmed[idx];
    idx++;
  }
  return root;
}

function isMinorKey(keyStr: string): boolean {
  const rest = keyStr.trim().substring(parseKeyRoot(keyStr).length).toLowerCase();
  return rest.startsWith("m") || rest.includes("minor");
}

/**
 * Returns a map from uppercase note letter to its implied accidental
 * based on the ABC key signature.
 *
 * - A bare note in the ABC body inherits the key accidental.
 * - `=` (natural) in the ABC body explicitly overrides the key accidental.
 * - `^` / `_` in the ABC body explicitly sets sharp / flat.
 */
export function getKeySignatureAccidentals(keyStr: string): AbcKeyAccidentalMap {
  const root = parseKeyRoot(keyStr);
  const minor = isMinorKey(keyStr);
  const majorRoot = minor ? (MINOR_TO_RELATIVE_MAJOR[root] ?? root) : root;
  const sharpCount = MAJOR_KEY_SHARPS[majorRoot] ?? 0;

  const accidentals: AbcKeyAccidentalMap = new Map();

  if (sharpCount > 0) {
    for (let i = 0; i < Math.min(sharpCount, SHARP_ORDER.length); i++) {
      accidentals.set(SHARP_ORDER[i], "^");
    }
  } else if (sharpCount < 0) {
    const flatCount = Math.abs(sharpCount);
    for (let i = 0; i < Math.min(flatCount, FLAT_ORDER.length); i++) {
      accidentals.set(FLAT_ORDER[i], "_");
    }
  }

  return accidentals;
}

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

/**
 * Convert an ABC note token to its MIDI number, respecting the key signature.
 *
 * Rules (ABC 2.1 §4.6):
 * 1. `^F`  → explicit sharp  → F#
 * 2. `_B`  → explicit flat   → Bb
 * 3. `=F`  → explicit natural → F♮ (overrides key signature)
 * 4. `F`   → bare note       → apply key signature accidental if any
 *
 * @param note        ABC note token, e.g. "F", "^F", "=F", "e,", "B'"
 * @param keyAccidentals  Optional map from getKeySignatureAccidentals()
 */
export function abcNoteToMidiWithKey(
  note: string,
  keyAccidentals?: AbcKeyAccidentalMap
): number | null {
  const match = note.trim().match(/^([_^=]?)([A-Ga-g])([,']*)/);
  if (!match) return null;

  const explicitAccidental = match[1]; // "^", "_", "=", or ""
  const letter = match[2];
  const octaveMarks = match[3] ?? "";

  let accidentalStr = "";
  if (explicitAccidental === "^") {
    accidentalStr = "#";
  } else if (explicitAccidental === "_") {
    accidentalStr = "b";
  } else if (explicitAccidental === "=") {
    // Explicit natural — no accidental, overrides key signature
    accidentalStr = "";
  } else {
    // No explicit accidental — apply key signature if available
    const keyAcc = keyAccidentals?.get(letter.toUpperCase());
    if (keyAcc === "^") {
      accidentalStr = "#";
    } else if (keyAcc === "_") {
      accidentalStr = "b";
    }
  }

  const pitchClass = `${letter.toUpperCase()}${accidentalStr}`;
  const semitone = PITCH_CLASS_TO_SEMITONE[pitchClass];
  if (semitone === undefined) return null;

  let octave = letter === letter.toLowerCase() ? 5 : 4;
  for (const mark of octaveMarks) {
    octave += mark === "'" ? 1 : -1;
  }

  return (octave + 1) * 12 + semitone;
}

/**
 * Extract the key string from ABC text and return its accidental map.
 * Convenience for callers who have the full ABC string.
 */
export function getKeyAccidentalsFromAbc(abcString: string): AbcKeyAccidentalMap {
  const keyLine = abcString.split(/\r?\n/).find((line) => line.trim().startsWith("K:"));
  const keyStr = keyLine ? keyLine.substring(keyLine.indexOf(":") + 1).trim().split(/\s/)[0] : "C";
  return getKeySignatureAccidentals(keyStr);
}
