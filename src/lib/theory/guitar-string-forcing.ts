/**
 * Guitar String-Forcing Post-Processor
 *
 * Post-processes ABC notation for Guitar voices to ensure every note has
 * an `!N!` string-forcing decoration (where N is the guitar string 1-6).
 *
 * ABCJS's tablature renderer uses getStringDecoration() to detect these
 * decorations. Without them, it falls back to a lowest-fret auto-assignment
 * algorithm that often fails — producing "X" (unplaceable) or "?" (ambiguous)
 * marks in the rendered TAB.
 *
 * This module is a safety net for ABC that bypasses the time-slice pipeline
 * (e.g. raw LLM-generated ABC). The time-slice pipeline already adds !N!
 * decorations correctly in convertTimeSliceMeasureToAbc().
 */

import { abcNoteToMidiWithKey, getKeyAccidentalsFromAbc, type AbcKeyAccidentalMap } from "./abc-key-signature";
import { STANDARD_TUNING_OPEN_MIDI, type GuitarPlayabilityStringNumber } from "./guitar-playability";

/** Strings from highest (1=E4) to lowest (6=E2). */
const ALL_STRINGS: GuitarPlayabilityStringNumber[] = [1, 2, 3, 4, 5, 6];
const TREBLE_STRINGS: GuitarPlayabilityStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarPlayabilityStringNumber[] = [4, 5, 6];

const MAX_FRET = 20;

/**
 * Check if a note token already has a string-forcing decoration.
 * Matches patterns like `!1!`, `!2!`, ..., `!6!` preceding the note.
 */
function hasStringForcing(token: string): boolean {
  return /^![1-6]!/.test(token);
}

/**
 * Route a MIDI pitch to the best guitar string, preferring the lowest fret.
 * Returns null if the pitch is outside the guitar's physical range.
 */
function routeMidiToString(
  midi: number,
  preferredStrings: GuitarPlayabilityStringNumber[] = ALL_STRINGS,
  usedStrings?: Set<GuitarPlayabilityStringNumber>
): { string: GuitarPlayabilityStringNumber; fret: number } | null {
  const candidates = preferredStrings
    .filter(s => !usedStrings || !usedStrings.has(s))
    .map(s => ({ string: s, fret: midi - STANDARD_TUNING_OPEN_MIDI[s] }))
    .filter(c => c.fret >= 0 && c.fret <= MAX_FRET);

  if (candidates.length === 0) {
    // Try all strings as fallback
    const allCandidates = ALL_STRINGS
      .filter(s => !usedStrings || !usedStrings.has(s))
      .map(s => ({ string: s, fret: midi - STANDARD_TUNING_OPEN_MIDI[s] }))
      .filter(c => c.fret >= 0 && c.fret <= MAX_FRET);
    if (allCandidates.length === 0) return null;
    return allCandidates.sort((a, b) => a.fret - b.fret)[0];
  }

  return candidates.sort((a, b) => a.fret - b.fret)[0];
}

/**
 * Regex that matches ABC note tokens (with optional accidentals, octave markers,
 * and duration suffixes) but NOT already-decorated tokens that start with `!`.
 *
 * Groups:
 *   1: accidental (^, _, =, ^^, __)
 *   2: note letter (A-G or a-g)
 *   3: octave markers (, or ')
 *   4: duration suffix (digits, /, etc.)
 */
