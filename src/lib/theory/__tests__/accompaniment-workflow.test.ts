import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOMPANIMENT_INSTRUMENT_LABELS,
  ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  applyAccompanimentWorkflowSetupToSession,
  buildAccompanimentWorkflowAbcAnnotation,
  getDefaultAccompanimentWorkflowSetup,
  getEnabledAccompanimentWorkflowStepIds,
  getVisibleAccompanimentWorkflowSteps,
  getVisibleAccompanimentWorkflowStepsForSetup,
  buildAccompanimentWorkflowPrompt,
  clearAccompanimentWorkflowStepResults,
  abcMatchesReferenceMeasureLinePattern,
  buildAccompanimentWorkflowToolSchema,
  buildAddStrongBeatIconsToolSchema,
  buildBreakMeasuresLineToolSchema,
  buildConsolidatedChordIngestionPrompt,
  buildConsolidatedChordIngestionToolSchema,
  break_measures_line,
  createAccompanimentWorkflowSession,
  extractLyricChordAnnotations,
  getAccompanimentWorkflowLlmToolNames,
  getNextUncompletedWorkflowStepId,
  getSelectedWorkflowContext,
  getSelectedWorkflowOption,
  getWorkflowAppliedMusicAbc,
  hasLyricChordAnnotations,
  isAccompanimentWorkflowStepEnabled,
  isAccompanimentWorkflowStepUnlocked,
  isGuitarTabValidationWorkflowStep,
  normalizeAccompanimentWorkflowSetup,
  normalizeWorkflowOptionDataLineBreaks,
  type AccompanimentWorkflowOption,
} from "../accompaniment-workflow";
import { generateAccompanimentSupportLayers } from "../accompaniment-workflow/support-layers";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { requestOpenAiCompatibleToolLoop, type ToolDiagnosticEvent } from "../../../app/actions/ai-config";
import { buildValidGuitarTabToolSchema } from "../guitar-tab-validation";

const sampleAbc = `X:1
T:Workflow Sample
M:3/4
L:1/8
K:C
| C2 E2 G2 | A3 G F2 | E6 |`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

interface WorkflowSchemaPropertyForTest {
  description?: string;
  required?: string[];
  properties?: Record<string, WorkflowSchemaPropertyForTest>;
  items?: WorkflowSchemaPropertyForTest;
}

interface WorkflowDataSchemaForTest {
  required?: string[];
  properties?: Record<string, WorkflowSchemaPropertyForTest>;
}

function selectOption(
  session: ReturnType<typeof createAccompanimentWorkflowSession>,
  stepId: (typeof ACCOMPANIMENT_WORKFLOW_STEP_IDS)[number],
  data: Record<string, unknown> = { style: "pop-ballad" }
) {
  const option: AccompanimentWorkflowOption = {
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
      createdAt: "2026-07-04T00:00:00.000Z",
      stepId,
      requestPrompt: "test prompt",
      userNote: "",
      options: [option],
    }],
    activeRunId: `${stepId}-run`,
    selectedOptionId: option.id,
    selectedAt: "2026-07-04T00:00:00.000Z",
    promptNote: `Saved note for ${stepId}`,
  };
}

