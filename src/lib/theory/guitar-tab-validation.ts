import {
  MAX_FRET_STRETCH,
  midiForStringFret,
  parseScientificPitch,
  resolveGuitarPlayabilityProfile,
  resolveGuitarVoicingProfile,
  type GuitarPlayabilityProfileInput,
  type GuitarVoicingPlayabilityProfileInput,
} from "./guitar-playability";
import { getNoteValue } from "./scales";

export type GuitarTabStringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface GuitarTabEvent {
  measureIndex: number;
  /** One-based sixteenth-note grid step used by Guitar Classic ABC conversion. */
  step?: number;
  /** Positive sounding duration in grid steps used by Guitar Classic ABC conversion. */
  durationSteps?: number;
  beat: number;
  subdivision?: string | number;
  simultaneousGroupId?: string;
  sourceEventId?: string;
  note: string;
  string: GuitarTabStringNumber;
  fret: number;
  role: string;
}

export interface GuitarTabValidationOptions {
  guitarProfile?: GuitarPlayabilityProfileInput;
  voicingProfile?: GuitarVoicingPlayabilityProfileInput;
  requireScientificPitch?: boolean;
  requireSourceEventIds?: boolean;
  requireRenderableTiming?: boolean;
}

export interface GuitarTabValidationIssue {
  code:
    | "invalid-string"
    | "invalid-fret"
    | "duplicate-string"
    | "duplicate-source-note"
    | "missing-source-event-id"
    | "too-many-notes"
    | "too-many-fretted-notes"
    | "fret-span"
    | "pitch-string-mismatch"
    | "fret-out-of-range"
    | "missing-octave"
    | "pitch-register-mismatch"
    | "left-hand-unfingerable"
    | "multiple-barres"
    | "invalid-grid-step"
    | "invalid-duration";
  message: string;
  measureIndex?: number;
  beat?: number;
  simultaneousGroupId?: string;
  string?: GuitarTabStringNumber;
  events?: GuitarTabEvent[];
}

export interface GuitarTabValidatedGroup {
  key: string;
  measureIndex: number;
  beat: number;
  simultaneousGroupId?: string;
  noteCount: number;
  frettedNoteCount: number;
  fretSpan: number;
  strings: GuitarTabStringNumber[];
  leftHandPlayable: boolean;
  frettingFingerCount: number;
  requiresBarre: boolean;
  barreFret?: number;
  profileId: string;
  voicingProfileId?: string;
}

export interface GuitarTabValidationResult {
  valid: boolean;
  issues: GuitarTabValidationIssue[];
  validatedGroups: GuitarTabValidatedGroup[];
}

const OPEN_STRING_VALUES: Record<GuitarTabStringNumber, number> = {
  1: getNoteValue("E"),
  2: getNoteValue("B"),
  3: getNoteValue("G"),
  4: getNoteValue("D"),
  5: getNoteValue("A"),
  6: getNoteValue("E"),
};

const VALID_STRINGS = new Set<number>([1, 2, 3, 4, 5, 6]);

