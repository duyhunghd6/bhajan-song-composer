import { buildAbcDurationContext, stripAbcChordSymbols, cleanAbcMeasureSegment, formatAbcDuration, AbcDurationContext, measureDurationUnits, AbcBarlineInfo, EMPTY_BARLINE_INFO, extractBarlineInfo, joinAbcMeasuresWithBarlines } from "../abc-duration";
import { parseNoteDuration } from "../melody-analyzer";
import { scientificPitchForStringFret } from "../guitar-playability";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import { getKeyAccidentalsFromAbc, abcNoteToMidiWithKey, type AbcKeyAccidentalMap } from "../abc-key-signature";

export interface TimeSliceMelodyEvent {
  kind: "note" | "rest";
  token: string;
  durationUnits: number;
  onsetUnits: number;
}

export interface TokenWithTie {
  token: string;
  durationUnits: number;
  hasTie: boolean;
}

export interface TimeSliceStep {
  step: number;
  beat: number;
  chord: string;
  melody: {
    pitch: string | null;
    state: "attack" | "sustain" | "rest";
  };
  lyric: string | null;
  weight: "⬤" | "●" | "*" | null;
}

export interface TimeSliceGridStep {
  step: number;
  chord: string;
  weight: "⬤" | "●" | "*" | null;
  melody: {
    pitch: string | null;
    state: "attack" | "sustain" | "rest";
  };
  lyric: string | null;
  tablature?: {
    string: GuitarStringNumber;
    fret: number;
    finger: "p" | "i" | "m" | "a" | null;
    role: "bass" | "melody" | "fill" | "root" | "fifth";
  }[];
}

export interface TimeSliceMeasure {
  measure: number;
  /** 0-based index of the ABC source line this measure belongs to. */
  lineIndex: number;
  style_profile: {
    key: string;
    comping_style: string;
    voicing_plan: string;
    fill_density?: string;
  };
  grid: TimeSliceGridStep[];
  /** If this measure is a pickup (anacrusis), the actual duration in ABC units.
   *  Undefined or 0 means it is a normal full measure. */
  pickupDurationUnits?: number;
  /** Repeat barline metadata (|:, :|, volta brackets) from the source ABC. */
  barline?: AbcBarlineInfo;
  visualTablature?: string;
  source_abc?: {
    melody: string;
    lyric: string;
    beatWeight: string;
  };
}

const STRONG_BEAT_LYRIC_CONTENT_PATTERN = /^[\s|*⬤●•·]+$/;

export function isStrongBeatLyricLine(line: string): boolean {
  const trimmed = line.trim();
  if (!/^w:\s*/.test(trimmed)) return false;

  const content = trimmed
    .replace(/^w:\s*/, "")
    .replace(/\s*%.*$/, "")
    .trim();

  return content.length > 0 && STRONG_BEAT_LYRIC_CONTENT_PATTERN.test(content);
}

