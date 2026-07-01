"use client";

import { useEffect, useMemo, useState } from "react";
import MusicSheetRenderer from "@/components/music-sheet/MusicSheetRenderer";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import {
  buildArrangementLayerProposals,
  generateArrangementPipeline,
  getArrangementPipelineStageGates,
} from "@/lib/theory/arrangement-pipeline";
import type {
  ArrangementLayerProposal,
  ArrangementPipelineResult,
  ArrangementPipelineStageId,
} from "@/lib/theory/arrangement-pipeline";
import {
  buildFingerstyleComposerIntegration,
  FINGERSTYLE_PROFILE_OPTIONS,
  type FingerstyleComposerIntegration,
  type FingerstyleComposerProfileId,
} from "./fingerstyle-integration";
import AbcEditor from "./AbcEditor";
import TheoryAssistant from "./TheoryAssistant";
import type { TheoryAssistantLayerProposal } from "./theory-assistant-layer";

const LAYERS_STORAGE_KEY = "bhajan-song-composer:composer:layers";
const ROLE_OPTIONS = ["melody", "harmony", "bass", "rhythm", "custom"] as const;

export type LayerRole = (typeof ROLE_OPTIONS)[number];

export type ComposerLayer = {
  id: string;
  name: string;
  role: LayerRole;
  abc: string;
  visible: boolean;
};

const DEFAULT_LAYERS: ComposerLayer[] = [
  {
    id: "melody",
    name: "Melody",
    role: "melody",
    visible: true,
    abc: `X:1
T:Melody Layer
M:4/4
L:1/8
Q:1/4=120
K:Em
V:melody name="Melody"
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`,
  },
  {
    id: "harmony",
    name: "Harmony Guide",
    role: "harmony",
    visible: true,
    abc: `X:2
T:Harmony Guide
M:4/4
L:1/8
Q:1/4=120
K:Em
V:harmony name="Harmony"
|: [EGB]4 [EGB]4 | [GBd]4 [DFA]4 | [CEG]4 [GBd]4 | [EGB]8 :|`,
  },
  {
    id: "bass",
    name: "Bass Pulse",
    role: "bass",
    visible: false,
    abc: `X:3
T:Bass Pulse
M:4/4
L:1/8
Q:1/4=120
K:Em
V:bass clef=bass name="Bass"
|: E,2 B,2 E,2 B,2 | G,2 D2 G,2 D2 | C,2 G,2 D,2 A,2 | E,8 :|`,
  },
];

const roleLabels: Record<LayerRole, string> = {
  melody: "Melody",
  harmony: "Harmony",
  bass: "Bass",
  rhythm: "Rhythm",
  custom: "Custom",
};

const generatedPipelineStageIds: ArrangementPipelineStageId[] = [
  "harmonization",
  "accompaniment",
  "full-track-expansion",
  "full-track",
];

function createLayerId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `layer-${Date.now().toString(36)}`;
}

function safeParseLayers(raw: string | null): ComposerLayer[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const layers = parsed.filter((layer): layer is ComposerLayer => {
      return (
        typeof layer?.id === "string" &&
        typeof layer?.name === "string" &&
        ROLE_OPTIONS.includes(layer?.role) &&
        typeof layer?.abc === "string" &&
        typeof layer?.visible === "boolean"
      );
    });

    return layers.length > 0 ? layers : null;
  } catch (err) {
    console.error("Error parsing saved composer layers:", err);
    return null;
  }
}

function combinedVisibleAbc(layers: ComposerLayer[]) {
  return layers
    .filter((layer) => layer.visible)
    .map((layer, index) => {
      const layerHeader = `% Layer ${index + 1}: ${layer.name} (${roleLabels[layer.role]})`;
      return `${layerHeader}\n${layer.abc.trim()}`;
    })
    .join("\n\n");
}

function LayerStackPreview({ abc, visibleCount }: { abc: string; visibleCount: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 p-5">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Visible layer stack
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Render the {visibleCount} visible ABC {visibleCount === 1 ? "track" : "tracks"} as a combined arrangement reference.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          Stack preview
        </span>
      </div>

      <div className="p-5 space-y-3">
        {visibleCount === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Turn on at least one layer to render the stack preview.
          </div>
        ) : (
          <MusicSheetRenderer
            abcString={abc}
            title="Visible Layer Music Sheet"
            canvasId="layer-stack-preview"
            controls={false}
            showLoopControls={false}
            minWidthClassName="min-w-[520px]"
          />
        )}
      </div>
    </div>
  );
}

