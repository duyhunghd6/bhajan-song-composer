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
  maxInvalidResults?: number;
}

export interface ToolLoopContextBudget {
  maxPromptBytes?: number;
  maxToolSchemaBytes?: number;
  maxMessages?: number;
  maxTranscriptBytes?: number;
  maxToolCallsPerTurn?: number;
  maxToolResultBytes?: number;
}

export const FINGERSTYLE_TOOL_LOOP_CONTEXT_BUDGET: Required<ToolLoopContextBudget> = {
  maxPromptBytes: 96_000,
  maxToolSchemaBytes: 48_000,
  maxMessages: 80,
  maxTranscriptBytes: 220_000,
  maxToolCallsPerTurn: 6,
  maxToolResultBytes: 28_000,
};

export interface ToolLoopValidationResult {
  valid: boolean;
  message?: string;
  toolResult?: unknown;
}

export interface ToolLoopTurn {
  tools: unknown[];
  toolChoice?: unknown;
  maxToolCallsPerTurn?: number;
}

export type ToolDiagnosticEvent =
  | { type: "chat-request"; iteration?: number; messageCount: number; toolChoice: unknown; toolNames: string[]; requestTimeoutMs?: number; maxRequestAttempts?: number }
  | { type: "chat-response"; iteration?: number; toolCallNames: string[]; elapsedMs?: number; requestAttempts?: number }
  | { type: "chat-error"; iteration?: number; status?: number; message: string; elapsedMs?: number; requestAttempts?: number }
  | { type: "tool-call"; iteration: number; toolName: string; toolCallId: string; local: boolean; final: boolean; input?: unknown }
  | { type: "tool-result"; iteration: number; toolName: string; toolCallId: string; result: unknown; invalidResultAttempts?: number; maxInvalidResults?: number }
  | { type: "final-validation"; iteration: number; toolName: string; valid: boolean; failedValidationAttempts: number; maxValidationAttempts: number; message?: string; toolResult?: unknown }
  | { type: "loop-exhausted"; maxIterations: number; failedValidationAttempts: number; maxValidationAttempts: number; lastValidationMessage: string; reason?: "iteration-limit" | "final-validation-limit" | "local-validation-limit" | "deadline"; localInvalidResultAttempts?: Record<string, number> }
  | { type: "context-budget-exceeded"; iteration: number; message: string };

export type ToolDiagnosticRecorder = (event: ToolDiagnosticEvent) => void | Promise<void>;

async function emitDiagnostic(onDiagnostic: ToolDiagnosticRecorder | undefined, event: ToolDiagnosticEvent): Promise<void> {
  if (!onDiagnostic) return;
  try {
    await onDiagnostic(event);
  } catch (error) {
    console.error("AI diagnostic recorder failed:", error);
  }
}

