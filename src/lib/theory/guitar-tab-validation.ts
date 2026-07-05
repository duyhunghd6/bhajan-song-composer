import { MAX_FRET_STRETCH } from "./guitar-playability";
import { getNoteValue } from "./scales";

export type GuitarTabStringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface GuitarTabEvent {
  measureIndex: number;
  beat: number;
  subdivision?: string | number;
  simultaneousGroupId?: string;
  note: string;
  string: GuitarTabStringNumber;
  fret: number;
  role: string;
}

export interface GuitarTabValidationIssue {
  code:
    | "invalid-string"
    | "invalid-fret"
    | "duplicate-string"
    | "too-many-notes"
    | "too-many-fretted-notes"
    | "fret-span"
    | "pitch-string-mismatch";
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

export function validateGuitarTab(events: GuitarTabEvent[]): GuitarTabValidationResult {
  const issues: GuitarTabValidationIssue[] = [];

  for (const event of events) {
    if (!VALID_STRINGS.has(event.string)) {
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
    }

    const actualPitch = eventPitchValue(event);
    if (actualPitch !== undefined && VALID_STRINGS.has(event.string) && event.fret >= 0) {
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
  }

  const validatedGroups: GuitarTabValidatedGroup[] = [];

  for (const [key, group] of groupEvents(events)) {
    const frettedFrets = group.filter((event) => event.fret > 0).map((event) => event.fret);
    const fretSpan = frettedFrets.length > 1 ? Math.max(...frettedFrets) - Math.min(...frettedFrets) : 0;
    const strings = group.map((event) => event.string);
    const frettedNoteCount = frettedFrets.length;

    validatedGroups.push({
      key,
      measureIndex: group[0]?.measureIndex ?? 0,
      beat: group[0]?.beat ?? 0,
      simultaneousGroupId: group[0]?.simultaneousGroupId,
      noteCount: group.length,
      frettedNoteCount,
      fretSpan,
      strings,
    });

    if (group.length > 6) {
      issues.push({
        code: "too-many-notes",
        message: `Simultaneous group ${key} has ${group.length} notes; a six-string guitar can sound at most 6 string events at once.`,
        ...issueLocation(group),
        events: group,
      });
    }

    if (frettedNoteCount > 4) {
      issues.push({
        code: "too-many-fretted-notes",
        message: `Simultaneous group ${key} has ${frettedNoteCount} fretted notes; the fretting hand has at most 4 fingers.`,
        ...issueLocation(group),
        events: group,
      });
    }

    if (fretSpan > MAX_FRET_STRETCH) {
      issues.push({
        code: "fret-span",
        message: `Simultaneous group ${key} spans ${fretSpan} frets; maximum playable span is ${MAX_FRET_STRETCH}.`,
        ...issueLocation(group),
        events: group,
      });
    }

    const byString = new Map<GuitarTabStringNumber, GuitarTabEvent[]>();
    for (const event of group) {
      const matches = byString.get(event.string) ?? [];
      matches.push(event);
      byString.set(event.string, matches);
    }

    for (const [string, stringEvents] of byString) {
      if (stringEvents.length <= 1) continue;
      // One physical string has only one speaking length at a time. This is the
      // hard invariant that rejects cases such as simultaneous E3 and G3 both
      // assigned to low-E string 6.
      issues.push({
        code: "duplicate-string",
        message: `Simultaneous group ${key} assigns ${stringEvents.map((event) => event.note).join(" + ")} to string ${string}; one guitar string cannot produce multiple pitches at the same time.`,
        ...issueLocation(stringEvents),
        string,
        events: stringEvents,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    validatedGroups,
  };
}

export function buildValidGuitarTabToolSchema() {
  return {
    type: "function",
    function: {
      name: "valid_guitar_tab",
      description: "Validate concrete guitar tab events before finalizing guitar voicings, fills, intro, interlude, or outro plans. Call this before the final generation tool. If invalid, revise the tab and call valid_guitar_tab again; do not finalize until every option is valid.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          context: {
            type: "string",
            description: "Short label for the option or passage being validated.",
          },
          events: {
            type: "array",
            description: "Concrete guitar tab events to validate. Events that share measureIndex + beat + subdivision or simultaneousGroupId are treated as simultaneous.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                measureIndex: { type: "number", description: "Zero-based or one-based measure index; use consistently." },
                beat: { type: "number", description: "Beat or subdivision time within the measure." },
                subdivision: { type: ["string", "number"], description: "Optional subdivision label when multiple events occur inside a beat." },
                simultaneousGroupId: { type: "string", description: "Optional explicit group id for notes that sound together." },
                note: { type: "string", description: "Sounding pitch label such as E3, G3, B, or F#4." },
                string: { type: "integer", enum: [1, 2, 3, 4, 5, 6], description: "Guitar string number, 1 high E through 6 low E." },
                fret: { type: "number", description: "Fret number, with 0 for an open string." },
                role: { type: "string", description: "Musical role: melody, bass, root, third, seventh, fill, percussion, etc." },
              },
              required: ["measureIndex", "beat", "note", "string", "fret", "role"],
            },
          },
        },
        required: ["events"],
      },
    },
  };
}
