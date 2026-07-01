import { describe, expect, it } from "vitest";
import {
  ARRANGEMENT_PIPELINE_STAGE_IDS,
  generateArrangementPipeline,
  getArrangementPipelineStageGates,
} from "../arrangement-pipeline";

const sampleAbc = `X:1
T:Pipeline Sample
M:4/4
L:1/8
Q:1/4=96
K:Em
| E2 G2 z2 B2 | B4 z2 A2 | G2 A2 B2 G2 | E8 |`;

describe("Arrangement pipeline orchestrator", () => {
  it("generates the Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track workflow in order", () => {
    const pipeline = generateArrangementPipeline(sampleAbc, {
      accompaniment: { instrument: "piano", compingPattern: "arpeggio" },
    });

    expect(pipeline.stages.map((stage) => stage.id)).toEqual(ARRANGEMENT_PIPELINE_STAGE_IDS);
    expect(pipeline.stages.every((stage) => stage.status === "complete")).toBe(true);
    expect(pipeline.validation).toMatchObject({
      enforcedOrder: true,
      harmonizationComplete: true,
      accompanimentComplete: true,
      fullTrackExpansionComplete: true,
      fullTrackReady: true,
    });
    expect(pipeline.finalAbc).toContain("T:Pipeline Sample");
    expect(pipeline.finalAbc).toContain("V:Accompaniment clef=bass name=\"Layer 2 Piano Accompaniment\"");
    expect(pipeline.finalAbc).toContain("V:Drums perc name=\"Layer 3 Drum Guidance\"");
  });

  it("locks downstream UI stage gates until every earlier stage is complete", () => {
    const gates = getArrangementPipelineStageGates(new Set(["melody"]));

    expect(gates.map((gate) => ({ id: gate.id, state: gate.state }))).toEqual([
      { id: "melody", state: "complete" },
      { id: "harmonization", state: "available" },
      { id: "accompaniment", state: "locked" },
      { id: "full-track-expansion", state: "locked" },
      { id: "full-track", state: "locked" },
    ]);
    expect(gates.find((gate) => gate.id === "full-track")?.blockedBy).toEqual([
      "harmonization",
      "accompaniment",
      "full-track-expansion",
    ]);
  });
});
