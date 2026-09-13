import type { ComposerProjectSaveRequest } from "@/app/actions/composer-project";

const OUTBOX_KEY = "bhajan-composer-project-outbox:v1";

export interface ComposerProjectOutboxEntry {
  id: string;
  kind: "autosave" | "checkpoint";
  request: ComposerProjectSaveRequest & { checkpointName?: string };
}

function read(storage: Storage): ComposerProjectOutboxEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as ComposerProjectOutboxEntry[] : [];
  } catch {
    return [];
  }
}

function write(storage: Storage, entries: ComposerProjectOutboxEntry[]): boolean {
  try {
    storage.setItem(OUTBOX_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

/** Latest autosave wins; checkpoints remain distinct user-named decisions. */
export function enqueueComposerProjectOutbox(
  storage: Storage,
  entry: ComposerProjectOutboxEntry,
): boolean {
  const entries = read(storage).filter((current) => (
    current.kind !== "autosave" || entry.kind !== "autosave" || current.request.projectId !== entry.request.projectId
  ));
  return write(storage, [...entries, entry]);
}

export function composerProjectOutboxEntries(storage: Storage): ComposerProjectOutboxEntry[] {
  return read(storage);
}

export function removeComposerProjectOutboxEntry(storage: Storage, id: string): boolean {
  return write(storage, read(storage).filter((entry) => entry.id !== id));
}
