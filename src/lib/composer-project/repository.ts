import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Server-owned Composer Project persistence. Browser state can mirror this
 * repository, but cannot be the authority for a recoverable arrangement.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface InlineJsonPayloadRef<T = JsonValue> {
  storage: "inline-json";
  contentType: "application/json";
  sha256: string;
  value: T;
}

export interface ComposerProjectArtifactRef {
  id: string;
  kind: "abc" | "events" | "audio-preview" | "document" | "other";
  contentType: string;
  uri: string;
  sha256?: string;
}

export interface ComposerProjectRun {
  id: string;
  input: JsonValue;
  rawOutput?: JsonValue;
  normalizedOutput?: JsonValue;
  diagnostics?: JsonValue;
  selectedOptionId?: string;
}

export interface ComposerProjectStepState {
  input: JsonValue;
  runs: ComposerProjectRun[];
  selectedOptionId?: string;
}

/**
 * Structured by convention, deliberately extensible so each Composer step can
 * retain its exact input, unselected options, raw response and diagnostics.
 */
export interface ComposerProjectPayload {
  song: {
    slug: string;
    sourceRevisionId?: string;
    sourceFingerprint?: string;
    metadata?: JsonObject;
  };
  steps?: Record<string, ComposerProjectStepState>;
  decisions?: JsonObject;
  artifacts?: ComposerProjectArtifactRef[];
}

export interface ComposerRevisionLineage {
  sourceRevisionId?: string;
  sourceFingerprint?: string;
  generatedFromRevisionIds?: string[];
  runIds?: string[];
  artifactRefs?: ComposerProjectArtifactRef[];
}

export type ComposerProjectRevisionKind = "initial" | "autosave" | "checkpoint" | "restore" | "conflict";

export interface ComposerProjectRevision {
  id: string;
  revision: number;
  kind: ComposerProjectRevisionKind;
  createdAt: string;
  parentRevisionId: string | null;
  /** A stale client save is retained on this branch instead of being discarded. */
  branchOfRevisionId?: string;
  checkpointName?: string;
  payloadRef: InlineJsonPayloadRef<ComposerProjectPayload>;
  lineage: ComposerRevisionLineage;
}

export interface ComposerProject {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Current accepted branch; conflict revisions never silently become head. */
  headRevisionId: string;
  headRevision: number;
  revisions: ComposerProjectRevision[];
}

export interface CreateComposerProjectInput {
  id?: string;
  title: string;
  payload: ComposerProjectPayload;
  lineage?: ComposerRevisionLineage;
}

export interface SaveComposerProjectRevisionInput {
  projectId: string;
  /** The accepted head revision on which the client made its edit. */
  baseRevision: number;
  payload: ComposerProjectPayload;
  lineage?: ComposerRevisionLineage;
}

export interface SaveComposerProjectCheckpointInput extends SaveComposerProjectRevisionInput {
  checkpointName: string;
}

export interface RestoreComposerProjectRevisionInput {
  projectId: string;
  baseRevision: number;
  restoreRevisionId: string;
  checkpointName?: string;
}

export type ComposerProjectWriteResult =
  | { status: "saved"; project: ComposerProject; revision: ComposerProjectRevision }
  | {
    status: "conflict";
    project: ComposerProject;
    expectedBaseRevision: number;
    latestRevision: ComposerProjectRevision;
    /** Persisted branch holding the offline/stale client payload for merge UI. */
    conflictRevision: ComposerProjectRevision;
  };

export interface FileComposerProjectRepositoryOptions {
  rootDirectory?: string;
  now?: () => Date;
  idFactory?: () => string;
}

const DEFAULT_DIRECTORY = path.join(process.cwd(), "data", "composer-projects");

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function inlinePayload(payload: ComposerProjectPayload): InlineJsonPayloadRef<ComposerProjectPayload> {
  const value = cloneJson(payload);
  const serialized = JSON.stringify(value);
  return {
    storage: "inline-json",
    contentType: "application/json",
    sha256: createHash("sha256").update(serialized).digest("hex"),
    value,
  };
}

