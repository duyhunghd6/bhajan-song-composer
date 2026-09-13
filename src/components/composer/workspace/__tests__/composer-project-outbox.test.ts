import { describe, expect, it } from "vitest";

import {
  composerProjectOutboxEntries,
  enqueueComposerProjectOutbox,
  removeComposerProjectOutboxEntry,
} from "../composer-project-outbox";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

const request = {
  projectId: "composer-hari-bol",
  title: "Hari Bol",
  payload: { song: { slug: "hari-bol" } },
};

describe("Composer Project outbox", () => {
  it("keeps only the latest queued autosave but retains an explicit checkpoint", () => {
    const storage = memoryStorage();
    enqueueComposerProjectOutbox(storage, { id: "auto-1", kind: "autosave", request });
    enqueueComposerProjectOutbox(storage, { id: "checkpoint-1", kind: "checkpoint", request: { ...request, checkpointName: "Before chorus" } });
    enqueueComposerProjectOutbox(storage, { id: "auto-2", kind: "autosave", request: { ...request, baseRevision: 2 } });

    expect(composerProjectOutboxEntries(storage).map((entry) => entry.id)).toEqual(["checkpoint-1", "auto-2"]);
    removeComposerProjectOutboxEntry(storage, "auto-2");
    expect(composerProjectOutboxEntries(storage).map((entry) => entry.id)).toEqual(["checkpoint-1"]);
  });
});
