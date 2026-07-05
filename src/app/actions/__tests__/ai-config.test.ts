import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOpenAiCompatibleToolLoop } from "../ai-config";

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
});