function normalizePitchClass(note: string): string | null {
  const match = note.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2] ?? ""}`;
}

function expectedPitchValueFor(event: GuitarTabEvent): number {
  return (OPEN_STRING_VALUES[event.string] + event.fret) % 12;
}

function eventPitchValue(event: GuitarTabEvent): number | undefined {
  const pitchClass = normalizePitchClass(event.note);
  if (!pitchClass) return undefined;
  return getNoteValue(pitchClass);
}

function groupKeyFor(event: GuitarTabEvent): string {
  if (event.simultaneousGroupId?.trim()) {
    return `${event.measureIndex}:${event.beat}:group:${event.simultaneousGroupId.trim()}`;
  }
  return `${event.measureIndex}:${event.beat}:${event.subdivision ?? "0"}`;
}

function groupEvents(events: GuitarTabEvent[]): Map<string, GuitarTabEvent[]> {
  return events.reduce((groups, event) => {
    const key = groupKeyFor(event);
    const existing = groups.get(key) ?? [];
    existing.push(event);
    groups.set(key, existing);
    return groups;
  }, new Map<string, GuitarTabEvent[]>());
}

function issueLocation(events: GuitarTabEvent[]): Pick<GuitarTabValidationIssue, "measureIndex" | "beat" | "simultaneousGroupId"> {
  const first = events[0];
  return {
    measureIndex: first?.measureIndex,
    beat: first?.beat,
    simultaneousGroupId: first?.simultaneousGroupId,
  };
}

function isValidString(value: number): value is GuitarTabStringNumber {
  return VALID_STRINGS.has(value);
}

export function validateOneGuitarStringAssignments(
  events: GuitarTabEvent[],
  options: GuitarTabValidationOptions = {}
): GuitarTabValidationIssue[] {
  const issues: GuitarTabValidationIssue[] = [];

  for (const [key, group] of groupEvents(events)) {
    if (group.length > 6) {
      issues.push({
        code: "too-many-notes",
        message: `Simultaneous group ${key} has ${group.length} notes; a six-string guitar can sound at most 6 string events at once.`,
        ...issueLocation(group),
        events: group,
      });
    }

    const byString = new Map<GuitarTabStringNumber, GuitarTabEvent[]>();
    const bySourceEvent = new Map<string, GuitarTabEvent[]>();

    for (const event of group) {
      const matches = byString.get(event.string) ?? [];
      matches.push(event);
      byString.set(event.string, matches);

      const sourceEventId = event.sourceEventId?.trim();
      if (sourceEventId) {
        const sourceMatches = bySourceEvent.get(sourceEventId) ?? [];
        sourceMatches.push(event);
        bySourceEvent.set(sourceEventId, sourceMatches);
      } else if (options.requireSourceEventIds) {
        issues.push({
          code: "missing-source-event-id",
          message: `${event.note} at measure ${event.measureIndex}, beat ${event.beat} is missing sourceEventId; one-note-to-one-string validation requires a stable source note id.`,
          ...issueLocation([event]),
          string: event.string,
          events: [event],
        });
      }
    }

    for (const [string, stringEvents] of byString) {
      if (stringEvents.length <= 1) continue;
      issues.push({
        code: "duplicate-string",
        message: `Simultaneous group ${key} assigns ${stringEvents.map((event) => event.note).join(" + ")} to string ${string}; one guitar string cannot produce multiple pitches at the same time.`,
        ...issueLocation(stringEvents),
        string,
        events: stringEvents,
      });
    }

    for (const [sourceEventId, sourceEvents] of bySourceEvent) {
      if (sourceEvents.length <= 1) continue;
      issues.push({
        code: "duplicate-source-note",
        message: `Simultaneous group ${key} assigns source note/event ${sourceEventId} to ${sourceEvents.length} strings; one musical source event must be placed on only one guitar string.`,
        ...issueLocation(sourceEvents),
        events: sourceEvents,
      });
    }
  }

  return issues;
}

export function validateGuitarFretboardRange(
  events: GuitarTabEvent[],
  options: GuitarTabValidationOptions = {}
): GuitarTabValidationIssue[] {
  const profile = resolveGuitarPlayabilityProfile(options.guitarProfile);
  const issues: GuitarTabValidationIssue[] = [];

  for (const event of events) {
    const validString = isValidString(event.string);
    if (!validString) {
      issues.push({
        code: "invalid-string",
        message: `Invalid guitar string ${event.string}; string must be 1-6.`,
        ...issueLocation([event]),
        events: [event],
      });
    }

    if (!Number.isFinite(event.fret) || event.fret < 0) {
      issues.push({
        code: "invalid-fret",
        message: `Invalid fret ${event.fret}; fret must be zero or greater.`,
        ...issueLocation([event]),
        string: event.string,
        events: [event],
      });
      continue;
    }

    if (!validString) continue;

    if (event.fret > profile.maxFret) {
      issues.push({
        code: "fret-out-of-range",
        message: `Fret ${event.fret} is outside ${profile.label}'s fretboard range; maximum supported fret is ${profile.maxFret}.`,
        ...issueLocation([event]),
        string: event.string,
        events: [event],
      });
    }

    const actualPitch = eventPitchValue(event);
    if (actualPitch !== undefined) {
      const expectedPitch = expectedPitchValueFor(event);
      if (actualPitch !== expectedPitch) {
        issues.push({
          code: "pitch-string-mismatch",
          message: `${event.note} does not match string ${event.string} fret ${event.fret}.`,
          ...issueLocation([event]),
          string: event.string,
          events: [event],
        });
      }
    }

    const scientificPitch = parseScientificPitch(event.note);
    if (options.requireScientificPitch && !scientificPitch) {
      issues.push({
        code: "missing-octave",
        message: `${event.note} must include octave/register, e.g. E2 or F#4, so fretboard range can be proven.`,
        ...issueLocation([event]),
        string: event.string,
        events: [event],
      });
      continue;
    }

    if (scientificPitch) {
      const expectedMidi = midiForStringFret(event.string, event.fret);
      if (scientificPitch.midi !== expectedMidi) {
        issues.push({
          code: "pitch-register-mismatch",
          message: `${event.note} is not the sounding register for string ${event.string} fret ${event.fret}; expected MIDI ${expectedMidi}.`,
          ...issueLocation([event]),
          string: event.string,
          events: [event],
        });
      }
    }
  }

  return issues;
}

