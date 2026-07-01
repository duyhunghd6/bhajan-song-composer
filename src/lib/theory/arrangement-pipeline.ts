import { AccompanimentOptions, AccompanimentStage, generateAccompanimentStage } from "./accompaniment-stage";
import { getBeatsPerMeasure, noteNameToAbc } from "./arranger-utils";
import { FullTrackExpansionMeasure, FullTrackExpansionStage, generateFullTrackExpansionStage } from "./full-track-expansion-stage";
import { generateHarmonizationStage, HarmonizationStage } from "./harmonizer";
import { parseAbcHeader } from "./melody-analyzer";

export const ARRANGEMENT_PIPELINE_STAGE_IDS = [
  "melody",
  "harmonization",
  "accompaniment",
  "full-track-expansion",
  "full-track",
] as const;

export type ArrangementPipelineStageId = (typeof ARRANGEMENT_PIPELINE_STAGE_IDS)[number];
export type ArrangementPipelineGateState = "complete" | "available" | "locked";
export type ArrangementPipelineStageStatus = "complete";

export interface ArrangementPipelineStageDefinition {
  id: ArrangementPipelineStageId;
  label: string;
  description: string;
}

export interface ArrangementPipelineStageGate extends ArrangementPipelineStageDefinition {
  state: ArrangementPipelineGateState;
  blockedBy: ArrangementPipelineStageId[];
}

export interface MelodyPipelineStage {
  id: "melody";
  label: string;
  status: ArrangementPipelineStageStatus;
  layer: {
    number: 1;
    name: "Melody";
    instrument: "voice";
  };
  abc: string;
  key: string;
  timeSignature: string;
}

export interface HarmonizationPipelineStage {
  id: "harmonization";
  label: string;
  status: ArrangementPipelineStageStatus;
  output: HarmonizationStage;
}

export interface AccompanimentPipelineStage {
  id: "accompaniment";
  label: string;
  status: ArrangementPipelineStageStatus;
  output: AccompanimentStage;
}

export interface FullTrackExpansionPipelineStage {
  id: "full-track-expansion";
  label: string;
  status: ArrangementPipelineStageStatus;
  output: FullTrackExpansionStage;
}

export interface FullTrackPipelineStage {
  id: "full-track";
  label: string;
  status: ArrangementPipelineStageStatus;
  abc: string;
}

export type ArrangementPipelineStage =
  | MelodyPipelineStage
  | HarmonizationPipelineStage
  | AccompanimentPipelineStage
  | FullTrackExpansionPipelineStage
  | FullTrackPipelineStage;

export interface ArrangementPipelineValidation {
  enforcedOrder: boolean;
  harmonizationComplete: boolean;
  accompanimentComplete: boolean;
  fullTrackExpansionComplete: boolean;
  fullTrackReady: boolean;
}

export interface ArrangementPipelineResult {
  stages: ArrangementPipelineStage[];
  gates: ArrangementPipelineStageGate[];
  harmonization: HarmonizationStage;
  accompaniment: AccompanimentStage;
  fullTrackExpansion: FullTrackExpansionStage;
  finalAbc: string;
  validation: ArrangementPipelineValidation;
}

export interface ArrangementPipelineOptions {
  accompaniment?: Omit<AccompanimentOptions, "progression"> & {
    progression?: AccompanimentOptions["progression"];
  };
}

export type ArrangementLayerProposalRole = "melody" | "harmony" | "bass" | "rhythm" | "custom";

export interface ArrangementLayerProposal {
  id: string;
  name: string;
  role: ArrangementLayerProposalRole;
  abc: string;
  visible: boolean;
}

