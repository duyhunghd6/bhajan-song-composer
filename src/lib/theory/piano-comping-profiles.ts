import { ChordInfo } from "./chords";
import { noteNameToAbc } from "./arranger-utils";

export type PianoCompingProfileId = "pop-ballad" | "rock-rnb" | "classical-folk";
export type PianoCompingStyle = "Pop/Ballad" | "Rock/R&B" | "Classical/Folk";
export type PianoCompingHand = "left" | "right";
export type PianoCompingRole = "root" | "fifth" | "tenth" | "octave" | "off-beat-chord" | "alberti-third";
export type PianoCompingArticulation = "legato" | "staccato" | "syncopated";

export interface PianoCompingEvent {
  beat: number;
  hand: PianoCompingHand;
  role: PianoCompingRole;
  notes: string[];
  abc: string;
  articulation: PianoCompingArticulation;
}

export interface PianoCompingProfileMeasure {
  measureIndex: number;
  chord: string;
  profileId: PianoCompingProfileId;
  style: PianoCompingStyle;
  rhythmicFeel: string;
  events: PianoCompingEvent[];
  leftHandAbc: string;
  rightHandAbc: string;
}

const PROFILE_STYLE: Record<PianoCompingProfileId, PianoCompingStyle> = {
  "pop-ballad": "Pop/Ballad",
  "rock-rnb": "Rock/R&B",
  "classical-folk": "Classical/Folk",
};

const PROFILE_FEEL: Record<PianoCompingProfileId, string> = {
  "pop-ballad": "1-5-10 arpeggiation",
  "rock-rnb": "staccato octave off-beat comping",
  "classical-folk": "Alberti bass",
};

function buildPopBalladEvents(chord: ChordInfo, beatCount: number): PianoCompingEvent[] {
  const [root, third, fifth] = chord.notes;
  const pattern: PianoCompingEvent[] = [
    { beat: 1, hand: "left", role: "root", notes: [root], abc: `${noteNameToAbc(root, ",,")}2`, articulation: "legato" },
    { beat: 2, hand: "left", role: "fifth", notes: [fifth], abc: `${noteNameToAbc(fifth, ",,")}2`, articulation: "legato" },
    { beat: 3, hand: "left", role: "tenth", notes: [third], abc: `${noteNameToAbc(third, ",")}2`, articulation: "legato" },
    { beat: 4, hand: "left", role: "fifth", notes: [fifth], abc: `${noteNameToAbc(fifth, ",,")}2`, articulation: "legato" },
  ];

  return Array.from({ length: beatCount }, (_, index) => ({ ...pattern[index % pattern.length], beat: index + 1 }));
}

function buildRockRnbEvents(chord: ChordInfo, beatCount: number): PianoCompingEvent[] {
  const [root, third, fifth] = chord.notes;
  const octave = `[${noteNameToAbc(root, ",,")}${noteNameToAbc(root, ",")}]1`;
  const offBeatChord = `[${noteNameToAbc(third, ",")}${noteNameToAbc(fifth, ",")}]1`;
  const pattern: PianoCompingEvent[] = [
    { beat: 1, hand: "left", role: "octave", notes: [root, root], abc: octave, articulation: "staccato" },
    { beat: 2, hand: "right", role: "off-beat-chord", notes: [third, fifth], abc: offBeatChord, articulation: "syncopated" },
    { beat: 3, hand: "left", role: "octave", notes: [root, root], abc: octave, articulation: "staccato" },
    { beat: 4, hand: "right", role: "off-beat-chord", notes: [third, fifth], abc: offBeatChord, articulation: "syncopated" },
  ];

  return Array.from({ length: beatCount }, (_, index) => ({ ...pattern[index % pattern.length], beat: index + 1 }));
}

function buildClassicalFolkEvents(chord: ChordInfo, beatCount: number): PianoCompingEvent[] {
  return buildPopBalladEvents(chord, beatCount).map((event) =>
    event.role === "tenth" ? { ...event, role: "alberti-third" } : event
  );
}

function buildMeasureAbc(events: PianoCompingEvent[], hand: PianoCompingHand): string {
  if (!events.some((event) => event.hand === hand)) return "";
  return events.map((event) => (event.hand === hand ? event.abc : "z1")).join(" ");
}

export function generatePianoCompingProfileMeasure(
  chord: ChordInfo,
  measureIndex: number,
  profileId: PianoCompingProfileId,
  beatCount: number
): PianoCompingProfileMeasure {
  const events = profileId === "rock-rnb"
    ? buildRockRnbEvents(chord, beatCount)
    : profileId === "classical-folk"
      ? buildClassicalFolkEvents(chord, beatCount)
      : buildPopBalladEvents(chord, beatCount);

  return {
    measureIndex,
    chord: chord.chordName,
    profileId,
    style: PROFILE_STYLE[profileId],
    rhythmicFeel: PROFILE_FEEL[profileId],
    events,
    leftHandAbc: buildMeasureAbc(events, "left"),
    rightHandAbc: buildMeasureAbc(events, "right"),
  };
}
