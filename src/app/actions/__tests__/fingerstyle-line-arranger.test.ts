import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";

const persistMock = vi.hoisted(() => vi.fn(async () => ({
  persisted: true,
  logPath: ".fingerstyle-diagnostics/test.jsonl",
})));

vi.mock("../fingerstyle-diagnostics", () => ({
  persistFingerstyleDiagnosticRecords: persistMock,
}));

vi.mock("../ai-config", () => ({
  requestOpenAiCompatibleToolLoop: vi.fn(async (input: {
    userPrompt: string;
    finalToolName: string;
    localTools: Array<{ name: string; execute: (args: unknown) => unknown | Promise<unknown> }>;
    onDiagnostic?: (event: unknown) => void | Promise<void>;
    validateFinalResult: (args: unknown) => { valid: boolean; message?: string };
  }) => {
    const localTool = (name: string) => input.localTools.find(tool => tool.name === name)!;
    expect(await localTool("inspect_fill_opportunities").execute({ cursor: 0 })).toMatchObject({
      valid: false,
      message: "Submit and freeze the foundation first.",
    });
    const highMelody = input.userPrompt.includes("B4=string 1 fret 7");
    const tablatureToon = [
      "tablature:v1",
      "{measure,step,string,fret,finger,role}",
      ...(highMelody ? [] : ["1,1,6,0,p,root"]),
      highMelody ? "1,1,1,7,a,melody" : "1,1,1,0,a,melody",
    ].join("\n");
    const foundation = await localTool("submit_fingerstyle_foundation").execute({ tablature_toon: tablatureToon });
    expect(foundation).toMatchObject({ valid: true });

    const pages: string[] = [];
    let cursor: number | null = 0;
    while (cursor !== null) {
      const page = await localTool("inspect_fill_opportunities").execute({ cursor });
      expect(typeof page).toBe("string");
      pages.push(page as string);
      const pageRow = (page as string).split("\n").find(line => line.startsWith("page,"))!;
      const next = pageRow.split(",")[2];
      cursor = next === "end" ? null : Number(next);
    }
    const rows = pages.flatMap(page => page.split("\n"));
    const setId = rows.find(line => line.startsWith("set,"))!.split(",")[1];
    const source = rows.find(line => line.startsWith("source,"))!.split(",")[1];
    const windowRows = rows.filter(line => line.startsWith("W,") && !line.startsWith("W,id,"));
    const candidateRows = rows.filter(line => line.startsWith("C,") && !line.startsWith("C,id,"));
    expect(windowRows, pages.join("\n")).not.toHaveLength(0);
    const selectedWindowId = windowRows[0].split(",")[1];
    const candidateRow = candidateRows.find(line => line.split(",")[2] === selectedWindowId)!;
    const candidateId = candidateRow.split(",")[1];
    const selectionToon = [
      "fill-selection:v1",
      `set,${setId}`,
      `source,${source}`,
      "decisions: [D,window,use|skip,reason]",
      ...windowRows.map((row, index) => `D,${row.split(",")[1]},${index === 0 ? "use" : "skip"},test decision`),
    ].join("\n");
    expect(await localTool("select_fill_windows").execute({ selection_toon: selectionToon })).toMatchObject({ valid: true });
    const fillsToon = [
      "fills:v1",
      `set,${setId}`,
      `source,${source}`,
      "notes: [N,candidate,durationSteps,finger]",
      `N,${candidateId},1,i`,
    ].join("\n");
    expect(await localTool("validate_composed_fills").execute({ fills_toon: fillsToon })).toMatchObject({ valid: true });

    expect(input.validateFinalResult({ fills_toon: fillsToon.replace(",1,i", ",2,i") }).valid).toBe(false);
    const args = { fills_toon: fillsToon };
    await input.onDiagnostic?.({
      type: "chat-request",
      iteration: 0,
      messageCount: 2,
      toolChoice: "required",
      toolNames: [input.finalToolName],
    });
    await input.onDiagnostic?.({
      type: "tool-call",
      iteration: 0,
      toolName: input.finalToolName,
      toolCallId: "call-submit",
      local: false,
      final: true,
      input: args,
    });
    const validation = input.validateFinalResult(args);
    await input.onDiagnostic?.({
      type: "final-validation",
      iteration: 0,
      toolName: input.finalToolName,
      valid: validation.valid,
      failedValidationAttempts: validation.valid ? 0 : 1,
      maxValidationAttempts: 10,
      message: validation.message,
    });
    if (!validation.valid) throw new Error(validation.message);
    return args;
  }),
}));

