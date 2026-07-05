import fs from "fs/promises";
import path from "path";

export interface AiConfig {
  url: string;
  apiKey: string;
  model: string;
}

interface ToolCall {
  id?: string;
  function?: { name?: string; arguments?: unknown };
}

interface ToolCallMessage {
  role?: string;
  content?: string | null;
  tool_calls?: ToolCall[];
}

interface ToolCallResponse {
  choices?: Array<{
    message?: ToolCallMessage;
  }>;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface LocalToolDefinition {
  name: string;
  execute: (args: unknown) => unknown | Promise<unknown>;
}

export interface ToolLoopValidationResult {
  valid: boolean;
  message?: string;
  toolResult?: unknown;
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

function parseToolCallArguments(toolCall: ToolCall, toolName: string): unknown {
  if (toolCall.function?.name !== toolName) {
    throw new Error(`LLM did not return the expected ${toolName} tool call`);
  }

  const args = toolCall.function.arguments;
  if (typeof args === "string") return JSON.parse(args);
  if (args && typeof args === "object") return args;
  throw new Error(`LLM returned empty ${toolName} tool arguments`);
}

export function parseToolArguments(data: unknown, toolName: string): unknown {
  const response = data as ToolCallResponse;
  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall) {
    throw new Error(`LLM did not return the expected ${toolName} tool call`);
  }

  return parseToolCallArguments(toolCall, toolName);
}

async function requestChatCompletion(input: {
  messages: ChatMessage[];
  tools: unknown[];
  toolChoice: unknown;
  temperature?: number;
}): Promise<ToolCallMessage> {
  const config = await readAiConfig();

  const res = await fetch(`${config.url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice,
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("LLM API Error:", err);
    throw new Error(`LLM API returned status: ${res.status}`);
  }

  const data = await res.json() as ToolCallResponse;
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("LLM returned no chat message");
  return message;
}

export async function requestOpenAiCompatibleTool(input: {
  systemPrompt: string;
  userPrompt: string;
  toolSchema: unknown;
  toolName: string;
  temperature?: number;
}): Promise<unknown> {
  const message = await requestChatCompletion({
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    tools: [input.toolSchema],
    toolChoice: {
      type: "function",
      function: { name: input.toolName },
    },
    temperature: input.temperature,
  });

  const toolCall = message.tool_calls?.[0];
  if (!toolCall) throw new Error(`LLM did not return the expected ${input.toolName} tool call`);
  return parseToolCallArguments(toolCall, input.toolName);
}

export async function requestOpenAiCompatibleToolLoop(input: {
  systemPrompt: string;
  userPrompt: string;
  tools: unknown[];
  finalToolName: string;
  localTools: LocalToolDefinition[];
  validateFinalResult: (args: unknown) => ToolLoopValidationResult;
  temperature?: number;
  maxIterations?: number;
}): Promise<unknown> {
  const messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt },
  ];
  const localTools = new Map(input.localTools.map((tool) => [tool.name, tool]));
  const maxIterations = input.maxIterations ?? 8;
  let lastValidationMessage = "The LLM did not call a validation tool before the loop ended.";

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const message = await requestChatCompletion({
      messages,
      tools: input.tools,
      toolChoice: "auto",
      temperature: input.temperature,
    });
    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      throw new Error(`LLM did not call ${input.finalToolName} or a local validation tool`);
    }

    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: toolCalls,
    });

    const toolResults: ChatMessage[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name;
      const toolCallId = toolCall.id ?? `${toolName ?? "tool"}-${iteration}`;

      if (!toolName) {
        toolResults.push({
          role: "tool",
          tool_call_id: toolCallId,
          content: JSON.stringify({ valid: false, issues: [{ message: "Tool call was missing a function name." }] }),
        });
        continue;
      }

      if (toolName === input.finalToolName) {
        const args = parseToolCallArguments(toolCall, input.finalToolName);
        const validation = input.validateFinalResult(args);
        if (validation.valid) return args;

        lastValidationMessage = validation.message ?? "Final tool result did not pass local validation.";
        // The loop stops only after the final tool payload passes local validation.
        // A model claim like "this is valid" is not authoritative; the local
        // validator must approve the concrete guitar tab events first.
        toolResults.push({
          role: "tool",
          tool_call_id: toolCallId,
          name: toolName,
          content: JSON.stringify(validation.toolResult ?? { valid: false, message: lastValidationMessage }),
        });
        continue;
      }

      const localTool = localTools.get(toolName);
      if (!localTool) {
        toolResults.push({
          role: "tool",
          tool_call_id: toolCallId,
          name: toolName,
          content: JSON.stringify({ valid: false, issues: [{ message: `Unknown local tool: ${toolName}` }] }),
        });
        continue;
      }

      const args = parseToolCallArguments(toolCall, toolName);
      const result = await localTool.execute(args);
      if (typeof result === "object" && result && "valid" in result && (result as { valid?: boolean }).valid === false) {
        lastValidationMessage = JSON.stringify(result);
      }
      toolResults.push({
        role: "tool",
        tool_call_id: toolCallId,
        name: toolName,
        content: JSON.stringify(result),
      });
    }

    messages.push(...toolResults);
  }

  throw new Error(`LLM did not produce validated ${input.finalToolName} output after ${maxIterations} iterations. Last validation: ${lastValidationMessage}`);
}
