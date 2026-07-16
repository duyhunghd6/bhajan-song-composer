import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOpenAiCompatibleTool, requestOpenAiCompatibleToolLoop } from "../ai-config";

describe("requestOpenAiCompatibleToolLoop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("runs local validation tools and stops only after the final tool result validates", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-validate-invalid",
              function: { name: "valid_guitar_tab", arguments: JSON.stringify({ events: [{ string: 6 }] }) },
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
              id: "call-validate-valid",
              function: { name: "valid_guitar_tab", arguments: JSON.stringify({ events: [{ string: 6 }, { string: 3 }] }) },
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
              id: "call-final",
              function: { name: "generate_guitar", arguments: JSON.stringify({ options: [{ id: "ok" }] }) },
            }],
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [
        { type: "function", function: { name: "valid_guitar_tab", parameters: { type: "object" } } },
        { type: "function", function: { name: "generate_guitar", parameters: { type: "object" } } },
      ],
      finalToolName: "generate_guitar",
      localTools: [{
        name: "valid_guitar_tab",
        execute: (args) => {
          const events = (args as { events: Array<{ string: number }> }).events;
          return { valid: events.length > 1 && new Set(events.map((event) => event.string)).size === events.length };
        },
      }],
      validateFinalResult: (args) => ({ valid: Array.isArray((args as { options?: unknown }).options) }),
    });

    expect(result).toEqual({ options: [{ id: "ok" }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondRequest.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call-validate-invalid",
          content: JSON.stringify({ valid: false }),
        }),
      ])
    );
  });

  it("restricts a staged caller to the server-selected next tool", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const toolResponse = (id: string, name: string) => new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id, function: { name, arguments: "{}" } }] } }],
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolResponse("call-foundation", "materialize_foundation"))
      .mockResolvedValueOnce(toolResponse("call-final", "submit_arrangement"));
    vi.stubGlobal("fetch", fetchMock);

    let materialized = false;
    await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [],
      resolveToolTurn: () => materialized
        ? {
            tools: [{ type: "function", function: { name: "submit_arrangement", parameters: { type: "object" } } }],
            toolChoice: { type: "function", function: { name: "submit_arrangement" } },
            maxToolCallsPerTurn: 1,
          }
        : {
            tools: [{ type: "function", function: { name: "materialize_foundation", parameters: { type: "object" } } }],
            toolChoice: { type: "function", function: { name: "materialize_foundation" } },
            maxToolCallsPerTurn: 1,
          },
      finalToolName: "submit_arrangement",
      localTools: [{ name: "materialize_foundation", execute: () => { materialized = true; return { valid: true }; } }],
      validateFinalResult: () => ({ valid: true }),
    });

    const firstRequest = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(firstRequest.tools.map((tool: { function: { name: string } }) => tool.function.name)).toEqual(["materialize_foundation"]);
    expect(firstRequest.tool_choice).toEqual({ type: "function", function: { name: "materialize_foundation" } });
    expect(secondRequest.tools.map((tool: { function: { name: string } }) => tool.function.name)).toEqual(["submit_arrangement"]);
  });

  it("feeds multiline string tool results back without JSON quoting", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const rawToon = "voicings:v1 rows=1\n{rank,span,frets_6_to_1,bass,melody,inner,barre}\n1,0,0/2/2/0/0/0,6/0,1/0,5/4/3/2,-";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-voicings",
              function: { name: "query_guitar_voicings", arguments: JSON.stringify({ chord: "Em" }) },
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
              id: "call-final",
              function: { name: "submit_arranged_measure", arguments: JSON.stringify({ tablature_toon: "tablature:v1\n{measure,step,string,fret,finger,role}" }) },
            }],
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [
        { type: "function", function: { name: "query_guitar_voicings", parameters: { type: "object" } } },
        { type: "function", function: { name: "submit_arranged_measure", parameters: { type: "object" } } },
      ],
      finalToolName: "submit_arranged_measure",
      localTools: [{ name: "query_guitar_voicings", execute: () => rawToon }],
      validateFinalResult: () => ({ valid: true }),
    });

    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const toolMessage = secondRequest.messages.find((message: { tool_call_id?: string }) => message.tool_call_id === "call-voicings");
    expect(toolMessage.content).toBe(rawToon);
    expect(toolMessage.content).not.toBe(JSON.stringify(rawToon));
  });

  it("returns validation feedback instead of accepting an invalid final tool result", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-final-invalid",
              function: { name: "generate_guitar", arguments: JSON.stringify({ options: [] }) },
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
              id: "call-final-valid",
              function: { name: "generate_guitar", arguments: JSON.stringify({ options: [{ id: "fixed" }] }) },
            }],
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [{ type: "function", function: { name: "generate_guitar", parameters: { type: "object" } } }],
      finalToolName: "generate_guitar",
      localTools: [],
      validateFinalResult: (args) => {
        const options = (args as { options?: unknown[] }).options;
        return {
          valid: Array.isArray(options) && options.length > 0,
          message: "missing options",
          toolResult: { valid: false, issues: ["missing options"] },
        };
      },
    });

    expect(result).toEqual({ options: [{ id: "fixed" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondRequest.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call-final-invalid",
          content: JSON.stringify({ valid: false, issues: ["missing options"] }),
        }),
      ])
    );
  });

  it("emits diagnostic events for request, tool result, and final validation", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-final-valid",
              function: { name: "generate_guitar", arguments: JSON.stringify({ options: [{ id: "ok" }] }) },
            }],
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const events: unknown[] = [];

    await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [{ type: "function", function: { name: "generate_guitar", parameters: { type: "object" } } }],
      finalToolName: "generate_guitar",
      localTools: [],
      validateFinalResult: () => ({ valid: true, toolResult: { valid: true } }),
      onDiagnostic: (event) => { events.push(event); },
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "chat-request", iteration: 0 }),
      expect.objectContaining({ type: "chat-response", toolCallNames: ["generate_guitar"] }),
      expect.objectContaining({ type: "tool-call", toolName: "generate_guitar", final: true }),
      expect.objectContaining({ type: "final-validation", valid: true }),
    ]));
  });

  it("emits a failed diagnostic when the LLM returns no tool calls", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "No structured output", tool_calls: [] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const events: unknown[] = [];

    await expect(requestOpenAiCompatibleTool({
      systemPrompt: "system",
      userPrompt: "user",
      toolSchema: { type: "function", function: { name: "generate_guitar", parameters: { type: "object" } } },
      toolName: "generate_guitar",
      onDiagnostic: (event) => { events.push(event); },
    })).rejects.toThrow("LLM did not return the expected generate_guitar tool call");

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "chat-request" }),
      expect.objectContaining({ type: "chat-response", toolCallNames: [] }),
      expect.objectContaining({ type: "chat-error", message: "LLM did not return the expected generate_guitar tool call" }),
    ]));
  });

  it("stops after the configured validation retry limit", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const invalidResponse = new Response(JSON.stringify({
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call-final-invalid",
            function: { name: "generate_guitar", arguments: JSON.stringify({ options: [] }) },
          }],
        },
      }],
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(invalidResponse.clone())
      .mockResolvedValueOnce(invalidResponse.clone())
      .mockResolvedValueOnce(invalidResponse.clone());
    vi.stubGlobal("fetch", fetchMock);
    const events: unknown[] = [];

    await expect(requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [{ type: "function", function: { name: "generate_guitar", parameters: { type: "object" } } }],
      finalToolName: "generate_guitar",
      localTools: [],
      validateFinalResult: () => ({ valid: false, message: "still invalid", toolResult: { valid: false } }),
      maxIterations: 3,
      onDiagnostic: (event) => { events.push(event); },
    })).rejects.toThrow("after 3 validation attempts");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(events.filter((event) => (event as { type?: string }).type === "final-validation")).toHaveLength(3);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "loop-exhausted", maxIterations: 3, lastValidationMessage: "still invalid" }),
    ]));
  });

  it("stops after a local tool reaches its invalid-result budget", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const invalidLocalResponse = new Response(JSON.stringify({
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call-foundation-invalid",
            function: { name: "submit_foundation", arguments: JSON.stringify({ value: "bad" }) },
          }],
        },
      }],
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(invalidLocalResponse.clone())
      .mockResolvedValueOnce(invalidLocalResponse.clone());
    vi.stubGlobal("fetch", fetchMock);
    const events: unknown[] = [];

    await expect(requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [
        { type: "function", function: { name: "submit_foundation", parameters: { type: "object" } } },
        { type: "function", function: { name: "generate_guitar", parameters: { type: "object" } } },
      ],
      finalToolName: "generate_guitar",
      localTools: [{
        name: "submit_foundation",
        maxInvalidResults: 2,
        execute: () => ({ valid: false, message: "still impossible" }),
      }],
      validateFinalResult: () => ({ valid: true }),
      maxIterations: 8,
      onDiagnostic: event => { events.push(event); },
    })).rejects.toThrow("2 invalid submit_foundation result");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "loop-exhausted",
        reason: "local-validation-limit",
        localInvalidResultAttempts: { submit_foundation: 2 },
      }),
    ]));
  });

  it("feeds break_measures_line tool output back before accepting final ABCNotation", async () => {
    vi.stubEnv("AI_API_URL", "http://llm.test");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubEnv("AI_MODEL", "test-model");

    const normalizedAbc = `X:1\nT:Normalized\nM:4/4\nL:1/8\nK:C\n| C2 D2 E2 F2 | G2 A2 B2 c2 |\n| c2 B2 A2 G2 | F2 E2 D2 C2 |`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-break-lines",
              function: { name: "break_measures_line", arguments: JSON.stringify({ generatedAbc: "collapsed abc" }) },
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
              id: "call-final-abc",
              function: {
                name: "generate_chord_progression",
                arguments: JSON.stringify({
                  options: [{
                    id: "line-safe",
                    data: { harmonizedAbc: normalizedAbc },
                  }],
                }),
              },
            }],
          },
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestOpenAiCompatibleToolLoop({
      systemPrompt: "system",
      userPrompt: "user",
      tools: [
        { type: "function", function: { name: "break_measures_line", parameters: { type: "object" } } },
        { type: "function", function: { name: "generate_chord_progression", parameters: { type: "object" } } },
      ],
      finalToolName: "generate_chord_progression",
      localTools: [{
        name: "break_measures_line",
        execute: () => ({ abc: normalizedAbc, valid: true }),
      }],
      validateFinalResult: (args) => ({
        valid: (args as { options?: Array<{ data?: { harmonizedAbc?: string } }> }).options?.[0]?.data?.harmonizedAbc === normalizedAbc,
      }),
    });

    expect(result).toEqual({ options: [{ id: "line-safe", data: { harmonizedAbc: normalizedAbc } }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondRequest.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          tool_call_id: "call-break-lines",
          name: "break_measures_line",
          content: JSON.stringify({ abc: normalizedAbc, valid: true }),
        }),
      ])
    );
  });
});
