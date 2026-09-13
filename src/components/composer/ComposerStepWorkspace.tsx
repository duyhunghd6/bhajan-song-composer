"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import {
  DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
  DEFAULT_HARMONY_LAYER_VISIBILITY,
  DEFAULT_LAYER_VOLUMES,
  useWorkspaceState,
} from "./useWorkspaceState";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import type { ComposerStepId } from "./composer-steps";
import { AccompanimentStep } from "./workspace/AccompanimentStep";
import { GuitarFingerstyleStep } from "./workspace/GuitarFingerstyleStep";
import {
  buildAccompanimentGuitarBranchResetState,
  buildHarmonyValidationBranchResetState,
  hasAccompanimentGuitarBranchWork,
} from "./workspace/accompaniment-guitar-reset";
import { buildArrangementPreviewModel } from "./workspace/arrangement-preview-model";
import { HarmonyStep } from "./workspace/HarmonyStep";
import {
  clearComposerSongStorage,
  getComposerFingerstyleMeasuresStorageKey,
  getComposerMelodyStorageKey,
} from "./workspace/storage";
import { ExportStep } from "./workspace/export/ExportStep";
import { autosaveComposerProject, checkpointComposerProject } from "@/app/actions/composer-project";
import {
  buildAccompanimentProjectPayload,
  buildInspectorIntegration,
  buildVoicingAuditionPreview,
  createVoicingOverride,
  revalidateVoicingOverridesForSource,
} from "./workspace/voicing-inspector-integration";
import type { VoicingAuditionRequest, VoicingCandidate, VoicingOverrideScope } from "./ChordVoicingInspector";
import type { InspectorIntegration, VoicingAuditionPreview } from "./workspace/voicing-inspector-integration";
import {
  composerProjectOutboxEntries,
  enqueueComposerProjectOutbox,
  removeComposerProjectOutboxEntry,
} from "./workspace/composer-project-outbox";

interface ComposerStepWorkspaceProps {
  slug: string;
  step: ComposerStepId;
  initialMelodyAbc?: string;
}

