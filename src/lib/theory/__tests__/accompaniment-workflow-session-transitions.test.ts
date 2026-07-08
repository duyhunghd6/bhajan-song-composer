import { describe, expect, it } from "vitest";

import {
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  createAccompanimentWorkflowSession,
  extractProfile,
  getEnabledAccompanimentWorkflowStepIds,
  getNextUncompletedWorkflowStepId,
  hasWorkflowStepResults,
  mergeRun,
  mergeRuns,
  selectOption,
  skipWorkflowSteps,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";

const sampleAbc = `X:1
T:Workflow Session Transitions
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |`;

function makeOption(id: string, data: Record<string, unknown> = { style: id }): AccompanimentWorkflowOption {
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

function makeRun(stepId: AccompanimentWorkflowStepId, id: string, optionIds: string[]): AccompanimentWorkflowRun {
  return {
    id,
    createdAt: "2026-07-06T00:00:00.000Z",
    stepId,
    requestPrompt: "test prompt",
    userNote: "",
    options: optionIds.map((optionId) => makeOption(optionId)),
  };
}

describe("accompaniment workflow session transitions", () => {
  it("keeps only enabled instrument branches in a solo setup and completes after those steps", () => {
    const setup = {
      style: "solo-fingerstyle" as const,
      instruments: [
        { id: "guitar-classic" as const, enabled: false, order: 0 },
        { id: "guitar-acoustic" as const, enabled: false, order: 1 },
        { id: "piano" as const, enabled: false, order: 2 },
        { id: "indian-harmonium" as const, enabled: false, order: 3 },
        { id: "flute" as const, enabled: true, order: 4 },
        { id: "djembe" as const, enabled: true, order: 5 },
        { id: "violin" as const, enabled: false, order: 6 },
      ],
    };

    const enabledStepIds = getEnabledAccompanimentWorkflowStepIds(setup);
    let session = createAccompanimentWorkflowSession(sampleAbc, setup);

    expect(enabledStepIds).toEqual([
      "key-scale-cadence",
      "strong-beat-targets",
      "chord-tone-mapping",
      "chord-progression",
      "voice-leading-validation",
      "flute-yield-register",
      "flute-breath-fill-validation",
      "djembe-groove-interlock",
      "djembe-fill-validation",
    ]);
    expect(session.enabledStepIds).toEqual(enabledStepIds);

    for (const stepId of enabledStepIds) {
      const run = makeRun(stepId, `${stepId}-run`, [`${stepId}-option`]);
      session = selectOption(mergeRun(session, run, ""), stepId, run.options[0], "", run.id);
    }

    expect(getNextUncompletedWorkflowStepId(session)).toBeNull();
  });

  it("keeps a selected option from an older run after regeneration", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const firstRun = makeRun("key-scale-cadence", "run-1", ["option-a", "option-b"]);
    const secondRun = makeRun("key-scale-cadence", "run-2", ["option-c", "option-d"]);

    const generated = mergeRun(session, firstRun, "first prompt");
    const selected = selectOption(generated, "key-scale-cadence", firstRun.options[1], "first prompt", firstRun.id);
    const regenerated = mergeRun(selected, secondRun, "second prompt");

    expect(regenerated.steps["key-scale-cadence"].runs.map((run) => run.id)).toEqual(["run-1", "run-2"]);
    expect(regenerated.steps["key-scale-cadence"].activeRunId).toBe("run-1");
    expect(regenerated.steps["key-scale-cadence"].selectedOptionId).toBe("option-b");
    expect(regenerated.steps["key-scale-cadence"].promptNote).toBe("second prompt");
  });

  it("replaces a run with the same id instead of duplicating it", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const firstRun = makeRun("key-scale-cadence", "run-1", ["option-a"]);
    const replacementRun = makeRun("key-scale-cadence", "run-1", ["option-b"]);

    const generated = mergeRun(session, firstRun, "first prompt");
    const replaced = mergeRun(generated, replacementRun, "second prompt");

    expect(replaced.steps["key-scale-cadence"].runs).toHaveLength(1);
    expect(replaced.steps["key-scale-cadence"].runs[0].options.map((option) => option.id)).toEqual(["option-b"]);
  });

  it("merges multiple runs and keeps the first run step as the current step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const next = mergeRuns(session, [
      makeRun("chord-tone-mapping", "roles-run", ["roles"]),
      makeRun("chord-progression", "progression-run", ["progression"]),
    ], "lyric chords");

    expect(next.currentStepId).toBe("chord-tone-mapping");
    expect(next.steps["chord-tone-mapping"].runs).toHaveLength(1);
    expect(next.steps["chord-progression"].runs).toHaveLength(1);
  });

  it("selects an option from an older run and advances to the next uncompleted step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const oldOption = makeOption("old-run-option");
    const newOption = makeOption("new-run-option");

    const generated = {
      ...session,
      steps: {
        ...session.steps,
        "key-scale-cadence": {
          runs: [
            { ...makeRun("key-scale-cadence", "old-run", []), options: [oldOption] },
            { ...makeRun("key-scale-cadence", "new-run", []), options: [newOption] },
          ],
          activeRunId: "new-run",
          selectedOptionId: null,
          selectedAt: null,
          promptNote: "",
        },
      },
    };

    const selected = selectOption(generated, "key-scale-cadence", oldOption, "", "old-run");

    expect(selected.steps["key-scale-cadence"].activeRunId).toBe("old-run");
    expect(selected.steps["key-scale-cadence"].selectedOptionId).toBe("old-run-option");
    expect(selected.currentStepId).toBe("strong-beat-targets");
  });

  it("extracts profile hints from preferred option data fields", () => {
    expect(extractProfile(makeOption("fallback", { profileId: "profile-id" }))).toBe("profile-id");
    expect(extractProfile(makeOption("fallback", { compingProfile: "rock-rnb" }))).toBe("rock-rnb");
    expect(extractProfile(makeOption("fallback", { pickingProfile: "folk-travis" }))).toBe("folk-travis");
    expect(extractProfile(makeOption("fallback", { style: "devotional" }))).toBe("devotional");
    expect(extractProfile(makeOption("fallback", { profile: "soft" }))).toBe("soft");
    expect(extractProfile(makeOption("fallback", {}))).toBe("fallback");
  });

  it("sets guitar and piano profile hints when selecting final branch options", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const guitarOption = makeOption("guitar", { pickingProfile: "folk-travis" });
    const pianoOption = makeOption("piano", { compingProfile: "classical-folk" });

    const withGuitar = selectOption(session, "guitar-fingerstyle", guitarOption, "", "guitar-run");
    const withPiano = selectOption(withGuitar, "piano-fills-pedal-validation", pianoOption, "", "piano-run");

    expect(withGuitar.guitarProfileHint).toBe("folk-travis");
    expect(withPiano.guitarProfileHint).toBe("folk-travis");
    expect(withPiano.pianoProfileHint).toBe("classical-folk");
  });

  it("skips branch steps and clears the matching profile hint", () => {
    const session = {
      ...createAccompanimentWorkflowSession(sampleAbc),
      guitarProfileHint: "strict-pima",
      pianoProfileHint: "pop-ballad",
    };

    const skipped = skipWorkflowSteps(session, ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar, "Guitar", "skip it");

    expect(skipped.guitarProfileHint).toBeNull();
    expect(skipped.pianoProfileHint).toBe("pop-ballad");
    for (const stepId of ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar) {
      expect(skipped.steps[stepId].selectedOptionId).toBe(`skip-${stepId}`);
      expect(skipped.steps[stepId].promptNote).toBe("skip it");
    }
  });

  it("detects existing workflow step results", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const generated = mergeRun(session, makeRun("key-scale-cadence", "run-1", ["option-a"]), "");

    expect(hasWorkflowStepResults(null, ["key-scale-cadence"])).toBe(false);
    expect(hasWorkflowStepResults(session, ["key-scale-cadence"])).toBe(false);
    expect(hasWorkflowStepResults(generated, ["key-scale-cadence"])).toBe(true);
  });
});
