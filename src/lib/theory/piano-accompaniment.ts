import { buildAbcDurationContext, extractMusicBodyLines, formatAbcDuration, splitAbcMeasureSegments } from "./abc-duration";
import { ChordInfo } from "./chords";
import {
  extractMelodyMeasures,
  getBeatsPerMeasure,
  noteNameToAbc,
  resolveProgression,
} from "./arranger-utils";
import { generateHarmonizationStage } from "./harmonizer";
import { parseNoteDuration } from "./melody-analyzer";
import {
  generatePianoCompingProfileMeasure,
} from "./piano-comping-profiles";
import { validatePianoPlayability } from "./piano-playability";
import { getNoteValue } from "./scales";
import { buildPedalAutomation, buildPedalEventMetadata } from "./piano-accompaniment/pedal-automation";
import { buildPhysicalHandEvents, buildPianoOutputContract } from "./piano-accompaniment/output-contract";
import type {
  MelodyTimelineEvent,
  PianoAccompaniment,
  PianoAccompanimentOptions,
  PianoBassEvent,
  PianoBassFoundation,
  PianoBassRole,
  PianoCadencePoint,
  PianoGapFillEvent,
  PianoGapFillMeasure,
  PianoHarmonicFrameworkMeasure,
  PianoLeftHandBassMeasure,
  PianoLowIntervalLimitReport,
  PianoMelodicGapEvent,
  PianoMelodyRole,
  PianoRightHandRole,
  PianoRightHandTone,
  PianoRightHandVoicingMeasure,
  PianoSourceAnalysis,
} from "./piano-accompaniment/types";
export type * from "./piano-accompaniment/types";



const LIL_ALLOWED_ROLES = new Set<PianoBassRole>(["root", "fifth", "octave"]);

function normalizeNoteName(note: string): string {
  const match = note.match(/[_^=]?([A-Ga-g])/);
  if (!match) return note;
  return match[1].toUpperCase();
}

function melodyRoleFor(chord: ChordInfo, targetNote: string | null): PianoMelodyRole {
  if (!targetNote) return "non-chord-tone";

  const normalizedTarget = normalizeNoteName(targetNote);
  const index = chord.notes.findIndex((note) => normalizeNoteName(note) === normalizedTarget);

  if (index === 0) return "root";
  if (index === 1) return "third";
  if (index === 2) return "fifth";
  if (index === 3) return "seventh";
  return "non-chord-tone";
}

function findStrongBeatTargets(abcString: string, beatCount: number): PianoSourceAnalysis["strongBeatTargets"] {
  return extractMelodyMeasures(abcString).flatMap((measure, measureIndex) => {
    const targets = [];
    if (measure[0]) {
      targets.push({ measureIndex, beat: 1, note: normalizeNoteName(measure[0].note) });
    }
    if (beatCount >= 4 && measure[2]) {
      targets.push({ measureIndex, beat: 3, note: normalizeNoteName(measure[2].note) });
    }
    return targets;
  });
}


function extractMelodyTimelines(abcString: string): MelodyTimelineEvent[][] {
  const durationContext = buildAbcDurationContext(abcString);
  const body = extractMusicBodyLines(abcString).join(" ");
  const rawMeasures = body.split(/[|\]]/);
  const measures: MelodyTimelineEvent[][] = [];
  const tokenRegex = /([_^=]?[A-Ga-g][,']*|z)([0-9]*\/?[0-9]*)/g;

  for (const rawMeasure of rawMeasures) {
    const trimmed = rawMeasure.trim().replace(/^[:\s]+|[:\s]+$/g, "");
    if (!trimmed || trimmed === ":" || trimmed === "::") continue;

    const events: MelodyTimelineEvent[] = [];
    let elapsedUnits = 0;
    let match: RegExpExecArray | null;
    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(trimmed)) !== null) {
      const duration = parseNoteDuration(match[2]);
      const startBeat = elapsedUnits / durationContext.unitsPerBeat + 1;
      const endBeat = startBeat + duration / durationContext.unitsPerBeat;
      const type = match[1] === "z" ? "rest" : "note";
      events.push({
        type,
        note: type === "note" ? normalizeNoteName(match[1]) : null,
        startBeat,
        endBeat,
      });
      elapsedUnits += duration;
    }

    measures.push(events);
  }

  return measures;
}