export default function ComposerStepWorkspace({ slug, step, initialMelodyAbc }: ComposerStepWorkspaceProps) {
  // Always initialize with the server-safe value to avoid hydration mismatch.
  // localStorage restoration happens in useEffect below.
  const [melodyAbc, setMelodyAbc] = useState(initialMelodyAbc ?? DEFAULT_ABC);
  const [hasMounted, setHasMounted] = useState(false);
  const {
    state: ws,
    updateState,
    resetState: resetWorkspaceState,
    isHydrated: isWorkspaceHydrated,
  } = useWorkspaceState(slug);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(DEFAULT_HARMONY_LAYER_VISIBILITY);
  const [layerVolumes, setLayerVolumes] = useState<Record<string, number>>(DEFAULT_LAYER_VOLUMES);
  const previousHarmonyValidationAbc = useRef<string | null | undefined>(undefined);
  const [selectedStrongBeatIndex, setSelectedStrongBeatIndex] = useState(0);
  const [projectSaveStatus, setProjectSaveStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [projectSaveDetail, setProjectSaveDetail] = useState<string | undefined>();
  const [voicingAuditionPreview, setVoicingAuditionPreview] = useState<VoicingAuditionPreview | null>(null);
  const projectRevisionRef = useRef<number | undefined>(undefined);

  const accompLayerVisibility = ws.accompanimentLayerVisibility ?? DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY;
  const accompLayerVolumes = ws.accompanimentLayerVolumes ?? DEFAULT_LAYER_VOLUMES;
  const setAccompLayerVisibility = useCallback((nextVisibility: SetStateAction<Record<string, boolean>>) => {
    updateState({
      accompanimentLayerVisibility: typeof nextVisibility === "function"
        ? nextVisibility(accompLayerVisibility)
        : nextVisibility,
    });
  }, [accompLayerVisibility, updateState]);
  const setAccompLayerVolumes = useCallback((nextVolumes: SetStateAction<Record<string, number>>) => {
    updateState({
      accompanimentLayerVolumes: typeof nextVolumes === "function"
        ? nextVolumes(accompLayerVolumes)
        : nextVolumes,
    });
  }, [accompLayerVolumes, updateState]);

  // Hydrate melodyAbc from localStorage after mount (client-only)
  useEffect(() => {
    try {
      const savedMelody = window.localStorage.getItem(getComposerMelodyStorageKey(slug));
      const isDefault = savedMelody === DEFAULT_ABC || (savedMelody && savedMelody.includes("T:New Bhajan Arrangement"));
      if (savedMelody && !isDefault) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- melody must hydrate from localStorage after mount to avoid SSR/localStorage mismatches.
        setMelodyAbc(savedMelody);
      }
    } catch (e) {
      console.error("Failed to restore melody state from localStorage", e);
    }
    setHasMounted(true);
  }, [slug]);

  useEffect(() => {
    if (!hasMounted) return;
    try {
      window.localStorage.setItem(getComposerMelodyStorageKey(slug), melodyAbc);
    } catch (error) {
      console.error("Failed to save melody state to localStorage", error);
    }
  }, [hasMounted, melodyAbc, slug]);

  // The baseline ABC is the pure melody.
  const activeAbc = melodyAbc;

  const previewModel = useMemo(() => buildArrangementPreviewModel({
    activeAbc,
    workflow: ws.accompanimentWorkflow,
    generatedAccompaniment: ws.generatedAccompaniment,
    generatedGuitar: ws.generatedGuitar,
    generatedGuitarOrigin: ws.generatedGuitarOrigin,
    previewPurpose: step === "accompaniment" ? "accompaniment" : "final",
    harmonyLayerVisibility: layerVisibility,
    harmonyLayerVolumes: layerVolumes,
    accompanimentLayerVisibility: accompLayerVisibility,
    accompanimentLayerVolumes: accompLayerVolumes,
  }), [
    activeAbc,
    ws.accompanimentWorkflow,
    ws.generatedAccompaniment,
    ws.generatedGuitar,
    ws.generatedGuitarOrigin,
    step,
    layerVisibility,
    layerVolumes,
    accompLayerVisibility,
    accompLayerVolumes,
  ]);

  const { pipeline, harmonyValidationAbc, sourceGraph } = previewModel;

  const accompanimentInspectorTargets = useMemo(() => {
    if (!harmonyValidationAbc || !pipeline) return [];
    return pipeline.harmonization.measures.map((measure) => buildInspectorIntegration({
      chordSymbol: measure.chord.name,
      measureIndex: measure.measureIndex,
      measureCount: pipeline.harmonization.measures.length,
      strongBeatNotes: measure.strongBeatNotes,
      sourceAbc: harmonyValidationAbc,
      profileName: ws.accompanimentWorkflow?.guitarProfileHint ?? undefined,
      overrides: ws.voicingOverrides,
    }));
  }, [harmonyValidationAbc, pipeline, ws.accompanimentWorkflow?.guitarProfileHint, ws.voicingOverrides]);

  useEffect(() => {
    if (selectedStrongBeatIndex < accompanimentInspectorTargets.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a source change can reduce the immutable harmony's measure count.
    setSelectedStrongBeatIndex(0);
  }, [accompanimentInspectorTargets.length, selectedStrongBeatIndex]);

  useEffect(() => {
    if (!isWorkspaceHydrated) return;
    if (previousHarmonyValidationAbc.current === undefined) {
      previousHarmonyValidationAbc.current = harmonyValidationAbc;
      return;
    }
    if (previousHarmonyValidationAbc.current === harmonyValidationAbc) return;

    previousHarmonyValidationAbc.current = harmonyValidationAbc;
    updateState({
      ...buildHarmonyValidationBranchResetState(ws),
      voicingOverrides: revalidateVoicingOverridesForSource(ws.voicingOverrides, harmonyValidationAbc ?? activeAbc),
    });
    try {
      window.localStorage.removeItem(getComposerFingerstyleMeasuresStorageKey(slug));
    } catch (error) {
      console.error("Failed to clear stale fingerstyle measures", error);
    }
  }, [activeAbc, harmonyValidationAbc, isWorkspaceHydrated, slug, updateState, ws]);

  const handleRestoreHarmony = useCallback(() => {
    const originalMelodyAbc = initialMelodyAbc ?? DEFAULT_ABC;
    setMelodyAbc(originalMelodyAbc);
    resetWorkspaceState();
    try {
      clearComposerSongStorage(window.localStorage, slug);
    } catch (e) {
      console.error("Failed to clear composer state from localStorage", e);
    }
    setLayerVisibility(DEFAULT_HARMONY_LAYER_VISIBILITY);
    setLayerVolumes(DEFAULT_LAYER_VOLUMES);
  }, [initialMelodyAbc, resetWorkspaceState, slug]);

  const hasGuitarBranchWork = hasAccompanimentGuitarBranchWork(ws);

  const handleResetGuitarBranchWork = useCallback(() => {
    updateState(buildAccompanimentGuitarBranchResetState(ws));
    setAccompLayerVisibility((current) => ({
      ...current,
      TAB: false,
    }));
  }, [setAccompLayerVisibility, slug, ws, updateState]);
  const getRenderOptionsFor = previewModel.getRenderOptionsFor;

  const projectId = useMemo(() => `composer-${slug.replace(/[^a-zA-Z0-9_-]/g, "-")}`, [slug]);
  const projectPayload = useMemo(() => buildAccompanimentProjectPayload({
    slug,
    activeAbc,
    branchSourceAbc: harmonyValidationAbc,
    workspace: ws,
  }), [activeAbc, harmonyValidationAbc, slug, ws]);

  const flushProjectOutbox = useCallback(async () => {
    for (const entry of composerProjectOutboxEntries(window.localStorage)) {
      try {
        const result = entry.kind === "checkpoint"
          ? await checkpointComposerProject({ ...entry.request, checkpointName: entry.request.checkpointName ?? "Recovered checkpoint" })
          : await autosaveComposerProject(entry.request);
        projectRevisionRef.current = result.revision;
        removeComposerProjectOutboxEntry(window.localStorage, entry.id);
        setProjectSaveStatus(result.status);
        setProjectSaveDetail(result.status === "conflict" ? "A queued offline revision was retained for review." : `Revision ${result.revision}`);
      } catch {
        // Keep the entry for the next online event; localStorage is an outbox,
        // never a replacement for the repository authority.
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    const onOnline = () => { void flushProjectOutbox(); };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) void flushProjectOutbox();
    return () => window.removeEventListener("online", onOnline);
  }, [flushProjectOutbox, hasMounted]);

  useEffect(() => {
    if (!hasMounted || !isWorkspaceHydrated || step !== "accompaniment") return;
    const timer = window.setTimeout(() => {
      setProjectSaveStatus("saving");
      const request = {
        projectId,
        title: `${slug} arrangement`,
        baseRevision: projectRevisionRef.current,
        payload: projectPayload,
      };
      void autosaveComposerProject(request).then((result) => {
        projectRevisionRef.current = result.revision;
        setProjectSaveStatus(result.status);
        setProjectSaveDetail(result.status === "conflict" ? "A separate offline revision was retained." : `Revision ${result.revision}`);
      }).catch((error: unknown) => {
        setProjectSaveStatus("error");
        const queued = enqueueComposerProjectOutbox(window.localStorage, {
          id: `autosave-${Date.now()}`,
          kind: "autosave",
          request,
        });
        setProjectSaveDetail(queued ? "Queued locally and will retry when online." : error instanceof Error ? error.message : "Unable to reach durable Project storage.");
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hasMounted, isWorkspaceHydrated, projectId, projectPayload, slug, step]);

  const handleProjectCheckpoint = useCallback(() => {
    setProjectSaveStatus("saving");
    const request = {
      projectId,
      title: `${slug} arrangement`,
      baseRevision: projectRevisionRef.current,
      payload: projectPayload,
      checkpointName: `Voicing checkpoint ${new Date().toLocaleString()}`,
    };
    void checkpointComposerProject(request).then((result) => {
      projectRevisionRef.current = result.revision;
      setProjectSaveStatus(result.status);
      setProjectSaveDetail(result.status === "conflict" ? "Checkpoint conflict retained for review." : `Checkpoint revision ${result.revision}`);
    }).catch((error: unknown) => {
      setProjectSaveStatus("error");
      const queued = enqueueComposerProjectOutbox(window.localStorage, {
        id: `checkpoint-${Date.now()}`,
        kind: "checkpoint",
        request,
      });
      setProjectSaveDetail(queued ? "Checkpoint queued locally and will retry when online." : error instanceof Error ? error.message : "Unable to save checkpoint.");
    });
  }, [projectId, projectPayload, slug]);

  const handleApplyVoicing = useCallback((target: InspectorIntegration, candidate: VoicingCandidate, scope: VoicingOverrideScope) => {
    const override = createVoicingOverride({ target: target.target, inspectorCandidate: candidate, scope });
    // Appending retains previous revisions/decisions for audit. It never changes
    // `harmonyValidationAbc`, the immutable source supplied to the branch.
    updateState({ voicingOverrides: [...ws.voicingOverrides, override] });
  }, [updateState, ws.voicingOverrides]);

  const handleVoicingAudition = useCallback((target: InspectorIntegration, request: VoicingAuditionRequest) => {
    // The temporary one/two-measure ABC is deliberately separate from
    // harmonyValidationAbc, so audition cannot mutate the locked source.
    setVoicingAuditionPreview(buildVoicingAuditionPreview(target.target, request));
  }, []);

  if (step === "melody") {
    return (
      <div className="space-y-5">
        <AbcEditor
          title="ABC Notation Editor"
          value={melodyAbc}
          initialAbc={initialMelodyAbc ?? DEFAULT_ABC}
          storageKey={getComposerMelodyStorageKey(slug)}
          manageStorage={false}
          onChange={setMelodyAbc}
        />
      </div>
    );
  }

  if (step === "harmony") {
    return (
      <HarmonyStep
        melodyAbc={melodyAbc}
        initialMelodyAbc={initialMelodyAbc}
        hasMounted={hasMounted}
        pipeline={pipeline}
        harmonyPreview={previewModel.harmony}
        layerVisibility={layerVisibility}
        setLayerVisibility={setLayerVisibility}
        layerVolumes={layerVolumes}
        setLayerVolumes={setLayerVolumes}
        ws={ws}
        updateState={updateState}
        onRestore={handleRestoreHarmony}
      />
    );
  }

  if (step === "accompaniment") {
    return (
      <AccompanimentStep
        activeAbc={activeAbc}
        branchSourceAbc={harmonyValidationAbc}
        pipeline={pipeline}
        accompanimentPreview={previewModel.accompaniment}
        accompLayerVisibility={accompLayerVisibility}
        setAccompLayerVisibility={setAccompLayerVisibility}
        accompLayerVolumes={accompLayerVolumes}
        setAccompLayerVolumes={setAccompLayerVolumes}
        getRenderOptionsFor={getRenderOptionsFor}
        ws={ws}
        updateState={updateState}
        voicingInspector={{
          targets: accompanimentInspectorTargets,
          selectedTargetIndex: selectedStrongBeatIndex,
          onSelectTarget: (index) => {
            setSelectedStrongBeatIndex(index);
            setVoicingAuditionPreview(null);
          },
          onApplyCandidate: handleApplyVoicing,
          onAuditionRequest: handleVoicingAudition,
          auditionPreview: voicingAuditionPreview,
        }}
        projectPersistence={{ status: projectSaveStatus, detail: projectSaveDetail, onCheckpoint: handleProjectCheckpoint }}
      />
    );
  }

  if (step === "guitar-fingerstyle") {
    return (
      <GuitarFingerstyleStep
        slug={slug}
        activeAbc={activeAbc}
        hasMounted={hasMounted}
        isWorkspaceHydrated={isWorkspaceHydrated}
        pipeline={pipeline}
        workflowAppliedMusicAbc={harmonyValidationAbc ?? ""}
        accompLayerVisibility={accompLayerVisibility}
        setAccompLayerVisibility={setAccompLayerVisibility}
        accompLayerVolumes={accompLayerVolumes}
        setAccompLayerVolumes={setAccompLayerVolumes}
        ws={ws}
        updateState={updateState}
        canResetGuitarBranchWork={hasGuitarBranchWork}
        onResetGuitarBranchWork={handleResetGuitarBranchWork}
      />
    );
  }

  return (
    <ExportStep
      slug={slug}
      sourceGraph={sourceGraph}
      previewAbc={previewModel.accompaniment.abc}
      getRenderOptionsFor={getRenderOptionsFor}
    />
  );
}