interface LeftHandGroupAnalysis {
  fretSpan: number;
  frettedNoteCount: number;
  frettingFingerCount: number;
  requiresBarre: boolean;
  barreFret?: number;
  playable: boolean;
  issues: GuitarTabValidationIssue[];
}

function analyzeLeftHandGroup(
  key: string,
  group: GuitarTabEvent[],
  options: GuitarTabValidationOptions
): LeftHandGroupAnalysis {
  const profile = resolveGuitarPlayabilityProfile(options.guitarProfile);
  const voicingProfile = resolveGuitarVoicingProfile(options.voicingProfile);
  const maxFretStretch = voicingProfile.maxFretStretch ?? profile.maxFretStretch ?? MAX_FRET_STRETCH;
  const allowBarre = voicingProfile.allowBarre ?? profile.allowSingleBarre;
  const frettedEvents = group.filter((event) => event.fret > 0 && isValidString(event.string));
  const frettedFrets = frettedEvents.map((event) => event.fret);
  const fretSpan = frettedFrets.length > 1 ? Math.max(...frettedFrets) - Math.min(...frettedFrets) : 0;
  const issues: GuitarTabValidationIssue[] = [];
  const eventsByFret = frettedEvents.reduce((acc, event) => {
    const matches = acc.get(event.fret) ?? [];
    matches.push(event);
    acc.set(event.fret, matches);
    return acc;
  }, new Map<number, GuitarTabEvent[]>());
  const duplicateFretGroups = Array.from(eventsByFret.entries())
    .filter(([, events]) => events.length > 1)
    .sort(([left], [right]) => left - right);
  const barreFret = allowBarre && duplicateFretGroups.length > 0 ? duplicateFretGroups[0][0] : undefined;
  const barreEventCount = barreFret === undefined ? 0 : eventsByFret.get(barreFret)?.length ?? 0;
  const requiresBarre = barreFret !== undefined;
  const frettingFingerCount = frettedEvents.length - Math.max(0, barreEventCount - 1);

  if (frettedEvents.length > profile.maxFrettingFingerCount && !allowBarre) {
    issues.push({
      code: "too-many-fretted-notes",
      message: `Simultaneous group ${key} has ${frettedEvents.length} fretted notes; the fretting hand has at most ${profile.maxFrettingFingerCount} fingers.`,
      ...issueLocation(group),
      events: group,
    });
  }

  if (frettingFingerCount > profile.maxFrettingFingerCount) {
    issues.push({
      code: "left-hand-unfingerable",
      message: `Simultaneous group ${key} needs ${frettingFingerCount} fretting fingers after barre/open-string reduction; one left hand has ${profile.maxFrettingFingerCount} fingers available.`,
      ...issueLocation(group),
      events: group,
    });
  }

  if (allowBarre && duplicateFretGroups.length > 1 && frettingFingerCount > profile.maxFrettingFingerCount) {
    issues.push({
      code: "multiple-barres",
      message: `Simultaneous group ${key} has same-fret clusters at frets ${duplicateFretGroups.map(([fret]) => fret).join(", ")}; one left hand can rely on at most one barre shape at a time.`,
      ...issueLocation(group),
      events: group,
    });
  }

  if (fretSpan > maxFretStretch) {
    issues.push({
      code: "fret-span",
      message: `Simultaneous group ${key} spans ${fretSpan} frets; maximum playable span is ${maxFretStretch}.`,
      ...issueLocation(group),
      events: group,
    });
  }

  return {
    fretSpan,
    frettedNoteCount: frettedEvents.length,
    frettingFingerCount,
    requiresBarre,
    barreFret,
    playable: issues.length === 0,
    issues,
  };
}

export function validateLeftHandReach(
  events: GuitarTabEvent[],
  options: GuitarTabValidationOptions = {}
): GuitarTabValidationIssue[] {
  return Array.from(groupEvents(events).entries()).flatMap(([key, group]) => analyzeLeftHandGroup(key, group, options).issues);
}

function validateRenderableTiming(
  events: GuitarTabEvent[],
  options: GuitarTabValidationOptions
): GuitarTabValidationIssue[] {
  if (!options.requireRenderableTiming) return [];

  return events.flatMap((event) => {
    const issues: GuitarTabValidationIssue[] = [];
    if (!Number.isInteger(event.step) || (event.step ?? 0) < 1) {
      issues.push({
        code: "invalid-grid-step",
        message: `${event.note} at measure ${event.measureIndex} needs a one-based integer grid step for ABCNotation conversion.`,
        ...issueLocation([event]),
        string: event.string,
        events: [event],
      });
    }
    if (!Number.isInteger(event.durationSteps) || (event.durationSteps ?? 0) < 1) {
      issues.push({
        code: "invalid-duration",
        message: `${event.note} at measure ${event.measureIndex} needs a positive integer durationSteps value for ABCNotation conversion.`,
        ...issueLocation([event]),
        string: event.string,
        events: [event],
      });
    }
    return issues;
  });
}

