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

export type ToolDiagnosticEvent =
  | { type: "chat-request"; iteration?: number; messageCount: number; toolChoice: unknown; toolNames: string[] }
  | { type: "chat-response"; iteration?: number; toolCallNames: string[] }
  | { type: "chat-error"; iteration?: number; status?: number; message: string }
  | { type: "tool-call"; iteration: number; toolName: string; toolCallId: string; local: boolean; final: boolean; input?: unknown }
  | { type: "tool-result"; iteration: number; toolName: string; toolCallId: string; result: unknown }
  | { type: "final-validation"; iteration: number; toolName: string; valid: boolean; failedValidationAttempts: number; maxValidationAttempts: number; message?: string; toolResult?: unknown }
  | { type: "loop-exhausted"; maxIterations: number; failedValidationAttempts: number; maxValidationAttempts: number; lastValidationMessage: string };

export type ToolDiagnosticRecorder = (event: ToolDiagnosticEvent) => void | Promise<void>;

async function emitDiagnostic(onDiagnostic: ToolDiagnosticRecorder | undefined, event: ToolDiagnosticEvent): Promise<void> {
  if (!onDiagnostic) return;
  try {
    await onDiagnostic(event);
  } catch (error) {
    console.error("AI diagnostic recorder failed:", error);
  }
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
  iteration?: number;
  onDiagnostic?: ToolDiagnosticRecorder;
}): Promise<ToolCallMessage> {
  const config = await readAiConfig();
  await emitDiagnostic(input.onDiagnostic, {
    type: "chat-request",
    iteration: input.iteration,
    messageCount: input.messages.length,
    toolChoice: input.toolChoice,
    toolNames: input.tools.map((tool) => (tool as { function?: { name?: string } }).function?.name).filter((name): name is string => Boolean(name)),
  });

  let res: Response | undefined;
  let lastError: Error | undefined;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      res = await fetch(`${config.url}/chat/completions`, {
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
      break; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const cause = (lastError as any).cause;
      console.warn(`LLM API fetch attempt ${attempt} failed:`, lastError.message, cause ? `(Cause: ${cause})` : "");
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  if (!res) {
    const causeMsg = (lastError as any)?.cause ? ` (Cause: ${(lastError as any).cause.message || (lastError as any).cause})` : "";
    const message = lastError ? `${lastError.message}${causeMsg}` : "LLM request failed after retries";
    console.error("LLM API request failed permanently:", lastError);
    await emitDiagnostic(input.onDiagnostic, { type: "chat-error", iteration: input.iteration, message });
    throw lastError || new Error(message);
  }

  if (!res.ok) {
    const err = await res.text();
    console.error("LLM API Error:", err);
    await emitDiagnostic(input.onDiagnostic, { type: "chat-error", iteration: input.iteration, status: res.status, message: err });
    throw new Error(`LLM API returned status: ${res.status}`);
  }

  const data = await res.json() as ToolCallResponse;
  const message = data.choices?.[0]?.message;
  if (!message) {
    await emitDiagnostic(input.onDiagnostic, { type: "chat-error", iteration: input.iteration, message: "LLM returned no chat message" });
    throw new Error("LLM returned no chat message");
  }
  await emitDiagnostic(input.onDiagnostic, {
    type: "chat-response",
    iteration: input.iteration,
    toolCallNames: (message.tool_calls ?? []).map((toolCall) => toolCall.function?.name).filter((name): name is string => Boolean(name)),
  });
  return message;
}

export async function requestOpenAiCompatibleTool(input: {
  systemPrompt: string;
  userPrompt: string;
  toolSchema: unknown;
  toolName: string;
  temperature?: number;
  onDiagnostic?: ToolDiagnosticRecorder;
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
    onDiagnostic: input.onDiagnostic,
  });

  const toolCall = message.tool_calls?.[0];
  if (!toolCall) {
    await emitDiagnostic(input.onDiagnostic, { type: "chat-error", iteration: 0, message: `LLM did not return the expected ${input.toolName} tool call` });
    throw new Error(`LLM did not return the expected ${input.toolName} tool call`);
  }
  const args = parseToolCallArguments(toolCall, input.toolName);
  await emitDiagnostic(input.onDiagnostic, {
    type: "tool-call",
    iteration: 0,
    toolName: toolCall.function?.name ?? input.toolName,
    toolCallId: toolCall.id ?? `${input.toolName}-0`,
    local: false,
    final: true,
    input: args,
  });
  await emitDiagnostic(input.onDiagnostic, {
    type: "final-validation",
    iteration: 0,
    toolName: input.toolName,
    valid: true,
    failedValidationAttempts: 0,
    maxValidationAttempts: 0,
    toolResult: { acceptedWithoutLocalValidation: true },
  });
  return args;
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
  maxValidationAttempts?: number;
  onDiagnostic?: ToolDiagnosticRecorder;
}): Promise<unknown> {
  const messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt },
  ];
  const localTools = new Map(input.localTools.map((tool) => [tool.name, tool]));
  const maxIterations = input.maxIterations ?? 8;
  const maxValidationAttempts = input.maxValidationAttempts ?? maxIterations;
  let failedValidationAttempts = 0;
  let lastValidationMessage = "The LLM did not call a validation tool before the loop ended.";

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const message = await requestChatCompletion({
      messages,
      tools: input.tools,
      toolChoice: "required",
      temperature: input.temperature,
      iteration,
      onDiagnostic: input.onDiagnostic,
    });
    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      await emitDiagnostic(input.onDiagnostic, { type: "chat-error", iteration, message: `LLM did not call ${input.finalToolName} or a local validation tool` });
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

      const localTool = localTools.get(toolName);
      const parsedInput = toolName === input.finalToolName || localTool
        ? parseToolCallArguments(toolCall, toolName)
        : undefined;

      await emitDiagnostic(input.onDiagnostic, {
        type: "tool-call",
        iteration,
        toolName,
        toolCallId,
        local: Boolean(localTool),
        final: toolName === input.finalToolName,
        input: parsedInput,
      });

      if (toolName === input.finalToolName) {
        const args = parsedInput;
        const validation = input.validateFinalResult(args);
        if (!validation.valid) failedValidationAttempts += 1;
        await emitDiagnostic(input.onDiagnostic, {
          type: "final-validation",
          iteration,
          toolName,
          valid: validation.valid,
          failedValidationAttempts,
          maxValidationAttempts,
          message: validation.message,
          toolResult: validation.toolResult,
        });
        if (validation.valid) return args;

        lastValidationMessage = validation.message ?? "Final tool result did not pass local validation.";
        if (failedValidationAttempts >= maxValidationAttempts) {
          await emitDiagnostic(input.onDiagnostic, { type: "loop-exhausted", maxIterations, failedValidationAttempts, maxValidationAttempts, lastValidationMessage });
          throw new Error(`LLM did not produce validated ${input.finalToolName} output after ${maxValidationAttempts} validation attempt${maxValidationAttempts === 1 ? "" : "s"}. Last validation: ${lastValidationMessage}`);
        }
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

      if (!localTool) {
        toolResults.push({
          role: "tool",
          tool_call_id: toolCallId,
          name: toolName,
          content: JSON.stringify({ valid: false, issues: [{ message: `Unknown local tool: ${toolName}` }] }),
        });
        continue;
      }

      const args = parsedInput;
      const result = await localTool.execute(args);
      await emitDiagnostic(input.onDiagnostic, { type: "tool-result", iteration, toolName, toolCallId, result });
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

  await emitDiagnostic(input.onDiagnostic, { type: "loop-exhausted", maxIterations, failedValidationAttempts, maxValidationAttempts, lastValidationMessage });
  throw new Error(`LLM did not produce validated ${input.finalToolName} output after ${maxIterations} loop iteration${maxIterations === 1 ? "" : "s"}. Failed final validation attempts: ${failedValidationAttempts}/${maxValidationAttempts}. Last validation: ${lastValidationMessage}`);
}
