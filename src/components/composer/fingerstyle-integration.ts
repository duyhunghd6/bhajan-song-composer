import { getGuitarFretY, getGuitarStringX, type GuitarFretPosition } from "../instruments/GuitarFretboard";
import type { InstrumentNoteMarker } from "../instruments/InstrumentNoteMarkers";
import { generateFingerstyleArrangement, type FingerstyleArrangement } from "@/lib/theory/fingerstyle-arranger";
import type { FingerstyleCompressionOptions } from "@/lib/theory/fingerstyle-compressor";
import type { ComposerLayer } from "./LayerManager";

export type FingerstyleComposerProfileId = NonNullable<FingerstyleCompressionOptions["pickingProfile"]>;

export interface FingerstyleComposerIntegrationOptions extends FingerstyleCompressionOptions {
  workflowOptionData?: Record<string, unknown>;
}

export interface FingerstyleComposerProfileOption {
  id: FingerstyleComposerProfileId;
  label: string;
  description: string;
}

export interface FingerstyleComposerIntegration {
  selectedProfile: FingerstyleComposerProfileOption;
  arrangement: FingerstyleArrangement;
  composerLayer: ComposerLayer;
  playability: {
    status: "ready_for_integration" | "needs_review";
    valid: boolean;
    maxFretSpan: number;
    failedConstraints: string[];
  };
  fretboard: {
    positions: GuitarFretPosition[];
  };
  noteMarkers: InstrumentNoteMarker[];
  workflowOptionData?: Record<string, unknown>;
}

export const FINGERSTYLE_PROFILE_OPTIONS: FingerstyleComposerProfileOption[] = [
  {
    id: "strict-pima",
    label: "Strict PIMA",
    description: "Classical floating-hand assignment for polyphonic melody and bass clarity.",
  },
  {
    id: "folk-travis",
    label: "Folk / Travis Override",
    description: "Anchored thumb-clock groove with syncopated treble and string-slap backbeats.",
  },
];

function profileOptionFor(profileId: FingerstyleComposerProfileId): FingerstyleComposerProfileOption {
  return FINGERSTYLE_PROFILE_OPTIONS.find((profile) => profile.id === profileId) ?? FINGERSTYLE_PROFILE_OPTIONS[0];
}

function toneForRole(role: string): GuitarFretPosition["tone"] {
  if (role === "bass") return "bass";
  if (role === "melody") return "melody";
  if (role === "root") return "root";
  return "chord";
}

function buildComposerLayer(arrangement: FingerstyleArrangement, profile: FingerstyleComposerProfileOption, sourceAbc: string): ComposerLayer {
  const sourceLength = sourceAbc.split(/\r?\n/).find((line) => line.trim().startsWith("L:"))?.trim() ?? "L:1/8";
  const sourceTempo = sourceAbc.split(/\r?\n/).find((line) => line.trim().startsWith("Q:"))?.trim() ?? "Q:1/4=120";
  return {
    id: `fingerstyle-guitar-${profile.id}`,
    name: `Fingerstyle Guitar (${profile.label})`,
    role: "custom",
    visible: true,
    abc: [
      "X:10",
      `T:Fingerstyle Guitar (${profile.label})`,
      `M:${arrangement.timeSignature}`,
      sourceLength,
      sourceTempo,
      `K:${arrangement.key}`,
      arrangement.abc,
    ].join("\n"),
  };
}

function buildPlayability(arrangement: FingerstyleArrangement): FingerstyleComposerIntegration["playability"] {
  const measures = arrangement.outputContract.playabilityReport.measures;
  const failedConstraints = Array.from(new Set(measures.flatMap((measure) => measure.failedConstraints)));
  const maxFretSpan = Math.max(0, ...measures.map((measure) => measure.fretSpan));
  const valid = arrangement.outputContract.playabilityReport.valid;

  return {
    status: valid ? "ready_for_integration" : "needs_review",
    valid,
    maxFretSpan,
    failedConstraints,
  };
}

function buildFretboardPositions(arrangement: FingerstyleArrangement): GuitarFretPosition[] {
  const firstMeasure = arrangement.outputContract.artifacts.tablature.measures[0];
  if (!firstMeasure) return [];

  return firstMeasure.positions.map((position) => ({
    string: position.string,
    fret: position.fret,
    note: position.note ?? undefined,
    tone: toneForRole(position.role),
  }));
}

function buildNoteMarkers(arrangement: FingerstyleArrangement): InstrumentNoteMarker[] {
  return arrangement.outputContract.artifacts.noteMarkerEvents.map((event) => {
    const targetString = event.string ?? 3;
    const targetFret = event.fret === 0 ? 0 : Math.max(1, event.fret);

    return {
      id: `fingerstyle-${event.sourceHand}-${event.measureIndex}-${event.beat}-${event.technique}-${event.string ?? "body"}-${event.fret}`,
      hand: event.hand,
      fingerNumber: event.fingerNumber,
      x: getGuitarStringX(targetString),
      y: getGuitarFretY(targetFret),
      noteLabel: event.string === null ? event.technique : `string ${event.string} fret ${event.fret}`,
      techniqueLabel: event.musicalFingering
        ? `${event.technique} (${event.musicalFingering})`
        : event.technique,
      measureIndex: event.measureIndex,
      beat: event.beat,
    };
  });
}

export function buildFingerstyleComposerIntegration(
  abcString: string,
  progression?: string[],
  options: FingerstyleComposerIntegrationOptions = {}
): FingerstyleComposerIntegration {
  const arrangement = generateFingerstyleArrangement(abcString, progression, {
    pickingProfile: options.pickingProfile,
    workflowOptionData: options.workflowOptionData,
  });
  const selectedProfile = profileOptionFor(options.pickingProfile ?? arrangement.outputContract.profileMetadata.id);

  const noteMarkers = buildNoteMarkers(arrangement);

  return {
    selectedProfile,
    arrangement,
    composerLayer: buildComposerLayer(arrangement, selectedProfile, abcString),
    playability: buildPlayability(arrangement),
    fretboard: { positions: buildFretboardPositions(arrangement) },
    noteMarkers,
    workflowOptionData: options.workflowOptionData,
  };
}
