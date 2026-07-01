import { ChordInfo } from "./chords";
import {
  extractMelodyMeasures,
  getBeatsPerMeasure,
  noteNameToAbc,
  resolveProgression,
} from "./arranger-utils";
import { CadenceRole, generateHarmonizationStage } from "./harmonizer";
import { parseNoteDuration } from "./melody-analyzer";
import {
  generatePianoCompingProfileMeasure,
  PianoCompingProfileId,
  PianoCompingProfileMeasure,
} from "./piano-comping-profiles";
import { getNoteValue } from "./scales";

export type PianoBassFoundation = "root" | "octave" | "open-fifth" | "1-5-8";
export type PianoMelodyRole = "root" | "third" | "fifth" | "seventh" | "non-chord-tone";
export type PianoBassRole = "root" | "fifth" | "octave";
export type PianoRightHandRole = "root" | "third" | "fifth" | "seventh";

export interface PianoAccompanimentOptions {
  progression?: string[];
  bassFoundation?: PianoBassFoundation;
  compingProfile?: PianoCompingProfileId;
}

export interface PianoCadencePoint {
  measureIndex: number;
  beat: number;
  type: "phrase-ending";
}

export interface PianoSourceAnalysis {
  key: string;
  timeSignature: string;
  cadencePoints: PianoCadencePoint[];
  strongBeatTargets: Array<{
    measureIndex: number;
    beat: number;
    note: string;
  }>;
}

export interface PianoHarmonicFrameworkMeasure {
  measureIndex: number;
  chord: string;
  chordNotes: string[];
  targetMelodyNote: string | null;
  targetBeat: number | null;
  melodyRole: PianoMelodyRole;
  cadenceRole: CadenceRole;
}

export interface PianoBassEvent {
  note: string;
  abc: string;
  register: "C2-C3";
  role: PianoBassRole;
}

export interface PianoLowIntervalLimitReport {
  valid: boolean;
  rejectedIntervals: string[];
}

export interface PianoLeftHandBassMeasure {
  measureIndex: number;
  chord: string;
  root: string;
  foundation: PianoBassFoundation;
  events: PianoBassEvent[];
  lowIntervalLimit: PianoLowIntervalLimitReport;
  abc: string;
}

export interface PianoRightHandTone {
  note: string;
  abc: string;
  midi: number;
  register: "C3-C5";
  role: PianoRightHandRole;
  retainedFromPrevious: boolean;
  semitoneMovement: number | null;
  masksMelody: boolean;
}

export interface PianoRightHandVoicingMeasure {
  measureIndex: number;
  chord: string;
  targetMelodyNote: string | null;
  inversion: "root" | "first" | "second" | "third";
  guideTones: string[];
  tones: PianoRightHandTone[];
  commonTones: string[];
  totalSemitoneMovement: number;
  melodyMaskingAvoided: boolean;
  abc: string;
}

export interface PianoMelodicGapEvent {
  measureIndex: number;
  startBeat: number;
  endBeat: number;
  durationBeats: number;
  safe: boolean;
  resumedBy: string | null;
}

export interface PianoGapFillEvent {
  measureIndex: number;
  beat: number;
  role: "passing-fill";
  notes: string[];
  abc: string;
  yieldsToMelodyAt: number | null;
}

export interface PianoGapFillMeasure {
  measureIndex: number;
  chord: string;
  gap: PianoMelodicGapEvent | null;
  events: PianoGapFillEvent[];
  abc: string;
}

export type PianoPedalEventType = "pedal-down" | "pedal-flush" | "pedal-up";

export interface PianoPedalEvent {
  measureIndex: number;
  beat: number;
  chord: string;
  type: PianoPedalEventType;
  value: 0 | 127;
  previousChord?: string;
}

export interface PianoPedalAutomation {
  controller: {
    midiControlChange: 64;
    downValue: 127;
    upValue: 0;
  };
  events: PianoPedalEvent[];
}

export interface PianoAccompaniment {
  sourceAnalysis: PianoSourceAnalysis;
  harmonicFramework: PianoHarmonicFrameworkMeasure[];
  leftHandBassMap: PianoLeftHandBassMeasure[];
  rightHandVoicingMap: PianoRightHandVoicingMeasure[];
  compingProfileMap: PianoCompingProfileMeasure[];
  gapFillMap: PianoGapFillMeasure[];
  pedalAutomation: PianoPedalAutomation;
  abc: string;
}

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

interface MelodyTimelineEvent {
  type: "note" | "rest";
  note: string | null;
  startBeat: number;
  endBeat: number;
}

function extractMelodyTimelines(abcString: string): MelodyTimelineEvent[][] {
  const body = abcString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Z]:/.test(line))
    .join(" ");
  const rawMeasures = body.split(/[|\]]/);
  const measures: MelodyTimelineEvent[][] = [];
  const tokenRegex = /([_^=]?[A-Ga-g][,']*|z)([0-9]*\/?[0-9]*)/g;

  for (const rawMeasure of rawMeasures) {
    const trimmed = rawMeasure.trim().replace(/^[:\s]+|[:\s]+$/g, "");
    if (!trimmed || trimmed === ":" || trimmed === "::") continue;

    const events: MelodyTimelineEvent[] = [];
    let elapsedEighths = 0;
    let match: RegExpExecArray | null;
    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(trimmed)) !== null) {
      const duration = parseNoteDuration(match[2]);
      const startBeat = elapsedEighths / 2 + 1;
      const endBeat = startBeat + duration / 2;
      const type = match[1] === "z" ? "rest" : "note";
      events.push({
        type,
        note: type === "note" ? normalizeNoteName(match[1]) : null,
        startBeat,
        endBeat,
      });
      elapsedEighths += duration;
    }

    measures.push(events);
  }

  return measures;
}