function detectMelodicGap(timeline: MelodyTimelineEvent[], measureIndex: number): PianoMelodicGapEvent | null {
  const restGaps: Array<{ startBeat: number; endBeat: number }> = [];

  for (let index = 0; index < timeline.length; index += 1) {
    const event = timeline[index];
    if (event.type !== "rest") continue;

    let endBeat = event.endBeat;
    let lastRestIndex = index;
    for (const rest of timeline.slice(index + 1)) {
      if (rest.type !== "rest" || rest.startBeat !== endBeat) break;
      endBeat = rest.endBeat;
      lastRestIndex += 1;
    }

    restGaps.push({ startBeat: event.startBeat, endBeat });
    index = lastRestIndex;
  }

  const heldNoteGaps = timeline
    .filter((event) => event.type === "note" && event.endBeat - (event.startBeat + 1) >= 2)
    .map((event) => ({ startBeat: event.startBeat + 1, endBeat: event.endBeat }));
  const candidates = [...restGaps, ...heldNoteGaps]
    .sort((a, b) => a.startBeat - b.startBeat);
  const gapWindow = candidates.find((gap) => gap.endBeat - gap.startBeat >= 2) ?? candidates[0];

  if (!gapWindow) return null;

  const resumedBy = timeline.find((event) => event.type === "note" && event.startBeat >= gapWindow.endBeat)?.note ?? null;
  const durationBeats = gapWindow.endBeat - gapWindow.startBeat;

  return {
    measureIndex,
    startBeat: gapWindow.startBeat,
    endBeat: gapWindow.endBeat,
    durationBeats,
    safe: durationBeats >= 2,
    resumedBy,
  };
}

function buildGapFillMeasure(
  chord: ChordInfo,
  measureIndex: number,
  timeline: MelodyTimelineEvent[],
  beatCount: number,
  beatDurationUnits: number
): PianoGapFillMeasure {
  const gap = detectMelodicGap(timeline, measureIndex);
  const beatDuration = formatAbcDuration(beatDurationUnits);
  const beatSlots = Array.from({ length: beatCount }, () => `z${beatDuration}`);
  const events: PianoGapFillEvent[] = [];

  if (gap?.safe) {
    const fillNotes = chord.notes.slice(1);
    for (let beat = gap.startBeat; beat < gap.endBeat; beat += 1) {
      const note = fillNotes[(beat - gap.startBeat) % fillNotes.length];
      const abc = `${noteNameToAbc(note, ",")}${beatDuration}`;
      beatSlots[Math.floor(beat) - 1] = abc;
      events.push({
        measureIndex,
        beat,
        role: "passing-fill",
        notes: [note],
        abc,
        yieldsToMelodyAt: gap.resumedBy ? gap.endBeat : null,
      });
    }
  }

  return {
    measureIndex,
    chord: chord.chordName,
    gap,
    events,
    abc: beatSlots.join(" "),
  };
}


function detectCadencePoints(abcString: string, beatCount: number): PianoCadencePoint[] {
  const measures = extractMelodyMeasures(abcString);
  if (measures.length === 0) return [];

  return [{ measureIndex: measures.length - 1, beat: beatCount, type: "phrase-ending" }];
}

function buildFoundationEvents(chord: ChordInfo, foundation: PianoBassFoundation): PianoBassEvent[] {
  const [root, , fifth] = chord.notes;
  const rootEvent: PianoBassEvent = {
    note: root,
    abc: noteNameToAbc(root, ",,"),
    register: "C2-C3",
    role: "root",
  };
  const fifthEvent: PianoBassEvent = {
    note: fifth,
    abc: noteNameToAbc(fifth, ",,"),
    register: "C2-C3",
    role: "fifth",
  };
  const octaveEvent: PianoBassEvent = {
    note: root,
    abc: noteNameToAbc(root, ","),
    register: "C2-C3",
    role: "octave",
  };

  if (foundation === "root") return [rootEvent];
  if (foundation === "octave") return [rootEvent, octaveEvent];
  if (foundation === "open-fifth") return [rootEvent, fifthEvent];
  return [rootEvent, fifthEvent, octaveEvent];
}

function validateLowIntervalLimit(events: PianoBassEvent[]): PianoLowIntervalLimitReport {
  const rejectedIntervals = events
    .filter((event) => !LIL_ALLOWED_ROLES.has(event.role))
    .map((event) => event.role);

  return { valid: rejectedIntervals.length === 0, rejectedIntervals };
}

function semitoneDistance(fromNote: string, toNote: string): number {
  const from = getNoteValue(normalizeNoteName(fromNote));
  const to = getNoteValue(normalizeNoteName(toNote));

  if (from === undefined || to === undefined) return 0;

  const clockwise = Math.abs(to - from);
  return Math.min(clockwise, 12 - clockwise);
}

function rightHandRole(index: number): PianoRightHandRole {
  if (index === 1) return "third";
  if (index === 2) return "fifth";
  if (index === 3) return "seventh";
  return "root";
}

