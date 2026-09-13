"use server";

import {
  FileComposerProjectRepository,
  type ComposerProjectPayload,
  type ComposerProjectWriteResult,
} from "@/lib/composer-project";

const repository = new FileComposerProjectRepository();

export interface ComposerProjectSaveRequest {
  projectId: string;
  title: string;
  baseRevision?: number;
  payload: ComposerProjectPayload;
}

export interface ComposerProjectSaveResponse {
  status: "saved" | "conflict";
  revision: number;
  revisionId: string;
  conflictRevisionId?: string;
}

function response(result: ComposerProjectWriteResult): ComposerProjectSaveResponse {
  if (result.status === "saved") {
    return { status: "saved", revision: result.revision.revision, revisionId: result.revision.id };
  }
  return {
    status: "conflict",
    revision: result.project.headRevision,
    revisionId: result.latestRevision.id,
    conflictRevisionId: result.conflictRevision.id,
  };
}

/** Create once per Composer slug, then append autosave revisions with OCC. */
export async function autosaveComposerProject(request: ComposerProjectSaveRequest): Promise<ComposerProjectSaveResponse> {
  let project = await repository.get(request.projectId);
  if (!project) {
    project = await repository.create({ id: request.projectId, title: request.title, payload: request.payload, lineage: {
      sourceRevisionId: request.payload.song.sourceRevisionId,
      sourceFingerprint: request.payload.song.sourceFingerprint,
    } });
    return { status: "saved", revision: project.headRevision, revisionId: project.headRevisionId };
  }
  return response(await repository.autosave({
    projectId: request.projectId,
    baseRevision: request.baseRevision ?? project.headRevision,
    payload: request.payload,
    lineage: { sourceRevisionId: request.payload.song.sourceRevisionId, sourceFingerprint: request.payload.song.sourceFingerprint },
  }));
}

export async function checkpointComposerProject(
  request: ComposerProjectSaveRequest & { checkpointName: string },
): Promise<ComposerProjectSaveResponse> {
  const project = await repository.get(request.projectId);
  if (!project) {
    await autosaveComposerProject(request);
    const created = await repository.get(request.projectId);
    if (!created) throw new Error("Composer Project could not be created.");
    return response(await repository.checkpoint({
      projectId: request.projectId,
      baseRevision: created.headRevision,
      checkpointName: request.checkpointName,
      payload: request.payload,
    }));
  }
  return response(await repository.checkpoint({
    projectId: request.projectId,
    baseRevision: request.baseRevision ?? project.headRevision,
    checkpointName: request.checkpointName,
    payload: request.payload,
  }));
}