const ABC_NOTE_IN_CHORD_REGEX = /([_^=]{0,2})([A-Ga-g])([,']*)([\d]*(?:\/[\d]*)?)/g;

/**
 * Add string-forcing to a single note token.
 * Returns the token with `!N!` prepended if it doesn't already have one.
 */
function addStringForcingToNote(
  noteToken: string,
  keyAccidentals: AbcKeyAccidentalMap,
  preferredStrings: GuitarPlayabilityStringNumber[],
  usedStrings: Set<GuitarPlayabilityStringNumber>
): string {
  if (hasStringForcing(noteToken)) return noteToken;

  // Parse just the pitch part (without duration)
  const pitchMatch = noteToken.match(/^([_^=]{0,2}[A-Ga-g][,']*)/);
  if (!pitchMatch) return noteToken;

  const pitchToken = pitchMatch[1];
  const rest = noteToken.slice(pitchToken.length);

  const midi = abcNoteToMidiWithKey(pitchToken, keyAccidentals);
  if (midi === null) return noteToken;

  // For treble-8 clef, ABCJS applies clefTranspose = -12 BEFORE fret calculation.
  // The MIDI we computed is the "written" pitch. ABCJS will subtract 12 from it
  // to get the sounding pitch, then compare against the un-transposed tuning.
  // So we need to route (midi - 12) against the standard tuning.
  const soundingMidi = midi - 12;
  const route = routeMidiToString(soundingMidi, preferredStrings, usedStrings);
  if (!route) return noteToken;

  usedStrings.add(route.string);
  return `!${route.string}!${pitchToken}${rest}`;
}

/**
 * Process a chord group `[...]` — each note inside gets string-forcing.
 * Notes that look like bass (lower pitch) prefer bass strings; treble prefer treble.
 */
function addStringForcingToChord(
  chordContent: string,
  keyAccidentals: AbcKeyAccidentalMap
): string {
  // Parse individual notes inside the chord
  const notes: Array<{ full: string; pitchToken: string; midi: number | null; index: number }> = [];
  let match: RegExpExecArray | null;
  const regex = /([_^=]{0,2})([A-Ga-g])([,']*)([\d]*(?:\/[\d]*)?)/g;

  while ((match = regex.exec(chordContent)) !== null) {
    const pitchToken = `${match[1]}${match[2]}${match[3]}`;
    const midi = abcNoteToMidiWithKey(pitchToken, keyAccidentals);
    notes.push({
      full: match[0],
      pitchToken,
      midi,
      index: match.index,
    });
  }

  if (notes.length === 0) return chordContent;

  // Sort by MIDI (lowest first) to assign bass strings to low notes
  const sorted = [...notes].sort((a, b) => (a.midi ?? 0) - (b.midi ?? 0));
  const usedStrings = new Set<GuitarPlayabilityStringNumber>();
  const assignments = new Map<number, GuitarPlayabilityStringNumber>();

  for (const note of sorted) {
    if (note.midi === null) continue;
    const soundingMidi = note.midi - 12;
    // Low notes prefer bass strings, high notes prefer treble
    const preferred = soundingMidi < STANDARD_TUNING_OPEN_MIDI[3]
      ? BASS_STRINGS
      : TREBLE_STRINGS;
    const route = routeMidiToString(soundingMidi, preferred, usedStrings);
    if (route) {
      usedStrings.add(route.string);
      assignments.set(note.index, route.string);
    }
  }

  // Rebuild the chord content with !N! prepended to each note
  let result = "";
  let lastEnd = 0;
  // Re-run regex to rebuild in original order
  regex.lastIndex = 0;
  while ((match = regex.exec(chordContent)) !== null) {
    result += chordContent.slice(lastEnd, match.index);
    const stringNum = assignments.get(match.index);
    if (stringNum !== undefined) {
      result += `!${stringNum}!${match[0]}`;
    } else {
      result += match[0];
    }
    lastEnd = match.index + match[0].length;
  }
  result += chordContent.slice(lastEnd);

  return result;
}

/**
 * Process a single line of Guitar voice ABC to add string-forcing decorations.
 *
 * Handles:
 * - Single notes: `e/2` → `!1!e/2`
 * - Chords: `[eBGE,]/2` → `[!1!e!2!B!3!G!6!E,]/2`
 * - Already-decorated notes: `!1!e` → left unchanged
 * - Rests, chord symbols, annotations: left unchanged
 */
export function processGuitarLine(line: string, keyAccidentals: AbcKeyAccidentalMap): string {
  // Match chord groups and individual notes/rests/decorations
  // This regex captures (in priority order):
  //   1. Quoted strings: "Em", "D7", "Am7/G" — chord symbols, pass through unchanged
  //   2. Chord groups: [...]  (with optional duration suffix after)
  //   3. Already-decorated notes: !N!...
  //   4. Bare notes: accidental + letter + octave + duration
  //   5. Everything else (rests, bar lines, etc.) falls through to the gap text
  const TOKEN_REGEX = /("[^"]*")|(\[[^\]]+\])([\d]*(?:\/[\d]*)?)|(![1-6]![_^=]{0,2}[A-Ga-g][,']*[\d]*(?:\/[\d]*)?)|([_^=]{0,2}[A-Ga-g][,']*)([\d]*(?:\/[\d]*)?)/g;

  let result = "";
  let lastEnd = 0;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = TOKEN_REGEX.exec(line)) !== null) {
    // Append any text between the last match and this one (bar lines, spaces, rests, etc.)
    result += line.slice(lastEnd, tokenMatch.index);

    if (tokenMatch[1]) {
      // Quoted string (chord symbol like "Em", "D7") — pass through unchanged
      result += tokenMatch[1];
    } else if (tokenMatch[2]) {
      // Chord group: [notes]duration
      const chordInner = tokenMatch[2].slice(1, -1); // Remove [ and ]
      const duration = tokenMatch[3] || "";

      // Check if all notes already have string-forcing
      if (/![1-6]!/.test(chordInner)) {
        // Already has some string-forcing, leave as-is
        result += tokenMatch[2] + (tokenMatch[3] || "");
      } else {
        const processed = addStringForcingToChord(chordInner, keyAccidentals);
        result += `[${processed}]${duration}`;
      }
    } else if (tokenMatch[4]) {
      // Already-decorated note: !N!...
      result += tokenMatch[4];
    } else if (tokenMatch[5]) {
      // Bare note: needs string-forcing
      const noteToken = tokenMatch[5];
      const duration = tokenMatch[6] || "";
      const usedStrings = new Set<GuitarPlayabilityStringNumber>();
      const processed = addStringForcingToNote(
        noteToken + duration,
        keyAccidentals,
        ALL_STRINGS,
        usedStrings
      );
      result += processed;
    } else {
      result += tokenMatch[0];
    }

    lastEnd = tokenMatch.index + tokenMatch[0].length;
  }

  // Append any remaining text
  result += line.slice(lastEnd);
  return result;
}

/**
 * Ensure all notes in Guitar voice sections of an ABC string have `!N!`
 * string-forcing decorations for correct ABCJS tablature rendering.
 *
 * This is a post-processing safety net. It:
 * 1. Identifies Guitar voice sections (via `V:Guitar` or `[V:Guitar]`)
 * 2. Parses each note token and computes its MIDI pitch
 * 3. Routes the pitch to the best guitar string
 * 4. Prepends `!N!` decoration if not already present
 *
 * Notes that already have `!N!` decorations are left unchanged, so this
 * function is safe to call on ABC that was already processed by the
 * time-slice pipeline.
 *
 * @param abcString - Full ABC string (may contain multiple voices)
 * @returns The ABC string with string-forcing applied to Guitar voices
 */
export function ensureGuitarStringForcing(abcString: string): string {
  // Quick check: if there's no Guitar voice, return as-is
  if (!/V:Guitar\b/i.test(abcString)) return abcString;

  // Quick check: if all Guitar notes already have !N! decorations, return as-is
  // (This handles the common case where the time-slice pipeline already processed it)
  const guitarLines = extractGuitarVoiceLines(abcString);
  if (guitarLines.length === 0) return abcString;

  const hasAnyBareNotes = guitarLines.some(line =>
    hasUnforcedNotes(line)
  );
  if (!hasAnyBareNotes) return abcString;

  const keyAccidentals = getKeyAccidentalsFromAbc(abcString);
  const lines = abcString.split(/\r?\n/);
  const result: string[] = [];

  let inGuitarVoice = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track voice context
    if (trimmed.startsWith("V:")) {
      const voiceId = trimmed.substring(2).split(/\s/)[0];
      inGuitarVoice = /^Guitar\b/i.test(voiceId);
      result.push(line);
      continue;
    }

    // Inline voice: [V:Guitar] content — process Guitar notes
    const inlineGuitarMatch = trimmed.match(/^(\[V:Guitar[^\]]*\])\s*(.*)/i);
    if (inlineGuitarMatch) {
      inGuitarVoice = true;
      const voiceTag = inlineGuitarMatch[1];
      const content = inlineGuitarMatch[2];
      if (content && hasUnforcedNotes(content)) {
        result.push(`${voiceTag} ${processGuitarLine(content, keyAccidentals)}`);
      } else {
        result.push(line);
      }
      continue;
    }

    // Inline voice: [V:SomeOtherVoice] — NOT Guitar, skip processing
    const inlineOtherMatch = trimmed.match(/^\[V:[^\]]+\]/);
    if (inlineOtherMatch) {
      inGuitarVoice = false;
      result.push(line);
      continue;
    }

    // Skip header lines, comments, lyrics
    if (/^[A-Za-z]:/.test(trimmed) || trimmed.startsWith("%") || trimmed.startsWith("w:") || !trimmed) {
      result.push(line);
      continue;
    }

    // If we're in a Guitar voice section, process the music line
    if (inGuitarVoice && hasUnforcedNotes(trimmed)) {
      result.push(processGuitarLine(line, keyAccidentals));
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Extract lines that belong to Guitar voice sections.
 */
function extractGuitarVoiceLines(abcString: string): string[] {
  const lines = abcString.split(/\r?\n/);
  const guitarLines: string[] = [];
  let inGuitarVoice = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("V:")) {
      const voiceId = trimmed.substring(2).split(/\s/)[0];
      inGuitarVoice = /^Guitar\b/i.test(voiceId);
      continue;
    }

    const inlineMatch = trimmed.match(/^\[V:Guitar[^\]]*\]\s*(.*)/i);
    if (inlineMatch) {
      inGuitarVoice = true;
      if (inlineMatch[1]) guitarLines.push(inlineMatch[1]);
      continue;
    }

    // Non-Guitar inline voice — reset context
    if (/^\[V:[^\]]+\]/.test(trimmed)) {
      inGuitarVoice = false;
      continue;
    }

    if (inGuitarVoice && !trimmed.startsWith("%") && !trimmed.startsWith("w:") && !/^[A-Za-z]:/.test(trimmed) && trimmed) {
      guitarLines.push(trimmed);
    }
  }

  return guitarLines;
}

/**
 * Check if a line of music ABC has notes without !N! string-forcing.
 * A "bare note" is any [A-Ga-g] not preceded by `!N!`.
 */
function hasUnforcedNotes(line: string): boolean {
  // Remove already-forced notes from consideration
  const withoutForced = line.replace(/![1-6]![_^=]{0,2}[A-Ga-g][,']*[\d]*(?:\/[\d]*)*/g, "");
  // Check if any bare notes remain (excluding chord symbols, rests, etc.)
  // Chord symbols are in double quotes: "Am", "D7", etc.
  const withoutChordSymbols = withoutForced.replace(/"[^"]*"/g, "");
  return /[_^=]{0,2}[A-Ga-g][,']*/.test(withoutChordSymbols);
}

function wrapForcedSingleNotesInLine(line: string): string {
  let result = "";
  let chordDepth = 0;

  for (let index = 0; index < line.length;) {
    const char = line[index];
    if (char === "[") {
      chordDepth += 1;
      result += char;
      index += 1;
      continue;
    }
    if (char === "]") {
      chordDepth = Math.max(0, chordDepth - 1);
      result += char;
      index += 1;
      continue;
    }

    const decoration = chordDepth === 0 ? line.slice(index).match(/^![1-6]!/)?.[0] : undefined;
    if (decoration) {
      const note = line.slice(index + decoration.length).match(/^[_^=]{0,2}[A-Ga-g][,']*/)?.[0];
      if (note) {
        result += `[${decoration}${note}]`;
        index += decoration.length + note.length;
        continue;
      }
    }

    result += char;
    index += 1;
  }

  return result;
}

/**
 * Work around abcjs attaching decorations on bare single notes to the note event
 * instead of its pitch. The tablature adapter reads pitch decorations, so forced
 * single notes must be represented as one-note chords at the render boundary.
 */
export function prepareGuitarStringForcingForAbcjs(abcString: string): string {
  if (!/V:Guitar\b/i.test(abcString)) return abcString;

  const lines = abcString.split(/\r?\n/);
  const result: string[] = [];
  let inGuitarVoice = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("V:")) {
      const voiceId = trimmed.substring(2).split(/\s/)[0];
      inGuitarVoice = /^Guitar\b/i.test(voiceId);
      result.push(line);
      continue;
    }

    const inlineGuitarMatch = trimmed.match(/^(\[V:Guitar[^\]]*\])\s*(.*)/i);
    if (inlineGuitarMatch) {
      inGuitarVoice = true;
      result.push(`${inlineGuitarMatch[1]} ${wrapForcedSingleNotesInLine(inlineGuitarMatch[2])}`);
      continue;
    }

    if (/^\[V:[^\]]+\]/.test(trimmed)) {
      inGuitarVoice = false;
      result.push(line);
      continue;
    }

    if (inGuitarVoice && !/^[A-Za-z]:/.test(trimmed) && !trimmed.startsWith("%") && !trimmed.startsWith("w:") && trimmed) {
      result.push(wrapForcedSingleNotesInLine(line));
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Remove all `!N!` string-forcing decorations from Guitar voices.
 * This ensures that standard staff rendering does not interpret them
 * as left-hand fingering numbers.
 */
export function stripGuitarStringForcing(abcString: string): string {
  if (!/V:Guitar\b/i.test(abcString)) return abcString;

  const lines = abcString.split(/\r?\n/);
  const result: string[] = [];
  let inGuitarVoice = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("V:")) {
      const voiceId = trimmed.substring(2).split(/\s/)[0];
      inGuitarVoice = /^Guitar\b/i.test(voiceId);
      result.push(line);
      continue;
    }

    const inlineMatch = trimmed.match(/^(\[V:Guitar[^\]]*\])\s*(.*)/i);
    if (inlineMatch) {
      inGuitarVoice = true;
      result.push(`${inlineMatch[1]} ${inlineMatch[2].replace(/![1-6]!/g, "")}`);
      continue;
    }

    if (/^\[V:[^\]]+\]/.test(trimmed)) {
      inGuitarVoice = false;
      result.push(line);
      continue;
    }

    if (inGuitarVoice && !/^[A-Za-z]:/.test(trimmed) && !trimmed.startsWith("%") && !trimmed.startsWith("w:") && trimmed) {
      result.push(line.replace(/![1-6]!/g, ""));
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}
