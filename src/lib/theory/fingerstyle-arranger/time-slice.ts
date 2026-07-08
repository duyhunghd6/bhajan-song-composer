import { buildAbcDurationContext, stripAbcChordSymbols, cleanAbcMeasureSegment } from "../abc-duration";
import { parseNoteDuration } from "../melody-analyzer";

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
  beatWeight: "strong" | "medium" | "soft" | null;
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

export function getMetricWeight(beat: number, timeSignature: string): "strong" | "medium" | "soft" | null {
  const normTime = timeSignature.trim();
  if (normTime === "4/4" || normTime === "C") {
    if (beat === 1.0) return "strong";
    if (beat === 3.0) return "medium";
    if (beat === 2.0 || beat === 4.0) return "soft";
  } else if (normTime === "3/4") {
    if (beat === 1.0) return "strong";
    if (beat === 2.0 || beat === 3.0) return "soft";
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

export function abcNoteToMidi(note: string): number | null {
  const match = note.trim().match(/^([_^=]?)([A-Ga-g])([,']*)/);
  if (!match) return null;
  const accidental = match[1] === "^" ? "#" : match[1] === "_" ? "b" : "";
  const letter = match[2];
  const pitchClass = `${letter.toUpperCase()}${accidental}`;
  const semitone = PITCH_CLASS_TO_SEMITONE[pitchClass];
  if (semitone === undefined) return null;
  let octave = letter === letter.toLowerCase() ? 5 : 4;
  for (const mark of match[3] ?? "") {
    octave += mark === "'" ? 1 : -1;
  }
  return (octave + 1) * 12 + semitone;
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

export function convertAbcToTimeSliceGrid(abcString: string, chords: string[]): TimeSliceStep[] {
  const durationContext = buildAbcDurationContext(abcString);
  const { unitsPerBeat, meter } = durationContext;
  const stepsPerBeat = 4;
  const stepsPerMeasure = meter.numerator * stepsPerBeat; // 16 for 4/4

  // Extract melody lines and matching lyrics / beat weights
  const lines = abcString.split(/\r?\n/);
  let activeVoiceIsMelody = true;
  const melodySegmentMeasures: string[][] = [];
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
        const measures = content.split("|").map((m) => m.trim()).filter(Boolean);
        melodySegmentMeasures.push(measures);

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
      const measures = line.split("|").map((m) => m.trim()).filter(Boolean);
      melodySegmentMeasures.push(measures);

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
  let measureCounter = 0;
  for (let k = 0; k < melodySegmentMeasures.length; k++) {
    const melodyMeasures = melodySegmentMeasures[k];
    const lyricMeasures = lyricSegmentMeasures[k] || [];
    const beatWeightMeasures = beatWeightSegmentMeasures[k] || [];
    for (let m = 0; m < melodyMeasures.length; m++) {
      finalMelodyMeasures[measureCounter] = melodyMeasures[m];
      finalLyricMeasures[measureCounter] = lyricMeasures[m] || "";
      finalBeatWeightMeasures[measureCounter] = beatWeightMeasures[m] || "";
      measureCounter++;
    }
  }

  const totalMeasures = finalMelodyMeasures.length;
  const flatGrid: TimeSliceStep[] = [];

  for (let measureIndex = 0; measureIndex < totalMeasures; measureIndex++) {
    const measureStr = finalMelodyMeasures[measureIndex];
    const lyricStr = finalLyricMeasures[measureIndex];
    const beatWeightStr = finalBeatWeightMeasures[measureIndex];
    const chordName = chords[measureIndex] || chords[chords.length - 1] || "C";

    // Syllables
    const syllables = getLyricSyllablesForMeasure(lyricStr);
    let syllableCursor = 0;

    // Beat weights
    const weightTokens = getLyricSyllablesForMeasure(beatWeightStr);
    let weightCursor = 0;

    // Initialize quantized steps for this measure
    const measureGrid = Array.from({ length: stepsPerMeasure }, (_, i) => {
      const stepNum = i + 1;
      const beat = 1.00 + i * 0.25;
      const timeSig = meter.numerator + "/" + meter.denominator;
      return {
        step: stepNum,
        beat: parseFloat(beat.toFixed(2)),
        chord: chordName,
        melody: {
          pitch: null as string | null,
          state: "rest" as "attack" | "sustain" | "rest",
        },
        lyric: null as string | null,
        beatWeight: getMetricWeight(beat, timeSig),
      };
    });

    // Extract note events with ties merged
    const events = extractMelodyMeasureTimelineWithTies(measureStr);

    for (const event of events) {
      const startIndex = Math.round((event.onsetUnits / unitsPerBeat) * stepsPerBeat);
      const span = Math.round((event.durationUnits / unitsPerBeat) * stepsPerBeat);

      if (startIndex < 0 || startIndex >= stepsPerMeasure) continue;

      if (event.kind === "note") {
        const midi = abcNoteToMidi(event.token);
        const pitch = midi !== null ? midiToScientificPitch(midi) : null;

        // Attack step
        measureGrid[startIndex].melody.pitch = pitch;
        measureGrid[startIndex].melody.state = "attack";

        // Lyric syllable mapping
        const syllable = syllables[syllableCursor];
        if (syllable !== undefined) {
          syllableCursor++;
          if (syllable !== "_" && syllable !== "*") {
            measureGrid[startIndex].lyric = syllable;
          }
        }

        // Beat weight mapping
        const weightToken = weightTokens[weightCursor];
        if (weightToken !== undefined) {
          weightCursor++;
          if (weightToken === "⬤") {
            measureGrid[startIndex].beatWeight = "strong";
          } else if (weightToken === "●") {
            measureGrid[startIndex].beatWeight = "medium";
          } else if (weightToken === "•" || weightToken === "*") {
            measureGrid[startIndex].beatWeight = "soft";
          }
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

    flatGrid.push(...measureGrid);
  }

  return flatGrid;
}
