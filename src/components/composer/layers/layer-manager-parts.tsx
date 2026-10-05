import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import GuitarFretboard from "@/components/instruments/GuitarFretboard";
import { getArrangementPipelineStageGates } from "@/lib/theory/arrangement-pipeline";
import type {
  ArrangementLayerProposal,
  ArrangementPipelineResult,
  ArrangementPipelineStageId,
} from "@/lib/theory/arrangement-pipeline";
import {
  FINGERSTYLE_PROFILE_OPTIONS,
  type FingerstyleComposerIntegration,
  type FingerstyleComposerProfileId,
} from "../fingerstyle-integration";

export const LAYERS_STORAGE_KEY = "bhajan-song-composer:composer:layers";
export const ROLE_OPTIONS = ["melody", "harmony", "bass", "rhythm", "custom"] as const;

export type LayerRole = (typeof ROLE_OPTIONS)[number];

export type ComposerLayer = {
  id: string;
  name: string;
  role: LayerRole;
  abc: string;
  visible: boolean;
};

export const DEFAULT_LAYERS: ComposerLayer[] = [
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

export const roleLabels: Record<LayerRole, string> = {
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

export function createLayerId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `layer-${Date.now().toString(36)}`;
}

export function safeParseLayers(raw: string | null): ComposerLayer[] | null {
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

export function combinedVisibleAbc(layers: ComposerLayer[]) {
  return layers
    .filter((layer) => layer.visible)
    .map((layer, index) => {
      const layerHeader = `% Layer ${index + 1}: ${layer.name} (${roleLabels[layer.role]})`;
      return `${layerHeader}\n${layer.abc.trim()}`;
    })
    .join("\n\n");
}

export function LayerStackPreview({ abc, visibleCount }: { abc: string; visibleCount: number }) {
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
          <AbcjsPlaybackController
            abcString={abc}
            title="Visible Layer Music Sheet"
            canvasId="layer-stack-preview"
            controls={false}
            showLoopControls={false}
            minWidthClassName="min-w-0"
          />
        )}
      </div>
    </div>
  );
}

export function ArrangementPipelineGatePanel({
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

export function FingerstyleIntegrationPanel({
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
          the Composer stack with synchronized fretboard and numbered note-marker events.
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
              Max fret span: {integration.playability.maxFretSpan} frets · {integration.noteMarkers.length} marker events
            </p>
            {integration.playability.failedConstraints.length > 0 && (
              <p className="mt-1 text-xs">
                Review: {integration.playability.failedConstraints.join(", ")}
              </p>
            )}
          </div>

          <GuitarFretboard
            title="Fingerstyle visual inspection"
            subtitle={`${integration.selectedProfile.label} · synchronized fretboard and note markers`}
            positions={integration.fretboard.positions}
            noteMarkers={integration.noteMarkers.slice(0, 1)}
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