function serializeToolResultContent(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result);
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function withinContextBudget(
  messages: ChatMessage[],
  tools: unknown[],
  budget: Required<ToolLoopContextBudget>,
): string | null {
  const promptBytes = utf8Bytes(messages.slice(0, 2).map(message => message.content ?? "").join("\n"));
  if (promptBytes > budget.maxPromptBytes) return `prompt is ${promptBytes} bytes; limit is ${budget.maxPromptBytes}.`;
  const toolSchemaBytes = utf8Bytes(JSON.stringify(tools));
  if (toolSchemaBytes > budget.maxToolSchemaBytes) return `tool schema is ${toolSchemaBytes} bytes; limit is ${budget.maxToolSchemaBytes}.`;
  if (messages.length > budget.maxMessages) return `transcript has ${messages.length} messages; limit is ${budget.maxMessages}.`;
  const transcriptBytes = utf8Bytes(JSON.stringify(messages));
  if (transcriptBytes > budget.maxTranscriptBytes) return `transcript is ${transcriptBytes} bytes; limit is ${budget.maxTranscriptBytes}.`;
  return null;
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
  requestTimeoutMs?: number;
  maxRequestAttempts?: number;
  deadlineAtMs?: number;
}): Promise<ToolCallMessage> {
  const config = await readAiConfig();
  const startedAtMs = Date.now();
  const requestTimeoutMs = input.requestTimeoutMs ?? 90_000;
  const maxRequestAttempts = input.maxRequestAttempts ?? 2;
  await emitDiagnostic(input.onDiagnostic, {
    type: "chat-request",
    iteration: input.iteration,
    messageCount: input.messages.length,
    toolChoice: input.toolChoice,
    toolNames: input.tools.map((tool) => (tool as { function?: { name?: string } }).function?.name).filter((name): name is string => Boolean(name)),
    requestTimeoutMs,
    maxRequestAttempts,
  });

  let res: Response | undefined;
  let lastError: Error | undefined;
  let requestAttempts = 0;

  for (let attempt = 1; attempt <= maxRequestAttempts; attempt++) {
    requestAttempts = attempt;
    res = undefined;
    const remainingMs = input.deadlineAtMs === undefined ? requestTimeoutMs : input.deadlineAtMs - Date.now();
    if (remainingMs <= 0) {
      lastError = new Error("LLM tool loop deadline exceeded before the next request.");
      break;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(requestTimeoutMs, remainingMs));
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
        signal: controller.signal,
      });
      if (res.ok || ![408, 409, 429].includes(res.status) && res.status < 500) break;
      lastError = new Error(`LLM API returned retryable status ${res.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < maxRequestAttempts) {
      const backoffMs = Math.min(1000 * attempt, Math.max(0, (input.deadlineAtMs ?? Infinity) - Date.now()));
      if (backoffMs > 0) await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  if (!res) {
    const message = lastError?.name === "AbortError"
      ? `LLM request timed out after ${requestTimeoutMs}ms.`
      : lastError?.message ?? "LLM request failed after retries";
    await emitDiagnostic(input.onDiagnostic, {
      type: "chat-error",
      iteration: input.iteration,
      message,
      elapsedMs: Date.now() - startedAtMs,
      requestAttempts,
    });
    throw new Error(message);
  }

  if (!res.ok) {
    const err = await res.text();
    await emitDiagnostic(input.onDiagnostic, {
      type: "chat-error",
      iteration: input.iteration,
      status: res.status,
      message: err,
      elapsedMs: Date.now() - startedAtMs,
      requestAttempts,
    });
    throw new Error(`LLM API returned status: ${res.status}`);
  }

  const data = await res.json() as ToolCallResponse;
  const message = data.choices?.[0]?.message;
  if (!message) {
    await emitDiagnostic(input.onDiagnostic, {
      type: "chat-error",
      iteration: input.iteration,
      message: "LLM returned no chat message",
      elapsedMs: Date.now() - startedAtMs,
      requestAttempts,
    });
    throw new Error("LLM returned no chat message");
  }
  await emitDiagnostic(input.onDiagnostic, {
    type: "chat-response",
    iteration: input.iteration,
    toolCallNames: (message.tool_calls ?? []).map((toolCall) => toolCall.function?.name).filter((name): name is string => Boolean(name)),
    elapsedMs: Date.now() - startedAtMs,
    requestAttempts,
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
  shouldComplete?: () => boolean;
  temperature?: number;
  maxIterations?: number;
  maxValidationAttempts?: number;
  requestTimeoutMs?: number;
  maxRequestAttempts?: number;
  maxDurationMs?: number;
  contextBudget?: ToolLoopContextBudget;
  /** Resolves phase-scoped tools immediately before each model request. */
  resolveToolTurn?: () => ToolLoopTurn;
  onDiagnostic?: ToolDiagnosticRecorder;
}): Promise<unknown> {
  const messages: ChatMessage[] = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt },
  ];
  const localTools = new Map(input.localTools.map((tool) => [tool.name, tool]));
  const maxIterations = input.maxIterations ?? 8;
  const maxValidationAttempts = input.maxValidationAttempts ?? maxIterations;
  const contextBudget: Required<ToolLoopContextBudget> = {
    ...FINGERSTYLE_TOOL_LOOP_CONTEXT_BUDGET,
    ...input.contextBudget,
  };
  let failedValidationAttempts = 0;
  let lastValidationMessage = "The LLM did not call a validation tool before the loop ended.";
  const localInvalidResultAttempts: Record<string, number> = {};
  const deadlineAtMs = input.maxDurationMs === undefined ? undefined : Date.now() + input.maxDurationMs;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (deadlineAtMs !== undefined && Date.now() >= deadlineAtMs) {
      await emitDiagnostic(input.onDiagnostic, {
        type: "loop-exhausted",
        maxIterations,
        failedValidationAttempts,
        maxValidationAttempts,
        lastValidationMessage,
        reason: "deadline",
        localInvalidResultAttempts,
      });
      throw new Error(`LLM tool loop exceeded its ${input.maxDurationMs}ms deadline. Last validation: ${lastValidationMessage}`);
    }
    const toolTurn = input.resolveToolTurn?.() ?? { tools: input.tools, toolChoice: "required" };
    const activeToolNames = new Set(toolTurn.tools.flatMap(tool => {
      const name = (tool as { function?: { name?: unknown } })?.function?.name;
      return typeof name === "string" ? [name] : [];
    }));
    const maxToolCallsPerTurn = toolTurn.maxToolCallsPerTurn ?? contextBudget.maxToolCallsPerTurn;
    const budgetError = withinContextBudget(messages, toolTurn.tools, contextBudget);
    if (budgetError) {
      await emitDiagnostic(input.onDiagnostic, {
        type: "context-budget-exceeded",
        iteration,
        message: budgetError,
      });
      throw new Error(`LLM context budget exceeded: ${budgetError}`);
    }
    const message = await requestChatCompletion({
      messages,
      tools: toolTurn.tools,
      toolChoice: toolTurn.toolChoice ?? "required",
      temperature: input.temperature,
      iteration,
      onDiagnostic: input.onDiagnostic,
      requestTimeoutMs: input.requestTimeoutMs,
      maxRequestAttempts: input.maxRequestAttempts,
      deadlineAtMs,
    });
    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length > maxToolCallsPerTurn) {
      const message = `LLM returned ${toolCalls.length} tool calls; limit is ${maxToolCallsPerTurn}.`;
      await emitDiagnostic(input.onDiagnostic, { type: "context-budget-exceeded", iteration, message });
      throw new Error(`LLM context budget exceeded: ${message}`);
    }
    const nonExposedTool = toolCalls.find(call => !activeToolNames.has(call.function?.name ?? ""));
    if (nonExposedTool) {
      const toolName = nonExposedTool.function?.name ?? "unknown";
      const message = `LLM called ${toolName}, which is not exposed in the current workflow phase.`;
      await emitDiagnostic(input.onDiagnostic, { type: "chat-error", iteration, message });
      throw new Error(message);
    }

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
          await emitDiagnostic(input.onDiagnostic, {
            type: "loop-exhausted",
            maxIterations,
            failedValidationAttempts,
            maxValidationAttempts,
            lastValidationMessage,
            reason: "final-validation-limit",
            localInvalidResultAttempts,
          });
          throw new Error(`LLM did not produce validated ${input.finalToolName} output after ${maxValidationAttempts} validation attempt${maxValidationAttempts === 1 ? "" : "s"}. Last validation: ${lastValidationMessage}`);
        }
        // The loop stops only after the final tool payload passes local validation.
        // A model claim like "this is valid" is not authoritative; the local
        // validator must approve the concrete guitar tab events first.
        toolResults.push({
          role: "tool",
          tool_call_id: toolCallId,
          name: toolName,
          content: serializeToolResultContent(validation.toolResult ?? { valid: false, message: lastValidationMessage }),
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
      const invalidResult = typeof result === "object" && result && "valid" in result
        && (result as { valid?: boolean }).valid === false;
      if (invalidResult) {
        localInvalidResultAttempts[toolName] = (localInvalidResultAttempts[toolName] ?? 0) + 1;
        lastValidationMessage = JSON.stringify(result);
      }
      await emitDiagnostic(input.onDiagnostic, {
        type: "tool-result",
        iteration,
        toolName,
        toolCallId,
        result,
        invalidResultAttempts: localInvalidResultAttempts[toolName] ?? 0,
        maxInvalidResults: localTool.maxInvalidResults,
      });
      if (!invalidResult && input.shouldComplete?.()) return {};
      if (invalidResult && localTool.maxInvalidResults !== undefined
        && localInvalidResultAttempts[toolName] >= localTool.maxInvalidResults) {
        await emitDiagnostic(input.onDiagnostic, {
          type: "loop-exhausted",
          maxIterations,
          failedValidationAttempts,
          maxValidationAttempts,
          lastValidationMessage,
          reason: "local-validation-limit",
          localInvalidResultAttempts,
        });
        throw new Error(`LLM produced ${localInvalidResultAttempts[toolName]} invalid ${toolName} result(s). Last validation: ${lastValidationMessage}`);
      }
      toolResults.push({
        role: "tool",
        tool_call_id: toolCallId,
        name: toolName,
        content: serializeToolResultContent(result),
      });
    }

    const oversizedResult = toolResults.find(result => utf8Bytes(result.content ?? "") > contextBudget.maxToolResultBytes);
    if (oversizedResult) {
      const message = `Tool result is ${utf8Bytes(oversizedResult.content ?? "")} bytes; limit is ${contextBudget.maxToolResultBytes}.`;
      await emitDiagnostic(input.onDiagnostic, { type: "context-budget-exceeded", iteration, message });
      throw new Error(`LLM context budget exceeded: ${message}`);
    }
    messages.push(...toolResults);
  }

  await emitDiagnostic(input.onDiagnostic, {
    type: "loop-exhausted",
    maxIterations,
    failedValidationAttempts,
    maxValidationAttempts,
    lastValidationMessage,
    reason: "iteration-limit",
    localInvalidResultAttempts,
  });
  throw new Error(`LLM did not produce validated ${input.finalToolName} output after ${maxIterations} loop iteration${maxIterations === 1 ? "" : "s"}. Failed final validation attempts: ${failedValidationAttempts}/${maxValidationAttempts}. Last validation: ${lastValidationMessage}`);
}
