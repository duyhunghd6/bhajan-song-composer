import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAIFingerstyleMeasure } from "../fingerstyle-arranger";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import type { TimeSliceGridStep } from "@/lib/theory/fingerstyle-arranger/time-slice";

describe("validateFingerstylePhysics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const baseStep: Omit<TimeSliceGridStep, "tablature"> = {
    step: 1,
    chord: "Em",
    weight: "⬤",
    melody: { pitch: "E4", state: "attack" },
    lyric: "Ha-",
  };

  it("accepts a standard 4-string pinch", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "i", role: "fifth" },
          { string: 3, fret: 0, finger: "m", role: "fill" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  it("accepts a 5-string strum with multiple thumb 'p' fingers", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "p", role: "fifth" },
          { string: 4, fret: 2, finger: "p", role: "fill" },
          { string: 3, fret: 0, finger: "p", role: "fill" },
          { string: 1, fret: 0, finger: "a", role: "melody" }, // melody played with 'a', others strummed with 'p'
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  it("rejects a 5-string pinch using separate non-strum fingers", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "i", role: "fifth" },
          { string: 4, fret: 2, finger: "m", role: "fill" },
          { string: 3, fret: 0, finger: "a", role: "fill" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds picking finger budget");
  });

  it("rejects more than 6 strings", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "p", role: "fifth" },
          { string: 4, fret: 2, finger: "p", role: "fill" },
          { string: 3, fret: 0, finger: "p", role: "fill" },
          { string: 2, fret: 0, finger: "p", role: "fill" },
          { string: 1, fret: 0, finger: "p", role: "melody" },
          { string: 1, fret: 3, finger: "p", role: "melody" }, // duplicate / extra
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds physical guitar limit of 6 strings");
  });

  it("rejects physically impossible diagonal stretch (String 6 Fret 3 and String 1 Fret 7)", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        melody: { pitch: "B4", state: "attack" }, // String 1 fret 7 is B4
        tablature: [
          { string: 6, fret: 3, finger: "p", role: "root" },
          { string: 1, fret: 7, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Left-hand fret span");
  });

  it("accepts a playable diagonal stretch (String 6 Fret 3 and String 1 Fret 3)", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        melody: { pitch: "G4", state: "attack" }, // String 1 fret 3 is G4
        tablature: [
          { string: 6, fret: 3, finger: "p", role: "root" },
          { string: 1, fret: 3, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  // --- Bass placement rule tests ---

  it("rejects bass on an unweighted step", () => {
    const grid: TimeSliceGridStep[] = [
      {
        step: 7,
        chord: "Em",
        weight: null, // no weight marker
        melody: { pitch: "F#4", state: "attack" },
        lyric: "Ga-",
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "bass" },
          { string: 1, fret: 2, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Bass note on unweighted step");
  });

  it("accepts bass on a weighted step (⬤)", () => {
    const grid: TimeSliceGridStep[] = [
      {
        step: 1,
        chord: "Em",
        weight: "⬤",
        melody: { pitch: "E4", state: "attack" },
        lyric: "ne-",
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "bass" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  it("accepts bass on a medium-weight step (●)", () => {
    const grid: TimeSliceGridStep[] = [
      {
        step: 9,
        chord: "Em",
        weight: "●",
        melody: { pitch: "G4", state: "attack" },
        lyric: "ne-",
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "bass" },
          { string: 1, fret: 3, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  // --- Fill density rule tests ---

  it("rejects 6 fills when fill_density is 'few'", () => {
    const grid: TimeSliceGridStep[] = Array.from({ length: 16 }, (_, i) => ({
      step: i + 1,
      chord: "Em",
      weight: i === 0 ? "⬤" as const : null,
      melody: { pitch: "E4", state: i === 0 ? "attack" as const : "sustain" as const },
      lyric: null,
      tablature: i >= 2 && i <= 7
        ? [{ string: 3, fret: 0, finger: "i" as const, role: "fill" as const }]
        : i === 0
          ? [{ string: 1, fret: 0, finger: "a" as const, role: "melody" as const }]
          : [],
    }));

    const result = validateFingerstylePhysics(grid, { fillDensity: "few" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Fill density violation");
    expect(result.message).toContain("6 fill attacks");
  });

  it("accepts 3 fills when fill_density is 'few'", () => {
    const grid: TimeSliceGridStep[] = Array.from({ length: 16 }, (_, i) => ({
      step: i + 1,
      chord: "Em",
      weight: i === 0 ? "⬤" as const : null,
      melody: { pitch: "E4", state: i === 0 ? "attack" as const : "sustain" as const },
      lyric: null,
      tablature: i >= 2 && i <= 4
        ? [{ string: 3, fret: 0, finger: "i" as const, role: "fill" as const }]
        : i === 0
          ? [{ string: 1, fret: 0, finger: "a" as const, role: "melody" as const }]
          : [],
    }));

    const result = validateFingerstylePhysics(grid, { fillDensity: "few" });
    expect(result.valid).toBe(true);
  });

  it("rejects 1 fill when fill_density is 'none'", () => {
    const grid: TimeSliceGridStep[] = [
      {
        step: 1,
        chord: "Em",
        weight: "⬤",
        melody: { pitch: "E4", state: "attack" },
        lyric: "ne-",
        tablature: [
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
      {
        step: 2,
        chord: "Em",
        weight: null,
        melody: { pitch: "E4", state: "sustain" },
        lyric: null,
        tablature: [
          { string: 3, fret: 0, finger: "i", role: "fill" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid, { fillDensity: "none" });
    expect(result.valid).toBe(false);
    expect(result.message).toContain("fill_density \"none\" allows 0");
  });

  it("accepts 0 fills when fill_density is 'none'", () => {
    const grid: TimeSliceGridStep[] = [
      {
        step: 1,
        chord: "Em",
        weight: "⬤",
        melody: { pitch: "E4", state: "attack" },
        lyric: "ne-",
        tablature: [
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid, { fillDensity: "none" });
    expect(result.valid).toBe(true);
  });

  it("uses compact tablature tool schemas and preserves source measure metadata", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const tablatureToon = [
      "tablature:v1",
      "{measure,step,string,fret,finger,role}",
      "1,1,6,0,p,bass",
      "1,1,1,0,a,melody",
    ].join("\n");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-validate",
              function: {
                name: "validate_fingerstyle_physics",
                arguments: JSON.stringify({ tablature_toon: tablatureToon }),
              },
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
              id: "call-submit",
              function: {
                name: "submit_arranged_measure",
                arguments: JSON.stringify({ tablature_toon: tablatureToon }),
              },
            }],
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const measure = {
      measure: 1,
      lineIndex: 0,
      style_profile: {
        key: "Em",
        comping_style: "Sparse PIMA",
        voicing_plan: "Open anchors",
        fill_density: "few",
      },
      pickupDurationUnits: 4,
      source_abc: { melody: "E2", lyric: "Ja-", beatWeight: "⬤" },
      grid: [{ ...baseStep, tablature: [] }],
    };

    const result = await generateAIFingerstyleMeasure({ measure, activeAbc: "K:Em\nE2" });

    expect(result.success).toBe(true);
    expect(result.measure).toMatchObject({
      measure: 1,
      lineIndex: 0,
      style_profile: measure.style_profile,
      pickupDurationUnits: 4,
      source_abc: measure.source_abc,
    });
    expect(result.measure?.grid[0]).toMatchObject({
      chord: "Em",
      weight: "⬤",
      melody: { pitch: "E4", state: "attack" },
      lyric: "Ha-",
      tablature: [
        { string: 6, fret: 0, finger: "p", role: "bass" },
        { string: 1, fret: 0, finger: "a", role: "melody" },
      ],
    });

    const firstRequest = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const validationTool = firstRequest.tools.find((tool: { function?: { name?: string } }) => tool.function?.name === "validate_fingerstyle_physics");
    const finalTool = firstRequest.tools.find((tool: { function?: { name?: string } }) => tool.function?.name === "submit_arranged_measure");
    expect(validationTool.function.parameters.required).toEqual(["tablature_toon"]);
    expect(finalTool.function.parameters.required).toEqual(["tablature_toon"]);
    expect(validationTool.function.parameters.properties).not.toHaveProperty("grid");
    expect(firstRequest.messages[1].content).not.toContain("tablature}");
  });
});
