import { getGuitarFretY, getGuitarStringX, type GuitarFretPosition } from "../instruments/GuitarFretboard";
import {
  buildSvgHandTransitionPathEvents,
  type SvgHandFingeringEvent,
  type SvgHandTransitionPathEvent,
} from "../instruments/SvgHandsOverlay";
import { generateFingerstyleArrangement, type FingerstyleArrangement } from "@/lib/theory/fingerstyle-arranger";
import type { FingerstyleCompressionOptions } from "@/lib/theory/fingerstyle-compressor";
import type { ComposerLayer } from "./LayerManager";

export type FingerstyleComposerProfileId = NonNullable<FingerstyleCompressionOptions["pickingProfile"]>;

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
  handOverlayEvents: SvgHandFingeringEvent[];
  transitionPathEvents: SvgHandTransitionPathEvent[];
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

function beatsPerMeasure(timeSignature: string): number {
  const [beats] = timeSignature.split("/");
  const parsed = Number(beats);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

function toneForRole(role: string): GuitarFretPosition["tone"] {
  if (role === "bass") return "bass";
  if (role === "melody") return "melody";
  if (role === "root") return "root";
  return "chord";
}

function buildComposerLayer(arrangement: FingerstyleArrangement, profile: FingerstyleComposerProfileOption): ComposerLayer {
  return {
    id: `fingerstyle-guitar-${profile.id}`,
    name: `Fingerstyle Guitar (${profile.label})`,
    role: "custom",
    visible: true,
    abc: [
      "X:10",
      `T:Fingerstyle Guitar (${profile.label})`,
      `M:${arrangement.timeSignature}`,
      "L:1/8",
      "Q:1/4=120",
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

function buildHandOverlayEvents(arrangement: FingerstyleArrangement): SvgHandFingeringEvent[] {
  const beats = beatsPerMeasure(arrangement.timeSignature);
  const secondsPerBeat = 0.5;

  return arrangement.outputContract.artifacts.handOverlayEvents.map((event) => {
    const targetString = event.string ?? 3;
    const targetFret = event.fret === 0 ? 0 : Math.max(1, event.fret);

    return {
      id: `fingerstyle-${event.hand}-${event.measureIndex}-${event.beat}-${event.technique}-${event.string ?? "body"}-${event.fret}`,
      instrument: "guitar",
      hand: event.hand === "picking" ? "right" : "left",
      finger: event.finger,
      target: {
        x: getGuitarStringX(targetString),
        y: getGuitarFretY(targetFret),
        label: event.string === null ? event.technique : `${event.technique} string ${event.string} fret ${event.fret}`,
      },
      cursorSeconds: (event.measureIndex * beats + event.beat - 1) * secondsPerBeat,
      measureIndex: event.measureIndex,
      beat: event.beat,
    };
  });
}

export function buildFingerstyleComposerIntegration(
  abcString: string,
  progression?: string[],
  options: FingerstyleCompressionOptions = {}
): FingerstyleComposerIntegration {
  const arrangement = generateFingerstyleArrangement(abcString, progression, options);
  const selectedProfile = profileOptionFor(options.pickingProfile ?? arrangement.outputContract.profileMetadata.id);

  const handOverlayEvents = buildHandOverlayEvents(arrangement);

  return {
    selectedProfile,
    arrangement,
    composerLayer: buildComposerLayer(arrangement, selectedProfile),
    playability: buildPlayability(arrangement),
    fretboard: { positions: buildFretboardPositions(arrangement) },
    handOverlayEvents,
    transitionPathEvents: buildSvgHandTransitionPathEvents(handOverlayEvents),
  };
}