export function getMetricWeight(beat: number, timeSignature: string): "⬤" | "●" | "*" | null {
  const normTime = timeSignature.trim();
  if (normTime === "4/4" || normTime === "C") {
    if (beat === 1.0) return "⬤";
    if (beat === 3.0) return "●";
    if (beat === 2.0 || beat === 4.0) return "*";
  } else if (normTime === "3/4") {
    if (beat === 1.0) return "⬤";
    if (beat === 2.0 || beat === 3.0) return "*";
  }
  return null;
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
 * Convert an ABC note token to MIDI number, applying key signature accidentals
 * when no explicit accidental is present on the note.
 */
export function abcNoteToMidi(note: string, keyAccidentals?: AbcKeyAccidentalMap): number | null {
  return abcNoteToMidiWithKey(note, keyAccidentals);
}

export function midiToScientificPitch(midi: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = notes[midi % 12];
  return `${noteName}${octave}`;
}

export function getLyricSyllablesForMeasure(lyricMeasureStr: string): string[] {
  const trimmed = lyricMeasureStr.trim();
  if (!trimmed) return [];

  // Split the measure by whitespace into word tokens
  const words = trimmed.split(/\s+/);
  const syllables: string[] = [];

  for (const word of words) {
    if (word === "_" || word === "*") {
      syllables.push(word);
      continue;
    }

    // Split by hyphens but keep hyphens on all parts except the last
    const parts = word.split("-");
    const effectiveLength = (parts.length > 1 && parts[parts.length - 1] === "") ? parts.length - 1 : parts.length;
    for (let i = 0; i < effectiveLength; i++) {
      const part = parts[i];
      if (i < parts.length - 1 || word.endsWith("-")) {
        syllables.push(part + "-");
      } else {
        syllables.push(part);
      }
    }
  }

  return syllables;
}

export function extractDurationTokensWithTies(abcMeasure: string): TokenWithTie[] {
  const cleanMeasure = stripAbcChordSymbols(cleanAbcMeasureSegment(abcMeasure));
  const tokens: TokenWithTie[] = [];
  let match: RegExpExecArray | null;

  const ABC_EVENT_REGEX = /(\[[^\]]+\]|[_^=]?[A-Ga-g][,']*|[zx])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g;
  ABC_EVENT_REGEX.lastIndex = 0;

  while ((match = ABC_EVENT_REGEX.exec(cleanMeasure)) !== null) {
    const tokenStr = match[0];
    const durationSuffix = match[2] ?? "";

    // Check if the next non-whitespace character in cleanMeasure is '-'
    let nextCharIndex = ABC_EVENT_REGEX.lastIndex;
    let hasTie = false;
    while (nextCharIndex < cleanMeasure.length) {
      const char = cleanMeasure[nextCharIndex];
      if (char === "-") {
        hasTie = true;
        break;
      } else if (/\s/.test(char)) {
        nextCharIndex++;
      } else {
        break;
      }
    }

    tokens.push({
      token: tokenStr,
      durationUnits: parseNoteDuration(durationSuffix),
      hasTie,
    });
  }

  return tokens;
}

export function extractMelodyMeasureTimelineWithTies(abcMeasureStr: string): TimeSliceMelodyEvent[] {
  const tokens = extractDurationTokensWithTies(abcMeasureStr);

  // Merge ties
  const mergedTokens: Array<{ token: string; durationUnits: number; kind: "note" | "rest" }> = [];
  let currentToken: TokenWithTie | null = null;
  let accumulatedDuration = 0;

  for (const token of tokens) {
    if (currentToken === null) {
      currentToken = token;
      accumulatedDuration = token.durationUnits;
    } else {
      const prevKind = /^[zx]/.test(currentToken.token) ? "rest" : "note";
      const currentKind = /^[zx]/.test(token.token) ? "rest" : "note";
      if (currentToken.hasTie && prevKind === "note" && currentKind === "note") {
        accumulatedDuration += token.durationUnits;
        currentToken = {
          token: currentToken.token,
          hasTie: token.hasTie,
          durationUnits: accumulatedDuration,
        };
      } else {
        mergedTokens.push({
          token: currentToken.token,
          durationUnits: currentToken.durationUnits,
          kind: prevKind,
        });
        currentToken = token;
        accumulatedDuration = token.durationUnits;
      }
    }
  }

  if (currentToken !== null) {
    const prevKind = /^[zx]/.test(currentToken.token) ? "rest" : "note";
    mergedTokens.push({
      token: currentToken.token,
      durationUnits: currentToken.durationUnits,
      kind: prevKind,
    });
  }

  // Calculate onsets
  let onsetUnits = 0;
  return mergedTokens.map((item) => {
    const event: TimeSliceMelodyEvent = {
      kind: item.kind,
      token: item.token,
      durationUnits: item.durationUnits,
      onsetUnits,
    };
    onsetUnits += item.durationUnits;
    return event;
  });
}

export function extractChordsFromMeasure(abcMeasure: string): { chord: string; onsetUnits: number }[] {
  const cleanMeasure = cleanAbcMeasureSegment(abcMeasure);
  const chords: { chord: string; onsetUnits: number }[] = [];
  let currentOnset = 0;

  const regex = /"([^"]+)"|(\[[^\]]+\]|[_^=]?[A-Ga-g][,']*|[zx])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleanMeasure)) !== null) {
    if (match[1]) {
      const chordName = match[1];
      chords.push({ chord: chordName, onsetUnits: currentOnset });
    } else {
      const durationSuffix = match[3] ?? "";
      const parsed = parseNoteDuration(durationSuffix);
      currentOnset += parsed;
    }
  }

  return chords;
}