describe("accompaniment workflow", () => {
  it("defines the instrument-aware human-in-loop order", () => {
    expect(ACCOMPANIMENT_WORKFLOW_STEP_IDS).toEqual([
      "key-beats",
      "chord-roles-progression",
      "voice-leading-validation",
      "guitar-comping-profile",
      "guitar-voicing-bass",
      "guitar-fills-validation",
      "piano-comping-bass",
      "piano-rh-voicing",
      "piano-fills-pedal-validation",
      "harmonium-drone-register",
      "harmonium-chord-voicing-validation",
      "djembe-groove-interlock",
      "djembe-fill-validation",
      "flute-yield-register",
      "flute-breath-fill-validation",
      "violin-bed-register",
      "violin-expression-validation",
    ]);
    expect(ACCOMPANIMENT_WORKFLOW_STEPS).toHaveLength(17);
  });

  it("keeps legacy session creation backward-compatible with Guitar + Piano", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);

    expect(session.setup.style).toBe("accompaniment");
    expect(session.enabledStepIds).toContain("guitar-fills-validation");
    expect(session.enabledStepIds).toContain("piano-fills-pedal-validation");
    expect(session.enabledStepIds).not.toContain("djembe-groove-interlock");
    expect(session.enabledStepIds).not.toContain("violin-bed-register");
    expect(getVisibleAccompanimentWorkflowSteps(session).map((step) => step.id)).toEqual(session.enabledStepIds);
  });

  it("includes Flute, Djembe, and Violin in new default setup", () => {
    const setup = getDefaultAccompanimentWorkflowSetup();
    const instrumentIds = setup.instruments.map((instrument) => instrument.id);

    expect(instrumentIds).toEqual(["guitar-classic", "guitar-acoustic", "piano", "indian-harmonium", "flute", "djembe", "violin"]);
    expect(ACCOMPANIMENT_INSTRUMENT_LABELS.flute).toBe("Flute");
    expect(ACCOMPANIMENT_INSTRUMENT_LABELS.djembe).toBe("Djembe");
    expect(ACCOMPANIMENT_INSTRUMENT_LABELS.violin).toBe("Violin");
  });

  it("normalizes older setup data with disabled missing support instruments", () => {
    const normalized = normalizeAccompanimentWorkflowSetup({
      style: "accompaniment",
      instruments: [{ id: "guitar-classic", enabled: true, order: 0 }],
    });

    expect(normalized.instruments.find((instrument) => instrument.id === "flute")?.enabled).toBe(false);
    expect(normalized.instruments.find((instrument) => instrument.id === "djembe")?.enabled).toBe(false);
    expect(normalized.instruments.find((instrument) => instrument.id === "violin")?.enabled).toBe(false);
  });

  it("derives solo fingerstyle steps from every enabled instrument in the selected setup", () => {
    const setup = {
      ...getDefaultAccompanimentWorkflowSetup(),
      style: "solo-fingerstyle" as const,
    };
    const stepIds = getEnabledAccompanimentWorkflowStepIds(setup);

    expect(stepIds).toContain("guitar-fills-validation");
    expect(stepIds).toContain("piano-comping-bass");
    expect(stepIds).toContain("harmonium-drone-register");
    expect(stepIds).toContain("djembe-groove-interlock");
    expect(stepIds).toContain("flute-yield-register");
    expect(stepIds).toContain("violin-bed-register");
  });

  it("derives solo support steps from exactly the enabled non-guitar instruments", () => {
    const setup = {
      ...getDefaultAccompanimentWorkflowSetup(),
      style: "solo-fingerstyle" as const,
      instruments: getDefaultAccompanimentWorkflowSetup().instruments.map((instrument) => ({
        ...instrument,
        enabled: instrument.id === "djembe" || instrument.id === "flute",
      })),
    };
    const stepIds = getEnabledAccompanimentWorkflowStepIds(setup);

    expect(stepIds).toEqual([
      "key-beats",
      "chord-roles-progression",
      "voice-leading-validation",
      "flute-yield-register",
      "flute-breath-fill-validation",
      "djembe-groove-interlock",
      "djembe-fill-validation",
    ]);
  });

  it("updates an active session when setup checkboxes enable another instrument", () => {
    const djembeOnlySetup = {
      ...getDefaultAccompanimentWorkflowSetup(),
      style: "solo-fingerstyle" as const,
      instruments: getDefaultAccompanimentWorkflowSetup().instruments.map((instrument) => ({
        ...instrument,
        enabled: instrument.id === "djembe",
      })),
    };
    const djembeAndFluteSetup = {
      ...djembeOnlySetup,
      instruments: djembeOnlySetup.instruments.map((instrument) => ({
        ...instrument,
        enabled: instrument.id === "djembe" || instrument.id === "flute",
      })),
    };

    const session = createAccompanimentWorkflowSession(sampleAbc, djembeOnlySetup);
    const updated = applyAccompanimentWorkflowSetupToSession(session, djembeAndFluteSetup);

    expect(session.enabledStepIds).toContain("djembe-fill-validation");
    expect(session.enabledStepIds).not.toContain("flute-yield-register");
    expect(updated.setup.instruments.find((instrument) => instrument.id === "flute")?.enabled).toBe(true);
    expect(updated.enabledStepIds).toContain("flute-yield-register");
    expect(updated.enabledStepIds).toContain("flute-breath-fill-validation");
    expect(updated.enabledStepIds).toContain("djembe-fill-validation");
    expect(getVisibleAccompanimentWorkflowSteps(updated).map((step) => step.id)).toEqual(updated.enabledStepIds);
  });

  it("derives combined accompaniment steps for every enabled instrument", () => {
    const setup = getDefaultAccompanimentWorkflowSetup();
    const stepIds = getEnabledAccompanimentWorkflowStepIds(setup);

    expect(stepIds).toContain("guitar-fills-validation");
    expect(stepIds).toContain("piano-fills-pedal-validation");
    expect(stepIds).toContain("harmonium-chord-voicing-validation");
    expect(stepIds).toContain("djembe-fill-validation");
    expect(stepIds).toContain("flute-breath-fill-validation");
    expect(stepIds).toContain("violin-expression-validation");
  });

  it("previews visible steps from setup and preserves instrument order", () => {
    const setup = {
      ...getDefaultAccompanimentWorkflowSetup(),
      instruments: getDefaultAccompanimentWorkflowSetup().instruments.map((instrument, index) => ({
        ...instrument,
        enabled: instrument.id === "violin" || instrument.id === "djembe" || instrument.id === "flute",
        order: instrument.id === "violin" ? 0 : instrument.id === "djembe" ? 1 : instrument.id === "flute" ? 2 : index + 3,
      })),
    };
    const stepIds = getVisibleAccompanimentWorkflowStepsForSetup(setup).map((step) => step.id);

    expect(stepIds.slice(0, 3)).toEqual(Array.from(ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 3)));
    expect(stepIds.slice(3)).toEqual([
      "violin-bed-register",
      "violin-expression-validation",
      "djembe-groove-interlock",
      "djembe-fill-validation",
      "flute-yield-register",
      "flute-breath-fill-validation",
    ]);
  });

  it("ignores disabled branch steps when unlocking and finding next work", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc, {
      ...getDefaultAccompanimentWorkflowSetup(),
      instruments: getDefaultAccompanimentWorkflowSetup().instruments.map((instrument) => ({
        ...instrument,
        enabled: instrument.id === "guitar-classic",
      })),
    });

    expect(isAccompanimentWorkflowStepEnabled(session, "piano-comping-bass")).toBe(false);
    expect(isAccompanimentWorkflowStepUnlocked(session, "piano-comping-bass")).toBe(false);
    for (const stepId of session.enabledStepIds.slice(0, 3)) selectOption(session, stepId);
    expect(getNextUncompletedWorkflowStepId(session)).toBe("guitar-comping-profile");
  });

  it("generates accompaniment support layers only after enabled support branches are complete", () => {
    const setup = {
      ...getDefaultAccompanimentWorkflowSetup(),
      instruments: getDefaultAccompanimentWorkflowSetup().instruments.map((instrument) => ({
        ...instrument,
        enabled: instrument.id === "djembe" || instrument.id === "flute" || instrument.id === "violin",
      })),
    };
    const session = createAccompanimentWorkflowSession(sampleAbc, setup);
    const accompaniment = generateAccompanimentStage(sampleAbc);

    expect(generateAccompanimentSupportLayers(sampleAbc, { workflow: session, accompaniment }).combined).toBeNull();

    selectOption(session, "djembe-fill-validation", { grooveProfile: "devotional", density: "moderate" });
    selectOption(session, "flute-breath-fill-validation", { role: "gap-fills", fillDensity: "minimal" });
    selectOption(session, "violin-expression-validation", { role: "harmonic-bed", doubleStopPolicy: "safe-double-stops" });

    const layers = generateAccompanimentSupportLayers(sampleAbc, { workflow: session, accompaniment });
    expect(layers.djembe).toContain("V:Djembe");
    expect(layers.flute).toContain("V:Flute");
    expect(layers.violin).toContain("V:Violin");
    expect(layers.combined).toContain("Layer 2");
  });

  it("generates support layers for completed enabled solo support branches", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc, {
      ...getDefaultAccompanimentWorkflowSetup(),
      style: "solo-fingerstyle",
      instruments: getDefaultAccompanimentWorkflowSetup().instruments.map((instrument) => ({
        ...instrument,
        enabled: instrument.id === "djembe",
      })),
    });
    const accompaniment = generateAccompanimentStage(sampleAbc);
    selectOption(session, "djembe-fill-validation", { grooveProfile: "devotional", density: "moderate" });
    selectOption(session, "flute-breath-fill-validation");
    selectOption(session, "violin-expression-validation");

    const layers = generateAccompanimentSupportLayers(sampleAbc, { workflow: session, accompaniment });
    expect(layers.djembe).toContain("V:Djembe");
    expect(layers.flute).toBeNull();
    expect(layers.violin).toBeNull();
  });

  it("locks branch steps until the shared harmonic foundation is selected", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);

    expect(isAccompanimentWorkflowStepUnlocked(session, "key-beats")).toBe(true);
    expect(isAccompanimentWorkflowStepUnlocked(session, "guitar-comping-profile")).toBe(false);
    expect(isAccompanimentWorkflowStepUnlocked(session, "piano-comping-bass")).toBe(false);

    for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 3)) {
      selectOption(session, stepId);
    }

    expect(isAccompanimentWorkflowStepUnlocked(session, "guitar-comping-profile")).toBe(true);
    expect(isAccompanimentWorkflowStepUnlocked(session, "piano-comping-bass")).toBe(true);
    expect(isAccompanimentWorkflowStepUnlocked(session, "guitar-voicing-bass")).toBe(false);
  });

  it("builds prompts with default rules, user notes, strong-beat guidance, and previous selections", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    selectOption(session, "key-beats");

    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "key-beats",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: getSelectedWorkflowContext(session, "key-beats"),
      setup: session.setup,
      userNote: "Prefer very simple bhajan support.",
    });

    expect(prompt).toContain("DEFAULT PROMPT");
    expect(prompt).toContain("Return 1-2 options");
    expect(prompt).toContain("emphasis direction");
    expect(prompt).toContain("Prefer very simple bhajan support.");
    expect(prompt).toContain("Setup");
    expect(prompt).toContain("Guitar Classic");
    expect(prompt).toContain("Piano");
    expect(prompt).toContain(sampleAbc);
  });

  it("creates a tool schema that permits 1-5 options and requires justification fields", () => {
    const schema = buildAccompanimentWorkflowToolSchema("piano-fills-pedal-validation");
    const options = schema.function.parameters.properties.options;
    const item = options.items;

    expect(options.minItems).toBe(1);
    expect(options.maxItems).toBe(2);
    expect(item.required).toEqual(["id", "label", "summary", "justification", "data", "warnings", "validationNotes"]);
  });

  it("lists every LLM-visible accompaniment workflow tool", () => {
    const toolNames = getAccompanimentWorkflowLlmToolNames();

    expect(toolNames).toContain("generate_chord_roles_progression");
    expect(toolNames).toContain("generate_piano_fills_pedal_validation");
    expect(toolNames).toContain("generate_harmonium_drone_register");
    expect(toolNames).toContain("generate_djembe_groove_interlock");
    expect(toolNames).toContain("generate_flute_breath_fill_validation");
    expect(toolNames).toContain("generate_violin_bed_register");
    expect(toolNames).toContain("generate_violin_expression_validation");
    expect(toolNames).toContain("generate_consolidated_chord_ingestion");
    expect(toolNames).toContain("break_measures_line");
    expect(toolNames).toContain("add_strong_beat_icons");
    expect(toolNames).toContain("valid_guitar_tab");
  });

  it("adds add_strong_beat_icons tool-call requirements to Strong Beats prompts and schemas", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "key-beats",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: [],
    });
    const schema = buildAccompanimentWorkflowToolSchema("key-beats");
    const data = schema.function.parameters.properties.options.items.properties.data as WorkflowDataSchemaForTest;
    const addStrongBeatSchema = buildAddStrongBeatIconsToolSchema();

    expect(prompt).toContain("add_strong_beat_icons");
    expect(prompt).toContain("emphasis direction");
    expect(data.required).toEqual(["strongBeatEmphasis"]);
    expect(data.properties?.strongBeatDirectives).toBeUndefined();
    expect(data.properties?.annotatedAbc).toBeUndefined();
    expect(addStrongBeatSchema.function.name).toBe("add_strong_beat_icons");
    expect(addStrongBeatSchema.function.parameters.required).toEqual(["emphasis"]);
  });

  it("records parsed final Strong Beats tool payloads in diagnostics", async () => {
    vi.stubEnv("AI_API_URL", "https://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");
    const finalArgs = {
      options: [{
        id: "primary-strong-beats",
        label: "Primary strong beats",
        summary: "Emphasize devotional downbeats and cadences.",
        justification: "Keeps the melody intact while marking structural anchors.",
        data: { strongBeatEmphasis: "primary-strong-beats" },
        warnings: [],
        validationNotes: ["Concrete beat rows are generated locally."],
      }],
    };
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "local-call-1",
              function: { name: "add_strong_beat_icons", arguments: JSON.stringify({ emphasis: "primary-strong-beats" }) },
            }],
          },
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "final-call-1",
              function: { name: "generate_key_beats", arguments: JSON.stringify(finalArgs) },
            }],
          },
        }],
      }), { status: 200 }));
    const diagnostics: ToolDiagnosticEvent[] = [];

    const result = await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [
        { type: "function", function: { name: "add_strong_beat_icons" } },
        { type: "function", function: { name: "generate_key_beats" } },
      ],
      finalToolName: "generate_key_beats",
      localTools: [{
        name: "add_strong_beat_icons",
        execute: () => ({
          abcNotation: sampleAbc,
          strongBeatDirectives: [{ measureIndex: 0, beats: [{ beatTime: 1, weight: "strong" }] }],
          issues: [],
          emphasis: "primary-strong-beats",
          valid: true,
        }),
      }],
      validateFinalResult: (args) => ({
        valid: Array.isArray((args as { options?: unknown }).options),
        toolResult: { valid: true, optionCount: (args as { options: unknown[] }).options.length },
      }),
      onDiagnostic: (event) => {
        diagnostics.push(event);
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(finalArgs);
    expect(diagnostics.find((event) => event.type === "tool-call" && event.final)).toMatchObject({
      type: "tool-call",
      toolName: "generate_key_beats",
      input: finalArgs,
    });
    expect(diagnostics.find((event) => event.type === "final-validation")).toMatchObject({
      toolName: "generate_key_beats",
      valid: true,
      toolResult: { valid: true, optionCount: 1 },
    });
  });

  it("adds break_measures_line tool-call requirements to chord ABC prompts and schemas", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "chord-roles-progression",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: [],
    });
    const consolidatedPrompt = buildConsolidatedChordIngestionPrompt({
      sourceAbc: `${sampleAbc}\nw: [C]Ha-ri | [G]Bol |`,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: [],
    });
    const schema = buildAccompanimentWorkflowToolSchema("chord-roles-progression");
    const breakSchema = buildBreakMeasuresLineToolSchema();
    const data = schema.function.parameters.properties.options.items.properties.data as WorkflowDataSchemaForTest;

    expect(prompt).toContain("break_measures_line");
    expect(prompt).toContain("harmonizedAbc");
    expect(consolidatedPrompt).toContain("break_measures_line");
    expect(breakSchema.function.name).toBe("break_measures_line");
    expect(breakSchema.function.parameters.required).toEqual(["generatedAbc"]);
    expect(data.properties?.harmonizedAbc).toBeDefined();
  });

  it("builds an ABC comment annotation for the latest applied workflow step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    selectOption(session, "key-beats");
    selectOption(session, "key-beats");

    const annotation = buildAccompanimentWorkflowAbcAnnotation(session);

    expect(annotation).toContain("% --- Human-in-the-loop Accompaniment Workflow Applied ---");
    expect(annotation).toContain("% ABCNotation applied after Step 1: Key, Scale, Cadence & Strong Beats");
    expect(annotation).toContain("% Step 1 Key, Scale, Cadence & Strong Beats: key-beats Choice");
  });

  it("applies selected chord progression ABC as the playable music staff source", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const progressionAbc = `${sampleAbc}\n% chords applied\n"C"C2 E2 G2 |`;
    selectOption(session, "chord-roles-progression", { harmonizedAbc: progressionAbc });

    expect(getWorkflowAppliedMusicAbc(session, sampleAbc)).toBe(progressionAbc);
  });

  it("breaks generated ABC measures to match the source melody line pattern", () => {
    const referenceAbc = `X:1
T:Line Pattern
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 | G2 A2 B2 c2 |
| c2 B2 A2 G2 | F2 E2 D2 C2 |
| C8 | D8 |`;
    const generatedAbc = `X:1
T:Generated Collapsed
M:4/4
L:1/8
K:C
V:Melody name="Melody"
| "C"C2 D2 E2 F2 | "G"G2 A2 B2 c2 | "Am"c2 B2 A2 G2 | "F"F2 E2 D2 C2 | "C"C8 | "G"D8 |`;

    expect(abcMatchesReferenceMeasureLinePattern(generatedAbc, referenceAbc)).toBe(false);

    const normalized = break_measures_line(generatedAbc, referenceAbc);
    const musicLines = normalized
      .split("\n")
      .filter((line) => line.trim().startsWith("|"));

    expect(abcMatchesReferenceMeasureLinePattern(normalized, referenceAbc)).toBe(true);
    expect(musicLines).toHaveLength(3);
    expect(musicLines.map((line) => line.split("|").filter((part) => part.trim()).length)).toEqual([2, 2, 2]);
  });

  it("preserves source lyric rows when normalizing generated harmony ABC without lyrics", () => {
    const referenceAbc = `X:1
T:Lyric Reference
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 | G2 A2 B2 c2 |
w: Ha-ri Bol Ha-ri Bol
| c2 B2 A2 G2 | F2 E2 D2 C2 |
w: Go-vin-da Ra-dhe Shyam`;
    const generatedAbc = `X:1
T:Generated Harmony
M:4/4
L:1/8
K:C
| "C"C2 D2 E2 F2 | "G"G2 A2 B2 c2 | "Am"c2 B2 A2 G2 | "F"F2 E2 D2 C2 |`;

    const normalized = break_measures_line(generatedAbc, referenceAbc);

    expect(normalized).toContain("w: Ha-ri Bol Ha-ri Bol");
    expect(normalized).toContain("w: Go-vin-da Ra-dhe Shyam");
    expect(abcMatchesReferenceMeasureLinePattern(normalized, referenceAbc)).toBe(true);
  });

  it("preserves source lyric rows under Melody in normalized inline multi-voice harmony ABC", () => {
    const referenceAbc = `X:1
T:Inline Lyric Reference
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 | G2 A2 B2 c2 |
w: Ha-ri Bol Ha-ri Bol
| c2 B2 A2 G2 | F2 E2 D2 C2 |
w: Go-vin-da Ra-dhe Shyam`;
    const generatedAbc = `X:1
T:Generated Multi Voice Harmony
M:4/4
L:1/8
%%score (Melody) (Guitar)
K:C
V:Melody name="Melody"
V:Guitar clef=treble-8
[V:Melody] | "C"C2 D2 E2 F2 | "G"G2 A2 B2 c2 | "Am"c2 B2 A2 G2 | "F"F2 E2 D2 C2 |
[V:Guitar] | C,2 G,2 C2 E2 | G,2 D2 G2 B2 | A,2 E2 A2 c2 | F,2 C2 F2 A2 |`;

    const normalized = break_measures_line(generatedAbc, referenceAbc);

    expect(normalized).toContain("[V:Melody] | \"C\"C2 D2 E2 F2 | \"G\"G2 A2 B2 c2 |");
    expect(normalized).toContain("w: Ha-ri Bol Ha-ri Bol");
    expect(normalized).toContain("[V:Guitar] | C,2 G,2 C2 E2 | G,2 D2 G2 B2 |");
    expect(normalized).toContain("[V:Melody] | \"Am\"c2 B2 A2 G2 | \"F\"F2 E2 D2 C2 |");
    expect(normalized).toContain("w: Go-vin-da Ra-dhe Shyam");
    expect(normalized).toContain("[V:Guitar] | A,2 E2 A2 c2 | F,2 C2 F2 A2 |");
    expect(abcMatchesReferenceMeasureLinePattern(normalized, referenceAbc)).toBe(true);
  });

  it("repairs malformed voice ids in ABC-shaped workflow option data", () => {
    const referenceAbc = `X:1
T:Hari Bol Reference
M:4/4
L:1/8
K:Em
| E E2 F (GB) A G | (FE) DF E4 |`;
    const malformedGeneratedAbc = `X:1
T:Hari Bol Generated
M:4/4
L:1/8
%%score (Melody) (Melody]) (GuitarClassic])
K:Em
V:Melody] | "Em"E E2 F (GB) A G | "D"(FE) DF "Em"E4 |
V:GuitarClassic] | E,2 B,2 E2 G2 | D,2 A,2 E,2 B,2 |`;

    const normalized = break_measures_line(malformedGeneratedAbc, referenceAbc);

    expect(normalized).toContain("%%score (Melody) (Guitar)");
    expect(normalized).toContain("[V:Melody] | \"Em\"E E2 F (GB) A G | \"D\"(FE) DF \"Em\"E4 |");
    expect(normalized).toContain("[V:Guitar] | E,2 B,2 E2 G2 | D,2 A,2 E,2 B,2 |");
    expect(normalized).not.toContain("Melody])");
    expect(normalized).not.toContain("GuitarClassic])");
    expect(normalized).not.toMatch(/^V:Melody\]/m);
    expect(normalized).not.toMatch(/^V:GuitarClassic\]/m);
    expect(abcMatchesReferenceMeasureLinePattern(normalized, referenceAbc)).toBe(true);
  });

  it("normalizes ABC-shaped workflow option data while preserving unrelated fields", () => {
    const referenceAbc = `X:1
T:Line Pattern
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 | G2 A2 B2 c2 |
| c2 B2 A2 G2 | F2 E2 D2 C2 |`;
    const data = normalizeWorkflowOptionDataLineBreaks({
      harmonizedAbc: `X:1
T:Generated
M:4/4
L:1/8
K:C
| "C"C2 D2 E2 F2 | "G"G2 A2 B2 c2 | "Am"c2 B2 A2 G2 | "F"F2 E2 D2 C2 |`,
      style: "devotional",
    }, referenceAbc);

    expect(data.style).toBe("devotional");
    expect(String(data.harmonizedAbc).split("\n").filter((line) => line.trim().startsWith("|"))).toHaveLength(2);
  });

  it("prefers voice-leading validated ABC over the earlier progression ABC", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const progressionAbc = `${sampleAbc}\n% progression only`;
    const validatedAbc = `${sampleAbc}\n% validated voice leading`;
    selectOption(session, "chord-roles-progression", { harmonizedAbc: progressionAbc });
    selectOption(session, "voice-leading-validation", { validatedAbc });

    expect(getWorkflowAppliedMusicAbc(session, sampleAbc)).toBe(validatedAbc);
  });

  it("detects chord annotations embedded in lyric lines", () => {
    const abcWithLyricChords = `${sampleAbc}\nw: [Em]Ha-ri Bol | Ha-ri [D]Bol | [C]Go-vin-da [B7]Bol |`;

    expect(hasLyricChordAnnotations(abcWithLyricChords)).toBe(true);
    expect(extractLyricChordAnnotations(abcWithLyricChords).map((annotation) => annotation.chord)).toEqual(["Em", "D", "C", "B7"]);
  });

  it("builds a consolidated chord-ingestion prompt and schema for the three harmony steps", () => {
    const abcWithLyricChords = `${sampleAbc}\nw: [Em]Ha-ri Bol | Ha-ri [D]Bol |`;
    const prompt = buildConsolidatedChordIngestionPrompt({
      sourceAbc: abcWithLyricChords,
      metadata: { key: "Em", scale: "minor", timeSignature: "4/4" },
      previousSelections: [],
      userNote: "Keep the user's chords.",
    });
    const schema = buildConsolidatedChordIngestionToolSchema();

    expect(prompt).toContain("CONSOLIDATED CHORD INGESTION");
    expect(prompt).toContain("Detected lyric chord progression: Em → D");
    expect(prompt).toContain("Keep the user's chords.");
    expect(schema.function.name).toBe("generate_consolidated_chord_ingestion");
    expect(schema.function.parameters.required).toEqual(["chordRolesProgression", "voiceLeadingValidation"]);
  });


  it("builds guitar prompts that require valid_guitar_tab before final output", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "guitar-fills-validation",
      sourceAbc: sampleAbc,
      metadata: { key: "Em", scale: "minor", timeSignature: "4/4" },
      previousSelections: [],
    });

    expect(prompt).toContain("valid_guitar_tab");
    expect(prompt).toContain("guitarTab");
    expect(prompt).toContain("compact event keys");
    expect(prompt).toContain("query_guitar_voicings");
  });

  it("requires guitarTab events in guitar tab-bearing workflow schemas", () => {
    const schema = buildAccompanimentWorkflowToolSchema("guitar-voicing-bass");
    const data = schema.function.parameters.properties.options.items.properties.data as WorkflowDataSchemaForTest;

    expect(data.required).toEqual(["guitarTab"]);
    const guitarTab = data.properties?.guitarTab;
    const events = guitarTab?.properties?.events;

    expect(guitarTab?.required).toEqual(["profileId", "events"]);
    expect(guitarTab?.properties).toHaveProperty("profileId");
    expect(guitarTab?.properties).toHaveProperty("voicingProfileId");
    expect(String(events?.description)).toContain("compact keys");
    expect(events?.items?.properties).toHaveProperty("sid");
    expect(events?.items?.required).toEqual([
      "m",
      "b",
      "sid",
      "n",
      "s",
      "f",
      "r",
    ]);
  });

  it("no longer includes a Guitar Fingerstyle step in the accompaniment workflow", () => {
    expect(ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS).not.toContain("guitar-fingerstyle");
  });

  it("exposes the valid_guitar_tab schema for the LLM tool loop", () => {
    const schema = buildValidGuitarTabToolSchema();

    expect(schema.function.name).toBe("valid_guitar_tab");
    expect(schema.function.description).toContain("do not finalize until every option is valid");
  });

  it("advances to the next unlocked incomplete step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    expect(getNextUncompletedWorkflowStepId(session)).toBe("key-beats");

    for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 3)) {
      selectOption(session, stepId);
    }

    expect(getNextUncompletedWorkflowStepId(session)).toBe("guitar-comping-profile");
  });

  it("clears instrument branch results while preserving shared harmonized ABC", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const validatedAbc = `${sampleAbc}\n% shared harmony stays applied`;

    for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 3)) {
      selectOption(session, stepId, stepId === "voice-leading-validation" ? { validatedAbc } : { style: "shared" });
    }
    for (const stepId of ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS) {
      selectOption(session, stepId, { style: "strict-pima" });
    }
    session.currentStepId = "piano-comping-bass";

    const cleared = clearAccompanimentWorkflowStepResults(session, ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS);

    for (const stepId of ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS) {
      expect(cleared.steps[stepId].runs).toEqual([]);
      expect(cleared.steps[stepId].activeRunId).toBeNull();
      expect(cleared.steps[stepId].selectedOptionId).toBeNull();
      expect(cleared.steps[stepId].selectedAt).toBeNull();
    }
    expect(getSelectedWorkflowOption(cleared, "voice-leading-validation")?.data.validatedAbc).toBe(validatedAbc);
    expect(getWorkflowAppliedMusicAbc(cleared, sampleAbc)).toBe(validatedAbc);
    expect(cleared.currentStepId).toBe("guitar-comping-profile");
  });
});
