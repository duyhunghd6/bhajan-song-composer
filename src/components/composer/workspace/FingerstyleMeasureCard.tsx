import { useState, useMemo, useEffect } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";
import { convertTimeSliceMeasureToAbc, convertAbcToTimeSliceGrid, type TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { formatMeasureAsToon, parseToonToMeasure, renderAsciiTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { buildAbcDurationContext } from "@/lib/theory/abc-duration";
import { COMPOSER_PREVIEW_RENDER_OPTIONS } from "./preview";
import { buildAccompanimentAbc } from "@/lib/theory/accompaniment-abc";
import { applyAbcLayerVisibility, isAbcLayerVisible, ABC_LAYER_IDS } from "@/lib/theory/abc-layer-visibility";
import { getArrangementRenderOptionsFor } from "./arrangement-preview-model";

interface FingerstyleMeasureCardProps {
  measure: TimeSliceMeasure;
  originalAbcMeasure: string;
  activeAbc: string;
  onUpdateMeasure: (updatedMeasure: TimeSliceMeasure) => void;
  accompLayerVisibility: Record<string, boolean>;
}

export function FingerstyleMeasureCard({
  measure,
  originalAbcMeasure,
  activeAbc,
  onUpdateMeasure,
  accompLayerVisibility,
}: FingerstyleMeasureCardProps) {
  const [toonText, setToonText] = useState(() => formatMeasureAsToon(measure));
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Sync toonText if measure changes externally (like on mount from localStorage or AI simulation)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToonText(formatMeasureAsToon(measure));
  }, [measure, measure.grid]);

  // We need to parse a simple duration context just for rendering this single measure
  // Usually the original ABC string has headers like M:4/4 and L:1/8
  // But originalAbcMeasure here is just one measure line. We'll prepend some mock headers.
  const durationContext = useMemo(() => {
    return buildAbcDurationContext(activeAbc);
  }, [activeAbc]);

  const parsedMeasures = useMemo(() => {
    try {
      return convertAbcToTimeSliceGrid(activeAbc, []);
    } catch {
      return [];
    }
  }, [activeAbc]);

  const abcResult = useMemo(() => {
    try {
      const measureAbc = convertTimeSliceMeasureToAbc(measure, durationContext);
      
      const generatedGuitar = [
        'V:Guitar clef=treble-8 name="Fingerstyle"',
        "%%MIDI program 24",
        `| ${measureAbc} |`
      ].join("\n");

      // Construct a single measure ABC with headers and the isolated measure layers
      const headerLines = activeAbc.split(/\r?\n/).filter(line => line.match(/^[A-Za-z]:/) && !line.startsWith("V:"));
      const miniBaseAbcLines = [...headerLines];
      
      const sourceAbc = measure.source_abc || parsedMeasures[measure.measure - 1]?.source_abc;
      if (sourceAbc) {
        miniBaseAbcLines.push(`| ${sourceAbc.melody} |`);
        if (sourceAbc.lyric) {
          miniBaseAbcLines.push(`w: ${sourceAbc.lyric}`);
        }
        if (sourceAbc.beatWeight) {
          miniBaseAbcLines.push(`w: ${sourceAbc.beatWeight}`);
        }
      } else {
        miniBaseAbcLines.push(`| ${originalAbcMeasure} |`);
      }

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
  }, [measure, durationContext, activeAbc, accompLayerVisibility, originalAbcMeasure, parsedMeasures]);

  const handleApply = () => {
    try {
      const updated = parseToonToMeasure(toonText, measure);
      onUpdateMeasure(updated);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid TOON format");
    }
  };

  const handleAIGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setLogs([]);
      const { generateAIFingerstyleMeasure } = await import("@/app/actions/fingerstyle-arranger");
      const generated = await generateAIFingerstyleMeasure({ measure, activeAbc });
      
      setLogs(generated.logs || []);
      
      if (!generated.success || !generated.measure) {
        setError(generated.error || "AI Generation Failed");
      } else {
        onUpdateMeasure(generated.measure);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI Generation Failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-bold text-zinc-900 dark:text-zinc-100">Measure {measure.measure}</h3>
        <span className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">
          {originalAbcMeasure}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Side: JSON Editor */}
        <div className="flex flex-col h-full">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Time-Slice Grid (TOON)
          </label>
          <textarea
            className="flex-grow min-h-[300px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 whitespace-pre"
            value={toonText}
            onChange={(e) => setToonText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              Apply Grid & Preview
            </button>
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={isGenerating}
              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50"
            >
              <span>✨</span> {isGenerating ? "Generating..." : "Generate with AI"}
            </button>
            {error && <span className="text-xs text-rose-500 font-semibold">{error}</span>}
          </div>

          {/* Diagnostic Logs */}
          {logs.length > 0 && (
            <div className="mt-4 flex flex-col flex-none">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 block">
                LLM Diagnostic Logs
              </label>
              <div 
                className="rounded-xl border border-zinc-200 bg-zinc-950 p-3 font-mono text-[10px] text-emerald-400"
                style={{ height: '320px', minHeight: '320px', maxHeight: '320px', overflowY: 'scroll', overflowX: 'hidden', wordBreak: 'break-word' }}
              >
                {logs.map((log, i) => (
                  <div key={i} className="mb-2 border-b border-zinc-800 pb-1 last:border-0 whitespace-pre-wrap">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Tablature Preview */}
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Resulting ABC Tablature
          </label>
          {abcResult ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-2 overflow-hidden">
               <AbcjsPlaybackController
                abcString={abcResult}
                title={`Measure ${measure.measure} Playback`}
                canvasId={`composer-measure-${measure.measure}-preview`}
                minWidthClassName="min-w-[400px]"
                sheetViewportClassName="max-h-[300px] overflow-auto"
                renderOptions={getArrangementRenderOptionsFor(abcResult, COMPOSER_PREVIEW_RENDER_OPTIONS, isAbcLayerVisible(ABC_LAYER_IDS.tab, accompLayerVisibility, false))}
              />
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-500">
              No ABC to render
            </div>
          )}
          <div className="mt-4">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Resulting ABC Tablature
            </label>
            <pre className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-3 overflow-x-auto text-xs font-mono text-zinc-700 dark:text-zinc-300">
              {renderAsciiTab(measure.grid)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
