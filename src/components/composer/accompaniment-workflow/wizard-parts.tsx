import { Button } from "@/components/ui/Button";
import { useState } from "react";

import {
  emptyStepState,
  type AccompanimentWorkflowLlmLogEntry,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowScope,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";

export const SCOPE_CLASS: Record<AccompanimentWorkflowScope, string> = {
  shared: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
  guitar: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
};

function llmLogStatusClass(status: AccompanimentWorkflowLlmLogEntry["status"]): string {
  switch (status) {
    case "started":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300";
  }
}

function llmPayloadPreviewLabel(kind: AccompanimentWorkflowLlmLogEntry["kind"]): string {
  switch (kind) {
    case "tool-call":
      return "Tool payload";
    case "tool-result":
      return "Tool result";
    case "final-validation":
      return "Validation result";
    default:
      return "Payload preview";
  }
}

function formatPayloadPreview(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function formatElapsedMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function LlmCallLogPanel({ logs }: { logs: AccompanimentWorkflowLlmLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const recentLogs = [...logs]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-20)
    .reverse();
  const visibleLogs = expanded ? recentLogs : recentLogs.slice(0, 2);

  const totalElapsedMs = logs.reduce((sum, log) => sum + (log.elapsedMs ?? 0), 0);
  const llmCallCount = logs.filter((log) => log.kind === "chat-response" || log.kind === "chat-error").length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">LLM Call Log</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{logs.length} event{logs.length === 1 ? "" : "s"}</span>
          {llmCallCount > 0 && (
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              · {llmCallCount} LLM call{llmCallCount === 1 ? "" : "s"}
              {totalElapsedMs > 0 && ` · ${formatElapsedMs(totalElapsedMs)} total`}
            </span>
          )}
          {recentLogs.length > 2 && (
            <Button variant="ghost" size="sm"
              type="button"
              onClick={() => setExpanded((current) => !current)}

            >
              {expanded ? "Collapse" : "Expand to 20"}
            </Button>
          )}
        </div>
      </div>
      {recentLogs.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          No LLM calls have been recorded for this step yet. Generation start, success, validation, and failure events will appear here.
        </p>
      ) : (
        <ol className={`mt-3 space-y-2 overflow-y-auto pr-1 ${expanded ? "max-h-96" : "max-h-28"}`}>
          {visibleLogs.map((log) => (
            <li key={log.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-[11px] leading-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${llmLogStatusClass(log.status)}`}>{log.status}</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{log.kind}</span>
                {typeof log.iteration === "number" && <span className="text-zinc-500 dark:text-zinc-400">iteration {log.iteration + 1}</span>}
                {log.elapsedMs !== undefined && (
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    log.elapsedMs > 60000
                      ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-400"
                      : log.elapsedMs > 30000
                        ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}>
                    {formatElapsedMs(log.elapsedMs)}
                  </span>
                )}
                {log.requestAttempts !== undefined && log.requestAttempts > 1 && (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
                    {log.requestAttempts} attempts
                  </span>
                )}
                <span className="text-zinc-400 dark:text-zinc-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{log.message}</p>
              {log.validationMessage && <p className="mt-1 text-amber-700 dark:text-amber-300">Validation: {log.validationMessage}</p>}
              {log.toolCallNames?.length ? <p className="mt-1 text-zinc-500 dark:text-zinc-400">Tools: {log.toolCallNames.join(", ")}</p> : null}
              {log.payloadPreview !== undefined && (
                <details className="mt-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {llmPayloadPreviewLabel(log.kind)}
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-zinc-600 dark:text-zinc-300">
                    {formatPayloadPreview(log.payloadPreview)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function RunOptionList({
  workflow,
  stepId,
  onSelect,
}: {
  workflow: AccompanimentWorkflowSession;
  stepId: AccompanimentWorkflowStepId;
  onSelect: (option: AccompanimentWorkflowOption, runId: string) => void;
}) {
  const stepState = workflow.steps[stepId] ?? emptyStepState();
  const runs = [...stepState.runs].slice(-1);

  if (runs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No results stored for this step yet. Generate options to begin this human review point.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <div key={run.id} className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <span>Run stored {new Date(run.createdAt).toLocaleString()}</span>
            {run.userNote && <span>User note: {run.userNote}</span>}
          </div>
          <div className="grid gap-2">
            {run.options.map((option) => {
              const isSelected = stepState.activeRunId === run.id && stepState.selectedOptionId === option.id;
              return (
                <Button variant="choice" size="md" aria-pressed={isSelected}
                  key={`${run.id}-${option.id}`}
                  type="button"
                  onClick={() => onSelect(option, run.id)}

                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{option.label}</h4>
                    {isSelected && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Selected</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{option.summary}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300"><strong>Why:</strong> {option.justification}</p>
                  {option.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                      {option.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  )}
                  {option.validationNotes.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
                      {option.validationNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  )}
                </Button>
              );
            })}
          </div>
          {run.diagnostics && (
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2 text-[11px] leading-4 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300">
              <p className="font-bold">Validation diagnostics</p>
              <p>Attempts: {run.diagnostics.validationAttempts}/{run.diagnostics.maxValidationAttempts}</p>
              <p>Log: {run.diagnostics.logPath}</p>
              <p>Tools: {run.diagnostics.exposedTools.join(", ")}</p>
              {run.diagnostics.llmLogs?.length ? <p>LLM log events: {run.diagnostics.llmLogs.length}</p> : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

