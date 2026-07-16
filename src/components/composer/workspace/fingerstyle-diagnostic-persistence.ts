import {
  FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION,
  type FingerstyleGenerationDiagnosticEvent,
  type FingerstyleGenerationDiagnosticRun,
} from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";

const PERSISTENCE_VERSION = 1 as const;
const MAX_RUNS_PER_LINE = 5;
const MAX_RUNS_PER_SONG = 20;
const MAX_EVENTS_PER_RUN = 300;
const MAX_PLAINTEXT_CHARS = 200_000;
const MAX_STORAGE_BYTES = 1_000_000;

interface PersistedFingerstyleDiagnostics {
  version: typeof PERSISTENCE_VERSION;
  sourceFingerprint: string;
  runs: FingerstyleGenerationDiagnosticRun[];
}

const REQUIRED_EVENT_KINDS = new Set([
  "configuration",
  "input-extraction",
  "input-anomaly",
  "candidate-generation",
  "fallback-noop",
  "backtrack-step",
  "pass-summary",
  "writeback",
  "validation",
  "rollback",
  "run-summary",
  "final-validation",
  "abc-ascii-guitartab-validated",
  "abc-ascii-guitartab-rejected",
  "fill-reservations-accepted",
  "fill-reservations-reconciled",
  "bass-positions-accepted",
  "bass-source-abc-annotated",
  "bass-pitches-accepted",
  "timegrid-materialized",
  "chat-error",
  "loop-exhausted",
]);

function stripSensitiveClientPayload(
  event: FingerstyleGenerationDiagnosticEvent,
): FingerstyleGenerationDiagnosticEvent {
  if (event.source === "llm") {
    const { payloadPreview, ...safeEvent } = event;
    void payloadPreview;
    return safeEvent;
  }
  return event;
}

function compactRun(run: FingerstyleGenerationDiagnosticRun): FingerstyleGenerationDiagnosticRun {
  const events = run.events.map(stripSensitiveClientPayload);
  const plaintext = run.plaintext.length > MAX_PLAINTEXT_CHARS
    ? `${run.plaintext.slice(0, MAX_PLAINTEXT_CHARS)}\n\n[client persistence truncated plaintext]`
    : run.plaintext;
  const required = events.filter(event => REQUIRED_EVENT_KINDS.has(event.kind));
  const recent = events.slice(-Math.max(0, MAX_EVENTS_PER_RUN - required.length));
  const compactEvents = [...new Map(
    [...required, ...recent].map(event => [event.id, event]),
  ).values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-MAX_EVENTS_PER_RUN);
  return { ...run, events: compactEvents, plaintext };
}

function parseEnvelope(
  saved: string | null,
  sourceFingerprint: string,
): PersistedFingerstyleDiagnostics {
  if (!saved) {
    return { version: PERSISTENCE_VERSION, sourceFingerprint, runs: [] };
  }
  try {
    const parsed = JSON.parse(saved) as Partial<PersistedFingerstyleDiagnostics>;
    if (
      parsed.version !== PERSISTENCE_VERSION
      || parsed.sourceFingerprint !== sourceFingerprint
      || !Array.isArray(parsed.runs)
    ) {
      return { version: PERSISTENCE_VERSION, sourceFingerprint, runs: [] };
    }
    return {
      version: PERSISTENCE_VERSION,
      sourceFingerprint,
      runs: parsed.runs.filter(run => (
        run
        && run.version === FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION
        && typeof run.runId === "string"
      )),
    };
  } catch {
    return { version: PERSISTENCE_VERSION, sourceFingerprint, runs: [] };
  }
}

function enforceRunLimits(
  runs: FingerstyleGenerationDiagnosticRun[],
): FingerstyleGenerationDiagnosticRun[] {
  const sorted = [...runs].sort((left, right) => (
    new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime()
  ));
  const perLine = new Map<number, FingerstyleGenerationDiagnosticRun[]>();
  for (const run of sorted) {
    const lineIndex = run.scope.lineIndex ?? -1;
    const lineRuns = perLine.get(lineIndex) ?? [];
    lineRuns.push(run);
    perLine.set(lineIndex, lineRuns.slice(-MAX_RUNS_PER_LINE));
  }
  return [...perLine.values()]
    .flat()
    .sort((left, right) => (
      new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime()
    ))
    .slice(-MAX_RUNS_PER_SONG);
}

function fitStorageBudget(
  envelope: PersistedFingerstyleDiagnostics,
): PersistedFingerstyleDiagnostics {
  const runs = [...envelope.runs];
  while (runs.length > 1 && JSON.stringify({ ...envelope, runs }).length > MAX_STORAGE_BYTES) {
    runs.shift();
  }
  if (JSON.stringify({ ...envelope, runs }).length <= MAX_STORAGE_BYTES) {
    return { ...envelope, runs };
  }
  const newest = runs.at(-1);
  return {
    ...envelope,
    runs: newest ? [{ ...newest, events: newest.events.filter(event => REQUIRED_EVENT_KINDS.has(event.kind)).slice(-60) }] : [],
  };
}

export function restoreFingerstyleDiagnosticRuns(
  saved: string | null,
  sourceFingerprint: string,
): FingerstyleGenerationDiagnosticRun[] {
  return parseEnvelope(saved, sourceFingerprint).runs;
}

export function persistFingerstyleDiagnosticRun(input: {
  storage: Storage;
  storageKey: string;
  sourceFingerprint: string;
  run: FingerstyleGenerationDiagnosticRun;
}): void {
  let saved: string | null = null;
  try {
    saved = input.storage.getItem(input.storageKey);
  } catch {
    // Browser storage is best-effort and must not fail generation.
  }
  const envelope = parseEnvelope(saved, input.sourceFingerprint);
  const runs = enforceRunLimits([
    ...envelope.runs.filter(run => run.runId !== input.run.runId),
    compactRun(input.run),
  ]);
  const bounded = fitStorageBudget({ ...envelope, runs });
  try {
    input.storage.setItem(input.storageKey, JSON.stringify(bounded));
    return;
  } catch {
    // Retry once with only the newest run and required diagnostic events.
  }
  const newest = bounded.runs.at(-1);
  const summaryOnly = {
    ...bounded,
    runs: newest ? [{
      ...newest,
      events: newest.events
        .filter(event => REQUIRED_EVENT_KINDS.has(event.kind))
        .slice(-30),
    }] : [],
  };
  try {
    input.storage.setItem(input.storageKey, JSON.stringify(summaryOnly));
  } catch {
    // Diagnostics are still available in memory and in server JSONL.
  }
}
