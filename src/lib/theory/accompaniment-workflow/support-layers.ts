import type { AccompanimentStage } from "../accompaniment-stage";
import type { AccompanimentWorkflowSession } from "./definition";

export interface AccompanimentSupportLayerBundle {
  djembe: string | null;
  combined: string | null;
}

interface GenerateAccompanimentSupportLayersOptions {
  accompaniment: AccompanimentStage | null;
  workflow: AccompanimentWorkflowSession | null;
}

export function generateAccompanimentSupportLayers(
  melodyAbc: string,
  { accompaniment, workflow }: GenerateAccompanimentSupportLayersOptions
): AccompanimentSupportLayerBundle {
  // Djembe is no longer an accompaniment-workflow branch. Keep this adapter
  // for callers that compose the final preview from optional support layers.
  void melodyAbc;
  void accompaniment;
  void workflow;
  return { djembe: null, combined: null };
}
