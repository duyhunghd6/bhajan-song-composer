import { buildAbcDurationContext, stripAbcChordSymbols, cleanAbcMeasureSegment, type AbcDurationContext, measureDurationUnits, type AbcBarlineInfo, EMPTY_BARLINE_INFO, extractBarlineInfo, joinAbcMeasuresWithBarlines } from "../abc-duration";
import { parseNoteDuration } from "../melody-analyzer";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import { getKeyAccidentalsFromAbc, abcNoteToMidiWithKey, type AbcKeyAccidentalMap } from "../abc-key-signature";
import { renderTimeSliceMeasureToAbc } from "./time-slice-abc-renderer";

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
    role: "bass" | "melody" | "fill" | "harmony" | "root" | "fifth";
    /** Number of quantized grid steps sounded; omitted events retain legacy attack-to-next-attack rendering. */
    durationSteps?: number;
    /** Deterministic fill provenance populated only for accepted composed fills. */
    fillWindowId?: string;
    fillCandidateId?: string;
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
  /** Parsed source duration before pickup normalization, retained for render diagnostics. */
  sourceDurationUnits?: number;
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

    // Only the opening source measure can be an anacrusis. A later sparse
    // measure is still a full measure whose unoccupied steps render as rests.
    const actualMelodyUnits = measureDurationUnits(measureStr);
    const isPickup = measureIndex === 0
      && actualMelodyUnits > 0
      && actualMelodyUnits < durationContext.fullMeasureUnits;

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
      sourceDurationUnits: actualMelodyUnits > 0 ? actualMelodyUnits : undefined,
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

export function convertTimeSliceMeasureToAbc(
  measure: TimeSliceMeasure,
  durationContext: AbcDurationContext,
  keyAccidentals?: AbcKeyAccidentalMap,
  includeTabStringForcing: boolean = false
): string {
  return renderTimeSliceMeasureToAbc(
    measure,
    durationContext,
    keyAccidentals,
    includeTabStringForcing,
  );
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