export function convertAbcToTimeSliceGrid(
  abcString: string,
  chords: string[],
  options?: {
    key?: string;
    comping_style?: string;
    voicing_plan?: string;
    fill_density?: string;
  }
): TimeSliceMeasure[] {
  const durationContext = buildAbcDurationContext(abcString);
  const keyAccidentals = getKeyAccidentalsFromAbc(abcString);
  const { unitsPerBeat, meter } = durationContext;
  const stepsPerBeat = 4;
  const stepsPerMeasure = meter.numerator * stepsPerBeat; // 16 for 4/4

  // Extract melody lines and matching lyrics / beat weights
  const lines = abcString.split(/\r?\n/);
  let activeVoiceIsMelody = true;
  const melodySegmentMeasures: string[][] = [];
  const melodySegmentBarlines: AbcBarlineInfo[][] = [];
  const lyricSegmentMeasures: string[][] = [];
  const beatWeightSegmentMeasures: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("%")) continue;

    if (line.startsWith("V:")) {
      const voiceId = line.substring(2).split(/\s/)[0];
      activeVoiceIsMelody = (voiceId === "Melody");
      continue;
    }

    const inlineMatch = line.match(/^\[V:([^\]]+)\](.*)/);
    if (inlineMatch) {
      const voiceId = inlineMatch[1].trim();
      const content = inlineMatch[2].trim();
      if (voiceId === "Melody") {
        const rawSplits = content.split("|");
        const measures: string[] = [];
        const segBarlines: AbcBarlineInfo[] = [];
        for (const raw of rawSplits) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          measures.push(trimmed);
          segBarlines.push(extractBarlineInfo(raw));
        }
        melodySegmentMeasures.push(measures);
        melodySegmentBarlines.push(segBarlines);

        const lyricsForThisLine: string[][] = [];
        const beatWeightsForThisLine: string[][] = [];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith("w:")) {
            const isBeatLine = isStrongBeatLyricLine(nextLine);
            const lyricContent = nextLine.substring(2).trim();
            const lyricMeasures = lyricContent.split("|").map((m) => m.trim());
            if (isBeatLine) {
              beatWeightsForThisLine.push(lyricMeasures);
            } else {
              lyricsForThisLine.push(lyricMeasures);
            }
            j++;
          } else if (nextLine.startsWith("%") || !nextLine) {
            j++;
          } else {
            break;
          }
        }
        if (lyricsForThisLine.length > 0) {
          lyricSegmentMeasures.push(lyricsForThisLine[0]);
        } else {
          lyricSegmentMeasures.push([]);
        }
        if (beatWeightsForThisLine.length > 0) {
          beatWeightSegmentMeasures.push(beatWeightsForThisLine[0]);
        } else {
          beatWeightSegmentMeasures.push([]);
        }
      }
      continue;
    }

    if (/^[A-Za-z]:/.test(line)) {
      continue;
    }

    if (activeVoiceIsMelody) {
      const rawSplits = line.split("|");
      const measures: string[] = [];
      const segBarlines: AbcBarlineInfo[] = [];
      for (const raw of rawSplits) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        measures.push(trimmed);
        segBarlines.push(extractBarlineInfo(raw));
      }
      melodySegmentMeasures.push(measures);
      melodySegmentBarlines.push(segBarlines);

      const lyricsForThisLine: string[][] = [];
      const beatWeightsForThisLine: string[][] = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith("w:")) {
          const isBeatLine = isStrongBeatLyricLine(nextLine);
          const lyricContent = nextLine.substring(2).trim();
          const lyricMeasures = lyricContent.split("|").map((m) => m.trim());
          if (isBeatLine) {
            beatWeightsForThisLine.push(lyricMeasures);
          } else {
            lyricsForThisLine.push(lyricMeasures);
          }
          j++;
        } else if (nextLine.startsWith("%") || !nextLine) {
          j++;
        } else {
          break;
        }
      }
      if (lyricsForThisLine.length > 0) {
        lyricSegmentMeasures.push(lyricsForThisLine[0]);
      } else {
        lyricSegmentMeasures.push([]);
      }
      if (beatWeightsForThisLine.length > 0) {
        beatWeightSegmentMeasures.push(beatWeightsForThisLine[0]);
      } else {
        beatWeightSegmentMeasures.push([]);
      }
    }
  }

  const finalMelodyMeasures: string[] = [];
  const finalLyricMeasures: string[] = [];
  const finalBeatWeightMeasures: string[] = [];
  const finalLineIndices: number[] = [];
  const finalBarlines: AbcBarlineInfo[] = [];
  let measureCounter = 0;
  for (let k = 0; k < melodySegmentMeasures.length; k++) {
    const melodyMeasures = melodySegmentMeasures[k];
    const melBarlines = melodySegmentBarlines[k] || [];
    const lyricMeasures = lyricSegmentMeasures[k] || [];
    const beatWeightMeasures = beatWeightSegmentMeasures[k] || [];
    for (let m = 0; m < melodyMeasures.length; m++) {
      finalMelodyMeasures[measureCounter] = melodyMeasures[m];
      finalLyricMeasures[measureCounter] = lyricMeasures[m] || "";
      finalBeatWeightMeasures[measureCounter] = beatWeightMeasures[m] || "";
      finalLineIndices[measureCounter] = k;
      finalBarlines[measureCounter] = melBarlines[m] || EMPTY_BARLINE_INFO;
      measureCounter++;
    }
  }

  const totalMeasures = finalMelodyMeasures.length;
  const measuresList: TimeSliceMeasure[] = [];

  const keyLine = abcString.split(/\r?\n/).find(line => line.trim().startsWith("K:"));
  const key = keyLine ? keyLine.substring(2).trim().split(/\s/)[0] : "Em";

  for (let measureIndex = 0; measureIndex < totalMeasures; measureIndex++) {
    const measureStr = finalMelodyMeasures[measureIndex];
    const lyricStr = finalLyricMeasures[measureIndex];
    const beatWeightStr = finalBeatWeightMeasures[measureIndex];
    const defaultChord = chords[measureIndex] || chords[chords.length - 1] || "C";
    const measureChords = extractChordsFromMeasure(measureStr);

    const getChordAtStep = (stepIdx: number): string => {
      const stepOnset = stepIdx * (unitsPerBeat / stepsPerBeat);
      let activeChord = defaultChord;
      for (const mc of measureChords) {
        if (mc.onsetUnits <= stepOnset) {
          activeChord = mc.chord;
        }
      }
      return activeChord;
    };

    // Syllables
    const syllables = getLyricSyllablesForMeasure(lyricStr);
    let syllableCursor = 0;

    // Beat weights
    const weightTokens = getLyricSyllablesForMeasure(beatWeightStr);
    let weightCursor = 0;

    // Initialize quantized steps for this measure (always 16 for 4/4).
    // Pickup measures keep all 16 steps; melody events fill their onset
    // positions and the remaining steps stay as rests. The LLM prompt
    // directs the AI to respect the pickup and only fill active steps.
    const measureGrid = Array.from({ length: stepsPerMeasure }, (_, i) => {
      const stepNum = i + 1;
      const beat = 1.00 + i * 0.25;
      return {
        step: stepNum,
        beat: parseFloat(beat.toFixed(2)),
        chord: getChordAtStep(i),
        melody: {
          pitch: null as string | null,
          state: "rest" as "attack" | "sustain" | "rest",
        },
        lyric: null as string | null,
        weight: null as "⬤" | "●" | "*" | null,
      };
    });

    // Extract note events with ties merged
    const events = extractMelodyMeasureTimelineWithTies(measureStr);

    for (const event of events) {
      const startIndex = Math.round((event.onsetUnits / unitsPerBeat) * stepsPerBeat);
      const span = Math.round((event.durationUnits / unitsPerBeat) * stepsPerBeat);

      if (startIndex < 0 || startIndex >= stepsPerMeasure) continue;

      if (event.kind === "note") {
        const midi = abcNoteToMidi(event.token, keyAccidentals);
        const pitch = midi !== null ? midiToScientificPitch(midi) : null;

        // Attack step
        measureGrid[startIndex].melody.pitch = pitch;
        measureGrid[startIndex].melody.state = "attack";

        // Lyric syllable mapping
        const syllable = syllables[syllableCursor];
        if (syllable !== undefined) {
          syllableCursor++;
          measureGrid[startIndex].lyric = syllable;
        }

        // Beat weight mapping
        const weightToken = weightTokens[weightCursor];
        if (weightToken !== undefined) {
          weightCursor++;
          if (weightToken === "⬤") {
            measureGrid[startIndex].weight = "⬤";
          } else if (weightToken === "●") {
            measureGrid[startIndex].weight = "●";
          } else if (weightToken === "•" || weightToken === "*") {
            measureGrid[startIndex].weight = "*";
          }
        } else {
          const timeSig = meter.numerator + "/" + meter.denominator;
          measureGrid[startIndex].weight = getMetricWeight(measureGrid[startIndex].beat, timeSig);
        }

        // Sustain steps
        const endOfSpan = Math.min(startIndex + span, stepsPerMeasure);
        for (let s = startIndex + 1; s < endOfSpan; s++) {
          measureGrid[s].melody.pitch = pitch;
          measureGrid[s].melody.state = "sustain";
        }
      } else {
        // Rest event
        const endOfRest = Math.min(startIndex + span, stepsPerMeasure);
        for (let s = startIndex; s < endOfRest; s++) {
          measureGrid[s].melody.pitch = null;
          measureGrid[s].melody.state = "rest";
        }
      }
    }

    const finalGrid: TimeSliceGridStep[] = measureGrid.map(item => ({
      step: item.step,
      chord: item.chord,
      weight: item.weight,
      melody: {
        pitch: item.melody.pitch,
        state: item.melody.state,
      },
      lyric: item.lyric,
      // Initially, no tablature events are present
      tablature: undefined,
    }));

    // Detect pickup: if the melody for this measure is shorter than a full measure,
    // record the actual duration so the LLM prompt and ABC converter can respect it.
    const actualMelodyUnits = measureDurationUnits(measureStr);
    const isPickup = actualMelodyUnits > 0 && actualMelodyUnits < durationContext.fullMeasureUnits;

    const bi = finalBarlines[measureIndex];
    const hasBarline = bi && (bi.repeatStart || bi.repeatEnd || bi.volta !== null);

    measuresList.push({
      measure: measureIndex + 1,
      lineIndex: finalLineIndices[measureIndex] ?? 0,
      style_profile: {
        key: options?.key || key,
        comping_style: options?.comping_style || "PIMA devotional fingerstyle. Sparse fills.",
        voicing_plan: options?.voicing_plan || `Open-position ${options?.key || key} and D shapes. Thumbed E/B and D/A anchors.`,
        fill_density: options?.fill_density || "few",
      },
      grid: finalGrid,
      pickupDurationUnits: isPickup ? actualMelodyUnits : undefined,
      barline: hasBarline ? bi : undefined,
      source_abc: {
        melody: measureStr,
        lyric: lyricStr,
        beatWeight: beatWeightStr,
      }
    });
  }

  return measuresList;
}

