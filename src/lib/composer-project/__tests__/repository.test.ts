import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FileComposerProjectRepository,
  type ComposerProjectPayload,
} from "@/lib/composer-project";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function repository(): Promise<FileComposerProjectRepository> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "composer-project-repository-"));
  directories.push(directory);
  return new FileComposerProjectRepository({ rootDirectory: directory });
}

function payload(version: string): ComposerProjectPayload {
  return {
    song: { slug: "hari-bol", sourceRevisionId: "harmony-r4", sourceFingerprint: "source-a" },
    steps: {
      harmony: {
        input: { abc: "X:1\nK:Am" },
        runs: [{
          id: `run-${version}`,
          input: { temperature: 0 },
          rawOutput: { candidates: ["Am", "F"] },
          normalizedOutput: { selected: "Am" },
          diagnostics: { warnings: [] },
          selectedOptionId: "candidate-am",
        }],
        selectedOptionId: "candidate-am",
      },
    },
    decisions: { voicingOverrideId: `override-${version}` },
    artifacts: [{ id: `abc-${version}`, kind: "abc", contentType: "text/vnd.abc", uri: `inline:abc-${version}` }],
  };
}

describe("FileComposerProjectRepository", () => {
  it("durably reloads append-only autosaves, checkpoints, raw runs and unselected options", async () => {
    const store = await repository();
    await store.create({ id: "hari-bol-project", title: "Hari Bol arrangement", payload: payload("initial") });

    const autosave = await store.autosave({
      projectId: "hari-bol-project",
      baseRevision: 0,
      payload: payload("autosave"),
      lineage: { sourceRevisionId: "harmony-r4", runIds: ["run-autosave"] },
    });
    expect(autosave.status).toBe("saved");
    if (autosave.status !== "saved") throw new Error("Expected a saved autosave.");

    const checkpoint = await store.checkpoint({
      projectId: "hari-bol-project",
      baseRevision: autosave.revision.revision,
      checkpointName: "Before high-position Am",
      payload: payload("checkpoint"),
    });
    expect(checkpoint.status).toBe("saved");
    if (checkpoint.status !== "saved") throw new Error("Expected a saved checkpoint.");

    const reloaded = await (await repositoryFromSameDirectory()).get("hari-bol-project");
    expect(reloaded?.headRevision).toBe(2);
    expect(reloaded?.revisions).toHaveLength(3);
    expect(reloaded?.revisions[1].payloadRef.value.steps?.harmony.runs[0]).toMatchObject({
      rawOutput: { candidates: ["Am", "F"] },
      diagnostics: { warnings: [] },
    });
    expect(reloaded?.revisions[2]).toMatchObject({ kind: "checkpoint", checkpointName: "Before high-position Am" });
    expect(reloaded?.revisions[2].payloadRef.sha256).toHaveLength(64);
  });

  it("restores a prior payload by appending a new revision instead of rewinding history", async () => {
    const store = await repository();
    const project = await store.create({ id: "restore-project", title: "Restore", payload: payload("initial") });
    const changed = await store.autosave({ projectId: project.id, baseRevision: 0, payload: payload("changed") });
    if (changed.status !== "saved") throw new Error("Expected changed revision.");

    const restored = await store.restore({
      projectId: project.id,
      baseRevision: changed.revision.revision,
      restoreRevisionId: "revision-0",
      checkpointName: "Back to source",
    });
    expect(restored.status).toBe("saved");
    if (restored.status !== "saved") throw new Error("Expected restored revision.");
    expect(restored.revision).toMatchObject({ kind: "restore", parentRevisionId: "revision-1", checkpointName: "Back to source" });
    expect(restored.revision.payloadRef.value.decisions).toEqual({ voicingOverrideId: "override-initial" });
    expect(restored.project.revisions.map((revision) => revision.id)).toEqual(["revision-0", "revision-1", "revision-2"]);
  });

  it("preserves an offline payload as a conflict branch and never overwrites the newer head", async () => {
    const store = await repository();
    await store.create({ id: "offline-project", title: "Offline", payload: payload("initial") });
    const current = await store.autosave({ projectId: "offline-project", baseRevision: 0, payload: payload("current") });
    expect(current.status).toBe("saved");

    const conflict = await store.autosave({ projectId: "offline-project", baseRevision: 0, payload: payload("offline") });
    expect(conflict.status).toBe("conflict");
    if (conflict.status !== "conflict") throw new Error("Expected an optimistic concurrency conflict.");

    expect(conflict.latestRevision).toMatchObject({ id: "revision-1", kind: "autosave" });
    expect(conflict.conflictRevision).toMatchObject({
      id: "revision-2",
      kind: "conflict",
      parentRevisionId: "revision-0",
      branchOfRevisionId: "revision-0",
    });
    expect(conflict.conflictRevision.payloadRef.value.decisions).toEqual({ voicingOverrideId: "override-offline" });
    expect(conflict.project.headRevision).toBe(1);

    const comparison = await store.compare("offline-project", "revision-1", "revision-2");
    expect(comparison.left.payloadRef.value.decisions).toEqual({ voicingOverrideId: "override-current" });
    expect(comparison.right.payloadRef.value.decisions).toEqual({ voicingOverrideId: "override-offline" });
  });

  it("serializes concurrent saves so one becomes a retained conflict branch", async () => {
    const store = await repository();
    await store.create({ id: "concurrent-project", title: "Concurrent", payload: payload("initial") });

    const results = await Promise.all([
      store.autosave({ projectId: "concurrent-project", baseRevision: 0, payload: payload("first") }),
      store.autosave({ projectId: "concurrent-project", baseRevision: 0, payload: payload("second") }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["conflict", "saved"]);
    const project = await store.get("concurrent-project");
    expect(project?.headRevision).toBe(1);
    expect(project?.revisions).toHaveLength(3);
  });
});

async function repositoryFromSameDirectory(): Promise<FileComposerProjectRepository> {
  // `get` already reads from disk; this extra repository instance proves no
  // in-memory session state is necessary to reopen a Composer Project.
  const directory = directories[directories.length - 1];
  if (!directory) throw new Error("Expected test repository directory.");
  return new FileComposerProjectRepository({ rootDirectory: directory });
}
