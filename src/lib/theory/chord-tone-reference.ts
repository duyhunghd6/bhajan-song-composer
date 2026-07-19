/**
 * Chord-Tone Reference Builder
 *
 * Extracts chord symbols from ABC notation and produces an explicit
 * chord-tone reference table. Each chord is mapped to its concrete
 * note names AND the ABC tokens that represent those notes under
 * the active key signature. This eliminates the LLM's need to
 * derive chord tones from training data (which causes errors like
 * ^G in Em chords under K:G).
 */

import { extractChordSymbolsByMeasure } from "./harmonization-candidates";
import { parseAbcHeader } from "./melody-analyzer";
import { parseRootAndMode } from "./harmonizer";
import { getDiatonicChords } from "./chords";
import { getNoteValue } from "./scales";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChordToneReference {
  /** Chord name as it appears in the ABC (e.g. "Em", "B7", "C") */
  chordName: string;
  /** Concert-pitch note names without octave (e.g. ["E", "G", "B"]) */
  notes: string[];
  /** ABC tokens for those notes across guitar/arpeggio range (e.g. ["E,", "G,", "B,", "E", "G", "B", "e"]) */
  abcTokens: string[];
  /** Human-readable note about key-signature implications */
  keySignatureNote: string;
}

export interface ChordToneReferenceTable {
  /** Key signature from the ABC header */
  key: string;
  /** Per-chord reference entries (deduplicated, ordered by first appearance) */
  references: ChordToneReference[];
  /** Pre-formatted prompt text ready for LLM injection */
  promptText: string;
  /** Per-measure chord mapping: measureIndex → chord names in that measure */
  measureChords: string[][];
}

// ---------------------------------------------------------------------------
// Key-signature accidental map
// ---------------------------------------------------------------------------

/**
 * Standard key signatures map: key → set of note letters that are sharped or flatted.
 * ABC notation convention: under K:G, F is F# implicitly (no accidental needed).
 * Writing ^F would be redundant. Writing F means F-natural would need =F.
 */
const KEY_SIGNATURE_SHARPS: Record<string, string[]> = {
  // Major keys
  "G": ["F"],
  "D": ["F", "C"],
  "A": ["F", "C", "G"],
  "E": ["F", "C", "G", "D"],
  "B": ["F", "C", "G", "D", "A"],
  "F#": ["F", "C", "G", "D", "A", "E"],
  // Minor keys (relative to their major)
  "Em": ["F"],        // same as G major
  "Bm": ["F", "C"],   // same as D major
  "F#m": ["F", "C", "G"], // same as A major
  "C#m": ["F", "C", "G", "D"], // same as E major
  "G#m": ["F", "C", "G", "D", "A"], // same as B major
};

const KEY_SIGNATURE_FLATS: Record<string, string[]> = {
  "F": ["B"],
  "Bb": ["B", "E"],
  "Eb": ["B", "E", "A"],
  "Ab": ["B", "E", "A", "D"],
  "Db": ["B", "E", "A", "D", "G"],
  "Gb": ["B", "E", "A", "D", "G", "C"],
  // Minor keys
  "Dm": ["B"],
  "Gm": ["B", "E"],
  "Cm": ["B", "E", "A"],
  "Fm": ["B", "E", "A", "D"],
};

interface KeySignatureInfo {
  sharps: Set<string>;
  flats: Set<string>;
}

function getKeySignatureInfo(keyStr: string): KeySignatureInfo {
  const trimmed = keyStr.trim();

  // Try exact match first
  const sharpLetters = KEY_SIGNATURE_SHARPS[trimmed];
  if (sharpLetters) return { sharps: new Set(sharpLetters), flats: new Set() };

  const flatLetters = KEY_SIGNATURE_FLATS[trimmed];
  if (flatLetters) return { sharps: new Set(), flats: new Set(flatLetters) };

  // Parse root and mode, then try the relative major
  const { root, mode } = parseRootAndMode(trimmed);
  const lookupKey = mode === "natural minor" ? `${root}m` : root;

  const sharpLookup = KEY_SIGNATURE_SHARPS[lookupKey];
  if (sharpLookup) return { sharps: new Set(sharpLookup), flats: new Set() };

  const flatLookup = KEY_SIGNATURE_FLATS[lookupKey];
  if (flatLookup) return { sharps: new Set(), flats: new Set(flatLookup) };

  // C major / A minor — no accidentals
  return { sharps: new Set(), flats: new Set() };
}

// ---------------------------------------------------------------------------
// Note → ABC token mapping
// ---------------------------------------------------------------------------

const CHORD_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

