import { buildAbcDurationContext } from "../abc-duration";
import { extractInlineChordEventsByMelodyMeasure } from "../fingerstyle-arranger/melody-chord-timeline";
import { convertAbcToTimeSliceGrid, type TimeSliceMeasure } from "../fingerstyle-arranger/time-slice";
import { getGuitarVoicings, type GuitarVoicing } from "../guitar-voicings";
import { scientificPitchForStringFret } from "../guitar-playability";
import { validateGuitarTab, type GuitarTabEvent } from "../guitar-tab-validation";
import {
  GUITAR_CLASSIC_COMPING_PROFILES,
  type GuitarClassicCompingProfileId,
} from "./definition";

const BASS_STRINGS = new Set([4, 5, 6]);
const TREBLE_STRINGS = new Set([1, 2, 3]);
const MIN_ENFORCED_ATTACKS = 10;
const MIN_BASS_ATTACK_SHARE = 0.3;
const MAX_BASS_ATTACK_SHARE = 0.45;
const MIN_TREBLE_ATTACK_SHARE = 0.55;
const MAX_TREBLE_ATTACK_SHARE = 0.7;
const MAX_BASS_ONLY_ONSETS = 2;

export interface GuitarClassicRealizationInput {
  sourceAbc: string;
  compingProfileId: GuitarClassicCompingProfileId;
  anchorEvents: GuitarTabEvent[];
}

export interface GuitarClassicRealizationResult {
  events: GuitarTabEvent[];
  errors: string[];
  profileId: GuitarClassicCompingProfileId;
  sourceAnchorCount: number;
  realizedAttackCount: number;
}

export interface GuitarClassicSingerSupportAnalysis {
  bassAttackCount: number;
  trebleAttackCount: number;
  eligibleAttackCount: number;
  bassAttackShare: number | null;
  trebleAttackShare: number | null;
  ratioEnforced: boolean;
  longestBassOnlyRun: number;
  issues: string[];
}

interface ChordWindow {
  chord: string;
  startStep: number;
  endStep: number;
}

interface SoundingString {
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
}

interface AttackGroup {
  measureIndex: number;
  step: number;
  events: GuitarTabEvent[];
}

function isBassString(string: number): boolean {
  return BASS_STRINGS.has(string);
}

function isTrebleString(string: number): boolean {
  return TREBLE_STRINGS.has(string);
}

function activeStepCount(measure: TimeSliceMeasure, stepDurationUnits: number): number {
  if (!measure.pickupDurationUnits || measure.pickupDurationUnits <= 0) return measure.grid.length;
  return Math.max(0, Math.min(measure.grid.length, Math.ceil(measure.pickupDurationUnits / stepDurationUnits)));
}

function chordWindowsForSource(sourceAbc: string, measures: TimeSliceMeasure[]): ChordWindow[][] {
  const durationContext = buildAbcDurationContext(sourceAbc);
  const stepDurationUnits = durationContext.unitsPerBeat / 4;
  const chordEvents = extractInlineChordEventsByMelodyMeasure(sourceAbc);
  let carriedChord: string | null = null;

  return measures.map((measure, measureIndex) => {
    const activeSteps = activeStepCount(measure, stepDurationUnits);
    const events = chordEvents[measureIndex] ?? [];
    const windows: ChordWindow[] = [];
    let chord = carriedChord;
    let startStep = 1;

    for (const event of events) {
      const nextStep = Math.max(1, Math.min(activeSteps + 1, Math.floor(event.onsetUnits / stepDurationUnits) + 1));
      if (chord && nextStep > startStep) windows.push({ chord, startStep, endStep: nextStep });
      chord = event.chord;
      startStep = nextStep;
    }
    if (chord && startStep <= activeSteps) windows.push({ chord, startStep, endStep: activeSteps + 1 });
    carriedChord = chord;
    return windows;
  });
}

function soundingStrings(voicing: GuitarVoicing): SoundingString[] {
  return voicing.frets.flatMap((fret, index) => (
    typeof fret === "number" ? [{ string: (6 - index) as SoundingString["string"], fret }] : []
  ));
}

