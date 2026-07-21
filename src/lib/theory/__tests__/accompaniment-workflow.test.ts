import { describe, expect, it } from "vitest";
import {
  ACCOMPANIMENT_INSTRUMENT_LABELS,
  ACCOMPANIMENT_WORKFLOW_STEP_IDS,
  buildAccompanimentWorkflowPrompt,
  createAccompanimentWorkflowSession,
  getDefaultAccompanimentWorkflowSetup,
  getEnabledAccompanimentWorkflowStepIds,
  getHarmonyValidationAbc,
  getVisibleAccompanimentWorkflowSteps,
  mergeRun,
  selectOption,
  normalizeAccompanimentWorkflowSession,
  normalizeAccompanimentWorkflowSetup,
} from "../accompaniment-workflow";

const sampleAbc = `X:1
T:Workflow Sample
M:4/4
L:1/8
K:C
| C2 E2 G2 c2 |`;

describe("accompaniment workflow", () => {
  it("offers only Guitar Classic, Harmonium, and Djembe", () => {
    expect(Object.keys(ACCOMPANIMENT_INSTRUMENT_LABELS)).toEqual([
      "guitar-classic",
      "indian-harmonium",
      "djembe",
    ]);
    expect(ACCOMPANIMENT_WORKFLOW_STEP_IDS).toEqual([
      "key-beats",
      "chord-roles-progression",
      "voice-leading-validation",
      "guitar-comping-profile",
      "guitar-voicing-bass",
      "guitar-classic-abc-notation",
      "harmonium-drone-register",
      "harmonium-chord-voicing-validation",
      "djembe-groove-interlock",
      "djembe-fill-validation",
    ]);
  });

  it("plans retained instrument branches in setup order", () => {
    const setup = getDefaultAccompanimentWorkflowSetup();
    expect(getEnabledAccompanimentWorkflowStepIds(setup)).toEqual(ACCOMPANIMENT_WORKFLOW_STEP_IDS);
    expect(getVisibleAccompanimentWorkflowSteps(createAccompanimentWorkflowSession(sampleAbc, setup))).toHaveLength(10);
  });

  it("normalizes persisted Solo/Fingerstyle setup to combined accompaniment", () => {
    const setup = normalizeAccompanimentWorkflowSetup({
      style: "solo-fingerstyle",
      instruments: [{ id: "djembe", enabled: true, order: 0 }],
    } as never);

    expect(setup.style).toBe("accompaniment");
    expect(setup.instruments.find((instrument) => instrument.id === "djembe")?.enabled).toBe(true);
  });

  it("drops removed instruments and steps while restoring persisted sessions", () => {
    const restored = normalizeAccompanimentWorkflowSession({
      version: 4,
      sourceAbc: sampleAbc,
      currentStepId: "piano-comping-bass",
      setup: {
        style: "accompaniment",
        instruments: [
          { id: "guitar-classic", enabled: true, order: 0 },
          { id: "piano", enabled: true, order: 1 },
          { id: "flute", enabled: true, order: 2 },
          { id: "djembe", enabled: true, order: 3 },
        ],
      },
      steps: {},
    });
    expect(restored?.version).toBe(8);
    expect(restored?.setup.instruments.map((instrument) => instrument.id)).toEqual([
      "guitar-classic", "indian-harmonium", "djembe",
    ]);
    expect(restored?.enabledStepIds).not.toContain("piano-comping-bass");
  });

  it("uses only the selected validated Harmony ABC as a downstream branch source", () => {
    const validatedAbc = `${sampleAbc}\n% validated harmony`;
    const progressionAbc = `${sampleAbc}\n% progression only`;
    const option = {
      id: "validated",
      label: "Validated",
      summary: "Validated harmony",
      justification: "Voice leading verified",
      data: { validatedAbc, harmonizedAbc: progressionAbc },
      warnings: [],
      validationNotes: [],
    };
    const run = {
      id: "validation-run",
      createdAt: "2026-07-20T00:00:00.000Z",
      stepId: "voice-leading-validation" as const,
      requestPrompt: "test",
      userNote: "",
      options: [option],
    };
    const session = selectOption(
      mergeRun(createAccompanimentWorkflowSession(sampleAbc), run, ""),
      "voice-leading-validation",
      option,
      "",
      run.id,
    );

    expect(getHarmonyValidationAbc(session)).toBe(validatedAbc);
    expect(getHarmonyValidationAbc(createAccompanimentWorkflowSession(sampleAbc))).toBeNull();
  });

  it("never names removed instruments in generated workflow prompts", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "djembe-groove-interlock",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "4/4" },
      previousSelections: [],
      setup: normalizeAccompanimentWorkflowSetup({
        style: "accompaniment",
        instruments: [{ id: "djembe", enabled: true, order: 0 }],
      }),
    });
    expect(prompt).toContain("Djembe");
    expect(prompt).not.toMatch(/Piano|Flute|Violin|Acoustic/i);
  });
});