/**
 * Convert a concert-pitch note name (e.g. "E", "F#", "Bb") to the ABC token
 * needed under the given key signature, for one specific octave register.
 *
 * ABC octave convention:
 *   C, D, ... B,  = octave 3
 *   C  D  ... B   = octave 4
 *   c  d  ... b   = octave 5
 *   c' d' ... b'  = octave 6
 */
function noteToAbcToken(
  noteName: string,
  octave: number,
  keyInfo: KeySignatureInfo
): string {
  // Parse the note name
  const letter = noteName.charAt(0).toUpperCase();
  const accidental = noteName.length > 1 ? noteName.slice(1) : "";

  // Determine if accidental is needed in ABC
  let abcAccidental = "";
  const isSharpedByKey = keyInfo.sharps.has(letter);
  const isFlattedByKey = keyInfo.flats.has(letter);

  if (accidental === "#") {
    // Note is sharp — if the key already sharps this letter, no accidental needed
    abcAccidental = isSharpedByKey ? "" : "^";
  } else if (accidental === "b") {
    // Note is flat — if the key already flats this letter, no accidental needed
    abcAccidental = isFlattedByKey ? "" : "_";
  } else {
    // Note is natural — if the key sharps/flats this letter, we need a natural sign
    if (isSharpedByKey || isFlattedByKey) {
      abcAccidental = "=";
    }
  }

  // Determine the ABC letter case and octave modifiers
  let abcLetter: string;
  let octaveModifier = "";

  if (octave <= 3) {
    abcLetter = letter.toUpperCase();
    octaveModifier = ",".repeat(Math.max(0, 4 - octave));
  } else if (octave === 4) {
    abcLetter = letter.toUpperCase();
  } else if (octave === 5) {
    abcLetter = letter.toLowerCase();
  } else {
    abcLetter = letter.toLowerCase();
    octaveModifier = "'".repeat(octave - 5);
  }

  return `${abcAccidental}${abcLetter}${octaveModifier}`;
}

/**
 * Generate ABC tokens for a note across the standard guitar range (octaves 2-5).
 */