function cloneProject(project: ComposerProject): ComposerProject {
  return cloneJson(project);
}

function validateProjectId(projectId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(projectId)) {
    throw new Error("Composer Project id must contain only letters, numbers, underscores, or hyphens.");
  }
}

function revisionId(revision: number): string {
  return `revision-${revision}`;
}

/**
 * File-backed append-only revision graph. A production database adapter can
 * implement the same public API without changing Composer clients.
 */
export class FileComposerProjectRepository {
  private readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(options: FileComposerProjectRepositoryOptions = {}) {
    this.rootDirectory = options.rootDirectory ?? DEFAULT_DIRECTORY;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  async create(input: CreateComposerProjectInput): Promise<ComposerProject> {
    const id = input.id ?? this.idFactory();
    validateProjectId(id);
    if (!input.title.trim()) throw new Error("Composer Project title is required.");

    return this.withProjectLock(id, async () => {
      const target = this.filePath(id);
      try {
        await fs.access(target);
        throw new Error(`Composer Project "${id}" already exists.`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      const createdAt = this.now().toISOString();
      const initial: ComposerProjectRevision = {
        id: revisionId(0),
        revision: 0,
        kind: "initial",
        createdAt,
        parentRevisionId: null,
        payloadRef: inlinePayload(input.payload),
        lineage: cloneJson(input.lineage ?? {}),
      };
      const project: ComposerProject = {
        schemaVersion: 1,
        id,
        title: input.title.trim(),
        createdAt,
        updatedAt: createdAt,
        headRevisionId: initial.id,
        headRevision: initial.revision,
        revisions: [initial],
      };
      await this.write(project);
      return cloneProject(project);
    });
  }

  async get(projectId: string): Promise<ComposerProject | null> {
    validateProjectId(projectId);
    try {
      return cloneProject(await this.read(projectId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async autosave(input: SaveComposerProjectRevisionInput): Promise<ComposerProjectWriteResult> {
    return this.append(input, "autosave");
  }

  async checkpoint(input: SaveComposerProjectCheckpointInput): Promise<ComposerProjectWriteResult> {
    if (!input.checkpointName.trim()) throw new Error("Checkpoint name is required.");
    return this.append(input, "checkpoint", input.checkpointName.trim());
  }

  async restore(input: RestoreComposerProjectRevisionInput): Promise<ComposerProjectWriteResult> {
    return this.withProjectLock(input.projectId, async () => {
      const project = await this.read(input.projectId);
      const source = project.revisions.find((revision) => revision.id === input.restoreRevisionId);
      if (!source) throw new Error(`Revision "${input.restoreRevisionId}" does not belong to Composer Project "${input.projectId}".`);
      return this.appendUnlocked(project, {
        projectId: input.projectId,
        baseRevision: input.baseRevision,
        payload: source.payloadRef.value,
        lineage: {
          ...source.lineage,
          generatedFromRevisionIds: [...(source.lineage.generatedFromRevisionIds ?? []), source.id],
        },
      }, "restore", input.checkpointName?.trim());
    });
  }

  async getRevision(projectId: string, revisionIdToRead: string): Promise<ComposerProjectRevision | null> {
    const project = await this.get(projectId);
    return project?.revisions.find((revision) => revision.id === revisionIdToRead) ?? null;
  }

  async compare(projectId: string, leftRevisionId: string, rightRevisionId: string): Promise<{
    left: ComposerProjectRevision;
    right: ComposerProjectRevision;
  }> {
    const project = await this.get(projectId);
    if (!project) throw new Error(`Composer Project "${projectId}" does not exist.`);
    const left = project.revisions.find((revision) => revision.id === leftRevisionId);
    const right = project.revisions.find((revision) => revision.id === rightRevisionId);
    if (!left || !right) throw new Error("Both revisions must belong to the Composer Project.");
    return { left, right };
  }

  private async append(
    input: SaveComposerProjectRevisionInput,
    kind: Exclude<ComposerProjectRevisionKind, "initial" | "conflict">,
    checkpointName?: string,
  ): Promise<ComposerProjectWriteResult> {
    return this.withProjectLock(input.projectId, async () => this.appendUnlocked(await this.read(input.projectId), input, kind, checkpointName));
  }

  private async appendUnlocked(
    project: ComposerProject,
    input: SaveComposerProjectRevisionInput,
    kind: Exclude<ComposerProjectRevisionKind, "initial" | "conflict">,
    checkpointName?: string,
  ): Promise<ComposerProjectWriteResult> {
    const latest = this.head(project);
    const base = project.revisions.find((revision) => revision.revision === input.baseRevision);
    if (!base) {
      throw new Error(`Base revision ${input.baseRevision} does not belong to Composer Project "${project.id}".`);
    }
    if (input.baseRevision !== project.headRevision) {
      const conflictRevision = this.newRevision(project, input.payload, input.lineage, "conflict", checkpointName, base.id);
      project.revisions.push(conflictRevision);
      project.updatedAt = conflictRevision.createdAt;
      await this.write(project);
      return {
        status: "conflict",
        project: cloneProject(project),
        expectedBaseRevision: input.baseRevision,
        latestRevision: cloneJson(latest),
        conflictRevision: cloneJson(conflictRevision),
      };
    }

    const revision = this.newRevision(project, input.payload, input.lineage, kind, checkpointName, latest.id);
    project.revisions.push(revision);
    project.headRevisionId = revision.id;
    project.headRevision = revision.revision;
    project.updatedAt = revision.createdAt;
    await this.write(project);
    return { status: "saved", project: cloneProject(project), revision: cloneJson(revision) };
  }

  private newRevision(
    project: ComposerProject,
    payload: ComposerProjectPayload,
    lineage: ComposerRevisionLineage | undefined,
    kind: ComposerProjectRevisionKind,
    checkpointName: string | undefined,
    parentRevisionId: string,
  ): ComposerProjectRevision {
    const revision = Math.max(...project.revisions.map((entry) => entry.revision)) + 1;
    return {
      id: revisionId(revision),
      revision,
      kind,
      createdAt: this.now().toISOString(),
      parentRevisionId,
      ...(kind === "conflict" ? { branchOfRevisionId: parentRevisionId } : {}),
      ...(checkpointName ? { checkpointName } : {}),
      payloadRef: inlinePayload(payload),
      lineage: cloneJson(lineage ?? {}),
    };
  }

  private head(project: ComposerProject): ComposerProjectRevision {
    const head = project.revisions.find((revision) => revision.id === project.headRevisionId);
    if (!head) throw new Error(`Composer Project "${project.id}" has no valid head revision.`);
    return head;
  }

  private filePath(projectId: string): string {
    return path.join(this.rootDirectory, `${projectId}.json`);
  }

  private async read(projectId: string): Promise<ComposerProject> {
    validateProjectId(projectId);
    const parsed: unknown = JSON.parse(await fs.readFile(this.filePath(projectId), "utf-8"));
    // The repository owns this file. Keep decoding intentionally narrow until a
    // migration layer is introduced for later schema versions.
    if (!parsed || typeof parsed !== "object" || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
      throw new Error(`Composer Project "${projectId}" has an unsupported storage format.`);
    }
    return parsed as ComposerProject;
  }

  private async write(project: ComposerProject): Promise<void> {
    await fs.mkdir(this.rootDirectory, { recursive: true });
    const target = this.filePath(project.id);
    const temporary = path.join(this.rootDirectory, `.${project.id}.${this.idFactory()}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, "utf-8");
    await fs.rename(temporary, target);
  }

  private async withProjectLock<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    validateProjectId(projectId);
    const prior = this.locks.get(projectId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = prior.then(() => current);
    this.locks.set(projectId, queued);
    await prior;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(projectId) === queued) this.locks.delete(projectId);
    }
  }
}
