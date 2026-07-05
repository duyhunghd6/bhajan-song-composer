import { describe, expect, it } from "vitest";
import {
  ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  buildAccompanimentWorkflowAbcAnnotation,
  buildAccompanimentWorkflowPrompt,
  clearAccompanimentWorkflowStepResults,
  abcMatchesReferenceMeasureLinePattern,
  buildAccompanimentWorkflowToolSchema,
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
  isAccompanimentWorkflowStepUnlocked,
  isGuitarTabValidationWorkflowStep,
  normalizeWorkflowOptionDataLineBreaks,
  type AccompanimentWorkflowOption,
} from "../accompaniment-workflow";
import { buildValidGuitarTabToolSchema } from "../guitar-tab-validation";

const sampleAbc = `X:1
T:Workflow Sample
M:3/4
L:1/8
K:C
| C2 E2 G2 | A3 G F2 | E6 |`;

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
  it("defines the exact 12-step Guitar + Piano human-in-loop order", () => {
    expect(ACCOMPANIMENT_WORKFLOW_STEP_IDS).toEqual([
      "melody-snapshot",
      "key-scale-cadence",
      "strong-beat-targets",
      "chord-tone-mapping",
      "chord-progression",
      "voice-leading-validation",
      "guitar-comping-profile",
      "guitar-voicing-bass",
      "guitar-fills-validation",
      "piano-comping-bass",
      "piano-rh-voicing",
      "piano-fills-pedal-validation",
    ]);
    expect(ACCOMPANIMENT_WORKFLOW_STEPS).toHaveLength(12);
  });

  it("locks branch steps until the shared harmonic foundation is selected", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);

    expect(isAccompanimentWorkflowStepUnlocked(session, "melody-snapshot")).toBe(true);
    expect(isAccompanimentWorkflowStepUnlocked(session, "key-scale-cadence")).toBe(false);
    expect(isAccompanimentWorkflowStepUnlocked(session, "guitar-comping-profile")).toBe(false);
    expect(isAccompanimentWorkflowStepUnlocked(session, "piano-comping-bass")).toBe(false);

    for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 6)) {
      selectOption(session, stepId);
    }

    expect(isAccompanimentWorkflowStepUnlocked(session, "guitar-comping-profile")).toBe(true);
    expect(isAccompanimentWorkflowStepUnlocked(session, "piano-comping-bass")).toBe(true);
    expect(isAccompanimentWorkflowStepUnlocked(session, "guitar-voicing-bass")).toBe(false);
  });

  it("builds prompts with default rules, user notes, strong-beat guidance, and previous selections", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    selectOption(session, "melody-snapshot");
    selectOption(session, "key-scale-cadence");

    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "strong-beat-targets",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: getSelectedWorkflowContext(session, "strong-beat-targets"),
      userNote: "Prefer very simple bhajan support.",
    });

    expect(prompt).toContain("DEFAULT PROMPT");
    expect(prompt).toContain("Return between 1 and 5 distinct options");
    expect(prompt).toContain("beat 1 in 3/4");
    expect(prompt).toContain("Prefer very simple bhajan support.");
    expect(prompt).toContain("melody-snapshot Choice");
    expect(prompt).toContain(sampleAbc);
  });

  it("creates a tool schema that permits 1-5 options and requires justification fields", () => {
    const schema = buildAccompanimentWorkflowToolSchema("piano-fills-pedal-validation");
    const options = schema.function.parameters.properties.options;
    const item = options.items;

    expect(options.minItems).toBe(1);
    expect(options.maxItems).toBe(5);
    expect(item.required).toEqual(["id", "label", "summary", "justification", "data", "warnings", "validationNotes"]);
  });

  it("lists every LLM-visible accompaniment workflow tool", () => {
    const toolNames = getAccompanimentWorkflowLlmToolNames();

    expect(toolNames).toContain("generate_melody_snapshot");
    expect(toolNames).toContain("generate_chord_progression");
    expect(toolNames).toContain("generate_piano_fills_pedal_validation");
    expect(toolNames).toContain("generate_consolidated_chord_ingestion");
    expect(toolNames).toContain("break_measures_line");
    expect(toolNames).toContain("add_strong_beat_icons");
    expect(toolNames).toContain("valid_guitar_tab");
  });

  it("adds add_strong_beat_icons tool-call requirements to Strong Beats prompts and schemas", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "strong-beat-targets",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: [],
    });
    const schema = buildAccompanimentWorkflowToolSchema("strong-beat-targets");
    const data = schema.function.parameters.properties.options.items.properties.data as WorkflowDataSchemaForTest;

    expect(prompt).toContain("add_strong_beat_icons");
    expect(prompt).toContain("local algorithm");
    expect(data.required).toEqual(["strongBeatDirectives"]);
    expect(data.properties?.strongBeatDirectives.description).toContain("add_strong_beat_icons");
  });

  it("adds break_measures_line tool-call requirements to chord ABC prompts and schemas", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "chord-progression",
      sourceAbc: sampleAbc,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: [],
    });
    const consolidatedPrompt = buildConsolidatedChordIngestionPrompt({
      sourceAbc: `${sampleAbc}\nw: [C]Ha-ri | [G]Bol |`,
      metadata: { key: "C", scale: "major", timeSignature: "3/4" },
      previousSelections: [],
    });
    const schema = buildAccompanimentWorkflowToolSchema("chord-progression");
    const breakSchema = buildBreakMeasuresLineToolSchema();
    const data = schema.function.parameters.properties.options.items.properties.data as WorkflowDataSchemaForTest;

    expect(prompt).toContain("call the break_measures_line tool");
    expect(prompt).toContain("copy the returned abc exactly");
    expect(prompt).toContain("same number of measures per line");
    expect(consolidatedPrompt).toContain("call the break_measures_line tool");
    expect(breakSchema.function.name).toBe("break_measures_line");
    expect(breakSchema.function.parameters.required).toEqual(["generatedAbc"]);
    expect(data.properties?.harmonizedAbc.description).toContain("copied exactly from the break_measures_line tool result");
  });

  it("builds an ABC comment annotation for the latest applied workflow step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    selectOption(session, "melody-snapshot");
    selectOption(session, "key-scale-cadence");

    const annotation = buildAccompanimentWorkflowAbcAnnotation(session);

    expect(annotation).toContain("% --- Human-in-the-loop Accompaniment Workflow Applied ---");
    expect(annotation).toContain("% ABCNotation applied after Step 2: Key, Scale & Cadence Analysis");
    expect(annotation).toContain("% Step 1 Melody Snapshot & Metadata: melody-snapshot Choice");
    expect(annotation).toContain("% Step 2 Key, Scale & Cadence Analysis: key-scale-cadence Choice");
  });

  it("applies selected chord progression ABC as the playable music staff source", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const progressionAbc = `${sampleAbc}\n% chords applied\n"C"C2 E2 G2 |`;
    selectOption(session, "chord-progression", { harmonizedAbc: progressionAbc });

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
    selectOption(session, "chord-progression", { harmonizedAbc: progressionAbc });
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

    expect(prompt).toContain("one LLM decision");
    expect(prompt).toContain("Detected lyric chord progression: Em → D");
    expect(prompt).toContain("Keep the user's chords.");
    expect(schema.function.name).toBe("generate_consolidated_chord_ingestion");
    expect(schema.function.parameters.required).toEqual(["chordToneMapping", "chordProgression", "voiceLeadingValidation"]);
  });

  it("marks guitar voicing and polish as tab-validation steps", () => {
    expect(isGuitarTabValidationWorkflowStep("guitar-comping-profile")).toBe(false);
    expect(isGuitarTabValidationWorkflowStep("guitar-voicing-bass")).toBe(true);
    expect(isGuitarTabValidationWorkflowStep("guitar-fills-validation")).toBe(true);
  });

  it("builds guitar prompts that require valid_guitar_tab before final output", () => {
    const prompt = buildAccompanimentWorkflowPrompt({
      stepId: "guitar-fills-validation",
      sourceAbc: sampleAbc,
      metadata: { key: "Em", scale: "minor", timeSignature: "4/4" },
      previousSelections: [],
    });

    expect(prompt).toContain("valid_guitar_tab");
    expect(prompt).toContain("guitarTab.events");
    expect(prompt).toContain("one guitar string cannot play E3 and G3");
  });

  it("requires guitarTab events in guitar tab-bearing workflow schemas", () => {
    const schema = buildAccompanimentWorkflowToolSchema("guitar-voicing-bass");
    const data = schema.function.parameters.properties.options.items.properties.data as WorkflowDataSchemaForTest;

    expect(data.required).toEqual(["guitarTab"]);
    const guitarTab = data.properties?.guitarTab;
    const events = guitarTab?.properties?.events;

    expect(guitarTab?.required).toEqual(["events"]);
    expect(events?.items?.required).toEqual([
      "measureIndex",
      "beat",
      "note",
      "string",
      "fret",
      "role",
    ]);
  });

  it("exposes the valid_guitar_tab schema for the LLM tool loop", () => {
    const schema = buildValidGuitarTabToolSchema();

    expect(schema.function.name).toBe("valid_guitar_tab");
    expect(schema.function.description).toContain("do not finalize until every option is valid");
  });

  it("advances to the next unlocked incomplete step", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    expect(getNextUncompletedWorkflowStepId(session)).toBe("melody-snapshot");

    for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 6)) {
      selectOption(session, stepId);
    }

    expect(getNextUncompletedWorkflowStepId(session)).toBe("guitar-comping-profile");
  });

  it("clears instrument branch results while preserving shared harmonized ABC", () => {
    const session = createAccompanimentWorkflowSession(sampleAbc);
    const validatedAbc = `${sampleAbc}\n% shared harmony stays applied`;

    for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, 6)) {
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
