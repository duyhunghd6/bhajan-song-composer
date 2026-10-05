import { afterEach, describe, expect, it, vi } from "vitest";
import { readAiConfig, requestOpenAiCompatibleTool } from "../ai-config";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configureEnv() {
  vi.stubEnv("AI_API_URL", "https://generativelanguage.googleapis.com/v1beta/openai");
  vi.stubEnv("AI_MODEL", "gemini-3.8-flash");
  vi.stubEnv("AI_API_KEY", "legacy-test-key");
  vi.stubEnv("AI_API_KEY_BASE64", Buffer.from("encoded-test-key").toString("base64"));
}

describe("AI environment credentials", () => {
  it("sends the decoded key through the existing OpenAI-compatible transport", async () => {
    configureEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { tool_calls: [{
        id: "call-test",
        function: { name: "check_connection", arguments: '{"ok":true}' },
      }] } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestOpenAiCompatibleTool({
      systemPrompt: "Test connection",
      userPrompt: "Return ok",
      toolName: "check_connection",
      toolSchema: { type: "function", function: {
        name: "check_connection", parameters: { type: "object" },
      } },
    })).resolves.toEqual({ ok: true });

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer encoded-test-key");
    expect(JSON.parse(request.body).model).toBe("gemini-3.8-flash");
    expect(request.body).not.toContain("encoded-test-key");
  });

  it("supports the legacy plain-text environment key", async () => {
    configureEnv();
    vi.stubEnv("AI_API_KEY_BASE64", undefined);
    expect((await readAiConfig()).apiKey).toBe("legacy-test-key");
  });

  it.each(["", "not base64!", "dGVzdA", "Cg==", "//4="])(
    "rejects invalid encoded credentials without sending a request: %s", async (value) => {
      configureEnv();
      vi.stubEnv("AI_API_KEY_BASE64", value);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(readAiConfig()).rejects.toThrow("AI_API_KEY_BASE64");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
