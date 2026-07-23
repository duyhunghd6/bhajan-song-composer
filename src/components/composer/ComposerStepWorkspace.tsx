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

  useEffect(() => {
    if (!isWorkspaceHydrated) return;
    if (previousHarmonyValidationAbc.current === undefined) {
      previousHarmonyValidationAbc.current = harmonyValidationAbc;
      return;
    }
    if (previousHarmonyValidationAbc.current === harmonyValidationAbc) return;

    previousHarmonyValidationAbc.current = harmonyValidationAbc;
    updateState(buildHarmonyValidationBranchResetState(ws));
    try {
      window.localStorage.removeItem(getComposerFingerstyleMeasuresStorageKey(slug));
    } catch (error) {
      console.error("Failed to clear stale fingerstyle measures", error);
    }
  }, [harmonyValidationAbc, isWorkspaceHydrated, slug, updateState, ws]);

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
