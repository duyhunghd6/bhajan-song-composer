import { ChordInfo } from "./chords";
import {
  extractMelodyMeasures,
  getBeatsPerMeasure,
  noteNameToAbc,
  resolveProgression,
} from "./arranger-utils";
import { CadenceRole, generateHarmonizationStage } from "./harmonizer";
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

export interface PianoAccompaniment {
  sourceAnalysis: PianoSourceAnalysis;
  harmonicFramework: PianoHarmonicFrameworkMeasure[];
  leftHandBassMap: PianoLeftHandBassMeasure[];
  rightHandVoicingMap: PianoRightHandVoicingMeasure[];
  compingProfileMap: PianoCompingProfileMeasure[];
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
  const compingVoiceName = compingProfile === "rock-rnb"
    ? "Rock/R&B Off-beats"
    : compingProfile === "classical-folk"
      ? "Classical/Folk Alberti Bass"
      : "Pop/Ballad 1-5-10";
  const compingLeftVoice = `V:PianoCompingLH clef=bass name="${compingVoiceName}"\n| ${compingProfileMap.map((measure) => measure.leftHandAbc).join(" | ")} |`;
  const compingRightVoice = compingProfileMap.some((measure) => measure.rightHandAbc.trim().length > 0)
    ? `\nV:PianoCompingRH clef=treble name="${compingVoiceName}"\n| ${compingProfileMap.map((measure) => measure.rightHandAbc).join(" | ")} |`
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
    abc: `V:PianoLH clef=bass name="Layer 2 Piano Left Hand"\n| ${leftHandBassMap.map((measure) => measure.abc).join(" | ")} |\nV:PianoRH clef=treble name="Layer 2 Piano Right Hand"\n| ${rightHandVoicingMap.map((measure) => measure.abc).join(" | ")} |\n${compingLeftVoice}${compingRightVoice}`,
  };
}