function validateVoicingShape(notes: SoundingString[]): boolean {
  const validation = validateGuitarTab(notes.map((note) => ({
    measureIndex: 1,
    step: 1,
    durationSteps: 1,
    beat: 1,
    note: scientificPitchForStringFret(note.string, note.fret),
    string: note.string,
    fret: note.fret,
    role: "harmony",
    simultaneousGroupId: "shape",
  })), {
    guitarProfile: "guitar-acoustic",
    requireScientificPitch: true,
    requireRenderableTiming: true,
  });
  return validation.valid;
}

function selectVoicing(chord: string, anchors: GuitarTabEvent[]): SoundingString[] | null {
  const candidates = getGuitarVoicings(chord)
    .map(soundingStrings)
    .filter((notes) => notes.length >= 3)
    .filter((notes) => notes.some((note) => isBassString(note.string)))
    .filter((notes) => notes.some((note) => isTrebleString(note.string)))
    .filter(validateVoicingShape);
  if (candidates.length === 0) return null;
  if (anchors.length === 0) return candidates[0];

  const constrainedAnchors = anchors.filter((anchor) => anchor.role !== "transition-approach");
  const matching = candidates.find((notes) => constrainedAnchors.every((anchor) =>
    notes.some((note) => note.string === anchor.string && note.fret === anchor.fret)
  ));
  return matching ?? candidates[0];
}

function makeEvent(input: {
  measureIndex: number;
  step: number;
  durationSteps: number;
  note: SoundingString;
  role: string;
  group?: string;
}): GuitarTabEvent {
  return {
    measureIndex: input.measureIndex,
    step: input.step,
    durationSteps: input.durationSteps,
    beat: 1 + (input.step - 1) / 4,
    note: scientificPitchForStringFret(input.note.string, input.note.fret),
    string: input.note.string,
    fret: input.note.fret,
    role: input.role,
    sourceEventId: `realized-${input.measureIndex}-${input.step}-${input.note.string}`,
    simultaneousGroupId: input.group,
  };
}

function attackPositions(startStep: number, endStep: number): Array<{ step: number; durationSteps: number }> {
  const span = endStep - startStep;
  const attacks = Math.max(2, Math.min(8, Math.floor(span / 2)));
  const stride = Math.max(1, Math.floor(span / attacks));
  return Array.from({ length: attacks }, (_, index) => startStep + index * stride)
    .filter((step) => step < endStep)
    .map((step) => ({ step, durationSteps: Math.max(1, Math.min(stride, endStep - step)) }));
}

function partitionVoicing(notes: SoundingString[]) {
  return {
    bass: notes.filter((note) => isBassString(note.string)).sort((left, right) => right.string - left.string),
    treble: notes.filter((note) => isTrebleString(note.string)).sort((left, right) => right.string - left.string),
  };
}

function isStrongStep(measure: TimeSliceMeasure, step: number): boolean {
  const weight = measure.grid[step - 1]?.weight;
  return weight === "⬤" || weight === "●";
}

