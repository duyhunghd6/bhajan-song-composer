import fs from "fs/promises";
import path from "path";

export interface AiConfig {
  url: string;
  apiKey: string;
  model: string;
}

interface ToolCallResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        function?: { name?: string; arguments?: unknown };
      }>;
    };
  }>;
}

export async function readAiConfig(): Promise<AiConfig> {
  const envConfig = {
    url: process.env.AI_API_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
  };

  if (envConfig.url && envConfig.apiKey && envConfig.model) {
    return envConfig as AiConfig;
  }

  const configPath = path.join(process.cwd(), "ai-config.json");
  const rawConfig = await fs.readFile(configPath, "utf-8");
  const encoded = JSON.parse(rawConfig).encoded;
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const fileConfig = JSON.parse(decoded) as AiConfig;

  return {
    url: envConfig.url ?? fileConfig.url,
    apiKey: envConfig.apiKey ?? fileConfig.apiKey,
    model: envConfig.model ?? fileConfig.model,
  };
}

export function parseToolArguments(data: unknown, toolName: string): unknown {
  const response = data as ToolCallResponse;
  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function?.name !== toolName) {
    throw new Error(`LLM did not return the expected ${toolName} tool call`);
  }

  const args = toolCall.function.arguments;
  if (typeof args === "string") return JSON.parse(args);
  if (args && typeof args === "object") return args;
  throw new Error(`LLM returned empty ${toolName} tool arguments`);
}

export async function requestOpenAiCompatibleTool(input: {
  systemPrompt: string;
  userPrompt: string;
  toolSchema: unknown;
  toolName: string;
  temperature?: number;
}): Promise<unknown> {
  const config = await readAiConfig();

  const res = await fetch(`${config.url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      tools: [input.toolSchema],
      tool_choice: {
        type: "function",
        function: { name: input.toolName },
      },
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("LLM API Error:", err);
    throw new Error(`LLM API returned status: ${res.status}`);
  }

  return parseToolArguments(await res.json(), input.toolName);
}
