import fs from "fs/promises";
import path from "path";

import type { FingerstyleDiagnosticPersistence } from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";

const FINGERSTYLE_DIAGNOSTICS_DIR = ".fingerstyle-diagnostics";
const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(api[-_]?key|authorization|cookie|password|secret|token)/i;

export interface FingerstyleStoredDiagnosticRecord {
  type: "run-input" | "llm-event" | "workflow-event" | "dp-event" | "run-complete";
  timestamp: string;
  runId: string;
  payload: unknown;
}

export function redactFingerstyleDiagnosticValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactFingerstyleDiagnosticValue(item, seen));
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : redactFingerstyleDiagnosticValue(child, seen);
  }
  return result;
}

function safeSegment(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return sanitized || fallback;
}

export async function persistFingerstyleDiagnosticRecords(input: {
  songSlug: string;
  lineIndex: number;
  runId: string;
  records: FingerstyleStoredDiagnosticRecord[];
}): Promise<FingerstyleDiagnosticPersistence> {
  const safeSlug = safeSegment(input.songSlug, "unknown-song");
  const safeRunId = safeSegment(input.runId, "run");
  const lineNumber = Math.max(1, Math.trunc(input.lineIndex) + 1);
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${date}-${safeRunId}.jsonl`;
  const relativePath = path.posix.join(
    FINGERSTYLE_DIAGNOSTICS_DIR,
    safeSlug,
    `line-${lineNumber}`,
    fileName,
  );
  const absolutePath = path.join(
    process.cwd(),
    FINGERSTYLE_DIAGNOSTICS_DIR,
    safeSlug,
    `line-${lineNumber}`,
    fileName,
  );

  try {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const jsonl = input.records
      .map((record) => JSON.stringify(redactFingerstyleDiagnosticValue(record)))
      .join("\n");
    await fs.writeFile(absolutePath, `${jsonl}\n`, { encoding: "utf-8", flag: "wx" });
    return { persisted: true, logPath: relativePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to persist fingerstyle diagnostics:", message);
    return { persisted: false, logPath: relativePath, error: message };
  }
}