function pushArpeggio(
  events: GuitarTabEvent[],
  measure: TimeSliceMeasure,
  measureIndex: number,
  startStep: number,
  endStep: number,
  notes: SoundingString[],
  pinch: boolean,
): void {
  const { bass, treble } = partitionVoicing(notes);
  if (bass.length === 0 || treble.length === 0) return;

  const positions = attackPositions(startStep, endStep);
  const strongPinches = pinch
    ? new Set(positions.filter((position) => isStrongStep(measure, position.step)).map((position) => position.step))
    : new Set<number>();
  const ordinaryPositions = positions.filter((position) => !strongPinches.has(position.step));
  const ordinaryBassCount = Math.max(0, Math.round((positions.length * 0.375) - strongPinches.size));
  const ordinaryPattern = ["treble", "treble", "bass", "treble", "treble", "treble", "bass"] as const;
  let bassCursor = 0;
  let trebleCursor = 0;
  let ordinaryBassRemaining = ordinaryBassCount;

  positions.forEach((position, index) => {
    if (strongPinches.has(position.step)) {
      const group = `pinch-${measureIndex}-${position.step}`;
      events.push(makeEvent({
        measureIndex,
        step: position.step,
        durationSteps: position.durationSteps,
        note: bass[index % bass.length],
        role: "bass",
        group,
      }));
      events.push(makeEvent({
        measureIndex,
        step: position.step,
        durationSteps: position.durationSteps,
        note: treble[trebleCursor++ % treble.length],
        role: "harmony",
        group,
      }));
      return;
    }

    const ordinaryIndex = ordinaryPositions.findIndex((candidate) => candidate.step === position.step);
    const remainingOrdinary = ordinaryPositions.length - ordinaryIndex;
    const patternKind = ordinaryPattern[ordinaryIndex % ordinaryPattern.length];
    const useBass = ordinaryBassRemaining > 0
      && (patternKind === "bass" || ordinaryBassRemaining >= remainingOrdinary);
    const note = useBass
      ? bass[bassCursor++ % bass.length]
      : treble[trebleCursor++ % treble.length];
    if (useBass) ordinaryBassRemaining -= 1;
    events.push(makeEvent({
      measureIndex,
      step: position.step,
      durationSteps: position.durationSteps,
      note,
      role: useBass ? "bass" : "harmony",
    }));
  });
}

function pushStrum(
  events: GuitarTabEvent[],
  measureIndex: number,
  startStep: number,
  endStep: number,
  notes: SoundingString[],
): void {
  const span = endStep - startStep;
  const attacks = Math.max(1, Math.min(4, Math.floor(span / 4)));
  const stride = Math.max(1, Math.floor(span / attacks));
  for (let index = 0; index < attacks; index += 1) {
    const step = startStep + index * stride;
    if (step >= endStep) break;
    const durationSteps = Math.max(1, Math.min(2, endStep - step));
    const group = `strum-${measureIndex}-${step}`;
    for (const note of notes) {
      events.push(makeEvent({ measureIndex, step, durationSteps, note, role: isBassString(note.string) ? "bass" : "harmony", group }));
    }
  }
}

