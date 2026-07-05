"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildArrangementLayerProposals,
  generateArrangementPipeline,
} from "@/lib/theory/arrangement-pipeline";
import type {
  ArrangementLayerProposal,
  ArrangementPipelineResult,
} from "@/lib/theory/arrangement-pipeline";
import {
  buildFingerstyleComposerIntegration,
  type FingerstyleComposerIntegration,
  type FingerstyleComposerProfileId,
} from "./fingerstyle-integration";
import AbcEditor from "./AbcEditor";
import TheoryAssistant from "./TheoryAssistant";
import type { TheoryAssistantLayerProposal } from "./theory-assistant-layer";
import {
  ArrangementPipelineGatePanel,
  DEFAULT_LAYERS,
  FingerstyleIntegrationPanel,
  LAYERS_STORAGE_KEY,
  LayerStackPreview,
  ROLE_OPTIONS,
  combinedVisibleAbc,
  createLayerId,
  roleLabels,
  safeParseLayers,
  type ComposerLayer,
  type LayerRole,
} from "./layers/layer-manager-parts";
export type { ComposerLayer, LayerRole } from "./layers/layer-manager-parts";


export interface LayerManagerProps {
  initialLayers?: ComposerLayer[];
  storageKey?: string;
}

export default function LayerManager({
  initialLayers = DEFAULT_LAYERS,
  storageKey = LAYERS_STORAGE_KEY,
}: LayerManagerProps) {
  const [layers, setLayers] = useState<ComposerLayer[]>(initialLayers);
  const [activeLayerId, setActiveLayerId] = useState(initialLayers[0]?.id || "melody");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [storageStatus, setStorageStatus] = useState("Layer stack saves locally in this browser.");
  const [copied, setCopied] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<ArrangementPipelineResult | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [dismissedPipelineLayerIds, setDismissedPipelineLayerIds] = useState<string[]>([]);
  const [fingerstyleProfileId, setFingerstyleProfileId] = useState<FingerstyleComposerProfileId>("strict-pima");
  const [fingerstyleIntegration, setFingerstyleIntegration] = useState<FingerstyleComposerIntegration | null>(null);
  const [fingerstyleError, setFingerstyleError] = useState<string | null>(null);

  const layersKey = storageKey;
  const activeLayerKey = `${storageKey}:active-layer`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        const savedLayers = safeParseLayers(window.localStorage.getItem(layersKey));
        const nextLayers = savedLayers ?? initialLayers;
        const savedActiveLayerId = window.localStorage.getItem(activeLayerKey);
        const nextActiveLayerId =
          savedActiveLayerId && nextLayers.some((layer) => layer.id === savedActiveLayerId)
            ? savedActiveLayerId
            : nextLayers[0]?.id || "melody";

        setLayers(nextLayers);
        setActiveLayerId(nextActiveLayerId);
        setStorageStatus(savedLayers ? "Loaded saved layers from this browser." : "Layer stack saves locally in this browser.");
      } catch (err) {
        console.error("Error loading composer layers:", err);
        setStorageStatus("Local layer loading is unavailable in this browser.");
      } finally {
        setHasLoadedStorage(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialLayers, layersKey, activeLayerKey]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(layersKey, JSON.stringify(layers));
        window.localStorage.setItem(activeLayerKey, activeLayerId);
        setStorageStatus("Layer stack saved locally in this browser.");
      } catch (err) {
        console.error("Error saving composer layers:", err);
        setStorageStatus("Local layer saving is unavailable in this browser.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeLayerId, hasLoadedStorage, layers, layersKey, activeLayerKey]);

  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0];
  const visibleLayers = useMemo(() => layers.filter((layer) => layer.visible), [layers]);
  const visibleAbc = useMemo(() => combinedVisibleAbc(layers), [layers]);
  const pipelineLayerProposals = useMemo(() => {
    if (!pipelineResult) return [];

    return buildArrangementLayerProposals(pipelineResult).filter(
      (proposal) =>
        !dismissedPipelineLayerIds.includes(proposal.id) &&
        !layers.some((layer) => layer.id === proposal.id)
    );
  }, [dismissedPipelineLayerIds, layers, pipelineResult]);

  const resetPipelineResult = () => {
    setPipelineResult(null);
    setPipelineError(null);
    setDismissedPipelineLayerIds([]);
  };

  const resetFingerstyleIntegration = () => {
    setFingerstyleIntegration(null);
    setFingerstyleError(null);
  };

  const resetGeneratedOutputs = () => {
    resetPipelineResult();
    resetFingerstyleIntegration();
  };

  const selectLayer = (layerId: string) => {
    setActiveLayerId(layerId);
    resetGeneratedOutputs();
  };

  const updateLayer = (layerId: string, updates: Partial<ComposerLayer>) => {
    const affectsActivePipeline =
      layerId === activeLayer.id &&
      ((updates.abc !== undefined && updates.abc !== activeLayer.abc) ||
        (updates.role !== undefined && updates.role !== activeLayer.role));

    if (affectsActivePipeline) {
      resetGeneratedOutputs();
    }

    setLayers((currentLayers) => {
      let changed = false;
      const nextLayers = currentLayers.map((layer) => {
        if (layer.id !== layerId) return layer;

        const nextLayer = { ...layer, ...updates };
        const layerChanged = Object.keys(updates).some(
          (key) => layer[key as keyof ComposerLayer] !== nextLayer[key as keyof ComposerLayer]
        );
        changed ||= layerChanged;
        return layerChanged ? nextLayer : layer;
      });

      return changed ? nextLayers : currentLayers;
    });
  };

  const updateActiveLayerAbc = (abc: string) => {
    updateLayer(activeLayer.id, { abc });
  };

  const addLayer = () => {
    const nextNumber = layers.length + 1;
    const id = createLayerId();
    const layer: ComposerLayer = {
      id,
      name: `Layer ${nextNumber}`,
      role: "custom",
      visible: true,
      abc: `X:${nextNumber}\nT:Layer ${nextNumber}\nM:4/4\nL:1/8\nQ:1/4=120\nK:Em\n| E2 F2 G2 A2 | B8 |`,
    };

    setLayers((currentLayers) => [...currentLayers, layer]);
    setActiveLayerId(id);
    resetGeneratedOutputs();
  };

  const duplicateActiveLayer = () => {
    const id = createLayerId();
    const layer: ComposerLayer = {
      ...activeLayer,
      id,
      name: `${activeLayer.name} Copy`,
      visible: true,
    };

    setLayers((currentLayers) => [...currentLayers, layer]);
    setActiveLayerId(id);
    resetGeneratedOutputs();
  };

  const deleteActiveLayer = () => {
    if (layers.length === 1) return;

    const activeIndex = layers.findIndex((layer) => layer.id === activeLayer.id);
    const nextLayers = layers.filter((layer) => layer.id !== activeLayer.id);
    const nextActiveLayer = nextLayers[Math.max(0, activeIndex - 1)] ?? nextLayers[0];

    setLayers(nextLayers);
    setActiveLayerId(nextActiveLayer.id);
    resetGeneratedOutputs();
  };

  const resetLayers = () => {
    setLayers(initialLayers);
    setActiveLayerId(initialLayers[0]?.id || "melody");
    setStorageStatus("Layer stack reset to the starter arrangement.");
    resetGeneratedOutputs();
  };

  const copyVisibleAbc = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(visibleAbc);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("Error copying visible layer stack:", err);
      setCopied(false);
    }
  };

  const runArrangementPipeline = () => {
    if (activeLayer.role !== "melody") {
      setPipelineError("Select a melody layer before generating downstream arrangement stages.");
      return;
    }

    try {
      setPipelineResult(generateArrangementPipeline(activeLayer.abc));
      setPipelineError(null);
      setDismissedPipelineLayerIds([]);
    } catch (err) {
      console.error("Error generating arrangement pipeline:", err);
      setPipelineResult(null);
      setDismissedPipelineLayerIds([]);
      setPipelineError("Add a valid melody ABC layer before running the ordered arrangement pipeline.");
    }
  };

  const acceptPipelineLayer = (proposal: ArrangementLayerProposal) => {
    const layer: ComposerLayer = { ...proposal };

    setLayers((currentLayers) => [...currentLayers, layer]);
    setActiveLayerId(layer.id);
    setDismissedPipelineLayerIds((currentIds) => [...currentIds, proposal.id]);
  };

  const acceptTheoryAssistantLayer = (proposal: TheoryAssistantLayerProposal) => {
    const layer: ComposerLayer = { ...proposal };

    setLayers((currentLayers) => [
      ...currentLayers.filter((currentLayer) => currentLayer.id !== layer.id),
      layer,
    ]);
    setActiveLayerId(layer.id);
    resetGeneratedOutputs();
  };

  const rejectPipelineLayer = (proposalId: string) => {
    setDismissedPipelineLayerIds((currentIds) =>
      currentIds.includes(proposalId) ? currentIds : [...currentIds, proposalId]
    );
  };

  const changeFingerstyleProfile = (profileId: FingerstyleComposerProfileId) => {
    setFingerstyleProfileId(profileId);
    resetFingerstyleIntegration();
  };

  const generateFingerstyleOutput = () => {
    if (activeLayer.role !== "melody") {
      setFingerstyleError("Select a melody layer before generating fingerstyle output.");
      return;
    }

    try {
      setFingerstyleIntegration(
        buildFingerstyleComposerIntegration(activeLayer.abc, undefined, { pickingProfile: fingerstyleProfileId })
      );
      setFingerstyleError(null);
    } catch (err) {
      console.error("Error generating fingerstyle output:", err);
      setFingerstyleIntegration(null);
      setFingerstyleError("Add a valid melody ABC layer before generating fingerstyle output.");
    }
  };

  const acceptFingerstyleLayer = () => {
    if (!fingerstyleIntegration) return;

    const layer = fingerstyleIntegration.composerLayer;
    setLayers((currentLayers) => [
      ...currentLayers.filter((currentLayer) => currentLayer.id !== layer.id),
      layer,
    ]);
    setActiveLayerId(layer.id);
    resetFingerstyleIntegration();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        <aside className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-md overflow-hidden">
          <div className="border-b border-zinc-100 dark:border-zinc-800 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
              Layer Manager
            </p>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Arrangement tracks
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Switch one editable ABC layer at a time, then keep supporting layers visible in the stack preview.
            </p>
          </div>

          <div className="p-4 space-y-3">
            {layers.map((layer, index) => {
              const isActive = layer.id === activeLayer.id;

              return (
                <div
                  key={layer.id}
                  className={`rounded-xl border p-3 transition-all ${
                    isActive
                      ? "border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/20"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => selectLayer(layer.id)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                        Track {index + 1} · {roleLabels[layer.role]}
                      </span>
                      <span className="mt-1 block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {layer.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                        layer.visible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}
                      aria-pressed={layer.visible}
                    >
                      {layer.visible ? "Visible" : "Hidden"}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={addLayer}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
              >
                Add layer
              </button>
              <button
                type="button"
                onClick={duplicateActiveLayer}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={deleteActiveLayer}
                disabled={layers.length === 1}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/70 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={resetLayers}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">{storageStatus}</p>

            <ArrangementPipelineGatePanel
              activeLayer={activeLayer}
              pipeline={pipelineResult}
              pipelineError={pipelineError}
              layerProposals={pipelineLayerProposals}
              onRunPipeline={runArrangementPipeline}
              onAcceptLayer={acceptPipelineLayer}
              onRejectLayer={rejectPipelineLayer}
            />

            <FingerstyleIntegrationPanel
              activeLayer={activeLayer}
              selectedProfileId={fingerstyleProfileId}
              integration={fingerstyleIntegration}
              error={fingerstyleError}
              onProfileChange={changeFingerstyleProfile}
              onGenerate={generateFingerstyleOutput}
              onAcceptLayer={acceptFingerstyleLayer}
            />
          </div>
        </aside>

        <div className="space-y-4 min-w-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <label htmlFor="active-layer-name-input" className="space-y-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Active layer name
                </span>
                <input
                  id="active-layer-name-input"
                  type="text"
                  value={activeLayer.name}
                  onChange={(event) => updateLayer(activeLayer.id, { name: event.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Role
                </span>
                <select
                  value={activeLayer.role}
                  onChange={(event) =>
                    updateLayer(activeLayer.id, { role: event.target.value as LayerRole })
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1">
                {layers.length} total {layers.length === 1 ? "layer" : "layers"}
              </span>
              <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1">
                {visibleLayers.length} visible
              </span>
              <button
                type="button"
                onClick={copyVisibleAbc}
                disabled={visibleLayers.length === 0}
                className="rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1 font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {copied ? "Copied stack" : "Copy visible ABC"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <AbcEditor
              key={activeLayer.id}
              title={`Editing: ${activeLayer.name}`}
              initialAbc={activeLayer.abc}
              value={activeLayer.abc}
              storageKey={`${layersKey}:${activeLayer.id}:draft`}
              onChange={updateActiveLayerAbc}
            />
            <TheoryAssistant abc={activeLayer.abc} onAcceptArrangement={acceptTheoryAssistantLayer} />
          </div>
        </div>
      </section>

      <LayerStackPreview abc={visibleAbc} visibleCount={visibleLayers.length} />
    </div>
  );
}
