"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  getSheetDurationSeconds,
  normalizeLoopRange,
  resolveLoopSeek,
  type MusicSheetLoopMode,
} from "./playback";
import { buildMusicSheetPlaybackCursorEvent } from "./playback-cursor";
import type { MusicSheetPlaybackCursorEvent } from "./playback-cursor";
export type { MusicSheetPlaybackCursorEvent } from "./playback-cursor";

type ProgressUnit = "seconds" | "beats" | "percent";

type NoteTimingEvent = {
  milliseconds: number;
  type?: string;
  startChar?: number;
  endChar?: number;
  elements?: HTMLElement[][];
};

type AbcElement = {
  el_type?: string;
  startChar?: number;
  endChar?: number;
  pitches?: unknown[];
  midiPitches?: unknown[];
  rest?: unknown;
};

type ClickListenerAnalysis = {
  selectableElement?: HTMLElement;
};

type VisualObj = {
  millisecondsPerMeasure?: (bpm?: number) => number;
  [key: string]: unknown;
};

type TimingCallbacksType = {
  start(position?: number, units?: ProgressUnit): void;
  pause(): void;
  stop(): void;
  setProgress(position: number, units?: ProgressUnit): void;
  noteTimings: NoteTimingEvent[];
};

type AbcjsType = {
  renderAbc: (
    target: string | HTMLElement,
    abcString: string,
    options?: Record<string, unknown>
  ) => VisualObj[];
  TimingCallbacks: new (
    visualObj: VisualObj,
    options?: {
      qpm?: number;
      eventCallback?: (event: NoteTimingEvent | null) => void;
    }
  ) => TimingCallbacksType;
  synth: unknown;
};

interface SynthType {
  init(options: {
    visualObj: VisualObj;
    audioContext: AudioContext;
    millisecondsPerMeasure?: number;
    options?: {
      qpm?: number;
      onEnded?: () => void;
    };
  }): Promise<unknown>;
  prime(): Promise<unknown>;
  start(): void;
  pause(): void;
  stop(): void;
  seek(position: number, units?: ProgressUnit): void;
  getIsRunning?: () => boolean;
}

export interface MusicSheetRendererProps {
  abcString: string;
  title?: string;
  description?: string;
  controls?: boolean;
  showLoopControls?: boolean;
  canvasId?: string;
  minWidthClassName?: string;
  paperClassName?: string;
  onPlaybackCursor?: (event: MusicSheetPlaybackCursorEvent | null) => void;
}

function formatSeconds(seconds: number) {
  return seconds.toFixed(1);
}

