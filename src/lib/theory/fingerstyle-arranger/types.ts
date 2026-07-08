import type { AccompanimentStage } from "../accompaniment-stage";
import type { FingerstyleDownwardCompression, FingerstylePhysicalHandEvent, GuitarStringNumber } from "../fingerstyle-compressor";
import type { FullTrackExpansionStage } from "../full-track-expansion-stage";
import type { CadenceRole } from "../harmonizer";
import type { GuitarTabEvent } from "../guitar-tab-validation";

export interface FingerstyleMeasure {
  measureIndex: number;
  chord: string;
  bassNotes: string[];
  melodyNotes: string[];
  abc: string;
}

export type FingerstyleUpwardConstructionLayerId =
  | "melody"
  | "harmonization"
  | "accompaniment"
  | "bassline"
  | "rhythm-percussion"
  | "counter-melody";

export interface FingerstyleMelodySourceLayer {
  id: "melody";
  layer: {
    number: 1;
    name: "Melody";
    instrument: "voice";
  };
  measures: Array<{
    measureIndex: number;
    notes: string[];
  }>;
}

export interface FingerstyleHarmonizationSourceLayer {
  id: "harmonization";
  progression: string[];
  measures: Array<{
    measureIndex: number;
    chord: string;
    cadenceRole: CadenceRole;
  }>;
}

export interface FingerstyleAccompanimentSourceLayer {
  id: "accompaniment";
  layer: AccompanimentStage["layer"];
  measures: AccompanimentStage["measures"];
}

export interface FingerstyleBasslineSourceLayer {
  id: "bassline";
  measures: Array<{
    measureIndex: number;
    chord: string;
    bassMap: FullTrackExpansionStage["measures"][number]["bassMap"];
  }>;
}

export interface FingerstyleRhythmPercussionSourceLayer {
  id: "rhythm-percussion";
  measures: Array<{
    measureIndex: number;
    chord: string;
    drums: FullTrackExpansionStage["measures"][number]["drums"];
  }>;
}

export interface FingerstyleCounterMelodySourceLayer {
  id: "counter-melody";
  measures: Array<{
    measureIndex: number;
    chord: string;
    melodicGaps: FullTrackExpansionStage["measures"][number]["melodicGaps"];
    counterMelodies: FullTrackExpansionStage["measures"][number]["counterMelodies"];
  }>;
}

export type FingerstyleUpwardConstructionLayer =
  | FingerstyleMelodySourceLayer
  | FingerstyleHarmonizationSourceLayer
  | FingerstyleAccompanimentSourceLayer
  | FingerstyleBasslineSourceLayer
  | FingerstyleRhythmPercussionSourceLayer
  | FingerstyleCounterMelodySourceLayer;

export interface FingerstyleUpwardConstructionContext {
  layers: FingerstyleUpwardConstructionLayer[];
  validation: {
    melodyReady: boolean;
    harmonizationReady: boolean;
    accompanimentReady: boolean;
    basslineReady: boolean;
    rhythmPercussionReady: boolean;
    counterMelodyUsesMelodicGaps: boolean;
  };
}

export type FingerstyleFailedConstraint =
  | "fret-span"
  | "fretting-assignments"
  | "picking-assignments"
  | "strict-pima"
  | "thumb-clock"
  | "string-slap";

export interface FingerstylePlayabilityMeasureReport {
  measureIndex: number;
  chord: string;
  fretSpan: number;
  maxFretSpan: number;
  simultaneousMelodyBassFeasible: boolean;
  frettingFingerCount: number;
  pickingFingerCount: number;
  failedConstraints: FingerstyleFailedConstraint[];
}

export interface FingerstylePlayabilityReport {
  valid: boolean;
  measures: FingerstylePlayabilityMeasureReport[];
}

export interface FingerstyleRhythmicEvent {
  measureIndex: number;
  chord: string;
  beat: number;
  role: FingerstylePhysicalHandEvent["role"];
  technique: FingerstylePhysicalHandEvent["technique"];
  pickingFinger: FingerstylePhysicalHandEvent["pickingFinger"];
  string: GuitarStringNumber | null;
  fret: number;
}

export interface FingerstyleProfileMetadata {
  id: FingerstyleDownwardCompression["physicalHandMapping"][number]["profile"]["id"];
  posture: FingerstyleDownwardCompression["physicalHandMapping"][number]["profile"]["posture"];
  pickingAssignments: Record<GuitarStringNumber, FingerstylePhysicalHandEvent["pickingFinger"][]>;
}

export interface FingerstyleTablaturePosition {
  note: string | null;
  string: GuitarStringNumber;
  fret: number;
  beat: number;
  role: FingerstylePhysicalHandEvent["role"];
  technique: FingerstylePhysicalHandEvent["technique"];
}

export interface FingerstyleTablatureMeasure {
  measureIndex: number;
  positions: FingerstyleTablaturePosition[];
}

export type FingerstyleFretboardHighlightEvent = FingerstyleTablaturePosition & {
  measureIndex: number;
};

export interface FingerstyleNoteMarkerEvent {
  measureIndex: number;
  beat: number;
  hand: "left" | "right";
  sourceHand: "fretting" | "picking";
  fingerNumber: 1 | 2 | 3 | 4 | 5;
  musicalFingering?: string;
  technique: FingerstylePhysicalHandEvent["technique"];
  string: GuitarStringNumber | null;
  fret: number;
}

export type FingerstyleFormSectionKind = "intro" | "body" | "interlude" | "outro";

export interface FingerstyleFormSection {
  kind: FingerstyleFormSectionKind;
  label: string;
  startMeasureIndex: number;
  measureCount: number;
  source: string;
  placement: string;
}

export interface FingerstyleFormPlan {
  sections: FingerstyleFormSection[];
}

export interface FingerstyleGeneratedArtifacts {
  finalAbc: string;
  formPlan: FingerstyleFormPlan;
  guitarTabEvents: GuitarTabEvent[];
  tablature: {
    measures: FingerstyleTablatureMeasure[];
  };
  fretboardHighlightEvents: FingerstyleFretboardHighlightEvent[];
  noteMarkerEvents: FingerstyleNoteMarkerEvent[];
  appliedWorkflowOption?: {
    pickingProfile: string;
    bassStrategy?: string;
    usedCanonicalGuitarTabEvents: boolean;
  };
}

export interface FingerstyleOutputContract {
  sourceLayers: FingerstyleUpwardConstructionLayer[];
  outerVoiceMap: FingerstyleDownwardCompression["outerVoiceMap"];
  playabilityReport: FingerstylePlayabilityReport;
  fallbackSuggestions: FingerstyleDownwardCompression["fallbackSuggestions"];
  innerVoiceReduction: FingerstyleDownwardCompression["innerVoiceReduction"];
  rhythmicEventMap: FingerstyleRhythmicEvent[];
  profileMetadata: FingerstyleProfileMetadata;
  artifacts: FingerstyleGeneratedArtifacts;
}

export interface FingerstyleArrangement {
  key: string;
  timeSignature: string;
  upwardConstruction: FingerstyleUpwardConstructionContext;
  downwardCompression: FingerstyleDownwardCompression;
  outputContract: FingerstyleOutputContract;
  measures: FingerstyleMeasure[];
  abc: string;
}