function inversionNameFor(firstRole: PianoRightHandRole): PianoRightHandVoicingMeasure["inversion"] {
  if (firstRole === "third") return "first";
  if (firstRole === "fifth") return "second";
  if (firstRole === "seventh") return "third";
  return "root";
}

function buildRightHandVoicing(
  chord: ChordInfo,
  framework: PianoHarmonicFrameworkMeasure,
  previousTones: PianoRightHandTone[] | null,
  fullMeasureUnits: number
): PianoRightHandVoicingMeasure {
  const targetMelodyNote = framework.targetMelodyNote;
  const target = targetMelodyNote ? normalizeNoteName(targetMelodyNote) : null;
  const guideToneIndexes = chord.notes.length > 3 ? [1, 3] : [1];
  const previousNotes = previousTones?.map((tone) => tone.note) ?? [];
  const chordTones = chord.notes
    .map((note, index) => ({ note, index, role: rightHandRole(index) }))
    .filter((tone) => normalizeNoteName(tone.note) !== target);
  const commonTone = chordTones.find((tone) => previousNotes.includes(tone.note));
  let selectedIndexes = chordTones.filter((tone) => guideToneIndexes.includes(tone.index) || tone.role === "fifth");

  if (commonTone && !selectedIndexes.some((tone) => tone.note === commonTone.note)) {
    const replacementIndex = selectedIndexes.reduce((maxIndex, tone, index) => {
      const currentDistance = Math.min(...previousNotes.map((previous) => semitoneDistance(previous, tone.note)));
      const maxDistance = Math.min(...previousNotes.map((previous) => semitoneDistance(previous, selectedIndexes[maxIndex].note)));
      return currentDistance > maxDistance ? index : maxIndex;
    }, 0);
    selectedIndexes = [
      ...selectedIndexes.slice(0, replacementIndex),
      commonTone,
      ...selectedIndexes.slice(replacementIndex + 1),
    ];
  }

  const tones = selectedIndexes.map((tone): PianoRightHandTone => {
    const retainedFromPrevious = previousNotes.includes(tone.note);
    const semitoneMovement = previousTones
      ? retainedFromPrevious
        ? 0
        : Math.min(...previousNotes.map((previous) => semitoneDistance(previous, tone.note)))
      : null;

    return {
      note: tone.note,
      abc: noteNameToAbc(tone.note, ","),
      midi: 48 + (getNoteValue(normalizeNoteName(tone.note)) ?? 0),
      register: "C3-C5",
      role: tone.role,
      retainedFromPrevious,
      semitoneMovement,
      masksMelody: target !== null && normalizeNoteName(tone.note) === target,
    };
  });

  return {
    measureIndex: framework.measureIndex,
    chord: chord.chordName,
    targetMelodyNote,
    inversion: inversionNameFor(tones[0]?.role ?? "root"),
    guideTones: tones.filter((tone) => tone.role === "third" || tone.role === "seventh").map((tone) => tone.note),
    tones,
    commonTones: tones.filter((tone) => tone.retainedFromPrevious).map((tone) => tone.note),
    totalSemitoneMovement: tones.reduce((sum, tone) => sum + (tone.semitoneMovement ?? 0), 0),
    melodyMaskingAvoided: tones.every((tone) => !tone.masksMelody),
    abc: `[${tones.map((tone) => tone.abc).join("")}]${formatAbcDuration(fullMeasureUnits)}`,
  };
}

function buildMeasurePattern(events: PianoBassEvent[], beatCount: number, beatDurationUnits: number): string {
  const root = events.find((event) => event.role === "root") ?? events[0];
  const fifth = events.find((event) => event.role === "fifth") ?? root;
  const octave = events.find((event) => event.role === "octave") ?? root;
  const pattern = [root, fifth, octave, fifth];
  const beatDuration = formatAbcDuration(beatDurationUnits);

  return Array.from({ length: beatCount }, (_, index) => `${pattern[index % pattern.length].abc}${beatDuration}`).join(" ");
}


