import { buildAbcDurationContext, splitAbcMeasureSegments } from "../abc-duration";
import { isAbcChordSymbol, normalizeAbcChordSymbol } from "../abc-chord-symbol";
import {
  extractChordsFromMeasure,
  extractMelodyMeasureTimelineWithTies,
} from "./time-slice";

export type MelodyChordSource = "inline" | "progression-fallback" | "carried" | "none";

export interface MelodyChordEvent {
  chord: string;
  onsetUnits: number;
}

export interface MelodyChordAssignment {
  measureIndex: number;
  token: string;
  onsetUnits: number;
  durationUnits: number;
  beat: number;
  chord: string | null;
  chordSource: MelodyChordSource;
  chordMeasureIndex: number | null;
  chordOnsetUnits: number | null;
}

interface ActiveChord {
  chord: string;
  source: Exclude<MelodyChordSource, "carried" | "none">;
  measureIndex: number;
  onsetUnits: number;
}

interface TimedChordEvent extends ActiveChord {
  priority: number;
}

/**
 * Extract Melody voice measures without compacting chordless source measures.
 * Inline `[V:Melody]` content takes precedence over the currently active `V:` voice.
 */
export function extractMelodyMeasures(abcString: string): string[] {
  let activeVoiceIsMelody = true;
  const measures: string[] = [];

  for (const rawLine of abcString.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("%")) continue;

    if (line.startsWith("V:")) {
      activeVoiceIsMelody = line.slice(2).trim().split(/\s+/)[0] === "Melody";
      continue;
    }

    const inlineVoice = line.match(/^\[V:([^\]]+)\](.*)$/);
    if (inlineVoice) {
      if (inlineVoice[1].trim() === "Melody") {
        measures.push(...splitAbcMeasureSegments(inlineVoice[2]));
      }
      continue;
    }

    if (/^[A-Za-z]:/.test(line) || !activeVoiceIsMelody) continue;
    measures.push(...splitAbcMeasureSegments(line));
  }

  return measures;
}

export function extractInlineChordEventsByMelodyMeasure(abcString: string): MelodyChordEvent[][] {
  return extractMelodyMeasures(abcString).map((measure) => extractChordsFromMeasure(measure));
}

function normalizedFallbackChord(progression: readonly string[] | undefined, measureIndex: number): string | null {
  const chord = progression?.[measureIndex];
  return typeof chord === "string" && isAbcChordSymbol(chord)
    ? normalizeAbcChordSymbol(chord)
    : null;
}

/**
 * Assign each melody-note attack its active harmony. An inline ABC chord starts at
 * its annotated onset and remains active across later notes and chordless measures.
 */
export function assignActiveChordsToMelodyNotes(
  abcString: string,
  fallbackProgression?: readonly string[],
): MelodyChordAssignment[] {
  const durationContext = buildAbcDurationContext(abcString);
  const measures = extractMelodyMeasures(abcString);
  const assignments: MelodyChordAssignment[] = [];
  let activeChord: ActiveChord | null = null;

  for (const [measureIndex, measure] of measures.entries()) {
    const fallbackChord = normalizedFallbackChord(fallbackProgression, measureIndex);
    const events: TimedChordEvent[] = [
      ...(fallbackChord
        ? [{
          chord: fallbackChord,
          onsetUnits: 0,
          source: "progression-fallback" as const,
          measureIndex,
          priority: 0,
        }]
        : []),
      ...extractChordsFromMeasure(measure).map((event) => ({
        ...event,
        source: "inline" as const,
        measureIndex,
        priority: 1,
      })),
    ].sort((left, right) => left.onsetUnits - right.onsetUnits || left.priority - right.priority);

    let eventCursor = 0;
    let noteActiveChord = activeChord;
    for (const note of extractMelodyMeasureTimelineWithTies(measure)) {
      while (eventCursor < events.length && events[eventCursor].onsetUnits <= note.onsetUnits) {
        const { priority: _priority, ...nextChord } = events[eventCursor];
        noteActiveChord = nextChord;
        eventCursor += 1;
      }

      if (note.kind !== "note") continue;
      const isCarried = noteActiveChord !== null && noteActiveChord.measureIndex < measureIndex;
      assignments.push({
        measureIndex,
        token: note.token,
        onsetUnits: note.onsetUnits,
        durationUnits: note.durationUnits,
        beat: 1 + note.onsetUnits / durationContext.unitsPerBeat,
        chord: noteActiveChord?.chord ?? null,
        chordSource: noteActiveChord === null ? "none" : isCarried ? "carried" : noteActiveChord.source,
        chordMeasureIndex: noteActiveChord?.measureIndex ?? null,
        chordOnsetUnits: noteActiveChord?.onsetUnits ?? null,
      });
    }

    if (events.length > 0) {
      const { priority: _priority, ...lastChord } = events[events.length - 1];
      activeChord = lastChord;
    }
  }

  return assignments;
}
