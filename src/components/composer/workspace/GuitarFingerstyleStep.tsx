import { useState, useMemo, useEffect, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import type { AccompanimentPreviewModel } from "./arrangement-preview-model";
import { convertAbcToTimeSliceGrid, groupMeasuresByLine, type TimeSliceMeasure, joinMeasureAbcWithBarlines } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { FingerstyleLineCard } from "./FingerstyleLineCard";
import { COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";
import { buildAbcDurationContext } from "@/lib/theory/abc-duration";
import { convertTimeSliceMeasureToAbc } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { getKeyAccidentalsFromAbc } from "@/lib/theory/abc-key-signature";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import { applyAbcLayerVisibility, applyAbcLayerVolumes, isAbcLayerVisible, ABC_LAYER_IDS, cleanAbcForExport } from "@/lib/theory/abc-layer-visibility";
import { getArrangementRenderOptionsFor, buildArrangementSynthOptions } from "./arrangement-preview-model";
import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import { getSelectedWorkflowOption } from "@/lib/theory/accompaniment-workflow";
import { getComposerSongStoragePrefix } from "./storage";
import { formatLineAsToon } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import type { PreviousLineContext } from "@/app/actions/fingerstyle-line-arranger";

interface GuitarFingerstyleStepProps {
  slug: string;
  activeAbc: string;
  hasMounted: boolean;
  pipeline: ArrangementPipelineResult | null;
  workflowAppliedMusicAbc: string;
  accompanimentPreview: AccompanimentPreviewModel;
  accompLayerVisibility: Record<string, boolean>;
  setAccompLayerVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  accompLayerVolumes: Record<string, number>;
  setAccompLayerVolumes: Dispatch<SetStateAction<Record<string, number>>>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
  canResetGuitarBranchWork: boolean;
  onResetGuitarBranchWork: () => void;
}

export function GuitarFingerstyleStep({
  slug,
  activeAbc,
  workflowAppliedMusicAbc,
  accompanimentPreview,
  accompLayerVisibility,
  setAccompLayerVisibility,
  accompLayerVolumes,
  setAccompLayerVolumes,
  ws,
  updateState,
}: GuitarFingerstyleStepProps) {
  const fingerstyleStorageKey = `${getComposerSongStoragePrefix(slug)}fingerstyle-measures`;
  const [measures, setMeasures] = useState<TimeSliceMeasure[]>([]);
  const [copiedMasterAbc, setCopiedMasterAbc] = useState(false);
  const [generatingLineIndex, setGeneratingLineIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const workflow = ws.accompanimentWorkflow;
      let compingStyle: string | undefined;
      let voicingPlan: string | undefined;
      let fillDensity: string | undefined;

      if (workflow) {
        const compingOpt = getSelectedWorkflowOption(workflow, "guitar-comping-profile");
        const voicingOpt = getSelectedWorkflowOption(workflow, "guitar-voicing-bass");
        const fillsOpt = getSelectedWorkflowOption(workflow, "guitar-fills-validation");
        if (compingOpt) compingStyle = (compingOpt.data?.compingProfile as string) || compingOpt.label;
        if (voicingOpt) voicingPlan = (voicingOpt.data?.voicingPlan as string) || voicingOpt.label;
        if (fillsOpt) fillDensity = (fillsOpt.data?.fillDensity as string) || undefined;
      }

      const options = { comping_style: compingStyle, voicing_plan: voicingPlan, fill_density: fillDensity };

      // Try loading from localStorage first
      const saved = localStorage.getItem(fingerstyleStorageKey);
      if (saved) {
        const parsedMeasures = JSON.parse(saved);
        const newParsed = convertAbcToTimeSliceGrid(workflowAppliedMusicAbc, [], options);
        if (parsedMeasures.length === newParsed.length) {
          const updatedMeasures = parsedMeasures.map((pm: TimeSliceMeasure, idx: number) => {
            const fresh = newParsed[idx];
            if (!fresh) return pm;
            return {
              ...pm,
              lineIndex: fresh.lineIndex,
              style_profile: fresh.style_profile,
              pickupDurationUnits: fresh.pickupDurationUnits,
              barline: fresh.barline,
              grid: pm.grid.map((step: TimeSliceMeasure["grid"][number], stepIdx: number) => {
                const freshStep = fresh.grid[stepIdx];
                return {
                  ...step,
                  chord: freshStep ? freshStep.chord : step.chord,
                  weight: freshStep ? freshStep.weight : step.weight,
                  melody: freshStep ? freshStep.melody : step.melody,
                  lyric: freshStep ? freshStep.lyric : step.lyric,
                };
              }),
            };
          });
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMeasures(updatedMeasures);
          return;
        }
      }
      
      const parsed = convertAbcToTimeSliceGrid(workflowAppliedMusicAbc, [], options);
      setMeasures(parsed);
    } catch (e) {
      console.error("Failed to parse measures", e);
    }
  }, [workflowAppliedMusicAbc, ws.accompanimentWorkflow, fingerstyleStorageKey]);

  // Save to localStorage and sync to workspace state whenever measures change
  useEffect(() => {
    if (measures.length > 0) {
      localStorage.setItem(fingerstyleStorageKey, JSON.stringify(measures));
      try {
        const baseInputAbc = accompanimentPreview.rawAbc || activeAbc;
        const durationContext = buildAbcDurationContext(baseInputAbc);
        const keyAccidentals = getKeyAccidentalsFromAbc(baseInputAbc);
        const tablatureAbcList = measures.map(m => convertTimeSliceMeasureToAbc(m, durationContext, keyAccidentals));
        const tablatureLines = joinMeasureAbcWithBarlines(tablatureAbcList, measures);
        const generatedGuitar = [
          'V:Guitar clef=treble-8 name="Fingerstyle Tablature"',
          "%%MIDI program 24",
          tablatureLines,
        ].join("\n");
        updateState({ generatedGuitar });
      } catch (e) {
        console.error("Failed to sync generated guitar to workspace state", e);
      }
    }
  }, [measures, activeAbc, accompanimentPreview.rawAbc, updateState]);

  // Group measures by line
  const lineGroups = useMemo(() => groupMeasuresByLine(measures), [measures]);

  // Handle updates from a line card (replace all measures in that line)
  const handleUpdateLineMeasures = useCallback((lineGroupIndex: number, updated: TimeSliceMeasure[]) => {
    setMeasures(prev => {
      const next = [...prev];
      for (const m of updated) {
        const idx = next.findIndex(existing => existing.measure === m.measure);
        if (idx !== -1) next[idx] = m;
      }
      return next;
    });
  }, []);

  // Build previous-line context for a given lineGroupIndex
  const buildPreviousLineContext = useCallback((lineGroupIndex: number): PreviousLineContext[] => {
    const context: PreviousLineContext[] = [];
    for (let i = 0; i < lineGroupIndex; i++) {
      const lineMeasures = lineGroups[i];
      if (!lineMeasures || lineMeasures.length === 0) continue;
      context.push({
        lineIndex: lineMeasures[0].lineIndex,
        inputToon: formatLineAsToon(lineMeasures.map(m => ({
          ...m,
          grid: m.grid.map(s => ({ ...s, tablature: undefined }))
        }))),
        outputToon: formatLineAsToon(lineMeasures),
      });
    }
    return context;
  }, [lineGroups]);

  const masterAbc = useMemo(() => {
    const baseInputAbc = accompanimentPreview.rawAbc || activeAbc;
    if (measures.length > 0) {
      try {
        const durationContext = buildAbcDurationContext(baseInputAbc);
        const keyAccidentals = getKeyAccidentalsFromAbc(baseInputAbc);
        const tablatureAbcList = measures.map(m => convertTimeSliceMeasureToAbc(m, durationContext, keyAccidentals));
        const tablatureLines = joinMeasureAbcWithBarlines(tablatureAbcList, measures);
        const generatedGuitar = [
          'V:Guitar clef=treble-8 name="Fingerstyle Tablature"',
          "%%MIDI program 24",
          tablatureLines,
        ].join("\n");
        const strippedAbc = applyAbcLayerVisibility(baseInputAbc, {
          "Melody": true, "Piano": true, "Harmonium": true, "Flute": true,
          "Djembe": true, "Violin": true, "Guitar": false, "Lyrics": true,
          "ChordProgression": true, "StrongBeats": true,
        });
        const buildResult = buildAccompanimentAbc({
          baseAbc: strippedAbc,
          generatedGuitar,
          layerVisibility: {
            ...accompLayerVisibility,
            __melody__: isAbcLayerVisible("Melody", accompLayerVisibility, true),
            __chords__: isAbcLayerVisible("ChordProgression", accompLayerVisibility, true),
            __strong_beats__: isAbcLayerVisible("StrongBeats", accompLayerVisibility, true),
          },
        });
        return applyAbcLayerVolumes(buildResult.abc, accompLayerVolumes);
      } catch (e) {
        console.error("Failed to inject generated guitar", e);
      }
    }
    return applyAbcLayerVisibility(applyAbcLayerVolumes(baseInputAbc, accompLayerVolumes), accompLayerVisibility);
  }, [measures, activeAbc, accompanimentPreview.rawAbc, accompLayerVisibility, accompLayerVolumes]);

  const handleCopyMasterAbc = () => {
    if (masterAbc) {
      navigator.clipboard.writeText(cleanAbcForExport(masterAbc));
      setCopiedMasterAbc(true);
      setTimeout(() => setCopiedMasterAbc(false), 2000);
    }
  };

  const masterTabEnabled = isAbcLayerVisible(ABC_LAYER_IDS.tab, accompLayerVisibility, false);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Guitar Fingerstyle — Line by Line</h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Generate the arrangement line by line. Each line sees the context of all previous lines for musical consistency.
        </p>

        <section className="mb-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 font-sans">Layer Visibility</h2>
          <LayerVisibilityControls
            items={accompanimentPreview.layerVisibilityItems}
            visibility={accompLayerVisibility}
            onVisibilityChange={setAccompLayerVisibility}
            volumes={accompLayerVolumes}
            onVolumeChange={setAccompLayerVolumes}
          />
        </section>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Master Playback</h3>
            {masterAbc && (
              <button
                type="button"
                onClick={handleCopyMasterAbc}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded cursor-pointer"
              >
                {copiedMasterAbc ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied to Clipboard!</span>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 p-2 overflow-hidden">
            <AbcjsPlaybackController
              abcString={masterAbc}
              title="Master Fingerstyle Arrangement"
              canvasId="composer-master-guitar-preview"
              minWidthClassName="min-w-[520px]"
              sheetViewportClassName="max-h-[800px] overflow-auto"
              useContainerWidth={true}
              hideVoiceNames={true}
              renderOptions={getArrangementRenderOptionsFor(masterAbc, COMPOSER_PREVIEW_RENDER_OPTIONS, masterTabEnabled)}
              synthOptions={buildArrangementSynthOptions(accompLayerVisibility, masterAbc)}
            />
          </div>
        </div>
      </section>

      {/* Line cards */}
      <div className="space-y-6">
        {lineGroups.map((lineMeasures, lineGroupIdx) => (
          <FingerstyleLineCard
            key={`line-${lineMeasures[0]?.lineIndex ?? lineGroupIdx}`}
            lineIndex={lineMeasures[0]?.lineIndex ?? lineGroupIdx}
            lineMeasures={lineMeasures}
            activeAbc={workflowAppliedMusicAbc}
            onUpdateMeasures={(updated) => handleUpdateLineMeasures(lineGroupIdx, updated)}
            accompLayerVisibility={accompLayerVisibility}
            buildPreviousContext={() => buildPreviousLineContext(lineGroupIdx)}
            workflowAppliedMusicAbc={workflowAppliedMusicAbc}
            isAnotherLineGenerating={generatingLineIndex !== null && generatingLineIndex !== lineGroupIdx}
          />
        ))}
      </div>
    </div>
  );
}