function detectMelodicGap(timeline: MelodyTimelineEvent[], measureIndex: number): PianoMelodicGapEvent | null {
  const firstRestIndex = timeline.findIndex((event) => event.type === "rest");
  const restGap = firstRestIndex >= 0
    ? (() => {
        const firstRest = timeline[firstRestIndex];
        let endBeat = firstRest.endBeat;
        for (const rest of timeline.slice(firstRestIndex + 1)) {
          if (rest.type !== "rest" || rest.startBeat !== endBeat) break;
          endBeat = rest.endBeat;
        }
        return { startBeat: firstRest.startBeat, endBeat };
      })()
    : null;
  const heldNoteGap = timeline
    .filter((event) => event.type === "note" && event.endBeat - (event.startBeat + 1) >= 2)
    .map((event) => ({ startBeat: event.startBeat + 1, endBeat: event.endBeat }))[0] ?? null;
  const gapWindow = [restGap, heldNoteGap]
    .filter((gap): gap is { startBeat: number; endBeat: number } => gap !== null)
    .sort((a, b) => a.startBeat - b.startBeat)[0];

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
  beatCount: number
): PianoGapFillMeasure {
  const gap = detectMelodicGap(timeline, measureIndex);
  const beatSlots = Array.from({ length: beatCount }, () => "z2");
  const events: PianoGapFillEvent[] = [];

  if (gap?.safe) {
    const fillNotes = chord.notes.slice(1);
    for (let beat = gap.startBeat; beat < gap.endBeat; beat += 1) {
      const note = fillNotes[(beat - gap.startBeat) % fillNotes.length];
      const abc = `${noteNameToAbc(note, ",")}2`;
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

function buildPedalAutomation(chords: ChordInfo[], beatCount: number): PianoPedalAutomation {
  const events: PianoPedalEvent[] = [];

  chords.forEach((chord, measureIndex) => {
    const previousChord = chords[measureIndex - 1]?.chordName;
    if (measureIndex === 0) {
      events.push({ measureIndex, beat: 1, chord: chord.chordName, type: "pedal-down", value: 127 });
      return;
    }

    if (previousChord !== chord.chordName) {
      events.push({
        measureIndex,
        beat: 1,
        chord: chord.chordName,
        type: "pedal-flush",
        value: 0,
        previousChord,
      });
      events.push({ measureIndex, beat: 1, chord: chord.chordName, type: "pedal-down", value: 127 });
    }
  });

  const lastChord = chords.at(-1);
  if (lastChord) {
    events.push({
      measureIndex: chords.length - 1,
      beat: beatCount,
      chord: lastChord.chordName,
      type: "pedal-up",
      value: 0,
    });
  }

  return {
    controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
    events,
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
  previousTones: PianoRightHandTone[] | null
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
    abc: `[${tones.map((tone) => tone.abc).join("")}]4`,
  };
}

function buildMeasurePattern(events: PianoBassEvent[], beatCount: number): string {
  const root = events.find((event) => event.role === "root") ?? events[0];
  const fifth = events.find((event) => event.role === "fifth") ?? root;
  const octave = events.find((event) => event.role === "octave") ?? root;
  const pattern = [root, fifth, octave, fifth];

  return Array.from({ length: beatCount }, (_, index) => `${pattern[index % pattern.length].abc}2`).join(" ");
}

export function generatePianoAccompaniment(
  abcString: string,
  options: PianoAccompanimentOptions = {}
): PianoAccompaniment {
  const resolved = resolveProgression(abcString, options.progression);
  const harmonization = generateHarmonizationStage(abcString);
  const beatCount = getBeatsPerMeasure(resolved.timeSignature);
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
      abc: buildMeasurePattern(events, beatCount),
    };
  });

  let previousRightHandTones: PianoRightHandTone[] | null = null;
  const rightHandVoicingMap = resolved.chords.map((chord, measureIndex) => {
    const voicing = buildRightHandVoicing(chord, harmonicFramework[measureIndex], previousRightHandTones);
    previousRightHandTones = voicing.tones;
    return voicing;
  });
  const compingProfile = options.compingProfile ?? "pop-ballad";
  const compingProfileMap = resolved.chords.map((chord, measureIndex) =>
    generatePianoCompingProfileMeasure(chord, measureIndex, compingProfile, beatCount)
  );
  const melodyTimelines = extractMelodyTimelines(abcString);
  const gapFillMap = resolved.chords.map((chord, measureIndex) =>
    buildGapFillMeasure(chord, measureIndex, melodyTimelines[measureIndex] ?? [], beatCount)
  );
  const pedalAutomation = buildPedalAutomation(resolved.chords, beatCount);
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
    pedalAutomation,
    abc: `V:PianoLH clef=bass name="Layer 2 Piano Left Hand"\n| ${leftHandBassMap.map((measure) => measure.abc).join(" | ")} |\nV:PianoRH clef=treble name="Layer 2 Piano Right Hand"\n| ${rightHandVoicingMap.map((measure) => measure.abc).join(" | ")} |\n${compingLeftVoice}${compingRightVoice}${gapFillVoice}`,
  };
}
