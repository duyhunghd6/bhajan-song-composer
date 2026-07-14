import { useState, useMemo, useEffect, useCallback } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { convertTimeSliceMeasureToAbc, convertAbcToTimeSliceGrid, type TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { formatLineAsToon, parseToonToLine, renderCombinedAsciiTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { extractRenderedTabFromSvg } from "@/components/music-sheet/abcjs-playback/abc-rendering";
import { buildAbcDurationContext } from "@/lib/theory/abc-duration";
import { getKeyAccidentalsFromAbc } from "@/lib/theory/abc-key-signature";
import { COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";
import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import { applyAbcLayerVisibility, isAbcLayerVisible, ABC_LAYER_IDS, cleanAbcForExport } from "@/lib/theory/abc-layer-visibility";
import { getArrangementRenderOptionsFor } from "./arrangement-preview-model";
import type {
  FingerstyleFillGenerationSummary,
  PreviousLineContext,
} from "@/app/actions/fingerstyle-line-arranger";
import type { FingerstyleGenerationSettings } from "../useWorkspaceState";
import type { FingerstyleGenerationDiagnosticRun } from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";
import {
  persistFingerstyleDiagnosticRun,
  restoreFingerstyleDiagnosticRuns,
} from "./fingerstyle-diagnostic-persistence";
import { getComposerFingerstyleDiagnosticsStorageKey } from "./storage";

interface FingerstyleLineCardProps {
  songSlug: string;
  sourceFingerprint: string;
  lineIndex: number;
  lineMeasures: TimeSliceMeasure[];
  activeAbc: string;
  onUpdateMeasures: (updated: TimeSliceMeasure[]) => void;
  accompLayerVisibility: Record<string, boolean>;
  /** Build cumulative context from all previous lines */
  buildPreviousContext: () => PreviousLineContext[];
  workflowAppliedMusicAbc: string;
  generationSettings: FingerstyleGenerationSettings;
  previousLineMeasures?: TimeSliceMeasure[];
  nextLineMeasures?: TimeSliceMeasure[];
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
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded cursor-pointer"
    >
      {copied ? (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// ── Main line card ─────────────────────────────────────────────────────

export function FingerstyleLineCard({
  songSlug,
  sourceFingerprint,
  lineIndex,
  lineMeasures,
  activeAbc,
  onUpdateMeasures,
  accompLayerVisibility,
  buildPreviousContext,
  workflowAppliedMusicAbc,
  generationSettings,
  previousLineMeasures,
  nextLineMeasures,
}: FingerstyleLineCardProps) {
  const measureNums = lineMeasures.map(m => m.measure);
  const [toonText, setToonText] = useState(() => formatLineAsToon(lineMeasures));
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [fillSummary, setFillSummary] = useState<FingerstyleFillGenerationSummary | null>(null);
  const [diagnosticRun, setDiagnosticRun] = useState<FingerstyleGenerationDiagnosticRun | null>(null);
  const diagnosticStorageKey = useMemo(
    () => getComposerFingerstyleDiagnosticsStorageKey(songSlug),
    [songSlug],
  );

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
  }, [diagnosticStorageKey, lineIndex, sourceFingerprint]);

  // Sync toonText when lineMeasures change externally (localStorage restore, etc.)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToonText(formatLineAsToon(lineMeasures));
  }, [lineMeasures]);

  const durationContext = useMemo(() => buildAbcDurationContext(activeAbc), [activeAbc]);

  const parsedMeasures = useMemo(() => {
    try { return convertAbcToTimeSliceGrid(activeAbc, []); }
    catch { return []; }
  }, [activeAbc]);

  // Build the ABC preview for the whole line
  const lineAbcResult = useMemo(() => {
    try {
      const keyAccidentals = getKeyAccidentalsFromAbc(activeAbc);
      const lineGuitarAbc = lineMeasures
        .map(m => convertTimeSliceMeasureToAbc(m, durationContext, keyAccidentals, true))
        .join(" | ");

      const generatedGuitar = [
        'V:Guitar clef=treble-8 name="Fingerstyle"',
        "%%MIDI program 24",
        `| ${lineGuitarAbc} |`
      ].join("\n");

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
        disablePickupLogic: true,
      });

      return applyAbcLayerVisibility(result.abc, accompLayerVisibility);
    } catch (e) {
      console.error(e);
      return "";
    }
  }, [lineMeasures, durationContext, activeAbc, accompLayerVisibility, parsedMeasures]);

  // Combined ASCII tab for all measures in the line
  const combinedAsciiTab = useMemo(() => {
    return renderCombinedAsciiTab(lineMeasures);
  }, [lineMeasures]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    try {
      const updated = parseToonToLine(toonText, lineMeasures);
      onUpdateMeasures(updated);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid TOON format");
    }
  }, [toonText, lineMeasures, onUpdateMeasures]);

  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setLogs([]);
      setFillSummary(null);
      const { generateAIFingerstyleLine } = await import("@/app/actions/fingerstyle-line-arranger");
      const result = await generateAIFingerstyleLine({
        songSlug,
        sourceFingerprint,
        lineMeasures,
        previousLines: buildPreviousContext(),
        activeAbc: workflowAppliedMusicAbc,
        skillLevel: generationSettings.skillLevel,
        densityMode: generationSettings.densityMode,
        previousLineMeasures,
        nextLineMeasures,
      });
      setLogs(result.logs || []);
      setFillSummary(result.fillSummary ?? null);
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
        onUpdateMeasures(result.measures);
      } else {
        setError(result.error || "AI Generation Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI Generation Failed");
    } finally {
      setIsGenerating(false);
    }
  }, [
    songSlug,
    sourceFingerprint,
    lineMeasures,
    buildPreviousContext,
    workflowAppliedMusicAbc,
    generationSettings,
    previousLineMeasures,
    nextLineMeasures,
    onUpdateMeasures,
    diagnosticStorageKey,
  ]);

  const tabEnabled = isAbcLayerVisible(ABC_LAYER_IDS.tab, accompLayerVisibility, false);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
          Line {lineIndex + 1} — Measures {measureNums[0]}–{measureNums[measureNums.length - 1]}
        </h3>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <span>✨</span>
          {isGenerating ? "Generating Line..." : "Generate Line with AI"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* ── Left: TOON Editor + Logs ── */}
        <div className="flex flex-col h-full lg:col-span-3">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Time-Slice Grid (TOON) — All Measures
          </label>
          <textarea
            className="flex-grow min-h-[400px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 whitespace-pre"
            value={toonText}
            onChange={(e) => setToonText(e.target.value)}
            onBlur={handleApply}
          />
          {error && (
            <div className="mt-2 text-xs text-rose-500 font-semibold">
              {error}
            </div>
          )}
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
              <div className="flex items-center justify-between mb-1">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    LLM + Workflow + DP Diagnostic Logs
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
                {combinedAsciiTab && (
                  <div className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">
                    {`\n## ASCII Tab\n\n${combinedAsciiTab}`}
                  </div>
                )}
                {lineAbcResult && (
                  <div className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">
                    {`\n## ABC Notation\n\n\`\`\`abc\n${lineAbcResult}\n\`\`\``}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: ABC + ASCII Preview ── */}
        <div className="flex flex-col lg:col-span-7">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Resulting ABC Tablature — Line {lineIndex + 1}
            </label>
            <div className="flex items-center gap-2">
              {lineAbcResult && (
                <CopyButton label="Copy portable ABC" text={cleanAbcForExport(lineAbcResult)} />
              )}
              {lineAbcResult && (
                <CopyTabButton label="Copy rendered TAB" containerId={`composer-line-${lineIndex}-preview`} />
              )}
            </div>
          </div>
          {lineAbcResult ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-2 overflow-hidden">
              <AbcjsPlaybackController
                abcString={lineAbcResult}
                title={`Line ${lineIndex + 1} Playback`}
                canvasId={`composer-line-${lineIndex}-preview`}
                minWidthClassName="min-w-[400px]"
                sheetViewportClassName="max-h-[600px] overflow-auto"
                useContainerWidth={true}
                showExactRenderAbcCopy={true}
                renderOptions={getArrangementRenderOptionsFor(lineAbcResult, COMPOSER_PREVIEW_RENDER_OPTIONS, tabEnabled)}
              />
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-500 min-h-[120px]">
              No ABC to render
            </div>
          )}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Resulting ASCII Tablature
              </label>
              {combinedAsciiTab && <CopyButton label="Copy" text={combinedAsciiTab} />}
            </div>
            <pre className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-3 overflow-x-auto text-xs font-mono text-zinc-700 dark:text-zinc-300">
              {combinedAsciiTab || "No tablature yet."}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CopyTabButton({ label, containerId }: { label: string; containerId: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    const tabAscii = extractRenderedTabFromSvg(containerId);
    navigator.clipboard.writeText(tabAscii);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [containerId]);

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
