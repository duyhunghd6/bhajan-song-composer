import { describe, expect, it } from "vitest";
import {
  buildEnsembleWorkflowAbcAnnotation,
  buildEnsembleWorkflowPrompt,
  buildEnsembleWorkflowToolSchema,
  createEnsembleWorkflowSession,
  ENSEMBLE_WORKFLOW_STEP_IDS,
  ENSEMBLE_WORKFLOW_STEPS,
  getEnsembleGenerationPlan,
  getSelectedEnsembleWorkflowContext,
  getSkippedEnsembleInstruments,
  isEnsembleInstrumentSkipped,
  isEnsembleWorkflowSourceCurrent,
  isEnsembleWorkflowStepUnlocked,
  type EnsembleWorkflowOption,
} from "../ensemble-workflow";

const sampleAbc = `X:1
T:Ensemble Workflow Sample
M:4/4
L:1/8
K:Em
| E2 G2 z4 | B4 z2 A2 |`;

function selectOption(
  session: ReturnType<typeof createEnsembleWorkflowSession>,
  stepId: (typeof ENSEMBLE_WORKFLOW_STEP_IDS)[number],
  data: Record<string, unknown> = {}
) {
  const option: EnsembleWorkflowOption = {
    id: `${stepId}-choice`,
    label: `${stepId} Choice`,
    summary: `Selected summary for ${stepId}`,
    justification: `Selected justification for ${stepId}`,
    data,
    warnings: [],
    validationNotes: ["Valid test option"],
  };

  session.steps[stepId] = {
    runs: [{
      id: `${stepId}-run`,
      createdAt: "2026-07-05T00:00:00.000Z",
      stepId,
      requestPrompt: "test prompt",
      userNote: "",
      options: [option],
    }],
    activeRunId: `${stepId}-run`,
    selectedOptionId: option.id,
    selectedAt: "2026-07-05T00:00:00.000Z",
    promptNote: `Saved note for ${stepId}`,
  };
}