function ArrangementPipelineGatePanel({
  activeLayer,
  pipeline,
  pipelineError,
  layerProposals,
  onRunPipeline,
  onAcceptLayer,
  onRejectLayer,
}: {
  activeLayer: ComposerLayer;
  pipeline: ArrangementPipelineResult | null;
  pipelineError: string | null;
  layerProposals: ArrangementLayerProposal[];
  onRunPipeline: () => void;
  onAcceptLayer: (proposal: ArrangementLayerProposal) => void;
  onRejectLayer: (proposalId: string) => void;
}) {
  const completedStages = new Set<ArrangementPipelineStageId>([
    "melody",
    ...(pipeline ? generatedPipelineStageIds : []),
  ]);
  const gates = getArrangementPipelineStageGates(completedStages);
  const canRunPipeline = activeLayer.role === "melody";

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
          Ordered workflow
        </p>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Arrangement pipeline stage gates
        </h3>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The UI only opens downstream stages after the melody establishes harmonization, then accompaniment,
          then drums and additional instruments before the full track export.
        </p>
      </div>

      <ol className="mt-4 space-y-2">
        {gates.map((gate, index) => (
          <li
            key={gate.id}
            data-testid={`pipeline-gate-${gate.id}`}
            className="rounded-xl border border-white/70 bg-white/80 p-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  {index + 1}. {gate.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {gate.description}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                  gate.state === "complete"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : gate.state === "available"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {gate.state === "complete" ? "Complete" : gate.state === "available" ? "Available" : "Locked"}
              </span>
            </div>
            {gate.blockedBy.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Blocked by: {gate.blockedBy.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRunPipeline}
          disabled={!canRunPipeline}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run ordered pipeline
        </button>
        {!canRunPipeline && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select a melody layer before generating downstream stages.
          </p>
        )}
      </div>

      {pipelineError && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
          {pipelineError}
        </p>
      )}

      {pipeline && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
          <p className="font-semibold">Full track ABC is ready after the ordered stage gates completed.</p>
          <p className="mt-1 text-xs">
            {pipeline.harmonization.progression.join(" | ")} · {pipeline.accompaniment.layer.instrument} · {pipeline.fullTrackExpansion.frequencyPlan.length} range lanes
          </p>
        </div>
      )}

      {layerProposals.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white/90 p-3 dark:border-amber-900/60 dark:bg-zinc-900/80">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Generated Composer layers
          </h4>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Accept a generated stage into the editable layer stack, or reject it to keep the current arrangement unchanged.
          </p>

          <div className="mt-3 space-y-2">
            {layerProposals.map((proposal) => (
              <div
                key={proposal.id}
                data-testid={`pipeline-layer-${proposal.id}`}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{proposal.name}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {roleLabels[proposal.role]} · editable ABC layer
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onAcceptLayer(proposal)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-700"
                    >
                      Accept {proposal.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectLayer(proposal.id)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 transition-all hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Reject {proposal.name}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FingerstyleIntegrationPanel({
  activeLayer,
  selectedProfileId,
  integration,
  error,
  onProfileChange,
  onGenerate,
  onAcceptLayer,
}: {
  activeLayer: ComposerLayer;
  selectedProfileId: FingerstyleComposerProfileId;
  integration: FingerstyleComposerIntegration | null;
  error: string | null;
  onProfileChange: (profileId: FingerstyleComposerProfileId) => void;
  onGenerate: () => void;
  onAcceptLayer: () => void;
}) {
  const canGenerate = activeLayer.role === "melody";

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
          Fingerstyle output
        </p>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Fingerstyle Composer integration
        </h3>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Generate a solo-guitar layer from the active melody, inspect playability, then accept the result into
          the Composer stack with synchronized fretboard and hand-overlay events.
        </p>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Fingerstyle picking profile
        </span>
        <select
          aria-label="Fingerstyle picking profile"
          value={selectedProfileId}
          onChange={(event) => onProfileChange(event.target.value as FingerstyleComposerProfileId)}
          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-900/70 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {FINGERSTYLE_PROFILE_OPTIONS.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate fingerstyle output
        </button>
        {!canGenerate && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select a melody layer before generating fingerstyle output.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      )}

      {integration && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
            <p className="font-semibold">{integration.playability.status}</p>
            <p className="mt-1 text-xs">
              Max fret span: {integration.playability.maxFretSpan} frets · {integration.handOverlayEvents.length} visual events
            </p>
            {integration.playability.failedConstraints.length > 0 && (
              <p className="mt-1 text-xs">
                Review: {integration.playability.failedConstraints.join(", ")}
              </p>
            )}
          </div>

          <GuitarFretboard
            title="Fingerstyle visual inspection"
            subtitle={`${integration.selectedProfile.label} · synchronized fretboard and hand overlay`}
            positions={integration.fretboard.positions}
            handOverlayEvents={integration.handOverlayEvents.slice(0, 1)}
            className="bg-white/90 dark:bg-zinc-950/70"
          />

          <button
            type="button"
            onClick={onAcceptLayer}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
          >
            Accept Fingerstyle Guitar
          </button>
        </div>
      )}
    </div>
  );
}

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
              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Active layer name
                </span>
                <input
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
