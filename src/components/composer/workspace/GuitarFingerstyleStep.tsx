import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { prepareAbcjsRenderInput } from "@/components/music-sheet/abcjs-playback/render-input";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import type { AccompanimentPreviewModel } from "./arrangement-preview-model";
import { convertAbcToTimeSliceGrid, groupMeasuresByLine, type TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { FingerstyleLineCard } from "./FingerstyleLineCard";
import {
  createFingerstyleLineGenerationCoordinator,
  mergeGeneratedFingerstyleLineMeasures,
} from "./fingerstyle-line-measures";
import { COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import { applyAbcLayerVisibility, applyAbcLayerVolumes, isAbcLayerVisible, ABC_LAYER_IDS, cleanAbcForExport } from "@/lib/theory/abc-layer-visibility";
import { getArrangementRenderOptionsFor, buildArrangementSynthOptions } from "./arrangement-preview-model";
import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import { fingerprintAccompanimentSource, getSelectedWorkflowOption } from "@/lib/theory/accompaniment-workflow";
import { getComposerFingerstyleMeasuresStorageKey } from "./storage";
import { formatFingerstyleTablatureAsToon } from "@/lib/theory/fingerstyle-arranger/llm-codec";
import { formatLineAsToon, renderCombinedAsciiGuitarTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { analyzeAuthoritativeMelodyPlayability } from "@/lib/theory/fingerstyle-arranger/source-playability";
import {
  formatImportedTimeGridDocumentCompact,
  parseImportedTimeGridDocumentCompact,
} from "@/lib/theory/fingerstyle-arranger/timegrid-document-codec";
import type {
  FingerstyleLineGenerationRun,
  PreviousLineContext,
} from "@/app/actions/fingerstyle-line-arranger";
import { buildGeneratedGuitarAbc } from "@/lib/theory/fingerstyle-arranger/guitar-abc-output";
import {
  restoreFingerstyleGenerationRuns,
  restorePersistedTablature,
  serializeFingerstyleMeasures,
} from "./fingerstyle-measure-persistence";

interface GuitarFingerstyleStepProps {
  slug: string;
  activeAbc: string;
  hasMounted: boolean;
  isWorkspaceHydrated: boolean;
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
  hasMounted,
  isWorkspaceHydrated,
  workflowAppliedMusicAbc,
  accompanimentPreview,
  accompLayerVisibility,
  setAccompLayerVisibility,
  accompLayerVolumes,
  setAccompLayerVolumes,
  ws,
  updateState,
}: GuitarFingerstyleStepProps) {
  const fingerstyleStorageKey = getComposerFingerstyleMeasuresStorageKey(slug);
  const sourceFingerprint = useMemo(
    () => fingerprintAccompanimentSource(workflowAppliedMusicAbc),
    [workflowAppliedMusicAbc],
  );
  const [measures, setMeasures] = useState<TimeSliceMeasure[]>([]);
  const [lineGenerationRunsByLine, setLineGenerationRunsByLine] = useState<Record<number, FingerstyleLineGenerationRun>>({});
  const [restoredSourceFingerprint, setRestoredSourceFingerprint] = useState<string | null>(null);
  const [timeGridJson, setTimeGridJson] = useState("");
  const [timeGridMessage, setTimeGridMessage] = useState<string | null>(null);
  const [generatingLineIndexes, setGeneratingLineIndexes] = useState<Set<number>>(() => new Set());
  const [generationCoordinator] = useState(() => createFingerstyleLineGenerationCoordinator());
  const timeGridFileInputRef = useRef<HTMLInputElement>(null);
  const refreshGeneratingLines = useCallback(() => {
    setGeneratingLineIndexes(new Set(generationCoordinator.activeLineIndexes()));
  }, [generationCoordinator]);
  const invalidateLineGenerations = useCallback(() => {
    generationCoordinator.invalidateDocument();
    refreshGeneratingLines();
  }, [generationCoordinator, refreshGeneratingLines]);
  const timeGridOptions = useMemo(() => {
    const workflow = ws.accompanimentWorkflow;
    const compingOpt = workflow ? getSelectedWorkflowOption(workflow, "guitar-comping-profile") : undefined;
    const voicingOpt = workflow ? getSelectedWorkflowOption(workflow, "guitar-voicing-bass") : undefined;
    return {
      comping_style: compingOpt ? (compingOpt.data?.compingProfile as string) || compingOpt.label : undefined,
      voicing_plan: voicingOpt ? (voicingOpt.data?.voicingPlan as string) || voicingOpt.label : undefined,
    };
  }, [ws.accompanimentWorkflow]);
  const compileFreshMeasures = useCallback((rawAbc: string) => (
    convertAbcToTimeSliceGrid(rawAbc, [], timeGridOptions)
  ), [timeGridOptions]);

  useEffect(() => {
    if (!hasMounted || !isWorkspaceHydrated || !workflowAppliedMusicAbc.trim()) return;

    try {
      const freshMeasures = compileFreshMeasures(workflowAppliedMusicAbc);
      const melodyPlayability = analyzeAuthoritativeMelodyPlayability(
        freshMeasures,
        ws.fingerstyleGenerationSettings.skillLevel,
      );
      const restoredMeasures = restorePersistedTablature(
        localStorage.getItem(fingerstyleStorageKey),
        freshMeasures,
        sourceFingerprint,
        {
          skillLevel: ws.fingerstyleGenerationSettings.skillLevel,
          maxMelodyFret: melodyPlayability.melodyMaxFret,
        },
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore is intentionally gated on both local-storage hydration phases.
      invalidateLineGenerations();
      setMeasures(restoredMeasures);
      setLineGenerationRunsByLine(restoreFingerstyleGenerationRuns(
        localStorage.getItem(fingerstyleStorageKey),
        freshMeasures,
        sourceFingerprint,
      ));
      setRestoredSourceFingerprint(sourceFingerprint);
    } catch (e) {
      console.error("Failed to restore fingerstyle measures", e);
      invalidateLineGenerations();
      setMeasures([]);
      setLineGenerationRunsByLine({});
      setRestoredSourceFingerprint(sourceFingerprint);
    }
  }, [
    compileFreshMeasures,
    fingerstyleStorageKey,
    invalidateLineGenerations,
    hasMounted,
    isWorkspaceHydrated,
    sourceFingerprint,
    workflowAppliedMusicAbc,
    ws.accompanimentWorkflow,
    ws.fingerstyleGenerationSettings.skillLevel,
  ]);

  // Save the authoritative structured measures and derive workspace Guitar ABC from them.
  useEffect(() => {
    if (restoredSourceFingerprint !== sourceFingerprint || measures.length === 0) return;

    try {
      localStorage.setItem(
        fingerstyleStorageKey,
        serializeFingerstyleMeasures(measures, sourceFingerprint, lineGenerationRunsByLine),
      );
      const generatedGuitar = buildGeneratedGuitarAbc(measures, workflowAppliedMusicAbc);
      if (ws.generatedGuitar !== generatedGuitar) updateState({ generatedGuitar });
    } catch (e) {
      console.error("Failed to sync generated guitar to workspace state", e);
    }
  }, [
    fingerstyleStorageKey,
    measures,
    lineGenerationRunsByLine,
    restoredSourceFingerprint,
    sourceFingerprint,
    updateState,
    workflowAppliedMusicAbc,
    ws.generatedGuitar,
  ]);

  const isFingerstyleReady = restoredSourceFingerprint === sourceFingerprint;

  // Never expose measures from a previous source while the current source restores.
  const lineGroups = useMemo(
    () => isFingerstyleReady ? groupMeasuresByLine(measures) : [],
    [isFingerstyleReady, measures],
  );
  // This baseline intentionally never carries the selected option's tablature.
  // Server-side option reconstruction must compare against it, not the mutable arrangement.
  const sourceLineGroups = useMemo(() => {
    if (!isFingerstyleReady) return [];
    try {
      return groupMeasuresByLine(compileFreshMeasures(workflowAppliedMusicAbc));
    } catch {
      return [];
    }
  }, [compileFreshMeasures, isFingerstyleReady, workflowAppliedMusicAbc]);

  const claimGeneration = useCallback((lineIndex: number) => {
    const claim = generationCoordinator.claim(lineIndex);
    if (claim) refreshGeneratingLines();
    return claim;
  }, [generationCoordinator, refreshGeneratingLines]);

  const releaseGeneration = useCallback((claim: Parameters<typeof generationCoordinator.release>[0]) => {
    generationCoordinator.release(claim);
    refreshGeneratingLines();
  }, [generationCoordinator, refreshGeneratingLines]);

  // A completed request may alter only its own still-current line. Other lines can
  // finish independently without invalidating this job's source snapshot.
  const applyGeneratedMeasures = useCallback((
    claim: Parameters<typeof generationCoordinator.canApply>[0],
    updated: TimeSliceMeasure[],
  ) => {
    if (!generationCoordinator.canApply(claim)) return false;
    if (!mergeGeneratedFingerstyleLineMeasures(measures, claim.lineIndex, updated)) return false;

    generationCoordinator.markLineApplied(claim.lineIndex);
    setMeasures(previous => (
      mergeGeneratedFingerstyleLineMeasures(previous, claim.lineIndex, updated) ?? previous
    ));
    return true;
  }, [generationCoordinator, measures]);

  const updateLineGenerationRun = useCallback((lineIndex: number, run: FingerstyleLineGenerationRun | null) => {
    setLineGenerationRunsByLine(previous => {
      if (!run) {
        const { [lineIndex]: _removed, ...remaining } = previous;
        return remaining;
      }
      return { ...previous, [lineIndex]: run };
    });
  }, []);

  // Build previous-line context for a given lineGroupIndex
  const buildPreviousLineContext = useCallback((lineGroupIndex: number): PreviousLineContext[] => {
    const context: PreviousLineContext[] = [];
    // Continuity is deliberately compact: the immediately preceding rendered line
    // supplies a useful hand/phrase landing without flooding the LLM transcript.
    for (let i = Math.max(0, lineGroupIndex - 1); i < lineGroupIndex; i++) {
      const lineMeasures = lineGroups[i];
      if (!lineMeasures || lineMeasures.length === 0) continue;
      context.push({
        lineIndex: lineMeasures[0].lineIndex,
        inputToon: formatLineAsToon(lineMeasures, { tablature: "omit" }),
        outputToon: formatFingerstyleTablatureAsToon(lineMeasures),
      });
    }
    return context;
  }, [lineGroups]);

  const masterAbcWithoutTab = useMemo(() => {
    if (!isFingerstyleReady) return "";
    const baseInputAbc = accompanimentPreview.rawAbc || activeAbc;
    if (measures.length > 0) {
      try {
        const generatedGuitar = buildGeneratedGuitarAbc(measures, workflowAppliedMusicAbc);
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
  }, [
    accompLayerVisibility,
    accompLayerVolumes,
    accompanimentPreview.rawAbc,
    activeAbc,
    isFingerstyleReady,
    measures,
    workflowAppliedMusicAbc,
  ]);

  const masterTabEnabled = isAbcLayerVisible(ABC_LAYER_IDS.tab, accompLayerVisibility, false);
  const masterAbc = masterAbcWithoutTab;
  const masterAbcjsRenderInput = useMemo(
    () => prepareAbcjsRenderInput({ abcString: masterAbc, tablatureEnabled: masterTabEnabled }),
    [masterAbc, masterTabEnabled],
  );
  const masterAsciiGuitarTab = useMemo(
    () => renderCombinedAsciiGuitarTab(measures),
    [measures],
  );
  const generationSettings = ws.fingerstyleGenerationSettings;
  const timeGridDocumentJson = useMemo(() => (
    measures.length > 0
      ? formatImportedTimeGridDocumentCompact({
        version: 1,
        source: { rawAbc: workflowAppliedMusicAbc },
        measures,
      })
      : ""
  ), [measures, workflowAppliedMusicAbc]);

  const applyTimeGridDocument = useCallback((payload: string) => {
    try {
      const imported = parseImportedTimeGridDocumentCompact(payload);
      if (imported.source.rawAbc !== workflowAppliedMusicAbc) {
        throw new Error("This TimeGrid source does not match the current workflow-applied melody. Import it from the matching song and arrangement source.");
      }
      const freshMeasures = compileFreshMeasures(workflowAppliedMusicAbc);
      const melodyPlayability = analyzeAuthoritativeMelodyPlayability(
        freshMeasures,
        generationSettings.skillLevel,
      );
      const restored = restorePersistedTablature(
        serializeFingerstyleMeasures(imported.measures, sourceFingerprint),
        freshMeasures,
        sourceFingerprint,
        {
          skillLevel: generationSettings.skillLevel,
          maxMelodyFret: melodyPlayability.melodyMaxFret,
        },
      );
      const importedHasTablature = imported.measures.some(measure => (
        measure.grid.some(step => step.tablature !== undefined)
      ));
      const restoredHasTablature = restored.some(measure => (
        measure.grid.some(step => step.tablature !== undefined)
      ));
      if (importedHasTablature && !restoredHasTablature) {
        throw new Error("The TimeGrid contains invalid, stale, or physically unplayable tablature and was not applied.");
      }
      invalidateLineGenerations();
      setMeasures(restored);
      setLineGenerationRunsByLine({});
      setTimeGridMessage(`Imported ${restored.length} TimeGrid measure${restored.length === 1 ? "" : "s"}.`);
      setTimeGridJson("");
    } catch (error) {
      setTimeGridMessage(error instanceof Error ? error.message : "Unable to import TimeGrid JSON.");
    }
  }, [compileFreshMeasures, generationSettings.skillLevel, invalidateLineGenerations, sourceFingerprint, workflowAppliedMusicAbc]);

  const downloadTimeGridDocument = useCallback(() => {
    if (!timeGridDocumentJson) return;
    const url = URL.createObjectURL(new Blob([timeGridDocumentJson], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-fingerstyle-timegrid.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [slug, timeGridDocumentJson]);

  const importTimeGridFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      applyTimeGridDocument(await file.text());
    } catch {
      setTimeGridMessage("Unable to read the selected TimeGrid JSON file.");
    }
  }, [applyTimeGridDocument]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Guitar Fingerstyle — Line by Line</h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Generate the arrangement line by line. Each line sees previous context and the next melody entrance while deterministic scoring exposes every legal fill choice.
        </p>

        <div className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Player skill
            <select
              value={generationSettings.skillLevel}
              disabled={generatingLineIndexes.size > 0}
              onChange={(event) => updateState({
                fingerstyleGenerationSettings: {
                  ...generationSettings,
                  skillLevel: event.target.value as typeof generationSettings.skillLevel,
                },
              })}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Fill density
            <select
              value={generationSettings.densityMode}
              onChange={(event) => updateState({
                fingerstyleGenerationSettings: {
                  ...generationSettings,
                  densityMode: event.target.value as typeof generationSettings.densityMode,
                },
              })}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="auto">Auto (from skill)</option>
              <option value="none">None — melody and bass anchors only</option>
              <option value="few">Few</option>
              <option value="normal">Normal</option>
              <option value="many">Many</option>
            </select>
          </label>
          <p className="text-[11px] text-zinc-500 sm:col-span-2">
            Skill limits discretionary accompaniment and fills, including frets, hand span, and notes per figure. The authoritative melody is never transposed; a labelled melody-only fret exception is used when its exact pitch requires one. Density independently controls how many scored windows may be selected. Existing lines are not regenerated when these settings change.
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Canonical TimeGrid JSON</h3>
              <p className="text-[11px] text-zinc-500">timegrid-document:v3 · {sourceFingerprint.slice(0, 12)}… · {measures.length} measures. ABC and ASCII tab are generated projections.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton label="Copy TimeGrid JSON" text={timeGridDocumentJson} />
              <button type="button" onClick={downloadTimeGridDocument} disabled={!timeGridDocumentJson} className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">Download JSON</button>
              <button type="button" onClick={() => timeGridFileInputRef.current?.click()} disabled={generatingLineIndexes.size > 0} className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">Choose JSON</button>
              <input ref={timeGridFileInputRef} type="file" accept="application/json,.json" className="hidden" disabled={generatingLineIndexes.size > 0} onChange={(event) => void importTimeGridFile(event.target.files?.[0])} />
            </div>
          </div>
          <textarea
            aria-label="Paste TimeGrid JSON"
            value={timeGridJson}
            disabled={generatingLineIndexes.size > 0}
            onChange={event => setTimeGridJson(event.target.value)}
            placeholder="Paste a timegrid-document:v3 export to import validated tablature over this exact source."
            className="mt-3 min-h-20 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500">Only compatible tablature is applied. Source melody, timing, chords, and barlines remain locked to the workflow source.</p>
            <button type="button" onClick={() => applyTimeGridDocument(timeGridJson)} disabled={generatingLineIndexes.size > 0 || !timeGridJson.trim()} className="rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Import JSON</button>
          </div>
          {timeGridMessage && <p className="mt-2 text-[11px] text-indigo-700 dark:text-indigo-300">{timeGridMessage}</p>}
        </section>

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
            <div className="flex items-center gap-2">
              {masterAbc && (
                <CopyButton label="Copy ABCJS ABC" text={masterAbcjsRenderInput} />
              )}
              {masterAbc && (
                <CopyButton label="Copy portable ABC" text={cleanAbcForExport(masterAbc)} />
              )}
              {masterAbc && (
                <CopyAsciiGuitarTabButton label="Copy ASCII-GuitarTab" text={masterAsciiGuitarTab} />
              )}
            </div>
          </div>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 p-2 overflow-hidden">
            {isFingerstyleReady ? (
              <AbcjsPlaybackController
                abcString={masterAbc}
                title="Master Fingerstyle Arrangement"
                canvasId="composer-master-guitar-preview"
                minWidthClassName="min-w-[520px]"
                sheetViewportClassName="max-h-[800px] overflow-auto"
                useContainerWidth={true}
                hideVoiceNames={true}
                showExactRenderAbcCopy={true}
                renderOptions={getArrangementRenderOptionsFor(masterAbc, COMPOSER_PREVIEW_RENDER_OPTIONS, masterTabEnabled)}
                synthOptions={buildArrangementSynthOptions(accompLayerVisibility, masterAbc)}
              />
            ) : (
              <div className="flex min-h-32 items-center justify-center text-sm text-zinc-500">
                Restoring the saved fingerstyle arrangement…
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Line cards */}
      <div className="space-y-6">
        {lineGroups.map((lineMeasures, lineGroupIdx) => (
          <FingerstyleLineCard
            key={`line-${lineMeasures[0]?.lineIndex ?? lineGroupIdx}`}
            songSlug={slug}
            sourceFingerprint={sourceFingerprint}
            lineIndex={lineMeasures[0]?.lineIndex ?? lineGroupIdx}
            sourceLineMeasures={sourceLineGroups[lineGroupIdx] ?? lineMeasures}
            lineMeasures={lineMeasures}
            activeAbc={workflowAppliedMusicAbc}
            accompLayerVisibility={accompLayerVisibility}
            buildPreviousContext={() => buildPreviousLineContext(lineGroupIdx)}
            workflowAppliedMusicAbc={workflowAppliedMusicAbc}
            generationSettings={generationSettings}
            generationRun={lineGenerationRunsByLine[lineMeasures[0]?.lineIndex ?? lineGroupIdx]}
            onGenerationRunChange={updateLineGenerationRun}
            previousLineMeasures={lineGroups[lineGroupIdx - 1]}
            nextLineMeasures={lineGroups[lineGroupIdx + 1]}
            generationLock={{
              isGenerating: generatingLineIndexes.has(lineMeasures[0]?.lineIndex ?? lineGroupIdx),
              claim: claimGeneration,
              release: releaseGeneration,
              apply: applyGeneratedMeasures,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded cursor-pointer whitespace-nowrap"
    >
      {copied ? (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export function CopyAsciiGuitarTabButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded cursor-pointer whitespace-nowrap"
    >
      {copied ? (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