export const ARRANGEMENT_PIPELINE_STAGE_DEFINITIONS: ArrangementPipelineStageDefinition[] = [
  {
    id: "melody",
    label: "Melody",
    description: "Start from the source Layer 1 melody ABC.",
  },
  {
    id: "harmonization",
    label: "Harmonization",
    description: "Detect key, strong beats, functional chords, and cadence roles.",
  },
  {
    id: "accompaniment",
    label: "Accompaniment",
    description: "Generate Layer 2 piano or rhythm-guitar support from the harmonized progression.",
  },
  {
    id: "full-track-expansion",
    label: "Drums & Additional Instruments",
    description: "Add bass/kick alignment, frequency ranges, and counter-melody guidance.",
  },
  {
    id: "full-track",
    label: "Full Track",
    description: "Export the combined melody, accompaniment, and full-track guidance only after every prior stage is complete.",
  },
];

function normalizeCompletedStages(completedStages: Iterable<ArrangementPipelineStageId>): Set<ArrangementPipelineStageId> {
  return new Set(completedStages);
}

function getPreviousStageIds(stageId: ArrangementPipelineStageId): ArrangementPipelineStageId[] {
  const stageIndex = ARRANGEMENT_PIPELINE_STAGE_IDS.indexOf(stageId);
  return ARRANGEMENT_PIPELINE_STAGE_IDS.slice(0, Math.max(stageIndex, 0));
}

export function getArrangementPipelineStageGates(
  completedStages: Iterable<ArrangementPipelineStageId>
): ArrangementPipelineStageGate[] {
  const completed = normalizeCompletedStages(completedStages);

  return ARRANGEMENT_PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    const blockedBy = getPreviousStageIds(definition.id).filter((stageId) => !completed.has(stageId));
    const state: ArrangementPipelineGateState = completed.has(definition.id)
      ? "complete"
      : blockedBy.length === 0
        ? "available"
        : "locked";

    return { ...definition, state, blockedBy };
  });
}

export function buildHarmonizationSummary(stage: HarmonizationStage): string {
  return [
    "% --- Pipeline Stage 2: Harmonization ---",
    `% Key: ${stage.key} · Scale: ${stage.scale} · Meter: ${stage.timeSignature}`,
    `% Chord progression: ${stage.progression.join(" | ")}`,
    `% Cadence roles: ${stage.measures.map((measure) => measure.cadenceRole).join(" | ")}`,
  ].join("\n");
}

function buildFullTrackAbc(melodyAbc: string, harmonization: HarmonizationStage, accompaniment: AccompanimentStage, fullTrackExpansion: FullTrackExpansionStage): string {
  return [
    melodyAbc.trim(),
    buildHarmonizationSummary(harmonization),
    accompaniment.abc.trim(),
    fullTrackExpansion.abc.trim(),
    buildBassMapAbc(fullTrackExpansion),
    buildCounterMelodyAbc(fullTrackExpansion),
  ].join("\n\n");
}

function buildBassMapAbc(stage: FullTrackExpansionStage): string {
  const beatCount = getBeatsPerMeasure(stage.timeSignature);
  const wholeMeasureDuration = beatCount * 2;
  const measures = stage.measures.map((measure) => {
    const firstBassEvent = measure.bassMap[0];
    return firstBassEvent ? `${noteNameToAbc(firstBassEvent.note, ",,")}${wholeMeasureDuration}` : `z${wholeMeasureDuration}`;
  });

  return [
    `V:Bass clef=bass name="Generated Bass Map"`,
    `% Source: full-track expansion bass/kick alignment`,
    `| ${measures.join(" | ")} |`,
  ].join("\n");
}

function buildCounterMelodyMeasureAbc(measure: FullTrackExpansionMeasure, beatCount: number): string {
  if (measure.counterMelodies.length === 0) return `z${beatCount * 2}`;

  const eventsByBeat = new Map(measure.counterMelodies.map((event) => [event.beat, event]));
  const tokens = Array.from({ length: beatCount }, (_, index) => {
    const beat = index + 1;
    const event = eventsByBeat.get(beat);
    if (!event) return "z2";

    const notes = event.notes.map((note) => noteNameToAbc(note, "'")).join("");
    return `[${notes}]2`;
  });

  return tokens.join(" ");
}

