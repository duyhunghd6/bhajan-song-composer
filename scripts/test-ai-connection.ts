import { loadEnvConfig } from "@next/env";
import {
  readAiConfig,
  requestOpenAiCompatibleTool,
  requestOpenAiCompatibleToolLoop,
} from "../src/app/actions/ai-config";

// Manual smoke test: uses the configured provider and consumes API quota.
loadEnvConfig(process.cwd(), true);

const tool = (name: string) => ({
  type: "function",
  function: {
    name,
    description: "Return the connection test result.",
    parameters: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
  },
});

async function main() {
  const config = await readAiConfig();
  console.log(`Testing ${config.model} via ${config.url}`);
  const result = await requestOpenAiCompatibleTool({
    systemPrompt: "You are testing an API connection. Use the requested tool with ok=true.",
    userPrompt: "Call check_connection with ok=true.",
    toolSchema: tool("check_connection"),
    toolName: "check_connection",
  });
  if ((result as { ok?: boolean }).ok !== true) throw new Error("Single tool check failed.");
  console.log("PASS: decoded credentials and forced function calling.");

  let localCalls = 0;
  let finalValidations = 0;
  const loopResult = await requestOpenAiCompatibleToolLoop({
    systemPrompt: "Call local_check with ok=true first. After its result is available, call finish_check with ok=true.",
    userPrompt: "Run the connection test in two turns.",
    tools: [tool("local_check"), tool("finish_check")],
    finalToolName: "finish_check",
    resolveToolTurn: () => localCalls === 0
      ? { tools: [tool("local_check")], toolChoice: { type: "function", function: { name: "local_check" } } }
      : { tools: [tool("finish_check")], toolChoice: { type: "function", function: { name: "finish_check" } } },
    localTools: [{ name: "local_check", execute: args => {
      if ((args as { ok?: boolean }).ok !== true) throw new Error("Local tool check failed.");
      localCalls++;
      return { valid: true, ok: true };
    } }],
    validateFinalResult: args => {
      finalValidations++;
      return { valid: localCalls === 1 && (args as { ok?: boolean }).ok === true };
    },
    maxIterations: 3,
    requestTimeoutMs: 30_000,
    maxRequestAttempts: 1,
  });
  if (localCalls !== 1 || finalValidations !== 1 || (loopResult as { ok?: boolean }).ok !== true) {
    throw new Error("Multi-turn tool check failed.");
  }
  console.log("PASS: multi-turn local tool execution and final validation.");
}

main().catch(async error => {
  const key = (await readAiConfig().catch(() => undefined))?.apiKey;
  const message = error instanceof Error ? error.message : "Connection test failed.";
  console.error(key ? message.replaceAll(key, "[REDACTED]") : message);
  process.exitCode = 1;
});