export default function MusicSheetRenderer({
  abcString,
  title = "Music Sheet Playback",
  description,
  controls = true,
  showLoopControls = controls,
  canvasId,
  minWidthClassName = "min-w-[600px]",
  paperClassName = "bg-white",
  onPlaybackCursor,
}: MusicSheetRendererProps) {
  const generatedId = useId().replace(/:/g, "");
  const resolvedCanvasId = canvasId ?? `music-sheet-canvas-${generatedId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [abcjsModule, setAbcjsModule] = useState<AbcjsType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [tempo, setTempo] = useState(120);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [loopMode, setLoopMode] = useState<MusicSheetLoopMode>("whole");
  const [loopStartSeconds, setLoopStartSeconds] = useState(0);
  const [loopEndSeconds, setLoopEndSeconds] = useState(0);
  const synthRef = useRef<SynthType | null>(null);
  const visualObjRef = useRef<VisualObj | null>(null);
  const timingCallbacksRef = useRef<TimingCallbacksType | null>(null);
  const activeNoteElementsRef = useRef<HTMLElement[]>([]);
  const suppressNextEndedRef = useRef(false);

  const setPlaybackState = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const clearActiveNoteHighlight = useCallback(() => {
    activeNoteElementsRef.current.forEach((element) => {
      element.classList.remove("abcjs-note-active");
    });
    activeNoteElementsRef.current = [];
    onPlaybackCursor?.(null);
  }, [onPlaybackCursor]);

  const highlightTimingEvent = useCallback(
    (event: NoteTimingEvent | null) => {
      clearActiveNoteHighlight();

      if (!event) return;

      onPlaybackCursor?.(buildMusicSheetPlaybackCursorEvent(event));

      if (!event.elements) return;

      const elements = event.elements.flat().filter(Boolean);
      elements.forEach((element) => {
        element.classList.add("abcjs-note-active");
      });
      activeNoteElementsRef.current = elements;
    },
    [clearActiveNoteHighlight, onPlaybackCursor]
  );

  const stopSynthPlayback = useCallback(() => {
    if (synthRef.current) {
      try {
        synthRef.current.stop();
      } catch (err) {
        console.error("Error stopping synth:", err);
      }
      synthRef.current = null;
    }

    timingCallbacksRef.current?.stop();
    clearActiveNoteHighlight();
  }, [clearActiveNoteHighlight]);

  const stopSynth = useCallback(() => {
    stopSynthPlayback();
    setPlaybackState(false);
  }, [setPlaybackState, stopSynthPlayback]);

  const initSynth = useCallback(async () => {
    if (!abcjsModule || !visualObjRef.current) return null;

    try {
      const win = window as Window & { webkitAudioContext?: typeof AudioContext };
      if (typeof window !== "undefined" && (window.AudioContext || win.webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || win.webkitAudioContext;
        if (!AudioContextClass) return null;
        const audioContext = new AudioContextClass();
        const CreateSynth = (abcjsModule.synth as { CreateSynth: new () => SynthType }).CreateSynth;
        const synth = new CreateSynth();
        synthRef.current = synth;

        await synth.init({
          visualObj: visualObjRef.current,
          audioContext,
          millisecondsPerMeasure: visualObjRef.current.millisecondsPerMeasure?.(tempo),
          options: {
            qpm: tempo,
            onEnded: () => {
              if (suppressNextEndedRef.current && synthRef.current?.getIsRunning?.()) {
                suppressNextEndedRef.current = false;
                return;
              }

              suppressNextEndedRef.current = false;
              timingCallbacksRef.current?.stop();
              clearActiveNoteHighlight();
              setPlaybackState(false);
            },
          },
        });

        await synth.prime();
        return synth;
      }
    } catch (err) {
      console.error("Error initializing synth:", err);
    }
    return null;
  }, [abcjsModule, clearActiveNoteHighlight, setPlaybackState, tempo]);

  const playSynth = async () => {
    if (isPlaying) return;

    try {
      let synth = synthRef.current;
      if (!synth) {
        synth = await initSynth();
      }

      if (synth) {
        if (loopMode === "range") {
          synth.seek(loopStartSeconds, "seconds");
          timingCallbacksRef.current?.setProgress(loopStartSeconds, "seconds");
          timingCallbacksRef.current?.start(loopStartSeconds, "seconds");
        } else {
          timingCallbacksRef.current?.start();
        }

        synth.start();
        setPlaybackState(true);
      }
    } catch (err) {
      console.error("Error playing synth:", err);
    }
  };

  const pauseSynth = () => {
    if (!isPlaying || !synthRef.current) return;
    try {
      synthRef.current.pause();
      timingCallbacksRef.current?.pause();
      setPlaybackState(false);
    } catch (err) {
      console.error("Error pausing synth:", err);
    }
  };

  const findTimingEventForClickedNote = useCallback(
    (abcElement: AbcElement, analysis?: ClickListenerAnalysis) => {
      const timingEvents = timingCallbacksRef.current?.noteTimings || [];
      const noteEvents = timingEvents.filter((event) => event.type === "event");
      const clickedElement = analysis?.selectableElement;

      if (clickedElement) {
        const eventFromDom = noteEvents.find((event) =>
          event.elements?.flat().some(
            (element) =>
              element === clickedElement ||
              element.contains(clickedElement) ||
              clickedElement.contains(element)
          )
        );
        if (eventFromDom) return eventFromDom;
      }

      if (abcElement.startChar === undefined || abcElement.endChar === undefined) {
        return null;
      }

      return (
        noteEvents.find((event) => {
          if (event.startChar === undefined || event.endChar === undefined) return false;
          return event.startChar < abcElement.endChar! && event.endChar > abcElement.startChar!;
        }) || null
      );
    },
    []
  );

  const playFromTimingEvent = useCallback(
    async (event: NoteTimingEvent) => {
      const startSeconds = event.milliseconds / 1000;

      highlightTimingEvent(event);

      try {
        let synth = synthRef.current;
        if (!synth) {
          synth = await initSynth();
        }
        if (!synth) return;

        suppressNextEndedRef.current = Boolean(synth.getIsRunning?.());
        synth.seek(startSeconds, "seconds");
        timingCallbacksRef.current?.setProgress(startSeconds, "seconds");

        if (!isPlayingRef.current && !synth.getIsRunning?.()) {
          synth.start();
          timingCallbacksRef.current?.start();
        }

        setPlaybackState(true);
      } catch (err) {
        console.error("Error playing from clicked note:", err);
      }
    },
    [highlightTimingEvent, initSynth, setPlaybackState]
  );

  const handleNoteClick = useCallback(
    (abcElement: AbcElement, _tuneNumber: number, _classes: string, analysis?: ClickListenerAnalysis) => {
      const hasPlayablePitch =
        Boolean(abcElement.pitches?.length) || Boolean(abcElement.midiPitches?.length);

      if (!hasPlayablePitch || abcElement.rest) return;

      const timingEvent = findTimingEventForClickedNote(abcElement, analysis);
      if (!timingEvent) return;

      void playFromTimingEvent(timingEvent);
    },
    [findTimingEventForClickedNote, playFromTimingEvent]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("abcjs")
        .then((mod) => {
          setAbcjsModule((mod.default ?? mod) as unknown as AbcjsType);
        })
        .catch((err) => {
          console.error("Error loading ABC notation renderer:", err);
          setRenderError("Could not load the ABC notation renderer.");
        });
    }
  }, []);

  useEffect(() => {
    if (!abcjsModule || !containerRef.current) return;

    const canvas = containerRef.current;
    let renderErrorMessage: string | null = null;
    let nextDuration = 0;
    let stateTimeoutId: number | null = null;

    const flushRenderState = () => {
      stateTimeoutId = window.setTimeout(() => {
        setRenderError(renderErrorMessage);
        setDurationSeconds(nextDuration);
        setLoopEndSeconds((current) => current || nextDuration);
      }, 0);
    };

    try {
      stopSynthPlayback();
      timingCallbacksRef.current = null;
      canvas.innerHTML = "";

      const visualObj = abcjsModule.renderAbc(canvas, abcString, {
        responsive: "resize",
        add_classes: true,
        clickListener: handleNoteClick,
      });

      if (!visualObj || visualObj.length === 0) {
        renderErrorMessage = "ABC notation could not be rendered. Check the header and note syntax.";
        flushRenderState();
        return () => {
          if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
          stopSynthPlayback();
          timingCallbacksRef.current = null;
        };
      }

      visualObjRef.current = visualObj[0];
      timingCallbacksRef.current = new abcjsModule.TimingCallbacks(visualObj[0], {
        qpm: tempo,
        eventCallback: (event) => {
          if (!event) {
            clearActiveNoteHighlight();
            setPlaybackState(false);
            return;
          }

          const cursorSeconds = event.milliseconds / 1000;
          const loop = normalizeLoopRange({
            mode: loopMode,
            startSeconds: loopStartSeconds,
            endSeconds: loopEndSeconds || nextDuration,
            durationSeconds: nextDuration,
          });
          const nextSeek = resolveLoopSeek({ loop, cursorSeconds });
          if (nextSeek !== null && isPlayingRef.current) {
            suppressNextEndedRef.current = true;
            synthRef.current?.seek(nextSeek, "seconds");
            timingCallbacksRef.current?.setProgress(nextSeek, "seconds");
            return;
          }

          highlightTimingEvent(event);
        },
      });

      nextDuration = getSheetDurationSeconds(timingCallbacksRef.current.noteTimings);

      const handleCanvasClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        const noteElement = target?.closest?.(".abcjs-note") as HTMLElement | null;
        if (!noteElement) return;

        const timingEvent = timingCallbacksRef.current?.noteTimings.find((timing) =>
          timing.elements?.flat().some(
            (element) =>
              element === noteElement ||
              element.contains(noteElement) ||
              noteElement.contains(element)
          )
        );

        if (timingEvent) {
          void playFromTimingEvent(timingEvent);
        }
      };

      canvas.addEventListener("click", handleCanvasClick);
      flushRenderState();

      return () => {
        if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
        canvas.removeEventListener("click", handleCanvasClick);
        stopSynthPlayback();
        timingCallbacksRef.current = null;
      };
    } catch (err) {
      console.error("Error rendering ABC notation:", err);
      renderErrorMessage = "ABC notation could not be rendered. Check the header and note syntax.";
      flushRenderState();
    }

    return () => {
      if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
      stopSynthPlayback();
      timingCallbacksRef.current = null;
    };
  }, [abcjsModule, abcString, clearActiveNoteHighlight, handleNoteClick, highlightTimingEvent, loopEndSeconds, loopMode, loopStartSeconds, playFromTimingEvent, setPlaybackState, stopSynthPlayback, tempo]);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          )}
        </div>

        {controls && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              {!isPlaying ? (
                <button
                  id="midi-btn-play"
                  onClick={playSynth}
                  className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </button>
              ) : (
                <button
                  id="midi-btn-pause"
                  onClick={pauseSynth}
                  className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  Pause
                </button>
              )}

              <button
                id="midi-btn-stop"
                onClick={stopSynth}
                className="p-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
                Stop
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Tempo:</span>
              <input
                id="midi-tempo-input"
                type="range"
                min="60"
                max="200"
                value={tempo}
                onChange={(event) => {
                  const newTempo = parseInt(event.target.value);
                  setTempo(newTempo);
                  if (synthRef.current) {
                    stopSynth();
                  }
                }}
                className="w-24 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 w-8">
                {tempo}
              </span>
            </div>
          </div>
        )}
      </div>

      {showLoopControls && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 px-4 py-3">
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Loop:</span>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="radio"
              name={`${resolvedCanvasId}-loop-mode`}
              value="whole"
              checked={loopMode === "whole"}
              onChange={() => setLoopMode("whole")}
              className="accent-amber-500"
            />
            Whole sheet
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="radio"
              name={`${resolvedCanvasId}-loop-mode`}
              value="range"
              checked={loopMode === "range"}
              onChange={() => setLoopMode("range")}
              className="accent-amber-500"
            />
            Range
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            Start
            <input
              id="midi-loop-start-input"
              type="range"
              min="0"
              max={Math.max(durationSeconds, 0)}
              step="0.1"
              value={Math.min(loopStartSeconds, durationSeconds)}
              disabled={loopMode === "whole" || durationSeconds === 0}
              onChange={(event) => setLoopStartSeconds(Number(event.target.value))}
              className="w-24 accent-amber-500 disabled:opacity-40"
            />
            <span className="font-mono">{formatSeconds(loopStartSeconds)}s</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            End
            <input
              id="midi-loop-end-input"
              type="range"
              min="0"
              max={Math.max(durationSeconds, 0)}
              step="0.1"
              value={Math.min(loopEndSeconds || durationSeconds, durationSeconds)}
              disabled={loopMode === "whole" || durationSeconds === 0}
              onChange={(event) => setLoopEndSeconds(Number(event.target.value))}
              className="w-24 accent-amber-500 disabled:opacity-40"
            />
            <span className="font-mono">{formatSeconds(loopEndSeconds || durationSeconds)}s</span>
          </label>
        </div>
      )}

      {renderError && (
        <div
          id="music-sheet-render-error"
          className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
        >
          {renderError}
        </div>
      )}

      <div className={`overflow-x-auto p-4 rounded-xl border border-zinc-200 ${paperClassName}`}>
        {!abcjsModule && !renderError && (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading Music Notation Renderer...
          </div>
        )}
        <div
          ref={containerRef}
          id={resolvedCanvasId}
          className={`w-full ${minWidthClassName} text-black`}
        />
      </div>

      <style>{`
        #${resolvedCanvasId} .abcjs-note,
        #${resolvedCanvasId} .abcjs-chord {
          cursor: pointer;
        }

        #${resolvedCanvasId} .abcjs-note-active,
        #${resolvedCanvasId} .abcjs-note-active * {
          fill: #f59e0b !important;
          stroke: #f59e0b !important;
        }
      `}</style>
    </div>
  );
}