export function generatePianoAccompaniment(
  abcString: string,
  options: PianoAccompanimentOptions = {}
): PianoAccompaniment {
  const resolved = resolveProgression(abcString, options.progression);
  const harmonization = generateHarmonizationStage(abcString);
  const beatCount = getBeatsPerMeasure(resolved.timeSignature);
  const durationContext = buildAbcDurationContext(abcString);
  const bassFoundation = options.bassFoundation ?? "1-5-8";
  const cadencePoints = detectCadencePoints(abcString, beatCount);
  const strongBeatTargets = findStrongBeatTargets(abcString, beatCount);

  const harmonicFramework = resolved.chords.map((chord, measureIndex) => {
    const target = strongBeatTargets.find((candidate) => candidate.measureIndex === measureIndex && candidate.beat === 1)
      ?? strongBeatTargets.find((candidate) => candidate.measureIndex === measureIndex)
      ?? null;

    return {
      measureIndex,
      chord: chord.chordName,
      chordNotes: chord.notes,
      targetMelodyNote: target?.note ?? null,
      targetBeat: target?.beat ?? null,
      melodyRole: melodyRoleFor(chord, target?.note ?? null),
      cadenceRole: harmonization.measures[measureIndex]?.cadenceRole ?? "continuation",
    };
  });

  const leftHandBassMap = resolved.chords.map((chord, measureIndex) => {
    const events = buildFoundationEvents(chord, bassFoundation);
    return {
      measureIndex,
      chord: chord.chordName,
      root: chord.notes[0],
      foundation: bassFoundation,
      events,
      lowIntervalLimit: validateLowIntervalLimit(events),
      abc: buildMeasurePattern(events, beatCount, durationContext.unitsPerBeat),
    };
  });

  let previousRightHandTones: PianoRightHandTone[] | null = null;
  const rightHandVoicingMap = resolved.chords.map((chord, measureIndex) => {
    const voicing = buildRightHandVoicing(chord, harmonicFramework[measureIndex], previousRightHandTones, durationContext.fullMeasureUnits);
    previousRightHandTones = voicing.tones;
    return voicing;
  });
  const compingProfile = options.compingProfile ?? "pop-ballad";
  const compingProfileMap = resolved.chords.map((chord, measureIndex) =>
    generatePianoCompingProfileMeasure(chord, measureIndex, compingProfile, beatCount, durationContext.unitsPerBeat)
  );
  const melodyTimelines = extractMelodyTimelines(abcString);
  const gapFillMap = resolved.chords.map((chord, measureIndex) =>
    buildGapFillMeasure(chord, measureIndex, melodyTimelines[measureIndex] ?? [], beatCount, durationContext.unitsPerBeat)
  );
  const pedalAutomation = buildPedalAutomation(resolved.chords, beatCount);
  const pedalEventMetadata = buildPedalEventMetadata(pedalAutomation);
  const physicalValidation = validatePianoPlayability(buildPhysicalHandEvents(leftHandBassMap, rightHandVoicingMap));
  const compingVoiceName = compingProfile === "rock-rnb"
    ? "Rock/R&B Off-beats"
    : compingProfile === "classical-folk"
      ? "Classical/Folk Alberti Bass"
      : "Pop/Ballad 1-5-10";
  const compingLeftVoice = `V:PianoCompingLH clef=bass name="${compingVoiceName}"\n| ${compingProfileMap.map((measure) => measure.leftHandAbc).join(" | ")} |`;
  const compingRightVoice = compingProfileMap.some((measure) => measure.rightHandAbc.trim().length > 0)
    ? `\nV:PianoCompingRH clef=treble name="${compingVoiceName}"\n| ${compingProfileMap.map((measure) => measure.rightHandAbc).join(" | ")} |`
    : "";
  const gapFillVoice = gapFillMap.some((measure) => measure.events.length > 0)
    ? `\nV:PianoGapFill clef=treble name="Safe Gap Fills"\n| ${gapFillMap.map((measure) => measure.abc).join(" | ")} |`
    : "";
  const grandStaffAbc = `V:PianoLH clef=bass name="Layer 2 Piano Left Hand"\n| ${leftHandBassMap.map((measure) => measure.abc).join(" | ")} |\nV:PianoRH clef=treble name="Layer 2 Piano Right Hand"\n| ${rightHandVoicingMap.map((measure) => measure.abc).join(" | ")} |\n${compingLeftVoice}${compingRightVoice}${gapFillVoice}`;
  const outputContract = buildPianoOutputContract(leftHandBassMap, rightHandVoicingMap);

  return {
    sourceAnalysis: {
      key: resolved.key,
      timeSignature: resolved.timeSignature,
      cadencePoints,
      strongBeatTargets,
    },
    harmonicFramework,
    leftHandBassMap,
    rightHandVoicingMap,
    compingProfileMap,
    gapFillMap,
    physicalValidation,
    playbackEvents: physicalValidation.playbackEvents,
    pedalAutomation,
    pedalEventMetadata,
    grandStaffAbc,
    pianoKeyHighlights: outputContract.pianoKeyHighlights,
    fingeringMetadata: outputContract.fingeringMetadata,
    abc: grandStaffAbc,
  };
}