/**
 * Convert scientific pitch (e.g. "F4", "F#4") to ABC notation token.
 *
 * When keyAccidentals is provided, the function emits explicit accidentals
 * to prevent ABCJS from misinterpreting the note due to the key signature.
 * For example, F4 in K:Em would be output as =f (explicit natural) because
 * K:Em makes bare f mean F#.
 */
function scientificPitchToAbc(scientificPitch: string, keyAccidentals?: AbcKeyAccidentalMap): string {
  const match = scientificPitch.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return scientificPitch;
  const [, letter, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  
  // ABCJS noteToMidi convention (matches standard ABC 2.1):
  //   C,, = octave 1  |  C, = octave 2  |  C = octave 3
  //   c   = octave 4  |  c' = octave 5  |  c'' = octave 6
  //
  // For guitar with clef=treble-8, ABCJS applies clefTranspose = -12 to the
  // note pitch BEFORE comparing against the tuning stringPitches (which are
  // NOT transposed). This means concert-pitch ABC tokens produce the correct
  // frets without any additional octave adjustment.
  let abcAccidental: string;
  if (accidental === "#") {
    // Check if key signature already implies this sharp — if so, bare note is fine
    const keyAcc = keyAccidentals?.get(letter);
    if (keyAcc === "^") {
      abcAccidental = ""; // Key already makes this letter sharp, no need for explicit ^
    } else {
      abcAccidental = "^";
    }
  } else if (accidental === "b") {
    const keyAcc = keyAccidentals?.get(letter);
    if (keyAcc === "_") {
      abcAccidental = ""; // Key already makes this letter flat
    } else {
      abcAccidental = "_";
    }
  } else {
    // No accidental in the scientific pitch — but key signature might imply one.
    // If the key says this letter is sharp/flat, we must use = (natural) to override.
    const keyAcc = keyAccidentals?.get(letter);
    if (keyAcc) {
      abcAccidental = "="; // Explicit natural to override key signature
    } else {
      abcAccidental = "";
    }
  }

  let abcLetter = letter;
  
  if (octave >= 4) {
    abcLetter = abcLetter.toLowerCase();
    const ticks = octave - 4;
    abcLetter += "'".repeat(ticks);
  } else if (octave === 3) {
    // Standard uppercase
  } else {
    const commas = 3 - octave;
    abcLetter += ",".repeat(commas);
  }
  return abcAccidental + abcLetter;
}

export function convertTimeSliceMeasureToAbc(
  measure: TimeSliceMeasure,
  durationContext: AbcDurationContext,
  keyAccidentals?: AbcKeyAccidentalMap
): string {
  const { unitsPerBeat } = durationContext;
  const stepsPerBeat = 4;
  const stepDurationUnits = unitsPerBeat / stepsPerBeat;

  // For pickup measures, cap the total output duration to the actual melody duration.
  // The grid is always 16 steps, but a pickup only occupies the first N steps.
  const maxOutputUnits = measure.pickupDurationUnits && measure.pickupDurationUnits > 0
    ? measure.pickupDurationUnits
    : undefined;

  const rendered: string[] = [];
  
  let currentRestSteps = 0;
  let totalEmittedUnits = 0;

  for (let i = 0; i < measure.grid.length; i++) {
    // Stop if we've emitted enough for a pickup measure
    if (maxOutputUnits !== undefined && totalEmittedUnits >= maxOutputUnits) break;

    const step = measure.grid[i];
    const isAttack = step.tablature && step.tablature.length > 0;

    if (isAttack) {
      // If we accumulated rests before this attack, output them
      if (currentRestSteps > 0) {
        let restUnits = currentRestSteps * stepDurationUnits;
        if (maxOutputUnits !== undefined) {
          restUnits = Math.min(restUnits, maxOutputUnits - totalEmittedUnits);
        }
        if (restUnits > 0) {
          rendered.push(`z${formatAbcDuration(restUnits)}`);
          totalEmittedUnits += restUnits;
        }
        currentRestSteps = 0;
      }

      // Stop if emitting the rest already filled the pickup
      if (maxOutputUnits !== undefined && totalEmittedUnits >= maxOutputUnits) break;

      // Calculate how long this attack holds
      let durationSteps = 1;
      for (let j = i + 1; j < measure.grid.length; j++) {
        if (measure.grid[j].tablature && measure.grid[j].tablature!.length > 0) {
          break; // Next attack interrupts
        }
        durationSteps++;
      }

      let durationUnits = durationSteps * stepDurationUnits;
      // Cap to remaining pickup budget
      if (maxOutputUnits !== undefined) {
        durationUnits = Math.min(durationUnits, maxOutputUnits - totalEmittedUnits);
      }
      const suffix = formatAbcDuration(durationUnits);

      // Convert tablature notes to ABC with !N! string-forcing decorations.
      const soundingAbc = step.tablature!
        .sort((a, b) => a.string - b.string)
        .map(tab => {
          const pitch = scientificPitchForStringFret(tab.string, tab.fret);
          const abcToken = scientificPitchToAbc(pitch, keyAccidentals);
          return `!${tab.string}!${abcToken}`;
        });

      if (soundingAbc.length === 1) {
        rendered.push(`${soundingAbc[0]}${suffix}`);
      } else if (soundingAbc.length > 1) {
        rendered.push(`[${soundingAbc.join("")}]${suffix}`);
      }
      
      totalEmittedUnits += durationUnits;
      // Skip the sustained steps
      i += (durationSteps - 1);
    } else {
      currentRestSteps++;
    }
  }

  // If there are leftover rests at the end of the measure
  if (currentRestSteps > 0) {
    let restUnits = currentRestSteps * stepDurationUnits;
    if (maxOutputUnits !== undefined) {
      restUnits = Math.min(restUnits, Math.max(0, maxOutputUnits - totalEmittedUnits));
    }
    if (restUnits > 0) {
      rendered.push(`z${formatAbcDuration(restUnits)}`);
    }
  }

  return rendered.join(" ");
}

/**
 * Group measures by their lineIndex (ABC source line).
 * Returns an array of arrays, sorted by lineIndex.
 */
export function groupMeasuresByLine(measures: TimeSliceMeasure[]): TimeSliceMeasure[][] {
  const lines: Map<number, TimeSliceMeasure[]> = new Map();
  for (const m of measures) {
    if (!lines.has(m.lineIndex)) lines.set(m.lineIndex, []);
    lines.get(m.lineIndex)!.push(m);
  }
  return Array.from(lines.entries())
    .sort(([a], [b]) => a - b)
    .map(([, lineMeasures]) => lineMeasures);
}

/**
 * Join measure ABC strings with barlines, preserving repeat markers
 * (|: :| and [N volta brackets) from the TimeSliceMeasure barline metadata.
 */
export function joinMeasureAbcWithBarlines(
  abcMeasures: string[],
  measures: TimeSliceMeasure[]
): string {
  return joinAbcMeasuresWithBarlines(
    abcMeasures,
    measures.map((m) => m.barline ?? EMPTY_BARLINE_INFO)
  );
}