function noteToAbcTokensAllOctaves(
  noteName: string,
  keyInfo: KeySignatureInfo
): string[] {
  const tokens: string[] = [];
  for (let octave = 2; octave <= 5; octave++) {
    tokens.push(noteToAbcToken(noteName, octave, keyInfo));
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Chord → notes resolver
// ---------------------------------------------------------------------------

function resolveChordNotes(chordName: string, keyStr: string): string[] {
  const rootMatch = chordName.match(/^([A-G](?:#|b)?)/);
  if (!rootMatch) return [];

  const root = rootMatch[1];
  const suffix = chordName.slice(root.length).split("/")[0].toLowerCase();

  // Try diatonic chord lookup first
  const { root: keyRoot, mode } = parseRootAndMode(keyStr);
  try {
    const diatonic = getDiatonicChords(keyRoot, mode);
    const match = diatonic.find(
      (c) => c.chordName.toLowerCase() === chordName.toLowerCase()
    );
    if (match) return match.notes;
  } catch {
    // Fall through to interval-based computation
  }

  // Interval-based computation
  const rootValue = getNoteValue(root);
  if (rootValue === undefined) return [root];

  let intervals = [0, 4, 7]; // Major triad default
  if (suffix.includes("dim") || suffix.includes("°")) {
    intervals = [0, 3, 6];
  } else if (suffix.includes("aug") || suffix.includes("+")) {
    intervals = [0, 4, 8];
  } else if (suffix.includes("sus2")) {
    intervals = [0, 2, 7];
  } else if (suffix.includes("sus4") || suffix.includes("sus")) {
    intervals = [0, 5, 7];
  } else if (suffix.startsWith("m") && !suffix.startsWith("maj")) {
    intervals = [0, 3, 7];
  }

  // Extensions
  if (suffix.includes("maj7")) {
    intervals.push(11);
  } else if (suffix.includes("7")) {
    intervals.push(10);
  }

  const rootLetterIndex = CHORD_LETTERS.indexOf(root.charAt(0).toUpperCase());

  return [...new Set(intervals)].map((interval) => {
    const value = (rootValue + interval) % 12;
    // Use diatonic letter spelling
    const letterSteps = interval === 0 ? 0 : interval <= 2 ? 1 : interval <= 4 ? 2 : interval <= 5 ? 3 : interval <= 7 ? 4 : interval <= 9 ? 5 : 6;
    const preferredLetter = CHORD_LETTERS[(rootLetterIndex + letterSteps) % 7];
    // Find the note name that matches this value with the preferred letter
    const natural = getNoteValue(preferredLetter);
    if (natural === value) return preferredLetter;
    if (natural !== undefined && (natural + 1) % 12 === value) return `${preferredLetter}#`;
    if (natural !== undefined && (natural + 11) % 12 === value) return `${preferredLetter}b`;
    // Fallback to chromatic
    const chromatic = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return chromatic[value];
  });
}

// ---------------------------------------------------------------------------
// Key-signature note description
// ---------------------------------------------------------------------------

function buildKeySignatureNote(
  chordName: string,
  notes: string[],
  keyInfo: KeySignatureInfo
): string {
  const remarks: string[] = [];

  for (const note of notes) {
    const letter = note.charAt(0).toUpperCase();
    const accidental = note.length > 1 ? note.slice(1) : "";

    if (accidental === "#" && keyInfo.sharps.has(letter)) {
      remarks.push(`${note} is implied by key signature (no ^ needed)`);
    } else if (accidental === "#" && !keyInfo.sharps.has(letter)) {
      remarks.push(`${note} needs ^ accidental`);
    } else if (accidental === "b" && keyInfo.flats.has(letter)) {
      remarks.push(`${note} is implied by key signature (no _ needed)`);
    } else if (accidental === "b" && !keyInfo.flats.has(letter)) {
      remarks.push(`${note} needs _ accidental`);
    } else if (!accidental && (keyInfo.sharps.has(letter) || keyInfo.flats.has(letter))) {
      remarks.push(`${note}-natural needs = accidental (key signature alters ${letter})`);
    }
  }

  return remarks.length > 0 ? remarks.join("; ") : "all notes are natural in this key";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a chord-tone reference table from an ABC source string.
 *
 * Extracts all chord symbols from the Melody, resolves each to its
 * component notes, and maps those notes to correct ABC tokens under
 * the key signature.
 */
export function buildChordToneReferenceTable(sourceAbc: string): ChordToneReferenceTable {
  const header = parseAbcHeader(sourceAbc);
  const keyInfo = getKeySignatureInfo(header.key);
  const measureChords = extractChordSymbolsByMeasure(sourceAbc);

  // Collect unique chord names in order of first appearance
  const seen = new Set<string>();
  const uniqueChords: string[] = [];
  for (const chords of measureChords) {
    for (const chord of chords) {
      if (!seen.has(chord)) {
        seen.add(chord);
        uniqueChords.push(chord);
      }
    }
  }

  const references: ChordToneReference[] = uniqueChords.map((chordName) => {
    const notes = resolveChordNotes(chordName, header.key);
    const abcTokens = notes.flatMap((note) =>
      noteToAbcTokensAllOctaves(note, keyInfo)
    );
    const keySignatureNote = buildKeySignatureNote(chordName, notes, keyInfo);
    return { chordName, notes, abcTokens, keySignatureNote };
  });

  const promptText = formatPromptText(header.key, references, measureChords);

  return { key: header.key, references, promptText, measureChords };
}

/**
 * Validate that Guitar voice notes in a multi-voice ABC belong to the
 * chord annotated in the Melody for the same measure.
 *
 * Returns issues (warning-level, non-blocking).
 */
export function validateGuitarVoiceChordTones(abc: string): {
  valid: boolean;
  issues: string[];
} {
  const header = parseAbcHeader(abc);
  const lines = abc.split(/\r?\n/);

  // Extract [V:Melody] and [V:Guitar] lines grouped by staff system
  const melodyLines: string[] = [];
  const guitarLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\[V:([^\]]+)\]\s*(.*)$/);
    if (!match) continue;
    const voiceId = match[1].trim();
    const body = match[2].trim();
    if (voiceId === "Melody" && body) melodyLines.push(body);
    if (voiceId === "Guitar" && body) guitarLines.push(body);
  }

  if (melodyLines.length === 0 || guitarLines.length === 0) {
    return { valid: true, issues: [] };
  }

  // Extract chords from melody measures
  const melodyBody = melodyLines.join(" | ");
  const melodyMeasureChords = extractChordSymbolsByMeasureFromBody(melodyBody);

  // Extract guitar notes per measure
  const guitarBody = guitarLines.join(" | ");
  const guitarMeasureNotes = extractNotesPerMeasureFromBody(guitarBody);

  const keyInfo = getKeySignatureInfo(header.key);
  const issues: string[] = [];

  const maxMeasures = Math.min(melodyMeasureChords.length, guitarMeasureNotes.length);

  for (let m = 0; m < maxMeasures; m++) {
    const chords = melodyMeasureChords[m];
    if (chords.length === 0) continue;

    // Build the set of allowed pitch classes for this measure (all chords combined)
    const allowedPitchClasses = new Set<number>();
    for (const chord of chords) {
      const notes = resolveChordNotes(chord, header.key);
      for (const note of notes) {
        const value = getNoteValue(note);
        if (value !== undefined) allowedPitchClasses.add(value);
      }
    }

    // Check each guitar note
    for (const guitarNote of guitarMeasureNotes[m]) {
      const pitchClass = abcTokenToPitchClass(guitarNote, keyInfo);
      if (pitchClass !== undefined && !allowedPitchClasses.has(pitchClass)) {
        const chordStr = chords.join("/");
        issues.push(
          `measure ${m + 1}: Guitar note "${guitarNote}" (pitch class ${pitchClass}) is not in chord ${chordStr} (allowed: ${[...allowedPitchClasses].join(",")})`
        );
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NOTE_REGEX = /([_^=]?)([A-Ga-g])([,']*)/g;

function abcTokenToPitchClass(token: string, keyInfo: KeySignatureInfo): number | undefined {
  const match = token.match(/^([_^=]?)([A-Ga-g])/);
  if (!match) return undefined;

  const accidental = match[1];
  const letter = match[2].toUpperCase();
  const baseValue = getNoteValue(letter);
  if (baseValue === undefined) return undefined;

  if (accidental === "^") return (baseValue + 1) % 12;
  if (accidental === "_") return (baseValue + 11) % 12;
  if (accidental === "=") return baseValue;

  // No explicit accidental — apply key signature
  if (keyInfo.sharps.has(letter)) return (baseValue + 1) % 12;
  if (keyInfo.flats.has(letter)) return (baseValue + 11) % 12;
  return baseValue;
}

function extractChordSymbolsByMeasureFromBody(body: string): string[][] {
  return body.split(/[|[\]]+/).map((segment) => {
    const chords: string[] = [];
    const regex = /"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(segment)) !== null) {
      const sym = match[1].trim();
      // Filter out annotations (^text, _text, etc.)
      if (/^[A-G]/.test(sym)) chords.push(sym);
    }
    return chords;
  }).filter((c) => c.length > 0);
}

function extractNotesPerMeasureFromBody(body: string): string[][] {
  return body.split(/[|[\]]+/).map((segment) => {
    const notes: string[] = [];
    // Strip chord symbols and decorations
    const cleaned = segment.replace(/"[^"]*"/g, "").replace(/![^!]*!/g, "");
    NOTE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = NOTE_REGEX.exec(cleaned)) !== null) {
      // Skip rests
      const letter = match[2];
      if (letter === "z" || letter === "Z" || letter === "x" || letter === "X") continue;
      notes.push(`${match[1]}${match[2]}`);
    }
    return notes;
  }).filter((n) => n.length > 0);
}

// ---------------------------------------------------------------------------
// Prompt formatting
// ---------------------------------------------------------------------------

function formatPromptText(
  key: string,
  references: ChordToneReference[],
  measureChords: string[][]
): string {
  if (references.length === 0) return "";

  const lines: string[] = [
    `### Chord-Tone Reference Table (K:${key})`,
    "",
    "CHORD-TONE ENFORCEMENT: Every Guitar voice note in every measure MUST be a member of the chord annotated in the Melody for that measure. Use ONLY the ABC tokens listed below. Common errors to avoid:",
    "- Using ^G (G#) when the chord is Em (which uses G natural, no accidental in K:G)",
    "- Copy-pasting the same arpeggio pattern across different chords",
    "- Ignoring split-chord measures (e.g., Am→B7 means first half uses Am tones, second half uses B7 tones)",
    "",
    "| Chord | Notes | ABC Tokens (octave 3-5) | Key Signature Note |",
    "|:------|:------|:------------------------|:-------------------|",
  ];

  for (const ref of references) {
    const notesStr = ref.notes.join(", ");
    const tokensStr = ref.abcTokens.join(", ");
    lines.push(`| ${ref.chordName} | ${notesStr} | ${tokensStr} | ${ref.keySignatureNote} |`);
  }

  // Add per-measure chord mapping
  lines.push("");
  lines.push("**Per-measure chord mapping:**");
  for (let i = 0; i < measureChords.length; i++) {
    const chords = measureChords[i];
    if (chords.length === 1) {
      lines.push(`- Measure ${i + 1}: ${chords[0]}`);
    } else if (chords.length > 1) {
      lines.push(`- Measure ${i + 1}: ${chords.join(" → ")} (split measure — use first chord tones for first half, second chord tones for second half)`);
    }
  }

  return lines.join("\n");
}