function buildCounterMelodyAbc(stage: FullTrackExpansionStage): string {
  const beatCount = getBeatsPerMeasure(stage.timeSignature);
  const measures = stage.measures.map((measure) => buildCounterMelodyMeasureAbc(measure, beatCount));

  return [
    `V:CounterMelody name="Generated Counter-Melody"`,
    `% Source: full-track expansion melodic gap fills`,
    `| ${measures.join(" | ")} |`,
  ].join("\n");
}

export function buildArrangementLayerProposals(pipeline: ArrangementPipelineResult): ArrangementLayerProposal[] {
  return [
    {
      id: "pipeline-harmonization",
      name: "Generated Harmonization",
      role: "harmony",
      visible: true,
      abc: buildHarmonizationSummary(pipeline.harmonization),
    },
    {
      id: "pipeline-accompaniment",
      name: "Generated Accompaniment",
      role: "harmony",
      visible: true,
      abc: pipeline.accompaniment.abc.trim(),
    },
    {
      id: "pipeline-drums",
      name: "Generated Drum Guidance",
      role: "rhythm",
      visible: true,
      abc: pipeline.fullTrackExpansion.abc.trim(),
    },
    {
      id: "pipeline-bass",
      name: "Generated Bass Map",
      role: "bass",
      visible: true,
      abc: buildBassMapAbc(pipeline.fullTrackExpansion),
    },
    {
      id: "pipeline-counter-melody",
      name: "Generated Counter-Melody",
      role: "custom",
      visible: true,
      abc: buildCounterMelodyAbc(pipeline.fullTrackExpansion),
    },
  ];
}

export function generateArrangementPipeline(
  melodyAbc: string,
  options: ArrangementPipelineOptions = {}
): ArrangementPipelineResult {
  const melodyHeader = parseAbcHeader(melodyAbc);
  const harmonization = generateHarmonizationStage(melodyAbc);
  const accompaniment = generateAccompanimentStage(melodyAbc, {
    ...options.accompaniment,
    progression: options.accompaniment?.progression ?? harmonization.progression,
  });
  const fullTrackExpansion = generateFullTrackExpansionStage(melodyAbc, { accompaniment });
  const finalAbc = buildFullTrackAbc(melodyAbc, harmonization, accompaniment, fullTrackExpansion);

  const stages: ArrangementPipelineStage[] = [
    {
      id: "melody",
      label: "Melody",
      status: "complete",
      layer: { number: 1, name: "Melody", instrument: "voice" },
      abc: melodyAbc,
      key: melodyHeader.key,
      timeSignature: melodyHeader.timeSignature,
    },
    { id: "harmonization", label: "Harmonization", status: "complete", output: harmonization },
    { id: "accompaniment", label: "Accompaniment", status: "complete", output: accompaniment },
    {
      id: "full-track-expansion",
      label: "Drums & Additional Instruments",
      status: "complete",
      output: fullTrackExpansion,
    },
    { id: "full-track", label: "Full Track", status: "complete", abc: finalAbc },
  ];

  const completedStageIds = stages.map((stage) => stage.id);
  const gates = getArrangementPipelineStageGates(completedStageIds);

  return {
    stages,
    gates,
    harmonization,
    accompaniment,
    fullTrackExpansion,
    finalAbc,
    validation: {
      enforcedOrder: stages.every((stage, index) => stage.id === ARRANGEMENT_PIPELINE_STAGE_IDS[index]),
      harmonizationComplete: harmonization.progression.length > 0,
      accompanimentComplete: accompaniment.measures.length > 0,
      fullTrackExpansionComplete: fullTrackExpansion.measures.length > 0,
      fullTrackReady: gates.every((gate) => gate.state === "complete"),
    },
  };
}