describe("ensemble workflow", () => {
  it("defines the exact 8-step Djembe + Flute + Violin order", () => {
    expect(ENSEMBLE_WORKFLOW_STEP_IDS).toEqual([
      "foundation-handshake",
      "djembe-groove-interlock",
      "djembe-fill-validation",
      "flute-yield-register",
      "flute-breath-fill-validation",
      "violin-bed-register",
      "violin-expression-validation",
      "final-conflict-review-apply",
    ]);
    expect(ENSEMBLE_WORKFLOW_STEPS).toHaveLength(8);
  });

  it("locks each instrument step until prior smaller decisions are selected", () => {
    const session = createEnsembleWorkflowSession(sampleAbc);

    expect(isEnsembleWorkflowStepUnlocked(session, "foundation-handshake")).toBe(true);
    expect(isEnsembleWorkflowStepUnlocked(session, "djembe-groove-interlock")).toBe(false);
    expect(isEnsembleWorkflowStepUnlocked(session, "final-conflict-review-apply")).toBe(false);

    for (const stepId of ENSEMBLE_WORKFLOW_STEP_IDS.slice(0, 7)) {
      selectOption(session, stepId);
    }

    expect(isEnsembleWorkflowStepUnlocked(session, "final-conflict-review-apply")).toBe(true);
  });

  it("invalidates saved sessions when the ensemble foundation ABC changes", () => {
    const session = createEnsembleWorkflowSession(sampleAbc);

    expect(isEnsembleWorkflowSourceCurrent(session, sampleAbc)).toBe(true);
    expect(isEnsembleWorkflowSourceCurrent(session, `${sampleAbc}\n% changed`)).toBe(false);
  });

  it("builds prompts with ensemble rules, user notes, and previous selections", () => {
    const session = createEnsembleWorkflowSession(sampleAbc);
    selectOption(session, "foundation-handshake", { densityGrid: "ready" });
    selectOption(session, "djembe-groove-interlock", { grooveProfile: "devotional" });

    const prompt = buildEnsembleWorkflowPrompt({
      stepId: "flute-yield-register",
      sourceAbc: sampleAbc,
      metadata: { key: "Em", scale: "minor", timeSignature: "4/4" },
      previousSelections: getSelectedEnsembleWorkflowContext(session, "flute-yield-register"),
      userNote: "Keep the flute sparse and devotional.",
    });

    expect(prompt).toContain("DEFAULT PROMPT");
    expect(prompt).toContain("Djembe must sync bass strokes to Layer 2");
    expect(prompt).toContain("Flute must yield while the primary melody is active");
    expect(prompt).toContain("Violin must behave as harmonic bed");
    expect(prompt).toContain("Final conflict hierarchy");
    expect(prompt).toContain("Keep the flute sparse and devotional.");
    expect(prompt).toContain("djembe-groove-interlock Choice");
  });

  it("creates a tool schema requiring option justification and validation fields", () => {
    const schema = buildEnsembleWorkflowToolSchema("violin-expression-validation");
    const options = schema.function.parameters.properties.options;
    const item = options.items;

    expect(options.minItems).toBe(1);
    expect(options.maxItems).toBe(5);
    expect(item.required).toEqual(["id", "label", "summary", "justification", "data", "warnings", "validationNotes"]);
  });

  it("extracts a deterministic generation plan from selected instrument options", () => {
    const session = createEnsembleWorkflowSession(sampleAbc);
    selectOption(session, "djembe-groove-interlock", { grooveProfile: "sparse", density: "minimal" });
    selectOption(session, "djembe-fill-validation", { bassSync: true, backbeatSlaps: false, fillPolicy: "none" });
    selectOption(session, "flute-yield-register", { role: "gap-fills", fillDensity: "active", yieldWhenMelodyActive: true });
    selectOption(session, "flute-breath-fill-validation", { breathEveryMeasures: 4, preferredRegister: "D5-A5" });
    selectOption(session, "violin-bed-register", { role: "drone-pad", registerStrategy: "below-melody" });
    selectOption(session, "violin-expression-validation", { doubleStopPolicy: "single-note", expressionProfile: "plain" });

    expect(getEnsembleGenerationPlan(session)).toEqual({
      djembe: {
        grooveProfile: "sparse",
        density: "minimal",
        bassSync: true,
        backbeatSlaps: false,
        fillPolicy: "none",
      },
      flute: {
        role: "gap-fills",
        fillDensity: "active",
        preferredRegister: "D5-A5",
        breathEveryMeasures: 4,
        yieldWhenMelodyActive: true,
      },
      violin: {
        role: "drone-pad",
        registerStrategy: "below-melody",
        doubleStopPolicy: "single-note",
        expressionProfile: "plain",
        yieldWhenMelodyActive: true,
      },
    });
  });

  it("treats skip selections as completed instrument decisions", () => {
    const session = createEnsembleWorkflowSession(sampleAbc);
    selectOption(session, "foundation-handshake");
    selectOption(session, "djembe-groove-interlock", { skipInstrument: true, instrument: "djembe" });
    selectOption(session, "djembe-fill-validation", { skipInstrument: true, instrument: "djembe" });

    expect(isEnsembleInstrumentSkipped(session, "djembe")).toBe(true);
    expect(getSkippedEnsembleInstruments(session)).toEqual(["djembe"]);
    expect(isEnsembleWorkflowStepUnlocked(session, "flute-yield-register")).toBe(true);
  });

  it("builds an ABC annotation only after final application", () => {
    const session = createEnsembleWorkflowSession(sampleAbc);
    selectOption(session, "foundation-handshake");
    selectOption(session, "djembe-groove-interlock");

    expect(buildEnsembleWorkflowAbcAnnotation(session)).toBe("");

    session.appliedAt = "2026-07-05T00:00:00.000Z";
    const annotation = buildEnsembleWorkflowAbcAnnotation(session);

    expect(annotation).toContain("% --- Human-in-the-loop Ensemble Workflow Applied ---");
    expect(annotation).toContain("% ABCNotation applied after Step 8: Final Conflict Review & Apply");
    expect(annotation).toContain("% Step 2 Djembe Groove Interlock: djembe-groove-interlock Choice");
  });
});
