import type { ToolDiagnosticEvent } from "../ai-config";
import { formatFingerstyleToolDiagnostic } from "../fingerstyle-tool-contract";
import type { FingerstyleLlmDiagnosticEvent } from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";

export function compactDiagnosticPayload(value: unknown, depth = 0): unknown {
  if (depth >= 4) return "[truncated]";
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 8).map(item => compactDiagnosticPayload(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .slice(0, 24)
      .map(([key, child]) => [key, compactDiagnosticPayload(child, depth + 1)]));
  }
  return value;
}

export function boundedToolDiagnostic(value: unknown): string {
  const formatted = formatFingerstyleToolDiagnostic(value);
  return formatted.length > 4_000 ? `${formatted.slice(0, 4_000)}\n…[truncated]` : formatted;
}

function llmDiagnosticMessage(event: ToolDiagnosticEvent): string {
  switch (event.type) {
    case "chat-request": return `Sending ${event.messageCount} message(s) with ${event.toolNames.length} exposed tool(s).`;
    case "chat-response": return event.toolCallNames.length > 0 ? `LLM requested ${event.toolCallNames.join(", ")}.` : "LLM returned without a tool call.";
    case "chat-error": return event.message;
    case "tool-call": return `${event.final ? "Final" : "Local"} tool call: ${event.toolName}.`;
    case "tool-result": return `Tool result received from ${event.toolName}.`;
    case "final-validation": return event.valid ? `Final ${event.toolName} payload passed local validation.` : `Final ${event.toolName} payload failed local validation.`;
    case "loop-exhausted": return `Tool loop exhausted after ${event.maxIterations} iteration(s): ${event.lastValidationMessage}`;
  }
}

export function makeLlmDiagnosticEvent(
  event: ToolDiagnosticEvent,
  runId: string,
  sequence: number,
): FingerstyleLlmDiagnosticEvent {
  const status: FingerstyleLlmDiagnosticEvent["status"] = event.type === "chat-request"
    ? "started"
    : event.type === "chat-error" || event.type === "loop-exhausted"
      ? "failed"
      : event.type === "final-validation" && !event.valid
        ? "warning"
        : event.type === "chat-response" || (event.type === "final-validation" && event.valid)
          ? "success"
          : "info";
  const payloadPreview = event.type === "tool-call"
    ? compactDiagnosticPayload(event.input)
    : event.type === "tool-result"
      ? compactDiagnosticPayload(event.result)
      : event.type === "final-validation"
        ? compactDiagnosticPayload(event.toolResult)
        : event.type === "chat-request"
          ? compactDiagnosticPayload({ toolChoice: event.toolChoice, toolNames: event.toolNames })
          : undefined;
  return {
    id: `${runId}-llm-${sequence}`,
    runId,
    sequence,
    createdAt: new Date().toISOString(),
    source: "llm",
    kind: event.type,
    phase: "llm-tool-loop",
    status,
    message: llmDiagnosticMessage(event),
    iteration: "iteration" in event ? event.iteration : undefined,
    toolName: "toolName" in event ? event.toolName : undefined,
    toolCallNames: event.type === "chat-response" ? event.toolCallNames : undefined,
    validationMessage: event.type === "final-validation" ? event.message : undefined,
    payloadPreview,
  };
}