import { generateAIFingerstyleLine } from "../fingerstyle-line-arranger";

function makeMeasure(pitch = "E4"): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "Sparse PIMA",
      voicing_plan: "Open Em",
      fill_density: "few",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: {
        pitch: index === 0 ? pitch : null,
        state: index === 0 ? "attack" as const : "rest" as const,
      },
      lyric: index === 0 ? "Ga-" : null,
    })),
  };
}

describe("generateAIFingerstyleLine diagnostics", () => {
  beforeEach(() => {
    persistMock.mockClear();
  });

  it("combines LLM and DP events, appends plaintext logs, and persists run-complete last", async () => {
    const result = await generateAIFingerstyleLine({
      songSlug: "ganesha",
      sourceFingerprint: "source-test",
      lineMeasures: [makeMeasure()],
      previousLines: [],
      activeAbc: "Q:1/4=90\nK:Em\nE2",
    });

    expect(result.success, `${result.error}\n${result.logs.join("\n")}`).toBe(true);
    expect(result.diagnostics?.plaintext).toContain(
      "FINGERSTYLE LLM + DP DIAGNOSTIC VISUALIZATION (PLAINTEXT)",
    );
    expect(result.logs.at(-1)).toBe(result.diagnostics?.plaintext);
    expect(result.diagnostics?.events.some(event => event.source === "llm")).toBe(true);
    expect(result.diagnostics?.events.some(event => event.source === "dp")).toBe(true);
    expect(result.diagnostics?.events.some(event => event.source === "workflow")).toBe(true);
    expect(result.diagnostics?.events.some(event => (
      event.source === "workflow" && event.kind === "abc-ascii-guitartab-validated"
    ))).toBe(true);
    expect(result.logs.join("\n")).toContain("## ABC ↔ ASCII-GuitarTab Validation");
    expect(result.fillSummary).toMatchObject({
      bpm: 90,
      policy: { skillLevel: "beginner", resolvedDensity: "few" },
      selectedWindowCount: 1,
      composedFillCount: 1,
      finalValidation: "passed",
    });
    expect(result.measures?.[0].grid[0].melody).toEqual({ pitch: "E4", state: "attack" });
    expect(result.measures?.[0].grid.slice(1).every(step =>
      step.tablature?.every(event => event.role !== "melody"),
    )).toBe(true);
    expect(result.measures?.[0].grid[0].tablature?.some(event => event.role === "fill")).toBe(false);
    expect(result.measures?.[0].grid.slice(1).some(step =>
      step.tablature?.some(event => event.role === "fill"),
    )).toBe(true);

    expect(persistMock).toHaveBeenCalledOnce();
    const calls = persistMock.mock.calls as unknown as Array<[{ records: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> }] >;
    const records = calls[0][0].records;
    const firstRecord = records[0]!;
    const lastRecord = records.at(-1)!;
    expect(firstRecord.type).toBe("run-input");
    expect(lastRecord.type).toBe("run-complete");
    expect(records.filter((record: { type: string }) => record.type === "run-complete")).toHaveLength(1);
    expect(lastRecord.payload.plaintext).toBe(result.diagnostics?.plaintext);
  });

  it("preserves a high authoritative melody with a beginner melody-only exception", async () => {
    const result = await generateAIFingerstyleLine({
      songSlug: "ganesha",
      sourceFingerprint: "source-b4",
      lineMeasures: [makeMeasure("B4")],
      previousLines: [],
      activeAbc: "Q:1/4=90\nK:G\nB2",
      skillLevel: "beginner",
    });

    expect(result.success, `${result.error}\n${result.logs.join("\n")}`).toBe(true);
    const melody = result.measures?.[0].grid[0].tablature?.find(event => event.role === "melody");
    expect(melody).toMatchObject({ string: 1, fret: 7, role: "melody" });
    expect(result.logs.join("\n")).toContain("melody-only fret exception up to fret 7");
  });
});