function attackGroups(events: GuitarTabEvent[]): AttackGroup[] {
  const groups = new Map<string, AttackGroup>();
  for (const event of events) {
    const key = `${event.measureIndex}:${event.step}`;
    const group = groups.get(key) ?? { measureIndex: event.measureIndex, step: event.step ?? 1, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.measureIndex - right.measureIndex || left.step - right.step);
}

export function analyzeGuitarClassicSingerSupport(events: GuitarTabEvent[], measures: TimeSliceMeasure[]): GuitarClassicSingerSupportAnalysis {
  const individualEvents = events.filter((event) => !event.simultaneousGroupId?.startsWith("strum-"));
  const bassAttackCount = individualEvents.filter((event) => isBassString(event.string)).length;
  const trebleAttackCount = individualEvents.filter((event) => isTrebleString(event.string)).length;
  const eligibleAttackCount = bassAttackCount + trebleAttackCount;
  const bassAttackShare = eligibleAttackCount > 0 ? bassAttackCount / eligibleAttackCount : null;
  const trebleAttackShare = eligibleAttackCount > 0 ? trebleAttackCount / eligibleAttackCount : null;
  const ratioEnforced = eligibleAttackCount >= MIN_ENFORCED_ATTACKS;
  const issues: string[] = [];

  if (ratioEnforced && (bassAttackShare === null || bassAttackShare < MIN_BASS_ATTACK_SHARE || bassAttackShare > MAX_BASS_ATTACK_SHARE)) {
    issues.push(`Guitar bass-band attacks must be ${MIN_BASS_ATTACK_SHARE * 100}-${MAX_BASS_ATTACK_SHARE * 100}% of individual attacks.`);
  }
  if (ratioEnforced && (trebleAttackShare === null || trebleAttackShare < MIN_TREBLE_ATTACK_SHARE || trebleAttackShare > MAX_TREBLE_ATTACK_SHARE)) {
    issues.push(`Guitar treble-band attacks must be ${MIN_TREBLE_ATTACK_SHARE * 100}-${MAX_TREBLE_ATTACK_SHARE * 100}% of individual attacks.`);
  }

  let bassOnlyRun = 0;
  let longestBassOnlyRun = 0;
  for (const group of attackGroups(events)) {
    const strings = group.events.map((event) => event.string);
    const hasBass = strings.some(isBassString);
    const hasTreble = strings.some(isTrebleString);
    const pinch = group.events.some((event) => event.simultaneousGroupId?.startsWith("pinch-"));
    if (pinch && (!hasBass || !hasTreble)) {
      issues.push(`Pinch at measure ${group.measureIndex}, step ${group.step} must include bass and treble strings.`);
    }
    if (pinch && !isStrongStep(measures[group.measureIndex - 1], group.step)) {
      issues.push(`Pinch at measure ${group.measureIndex}, step ${group.step} is not on a strong metric step.`);
    }
    bassOnlyRun = hasBass && !hasTreble ? bassOnlyRun + 1 : 0;
    longestBassOnlyRun = Math.max(longestBassOnlyRun, bassOnlyRun);
    if (bassOnlyRun > MAX_BASS_ONLY_ONSETS) {
      issues.push(`More than ${MAX_BASS_ONLY_ONSETS} consecutive bass-only Guitar attacks at measure ${group.measureIndex}, step ${group.step}.`);
    }
  }

  return {
    bassAttackCount,
    trebleAttackCount,
    eligibleAttackCount,
    bassAttackShare,
    trebleAttackShare,
    ratioEnforced,
    longestBassOnlyRun,
    issues,
  };
}

/**
 * Deterministically materialize complete acoustic steel-string Guitar accompaniment from the
 * selected Step 4 technique and Step 5 physical anchors before ABC rendering.
 */
export function realizeGuitarClassicAccompaniment(input: GuitarClassicRealizationInput): GuitarClassicRealizationResult {
  const measures = convertAbcToTimeSliceGrid(input.sourceAbc, []);
  const windows = chordWindowsForSource(input.sourceAbc, measures);
  const errors: string[] = [];
  const events: GuitarTabEvent[] = [];

  windows.forEach((measureWindows, index) => {
    const measureIndex = index + 1;
    const measure = measures[index];
    for (const window of measureWindows) {
      const anchors = input.anchorEvents.filter((event) => event.measureIndex === measureIndex
        && (event.step ?? 1) >= window.startStep && (event.step ?? 1) < window.endStep);
      const notes = selectVoicing(window.chord, anchors);
      if (!notes) {
        errors.push(`Measure ${measureIndex} chord ${window.chord} has no playable Guitar voicing matching its selected anchors.`);
        continue;
      }
      const profile = GUITAR_CLASSIC_COMPING_PROFILES[input.compingProfileId];
      if (profile.technique === "strum") {
        pushStrum(events, measureIndex, window.startStep, window.endStep, notes);
      } else {
        pushArpeggio(events, measure, measureIndex, window.startStep, window.endStep, notes, profile.technique === "pinch");
      }
    }
  });

  const validation = validateGuitarTab(events, {
    guitarProfile: "guitar-acoustic",
    requireScientificPitch: true,
    requireRenderableTiming: true,
  });
  if (!validation.valid) errors.push(...validation.issues.map((issue) => issue.message));
  const supportPolicy = analyzeGuitarClassicSingerSupport(events, measures);
  errors.push(...supportPolicy.issues);

  const attackKeys = new Set(events.map((event) => `${event.measureIndex}:${event.step}`));
  return {
    events: errors.length === 0 ? events : [],
    errors,
    profileId: input.compingProfileId,
    sourceAnchorCount: input.anchorEvents.length,
    realizedAttackCount: attackKeys.size,
  };
}
