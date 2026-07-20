import { describe, expect, it } from "vitest";

import {
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  clearAccompanimentWorkflowStepResults,
  createAccompanimentWorkflowSession,
  mergeRun,
  selectOption,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";
import {
  buildArrangementPreviewModel,
  getArrangementRenderOptionsFor,
} from "../arrangement-preview-model";
import { ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS } from "../preview";

const sampleAbc = `X:1
T:Preview Model Sample
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 | G4 G4 |`;

const harmonizedAbc = `X:1
T:Preview Model Sample
M:4/4
L:1/8
K:C
| "C"C2 D2 "F"E2 F2 | "G"G4 "C"G4 |`;

const guitarAbc = `X:1
T:Guitar Layer
M:4/4
L:1/8
K:C
V:Guitar clef=treble
[V:Guitar] C2 G2 E2 G2 | C2 G2 E2 G2 |`;

const djembeOnlySetup = {
  style: "solo-fingerstyle" as const,
  instruments: [
    { id: "guitar-classic" as const, enabled: false, order: 0 },
    { id: "indian-harmonium" as const, enabled: false, order: 1 },
    { id: "djembe" as const, enabled: true, order: 2 },
  ],
};

function makeOption(id: string, data: Record<string, unknown> = {}): AccompanimentWorkflowOption {
  return {
    id,
    label: id,
    summary: `${id} summary`,
    justification: `${id} justification`,
    data,
    warnings: [],
    validationNotes: [],
  };
}

function makeRun(stepId: AccompanimentWorkflowStepId, option: AccompanimentWorkflowOption): AccompanimentWorkflowRun {
  return {
    id: `${stepId}-run`,
    createdAt: "2026-07-06T00:00:00.000Z",
    stepId,
    requestPrompt: "test prompt",
    userNote: "",
    options: [option],
  };
}

function selectWorkflowStep(
  session: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId,
  option: AccompanimentWorkflowOption
): AccompanimentWorkflowSession {
  const run = makeRun(stepId, option);
  return selectOption(mergeRun(session, run, ""), stepId, option, "", run.id);
}

function buildModel(overrides: Partial<Parameters<typeof buildArrangementPreviewModel>[0]> = {}) {
  const validatedWorkflow = selectWorkflowStep(
    createAccompanimentWorkflowSession(sampleAbc),
    "voice-leading-validation",
    makeOption("validated-harmony", { validatedAbc: sampleAbc }),
  );
  return buildArrangementPreviewModel({
    activeAbc: sampleAbc,
    workflow: validatedWorkflow,
    generatedAccompaniment: null,
    generatedGuitar: null,
    harmonyLayerVisibility: { melody: true, harmony: true },
    harmonyLayerVolumes: { Melody: 100, ChordProgression: 100 },
    accompanimentLayerVisibility: {
      __melody__: true,
      __strong_beats__: true,
      __chords__: false,
      __guitar_tab__: false,
    },
    accompanimentLayerVolumes: { Melody: 100, ChordProgression: 100 },
    ...overrides,
  });
}

describe("arrangement preview model", () => {
  it("ignores a persisted workflow when the source ABC is stale", () => {
    const workflow = createAccompanimentWorkflowSession(sampleAbc);
    const model = buildModel({
      activeAbc: `${sampleAbc}\n% edited`,
      workflow,
    });

    expect(model.activeWorkflow).toBeNull();
    expect(model.workflowAppliedMusicAbc).toBe(`${sampleAbc}\n% edited`);
  });

  it("derives harmony synth options and filtered ABC from layer visibility", () => {
    const model = buildModel({
      activeAbc: harmonizedAbc,
      harmonyLayerVisibility: { melody: false, harmony: false },
    });

    expect(model.harmony.synthOptions).toEqual({ voicesOff: true, chordsOff: true });
    expect(model.harmony.rawAbc).toContain('"C"C2');
    expect(model.harmony.abc).not.toContain('"C"');
    expect(model.harmony.abc).not.toContain("C2 D2");
  });

  it("uses workflow-applied ABC from selected chord progression options", () => {
    const workflow = selectWorkflowStep(
      createAccompanimentWorkflowSession(sampleAbc),
      "chord-roles-progression",
      makeOption("progression", { chordAnnotatedAbc: harmonizedAbc })
    );

    const model = buildModel({ workflow });

    expect(model.activeWorkflow).toBe(workflow);
    expect(model.workflowAppliedMusicAbc).toBe(harmonizedAbc);
    expect(model.harmony.rawAbc).toContain("%%MIDI program 52");
    expect(model.harmony.rawAbc).toContain(harmonizedAbc.split("\n").at(-1));
    expect(model.harmony.layerVisibilityItems.map((item) => item.id)).toEqual([
      "ChordProgression",
      "Lyrics",
      "Melody",
      "TAB",
    ]);
  });

  it("builds accompaniment from the selected validated Harmony output, never a progression fallback", () => {
    const progressionAbc = sampleAbc.replace("T:Preview Model Sample", "T:Progression Only");
    const validatedAbc = sampleAbc.replace("T:Preview Model Sample", "T:Validated Only");
    let workflow = createAccompanimentWorkflowSession(sampleAbc);
    workflow = selectWorkflowStep(
      workflow,
      "chord-roles-progression",
      makeOption("progression", { harmonizedAbc: progressionAbc }),
    );
    workflow = selectWorkflowStep(
      workflow,
      "voice-leading-validation",
      makeOption("validation", { harmonizedAbc: progressionAbc, validatedAbc }),
    );

    const model = buildModel({
      workflow,
      generatedAccompaniment: `V:Harmonium\n| C8 |`,
    });

    expect(model.harmonyValidationAbc).toBe(validatedAbc);
    expect(model.accompaniment.rawAbc).toContain("T:Validated Only");
    expect(model.accompaniment.rawAbc).not.toContain("T:Progression Only");
    expect(model.accompaniment.rawAbc).toContain("V:Harmonium");
  });

  it("gates strong-beat layer visibility until the workflow step is complete", () => {
    const incomplete = buildModel({
      accompanimentLayerVisibility: { __melody__: true, __strong_beats__: true },
    });
    const workflow = selectWorkflowStep(
      createAccompanimentWorkflowSession(sampleAbc),
      "key-beats",
      makeOption("strong-beats", { strongBeatEmphasis: "all-metric-beats", strongBeatDirectives: [] })
    );
    const complete = buildModel({
      workflow,
      accompanimentLayerVisibility: { __melody__: true, __strong_beats__: true },
    });

    expect(incomplete.accompaniment.strongBeatsStepComplete).toBe(false);
    expect(incomplete.accompaniment.effectiveLayerVisibility.__strong_beats__).toBe(false);
    expect(complete.accompaniment.strongBeatsStepComplete).toBe(true);
    expect(complete.accompaniment.effectiveLayerVisibility.__strong_beats__).toBe(true);
  });

  it("appends workflow annotation to accompaniment ABC when a workflow option is selected", () => {
    const workflow = selectWorkflowStep(
      createAccompanimentWorkflowSession(sampleAbc),
      "key-beats",
      makeOption("key-analysis")
    );

    const model = buildModel({ workflow });

    expect(model.accompaniment.abc).toContain("% --- Human-in-the-loop Accompaniment Workflow Applied ---");
    expect(model.accompaniment.appliedWorkflowStep?.id).toBe("key-beats");
  });

  it("derives guitar voice state when a generated guitar layer is visible", () => {
    const model = buildModel({
      generatedGuitar: guitarAbc,
      accompanimentLayerVisibility: {
        __melody__: true,
        __strong_beats__: false,
        __chords__: false,
        __guitar_tab__: true,
      },
    });

    expect(model.accompaniment.voiceNames).toContain("Guitar");
    expect(model.accompaniment.visibleVoiceNames).toContain("Guitar");
    expect(model.accompaniment.layerVisibilityItems.map((item) => item.id)).toContain("Guitar");
    expect(model.accompaniment.layerVisibilityItems.map((item) => item.id)).toContain("TAB");
    expect(model.accompaniment.hasGuitarVoice).toBe(true);
    expect(model.accompaniment.guitarTabEnabled).toBe(true);
  });

  it("keeps fingerstyle guitar as one tab-enabled voice grouped under each Melody staff system", () => {
    const fingerstyleGuitarAbc = `X:1
T:Fingerstyle Layer
M:4/4
L:1/8
K:C
V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"
%%MIDI program 24
% @fingerstyle-section body
| [C,C]2 D2 [G,E]2 F2 | [G,G]4 [D,G]4 |`;

    const model = buildModel({
      generatedGuitar: fingerstyleGuitarAbc,
      accompanimentLayerVisibility: {
        __melody__: true,
        __strong_beats__: false,
        __chords__: false,
        __guitar_tab__: true,
      },
    });

    expect(model.accompaniment.rawAbc).toContain('V:Guitar clef=treble-8 name="Guitar" stem=down');
    expect(model.accompaniment.rawAbc).toContain("% Staff system 1: Melody and visible instruments share this measure range.");
    expect(model.accompaniment.rawAbc).toContain("[V:Melody] | C2 D2 E2 F2 | G4 G4 |");
    expect(model.accompaniment.rawAbc).toContain("[V:Guitar] | [C,C]2 D2 [G,E]2 F2 | [G,G]4 [D,G]4 |");
    expect(model.accompaniment.voiceNames).toContain("Guitar");
    expect(model.accompaniment.visibleVoiceNames).toContain("Guitar");
    expect(model.accompaniment.guitarTabEnabled).toBe(true);
  });

  it("applies Melody singer program and per-layer volume directives to preview ABC", () => {
    const workflow = selectWorkflowStep(
      createAccompanimentWorkflowSession(harmonizedAbc),
      "voice-leading-validation",
      makeOption("validated-harmony", { validatedAbc: harmonizedAbc }),
    );
    const model = buildModel({
      activeAbc: harmonizedAbc,
      workflow,
      generatedGuitar: guitarAbc,
      harmonyLayerVolumes: { Melody: 50, ChordProgression: 25 },
      accompanimentLayerVolumes: { Melody: 50, Guitar: 75, ChordProgression: 25 },
    });

    expect(model.harmony.rawAbc).toContain("%%MIDI program 52");
    expect(model.harmony.rawAbc).toContain("%%MIDI beat 64 64 64 1");
    expect(model.harmony.rawAbc).toContain("%%MIDI chordvol 32");
    expect(model.accompaniment.rawAbc).toContain("V:Guitar");
    expect(model.accompaniment.rawAbc).toContain("%%MIDI beat 95 95 95 1");
  });

  it("keeps hidden accompaniment voices available in raw-derived layer controls", () => {
    const model = buildModel({
      generatedGuitar: guitarAbc,
      accompanimentLayerVisibility: {
        Guitar: false,
        TAB: true,
      },
    });

    expect(model.accompaniment.rawAbc).toContain("V:Guitar");
    expect(model.accompaniment.abc).not.toContain("V:Guitar");
    expect(model.accompaniment.layerVisibilityItems.map((item) => item.id)).toContain("Guitar");
    expect(model.accompaniment.visibleVoiceNames).not.toContain("Guitar");
    expect(model.accompaniment.hasGuitarVoice).toBe(false);
    expect(model.accompaniment.guitarTabEnabled).toBe(false);
  });

  it("removes guitar ABC after guitar branch reset while preserving harmony", () => {
    let workflow = createAccompanimentWorkflowSession(sampleAbc);
    workflow = selectWorkflowStep(
      workflow,
      "voice-leading-validation",
      makeOption("validated", { validatedAbc: harmonizedAbc })
    );
    workflow = selectWorkflowStep(
      workflow,
      "guitar-comping-profile",
      makeOption("fingerstyle", { pickingProfile: "folk-travis" })
    );

    const beforeReset = buildModel({
      workflow,
      generatedGuitar: guitarAbc,
      accompanimentLayerVisibility: {
        __melody__: true,
        __strong_beats__: false,
        __chords__: false,
        __guitar_tab__: true,
      },
    });
    const clearedWorkflow = clearAccompanimentWorkflowStepResults(
      workflow,
      ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar
    );
    const afterReset = buildModel({
      workflow: clearedWorkflow,
      generatedGuitar: null,
      accompanimentLayerVisibility: {
        __melody__: true,
        __strong_beats__: false,
        __chords__: false,
        __guitar_tab__: false,
      },
    });

    expect(beforeReset.workflowAppliedMusicAbc).toBe(harmonizedAbc);
    expect(beforeReset.accompaniment.abc).toContain("V:Guitar");
    expect(beforeReset.accompaniment.guitarTabEnabled).toBe(true);

    expect(afterReset.workflowAppliedMusicAbc).toBe(harmonizedAbc);
    expect(afterReset.accompaniment.abc).not.toContain("V:Guitar");
    expect(afterReset.accompaniment.guitarTabEnabled).toBe(false);
    expect(afterReset.accompaniment.appliedWorkflowStep?.id).toBe("voice-leading-validation");
  });

  it("applies Djembe support ABC after the Djembe branch completes in a Djembe-only solo setup", () => {
    let workflow = createAccompanimentWorkflowSession(sampleAbc, djembeOnlySetup);
    workflow = selectWorkflowStep(
      workflow,
      "voice-leading-validation",
      makeOption("validated-harmony", { validatedAbc: sampleAbc })
    );
    workflow = selectWorkflowStep(
      workflow,
      "djembe-groove-interlock",
      makeOption("djembe-groove", { grooveProfile: "devotional", density: "moderate", bassSync: true })
    );
    workflow = selectWorkflowStep(
      workflow,
      "djembe-fill-validation",
      makeOption("djembe-fills", { fillPolicy: "cadence-only", backbeatSlaps: true })
    );

    const model = buildModel({ workflow });

    expect(model.accompaniment.appliedWorkflowStep?.id).toBe("djembe-fill-validation");
    expect(model.accompaniment.rawAbc).toContain("V:Djembe");
    expect(model.accompaniment.voiceNames).toContain("Djembe");
    expect(model.accompaniment.rawAbc).toContain("ABCNotation applied after Step 9: Djembe Fill & Transient Validation");
  });

  it("derives guitar tablature render options from score order", () => {
    const options = getArrangementRenderOptionsFor(
      `X:1\n%%score Melody Piano Guitar\nV:Melody\nV:Piano\nV:Guitar\nK:C\n[V:Melody] C4 |\n[V:Piano] C4 |\n[V:Guitar] C4 |`,
      ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
      true
    );

    expect(options).toMatchObject({
      tablature: [
        { instrument: "" },
        { instrument: "" },
        { instrument: "guitar", label: "", capo: 0, hideTabSymbol: false },
      ],
    });
  });

  it("falls back to voice order when score order is absent", () => {
    const options = getArrangementRenderOptionsFor(
      `X:1\nV:Melody\nV:Guitar\nK:C\n[V:Melody] C4 |\n[V:Guitar] C4 |`,
      ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS,
      true
    );

    expect(options).toMatchObject({
      tablature: [
        { instrument: "" },
        { instrument: "guitar", label: "", capo: 0, hideTabSymbol: false },
      ],
    });
  });
});
