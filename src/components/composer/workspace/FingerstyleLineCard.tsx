import { Button } from "@/components/ui/Button";
import { useState, useMemo, useEffect, useCallback } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { prepareAbcjsRenderInput } from "@/components/music-sheet/abcjs-playback/render-input";
import { convertAbcToTimeSliceGrid, type TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { buildGeneratedGuitarAbc } from "@/lib/theory/fingerstyle-arranger/guitar-abc-output";
import { renderCombinedAsciiGuitarTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";
import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import { applyAbcLayerVisibility, isAbcLayerVisible, ABC_LAYER_IDS, cleanAbcForExport } from "@/lib/theory/abc-layer-visibility";
import { getArrangementRenderOptionsFor } from "./arrangement-preview-model";
import type {
  FingerstyleFillGenerationSummary,
  FingerstyleGenerationNotice,
  FingerstyleLineGenerationRun,
  PreviousLineContext,
} from "@/app/actions/fingerstyle-line-arranger";
import type { FingerstyleGenerationSettings } from "../useWorkspaceState";
import type { FingerstyleGenerationDiagnosticRun } from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";
import {
  formatAbcAsciiGuitarTabValidation,
  type AbcAsciiGuitarTabValidationResult,
} from "@/lib/theory/fingerstyle-arranger/abc-ascii-guitartab-validation";
import { analyzeAuthoritativeMelodyPlayability } from "@/lib/theory/fingerstyle-arranger/source-playability";
import {
  persistFingerstyleDiagnosticRun,
  restoreFingerstyleDiagnosticRuns,
} from "./fingerstyle-diagnostic-persistence";
import { getComposerFingerstyleDiagnosticsStorageKey } from "./storage";
import type { FingerstyleLineGenerationClaim } from "./fingerstyle-line-measures";

interface FingerstyleLineCardProps {
  compact?: boolean;
  songSlug: string;
  sourceFingerprint: string;
  lineIndex: number;
  /** Immutable TimeGrid source used to generate and safely rebuild fill variants. */
  sourceLineMeasures: TimeSliceMeasure[];
  /** Current rendered arrangement, including the selected option's tablature. */
  lineMeasures: TimeSliceMeasure[];
  activeAbc: string;
  accompLayerVisibility: Record<string, boolean>;
  /** Build cumulative context from all previous lines */
  buildPreviousContext: () => PreviousLineContext[];
  workflowAppliedMusicAbc: string;
  generationSettings: FingerstyleGenerationSettings;
  generationRun?: FingerstyleLineGenerationRun;
  onGenerationRunChange: (lineIndex: number, run: FingerstyleLineGenerationRun | null) => void;
  previousLineMeasures?: TimeSliceMeasure[];
  nextLineMeasures?: TimeSliceMeasure[];
  generationLock: {
    isGenerating: boolean;
    claim: (lineIndex: number) => FingerstyleLineGenerationClaim | null;
    release: (claim: FingerstyleLineGenerationClaim) => void;
    apply: (claim: FingerstyleLineGenerationClaim, measures: TimeSliceMeasure[]) => boolean;
  };
}

// ── Inline copy button ─────────────────────────────────────────────────

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <Button variant="ghost" size="sm"
      type="button"
      onClick={handleCopy}

    >
      {copied ? (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}

// ── Main line card ─────────────────────────────────────────────────────

export function FingerstyleLineCard({
  compact = false,
  songSlug,
  sourceFingerprint,
  lineIndex,
  sourceLineMeasures,
  lineMeasures,
  activeAbc,
  accompLayerVisibility,
  buildPreviousContext,
  workflowAppliedMusicAbc,
  generationSettings,
  generationRun,
  onGenerationRunChange,
  previousLineMeasures,
  nextLineMeasures,
  generationLock,
}: FingerstyleLineCardProps) {
  const measureNums = lineMeasures.map(m => m.measure);
  const [error, setError] = useState<string | null>(null);
  const [isSelectingOption, setIsSelectingOption] = useState(false);
  const isGenerating = generationLock.isGenerating || isSelectingOption;
  const [logs, setLogs] = useState<string[]>([]);
  const [fillSummary, setFillSummary] = useState<FingerstyleFillGenerationSummary | null>(null);
  const [notices, setNotices] = useState<FingerstyleGenerationNotice[]>([]);
  const [diagnosticRun, setDiagnosticRun] = useState<FingerstyleGenerationDiagnosticRun | null>(null);
  const diagnosticStorageKey = useMemo(
    () => getComposerFingerstyleDiagnosticsStorageKey(songSlug),
    [songSlug],
  );
  const melodyPlayability = useMemo(
    () => analyzeAuthoritativeMelodyPlayability(lineMeasures, generationSettings.skillLevel),
    [generationSettings.skillLevel, lineMeasures],
  );
  const isGenerateDisabled = isGenerating || !melodyPlayability.playable;

  useEffect(() => {
    let restored: FingerstyleGenerationDiagnosticRun[] = [];
    try {
      restored = restoreFingerstyleDiagnosticRuns(
        window.localStorage.getItem(diagnosticStorageKey),
        sourceFingerprint,
      );
    } catch {
      // Browser storage is best-effort; generation diagnostics remain available in memory.
    }
    const latestForLine = restored
      .filter(run => run.scope.lineIndex === lineIndex)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDiagnosticRun(latestForLine);
    setLogs(latestForLine?.plaintext ? [latestForLine.plaintext] : []);
    const summaryEvent = latestForLine?.events.findLast(event => (
      event.source === "workflow" && event.kind === "final-merge-validated"
    ));
    setFillSummary(
      summaryEvent?.source === "workflow" && summaryEvent.payloadPreview
        ? summaryEvent.payloadPreview as FingerstyleFillGenerationSummary
        : null,
    );
    const unavailableEvent = latestForLine?.events.findLast(event => (
      event.source === "workflow" && event.kind === "fill-stages-unavailable"
    ));
    const reason = unavailableEvent?.source === "workflow" && unavailableEvent.payloadPreview
      ? (unavailableEvent.payloadPreview as { reason?: FingerstyleGenerationNotice["reason"] }).reason
      : undefined;
    setNotices(reason ? [{ code: "fills-unavailable", severity: "warning", message: unavailableEvent!.message, reason }] : []);
  }, [diagnosticStorageKey, lineIndex, sourceFingerprint]);

  const parsedMeasures = useMemo(() => {
    try { return convertAbcToTimeSliceGrid(activeAbc, []); }
    catch { return []; }
  }, [activeAbc]);

  // Build the ABC preview for the whole line
  const lineAbcResult = useMemo(() => {
    try {
      // Use the same canonical TimeGrid → Guitar ABC projection as the full workspace
      // and /test-timegrid-to-abcnotation; the card never persists this line-only preview.
      const generatedGuitar = buildGeneratedGuitarAbc(lineMeasures, workflowAppliedMusicAbc);

      // Build a mini base ABC with just this line's melody measures
      const headerLines = activeAbc.split(/\r?\n/).filter(line => line.match(/^[A-Za-z]:/) && !line.startsWith("V:"));
      const miniBaseAbcLines = [...headerLines];

      const melodyParts: string[] = [];
      const lyricParts: string[] = [];
      const beatParts: string[] = [];
      for (const measure of lineMeasures) {
        const src = measure.source_abc || parsedMeasures[measure.measure - 1]?.source_abc;
        if (src) {
          melodyParts.push(src.melody);
          if (src.lyric) lyricParts.push(src.lyric);
          if (src.beatWeight) beatParts.push(src.beatWeight);
        }
      }
      miniBaseAbcLines.push(`| ${melodyParts.join(" | ")} |`);
      if (lyricParts.length > 0) miniBaseAbcLines.push(`w: ${lyricParts.join(" | ")}`);
      if (beatParts.length > 0) miniBaseAbcLines.push(`w: ${beatParts.join(" | ")}`);

      const miniBaseAbc = miniBaseAbcLines.join("\n");

      const result = buildAccompanimentAbc({
        baseAbc: miniBaseAbc,
        generatedGuitar,
        layerVisibility: {
          ...accompLayerVisibility,
          __melody__: isAbcLayerVisible("Melody", accompLayerVisibility, true),
          __chords__: isAbcLayerVisible("ChordProgression", accompLayerVisibility, true),
          __strong_beats__: isAbcLayerVisible("StrongBeats", accompLayerVisibility, true),
        },
      });

      return applyAbcLayerVisibility(result.abc, accompLayerVisibility);
    } catch (e) {
      console.error(e);
      return "";
    }
  }, [lineMeasures, workflowAppliedMusicAbc, activeAbc, accompLayerVisibility, parsedMeasures]);

  // Combined ASCII-GuitarTab for all measures in the line
  const combinedAsciiGuitarTab = useMemo(() => {
    return renderCombinedAsciiGuitarTab(lineMeasures);
  }, [lineMeasures]);

  const asciiGuitarTabValidationLog = useMemo(() => {
    const event = diagnosticRun?.events.findLast(candidate => (
      candidate.source === "workflow"
      && (candidate.kind === "abc-ascii-guitartab-validated" || candidate.kind === "abc-ascii-guitartab-rejected")
    ));
    if (!event || event.source !== "workflow" || !event.payloadPreview) return null;
    return formatAbcAsciiGuitarTabValidation(event.payloadPreview as AbcAsciiGuitarTabValidationResult);
  }, [diagnosticRun]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const generation = generationLock.claim(lineIndex);
    if (!generation) return;

    try {
      setError(null);
      setLogs([]);
      setFillSummary(null);
      setNotices([]);
      const { generateAIFingerstyleLine } = await import("@/app/actions/fingerstyle-line-arranger");
      const result = await generateAIFingerstyleLine({
        songSlug,
        sourceFingerprint,
        lineMeasures: sourceLineMeasures,
        previousLines: buildPreviousContext(),
        activeAbc: workflowAppliedMusicAbc,
        skillLevel: generationSettings.skillLevel,
        densityMode: generationSettings.densityMode,
        previousLineMeasures,
        nextLineMeasures,
      });
      setLogs(result.logs || []);
      setFillSummary(result.fillSummary ?? null);
      setNotices(result.notices ?? []);
      if (result.diagnostics) {
        setDiagnosticRun(result.diagnostics);
        persistFingerstyleDiagnosticRun({
          storage: window.localStorage,
          storageKey: diagnosticStorageKey,
          sourceFingerprint,
          run: result.diagnostics,
        });
      }
      if (result.success && result.measures) {
        const applied = generationLock.apply(generation, result.measures);
        if (!applied) setError("The source changed while this line was generating, so the stale result was not applied.");
        else onGenerationRunChange(lineIndex, result.generationRun ?? null);
      } else {
        setError(result.error || "AI Generation Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI Generation Failed");
    } finally {
      generationLock.release(generation);
    }
  }, [
    songSlug,
    sourceFingerprint,
    sourceLineMeasures,
    lineMeasures,
    buildPreviousContext,
    workflowAppliedMusicAbc,
    generationSettings,
    previousLineMeasures,
    nextLineMeasures,
    generationLock,
    lineIndex,
    onGenerationRunChange,
    diagnosticStorageKey,
  ]);

  const handleSelectOption = useCallback(async (optionId: string) => {
    if (!generationRun || optionId === generationRun.selectedOptionId) return;
    const generation = generationLock.claim(lineIndex);
    if (!generation) return;
    setIsSelectingOption(true);
    try {
      setError(null);
      const { selectAIFingerstyleLineOption } = await import("@/app/actions/fingerstyle-line-arranger");
      const result = await selectAIFingerstyleLineOption({
        sourceFingerprint,
        lineMeasures: sourceLineMeasures,
        activeAbc: workflowAppliedMusicAbc,
        generationRun,
        optionId,
      });
      if (!result.success || !result.measures || !result.selectedOptionId) {
        setError(result.error || "Unable to apply this fill option.");
        return;
      }
      if (!generationLock.apply(generation, result.measures)) {
        setError("The source changed while this option was applying, so the stale result was not applied.");
        return;
      }
      onGenerationRunChange(lineIndex, { ...generationRun, selectedOptionId: result.selectedOptionId });
      const option = generationRun.options.find(candidate => candidate.id === result.selectedOptionId);
      if (option) setFillSummary(option.fillSummary);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to apply this fill option.");
    } finally {
      generationLock.release(generation);
      setIsSelectingOption(false);
    }
  }, [generationLock, generationRun, lineIndex, sourceLineMeasures, onGenerationRunChange, sourceFingerprint, workflowAppliedMusicAbc]);

  const tabEnabled = isAbcLayerVisible(ABC_LAYER_IDS.tab, accompLayerVisibility, false);
  const abcjsRenderInput = useMemo(
    () => lineAbcResult
      ? prepareAbcjsRenderInput({ abcString: lineAbcResult, tablatureEnabled: tabEnabled })
      : "",
    [lineAbcResult, tabEnabled],
  );
  const fillOpportunityMarkers = useMemo(() => {
    if (!generationRun) return [];
    const localMeasureIndex = new Map(sourceLineMeasures.map((measure, index) => [measure.measure, index]));
    return (generationRun.opportunityAnalysis.windows ?? []).flatMap(window => {
      const measureIndex = localMeasureIndex.get(window.measure);
      const measure = sourceLineMeasures[measureIndex ?? -1];
      if (measureIndex === undefined || !measure?.grid.length) return [];
      return [{
        id: window.id,
        measureIndex,
        startFraction: (window.startStep - 1) / measure.grid.length,
        label: `Fill opportunity: measure ${window.measure}, steps ${window.startStep}–${window.endStep}`,
      }];
    });
  }, [generationRun, sourceLineMeasures]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
          Line {lineIndex + 1} — Measures {measureNums[0]}–{measureNums[measureNums.length - 1]}
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {generationRun?.options.map(option => {
            const isSelected = option.id === generationRun.selectedOptionId;
            return (
              <Button variant="secondary" size="sm"
                key={option.id}
                type="button"
                onClick={() => void handleSelectOption(option.id)}
                disabled={isGenerating}
                aria-pressed={isSelected}

              >
                Option {option.ordinal}
              </Button>
            );
          })}
          <Button variant="primary" size="md"
            type="button"
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            aria-busy={isGenerating}

          >
            <span>✨</span>
            {isGenerating ? "Generating Line..." : "Generate Line with AI"}
          </Button>
        </div>
      </div>

      <p className="mb-4 rounded-xl border border-indigo-200 bg-white/70 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
        {compact ? "Generate options, then choose the version you want to hear in the score." : "Melody attacks and rests stay pinned to the source. AI first reserves fill positions, then plans chord-derived bass positions and pitches, freezes the TimeGrid, and finally composes only post-bass legal fills."}
      </p>

      {generationRun?.options.length ? (
        <div className="mb-4 space-y-2" aria-label="Fill option justifications">
          {generationRun.options.map(option => (
            <article key={option.id} className={`rounded-xl border p-3 text-xs ${
              option.id === generationRun.selectedOptionId
                ? "border-amber-300 bg-amber-50/70 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
                : "border-indigo-200 bg-white/70 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-100"
            }`}>
              <h4 className="font-bold">Option {option.ordinal} — Why these choices</h4>
              {option.justification.positions.length > 0 ? (
                <div className="mt-2 space-y-1">
                  <div className="font-semibold">Position</div>
                  {option.justification.positions.map(position => (
                    <p key={position.windowId}>
                      M{position.measure}, steps {position.startStep}–{position.endStep} over {position.activeChord}: {position.reason}
                    </p>
                  ))}
                </div>
              ) : <p className="mt-2">No discretionary fill position was selected; this option keeps the validated bass foundation.</p>}
              {option.justification.notes.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="font-semibold">Pitches and durations</div>
                  {option.justification.notes.map(note => (
                    <p key={note.candidateId}>
                      {note.pitch} ({note.harmonicRole}), string {note.string} fret {note.fret}, {note.durationSteps} step{note.durationSteps === 1 ? "" : "s"}, {note.finger}: {note.reason}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {melodyPlayability.exceptions.length > 0 && (
        <details open={!compact} className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <summary className="cursor-pointer font-semibold">Melody requires higher frets · {melodyPlayability.exceptions.length} notes</summary>
          {melodyPlayability.exceptions.map(anchor => (
            <div key={`${anchor.measure}-${anchor.step}`}>
              {anchor.pitch} in measure {anchor.measure}, step {anchor.step} requires string {anchor.preferredPosition.string} fret {anchor.preferredPosition.fret}. Accompaniment and fills remain {generationSettings.skillLevel}-limited to fret {melodyPlayability.accompanimentMaxFret}.
            </div>
          ))}
        </details>
      )}
      {!melodyPlayability.playable && (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {melodyPlayability.issues.map(issue => <div key={`${issue.measure}-${issue.step}`}>{issue.message}</div>)}
        </div>
      )}

      {compact && error && <p role="alert" className="mb-3 text-xs text-rose-600">{error}</p>}
      {compact && notices.map(notice => <p key={`${notice.code}-${notice.reason}`} role="status" className="mb-3 text-xs text-amber-700 dark:text-amber-300">{notice.message}</p>)}
      <details open={!compact} className="min-w-0">
        <summary className="mb-3 cursor-pointer text-xs font-semibold text-zinc-500">Line preview & details</summary>
      <div className={compact ? "grid min-w-0 grid-cols-1 gap-4" : "grid grid-cols-1 lg:grid-cols-10 gap-4"}>
        {/* ── Left: TOON Editor + Logs ── */}
        <div className={compact ? "flex min-w-0 flex-col" : "flex flex-col h-full lg:col-span-3"}>
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">Canonical TimeGrid</div>
            <p className="mt-1 text-[11px] text-zinc-500">Source melody, chords, timing, and grid coordinates are locked. AI output and imported v3 JSON are validated before they update this line.</p>
            <div className="mt-3 space-y-1 font-mono text-[10px]">
              {lineMeasures.map(measure => (
                <div key={measure.measure}>
                  M{measure.measure} · {measure.grid.length} steps · {measure.grid.reduce((count, step) => count + (step.tablature?.length ?? 0), 0)} guitar attacks
                </div>
              ))}
            </div>
          </div>
          {error && (
            <div className="mt-2 text-xs text-rose-500 font-semibold">
              {error}
            </div>
          )}
          {notices.map(notice => (
            <div key={`${notice.code}-${notice.reason}`} className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {notice.message}
            </div>
          ))}
          {fillSummary && (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-white/80 p-3 text-[11px] text-zinc-700 dark:border-indigo-900 dark:bg-zinc-900/70 dark:text-zinc-300">
              <div className="font-semibold text-indigo-700 dark:text-indigo-300">Scored fill run</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                <span>{fillSummary.policy.skillLevel} · {fillSummary.policy.resolvedDensity}</span>
                <span>{fillSummary.bpm} BPM</span>
                <span>{fillSummary.eligibleWindowCount} legal windows</span>
                <span>{fillSummary.selectedWindowCount} selected</span>
                <span>{fillSummary.evaluatedPlacementCount} placements</span>
                <span>{fillSummary.composedFillCount} fill notes</span>
              </div>
            </div>
          )}

          {/* Diagnostic Logs */}
          {logs.length > 0 && (
            <div className="mt-4 flex flex-col flex-none">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    LLM + TimeGrid Workflow Diagnostic Logs
                  </label>
                  {diagnosticRun && (
                    <div className="text-[10px] text-zinc-500">
                      {diagnosticRun.summary.outcome} · run {diagnosticRun.runId.slice(0, 8)}
                    </div>
                  )}
                </div>
                <CopyButton label="Copy" text={logs.join("\n")} />
              </div>
              <div
                className="rounded-xl border border-zinc-200 bg-zinc-950 p-3 font-mono text-[10px] text-emerald-400"
                style={{ height: '360px', minHeight: '360px', maxHeight: '360px', overflowY: 'scroll', overflowX: 'hidden', wordBreak: 'break-word' }}
              >
                {logs.map((log, i) => (
                  <div key={i} className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">{log}</div>
                ))}
                {combinedAsciiGuitarTab && (
                  <div className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">
                    {`\n## ASCII-GuitarTab\n\n${combinedAsciiGuitarTab}`}
                  </div>
                )}
                {lineAbcResult && (
                  <div className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">
                    {`\n## ABCJS Render Input\n\n\`\`\`abc\n${abcjsRenderInput}\n\`\`\``}
                  </div>
                )}
                {asciiGuitarTabValidationLog && !logs.some(log => log.includes("## ABC ↔ ASCII-GuitarTab Validation")) && (
                  <div className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">
                    {`\n## ABC ↔ ASCII-GuitarTab Validation\n\n${asciiGuitarTabValidationLog}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: ABC + ASCII Preview ── */}
        <div className={compact ? "flex min-w-0 flex-col" : "flex min-w-0 flex-col lg:col-span-7"}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Resulting ABC Tablature — Line {lineIndex + 1}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {lineAbcResult && (
                <CopyButton label="Copy ABCJS ABC" text={abcjsRenderInput} />
              )}
              {lineAbcResult && (
                <CopyButton label="Copy portable ABC" text={cleanAbcForExport(lineAbcResult)} />
              )}
              {lineAbcResult && (
                <CopyAsciiGuitarTabButton label="Copy ASCII-GuitarTab" text={combinedAsciiGuitarTab} />
              )}
            </div>
          </div>
          {lineAbcResult ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-2 overflow-hidden">
              <AbcjsPlaybackController
                abcString={lineAbcResult}
                title={`Line ${lineIndex + 1} Playback`}
                canvasId={`composer-line-${lineIndex}-preview`}
                minWidthClassName="min-w-0"
                sheetViewportClassName=""
                useContainerWidth={true}
                notationScale={0.7}
                showExactRenderAbcCopy={true}
                // The generated Guitar voice already carries the melody; avoid a second Melody/chord-track attack.
                synthOptions={{ voicesOff: [0], chordsOff: true }}
                visualMarkers={fillOpportunityMarkers}
                renderOptions={getArrangementRenderOptionsFor(lineAbcResult, COMPOSER_PREVIEW_RENDER_OPTIONS, tabEnabled)}
              />
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-500 min-h-[120px]">
              No ABC to render
            </div>
          )}
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Resulting ASCII-GuitarTab
              </label>
              {combinedAsciiGuitarTab && <CopyButton label="Copy" text={combinedAsciiGuitarTab} />}
            </div>
            <div className="min-w-0 max-w-full overflow-x-auto">
              <pre
                className="w-max min-w-full whitespace-pre break-normal rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono leading-4 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
                style={{
                  fontSize: "9.333px",
                  whiteSpace: "pre",
                  overflowWrap: "normal",
                  wordBreak: "normal",
                }}
              >
                {combinedAsciiGuitarTab || "No ASCII-GuitarTab yet."}
              </pre>
            </div>
          </div>
        </div>
      </div>
      </details>
    </section>
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
    <Button variant="ghost" size="sm"
      type="button"
      onClick={handleCopy}

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
    </Button>
  );
}