export function validateGuitarTab(
  events: GuitarTabEvent[],
  options: GuitarTabValidationOptions = {}
): GuitarTabValidationResult {
  const profile = resolveGuitarPlayabilityProfile(options.guitarProfile);
  const voicingProfile = resolveGuitarVoicingProfile(options.voicingProfile);
  const issues = [
    ...validateRenderableTiming(events, options),
    ...validateGuitarFretboardRange(events, options),
    ...validateOneGuitarStringAssignments(events, options),
    ...validateLeftHandReach(events, options),
  ];
  const validatedGroups: GuitarTabValidatedGroup[] = [];

  for (const [key, group] of groupEvents(events)) {
    const leftHand = analyzeLeftHandGroup(key, group, options);
    validatedGroups.push({
      key,
      measureIndex: group[0]?.measureIndex ?? 0,
      beat: group[0]?.beat ?? 0,
      simultaneousGroupId: group[0]?.simultaneousGroupId,
      noteCount: group.length,
      frettedNoteCount: leftHand.frettedNoteCount,
      fretSpan: leftHand.fretSpan,
      strings: group.map((event) => event.string),
      leftHandPlayable: leftHand.playable,
      frettingFingerCount: leftHand.frettingFingerCount,
      requiresBarre: leftHand.requiresBarre,
      barreFret: leftHand.barreFret,
      profileId: profile.id,
      voicingProfileId: voicingProfile.id,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    validatedGroups,
  };
}

function buildGuitarTabEventSchemaProperties() {
  return {
    measureIndex: { type: "number", description: "One-based source measure number." },
    step: { type: "integer", minimum: 1, description: "One-based sixteenth-note grid step within the measure." },
    durationSteps: { type: "integer", minimum: 1, description: "Positive duration in sixteenth-note grid steps." },
    beat: { type: "number", description: "Beat or subdivision time within the measure." },
    subdivision: { type: ["string", "number"], description: "Optional subdivision label when multiple events occur inside a beat." },
    simultaneousGroupId: { type: "string", description: "Optional explicit group id for notes that sound together." },
    sourceEventId: { type: "string", description: "Stable id for the musical source note/event. The same source note event must not be assigned to multiple strings in the same simultaneous group." },
    note: { type: "string", description: "Sounding pitch with octave/register, such as E2, B3, or F#4." },
    string: { type: "integer", enum: [1, 2, 3, 4, 5, 6], description: "Guitar string number, 1 high E through 6 low E." },
    fret: { type: "number", description: "Fret number, with 0 for an open string." },
    role: { type: "string", description: "Musical role: melody, bass, root, third, seventh, fill, percussion, etc." },
  };
}

export function buildValidGuitarTabToolSchema() {
  return {
    type: "function",
    function: {
      name: "valid_guitar_tab",
      description: "Validate concrete guitar tab events against one physical guitar before finalizing guitar profiles, voicings, fills, intro, interlude, or outro plans. Call this before the final generation tool. If invalid, revise the tab and call valid_guitar_tab again; do not finalize until every option is valid.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          context: {
            type: "string",
            description: "Short label for the option or passage being validated.",
          },
          profileId: {
            type: "string",
            enum: ["guitar-acoustic", "guitar-classic", "standard-six-string"],
            description: "Physical guitar profile used for fret range and left-hand validation.",
          },
          voicingProfileId: {
            type: "string",
            description: "Voicing/playability profile such as open-position, barre, fingerstyle-melody-bass, or power-chord.",
          },
          events: {
            type: "array",
            description: "Compact guitar tab events: m=one-based measure, t=one-based grid step, d=duration steps, b=beat, sid=source id, n=pitch, s=string, f=fret, r=role. Events sharing m + t or gid are simultaneous.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                m: { type: "number" }, t: { type: "integer", minimum: 1 }, d: { type: "integer", minimum: 1 }, b: { type: "number" }, sd: { type: ["string", "number"] }, gid: { type: "string" }, sid: { type: "string" },
                n: { type: "string" }, s: { type: "integer", enum: [1, 2, 3, 4, 5, 6] }, f: { type: "number" }, r: { type: "string" },
              },
              required: ["m", "t", "d", "b", "sid", "n", "s", "f", "r"],
            },
          },
        },
        required: ["events"],
      },
    },
  };
}
