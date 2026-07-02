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

export interface AbcjsPlaybackControllerProps {
  abcString: string;
  title?: string;
  description?: string;
  controls?: boolean;
  showLoopControls?: boolean;
  canvasId?: string;
  minWidthClassName?: string;
  paperClassName?: string;
  sheetViewportClassName?: string;
  renderOptions?: Record<string, unknown>;
  onPlaybackCursor?: (event: MusicSheetPlaybackCursorEvent | null) => void;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function AbcjsPlaybackController({
  abcString,
  title = "Music Sheet Playback",
  description,
  controls = true,
  showLoopControls = controls,
  canvasId,
  minWidthClassName = "min-w-[600px]",
  paperClassName = "bg-white",
  sheetViewportClassName = "overflow-x-auto p-4",
  renderOptions,
  onPlaybackCursor,
}: AbcjsPlaybackControllerProps) {
  const generatedId = useId().replace(/:/g, "");
  const resolvedCanvasId = canvasId ?? `music-sheet-canvas-${generatedId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [abcjsModule, setAbcjsModule] = useState<AbcjsType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [tempo, setTempo] = useState(120);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [millisecondsPerMeasure, setMillisecondsPerMeasure] = useState(2000);
  const [loopMode, setLoopMode] = useState<MusicSheetLoopMode>("whole");
  const [loopStartMeasure, setLoopStartMeasure] = useState(1);
  const [loopEndMeasure, setLoopEndMeasure] = useState(4);
  const synthRef = useRef<SynthType | null>(null);
  const visualObjRef = useRef<VisualObj | null>(null);
  const timingCallbacksRef = useRef<TimingCallbacksType | null>(null);
  const activeNoteElementsRef = useRef<HTMLElement[]>([]);
  const suppressNextEndedRef = useRef(false);

  const secondsPerMeasure = millisecondsPerMeasure / 1000;
  const totalMeasures = Math.max(1, Math.ceil(durationSeconds / secondsPerMeasure));
  const loopStartSeconds = (loopStartMeasure - 1) * secondsPerMeasure;


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

      setCurrentSeconds(event.milliseconds / 1000);
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
    setCurrentSeconds(0);
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
        setCurrentSeconds(startSeconds);

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
    let nextMillisecondsPerMeasure = 2000;
    let stateTimeoutId: number | null = null;

    const stopRenderedPlayback = () => {
      if (synthRef.current) {
        try {
          synthRef.current.stop();
        } catch (err) {
          console.error("Error stopping synth:", err);
        }
        synthRef.current = null;
      }

      timingCallbacksRef.current?.stop();
      activeNoteElementsRef.current.forEach((element) => {
        element.classList.remove("abcjs-note-active");
      });
      activeNoteElementsRef.current = [];
      onPlaybackCursor?.(null);
      isPlayingRef.current = false;
    };

    const flushRenderState = () => {
      stateTimeoutId = window.setTimeout(() => {
        setRenderError(renderErrorMessage);
        setDurationSeconds(nextDuration);
        setMillisecondsPerMeasure(nextMillisecondsPerMeasure);
        setCurrentSeconds(0);
        setPlaybackState(false);
      }, 0);
    };

    try {
      stopRenderedPlayback();
      timingCallbacksRef.current = null;
      canvas.innerHTML = "";

      const visualObj = abcjsModule.renderAbc(canvas, abcString, {
        responsive: "resize",
        add_classes: true,
        ...renderOptions,
        clickListener: handleNoteClick,
      });

      if (!visualObj || visualObj.length === 0) {
        renderErrorMessage = "ABC notation could not be rendered. Check the header and note syntax.";
        flushRenderState();
        return () => {
          if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
          stopRenderedPlayback();
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
          const currentMsPerMeasure = visualObjRef.current?.millisecondsPerMeasure?.(tempo) || 2000;
          const currentSecPerMeasure = currentMsPerMeasure / 1000;
          const loop = normalizeLoopRange({
            mode: loopMode,
            startSeconds: (loopStartMeasure - 1) * currentSecPerMeasure,
            endSeconds: Math.min(loopEndMeasure * currentSecPerMeasure, nextDuration),
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
      nextMillisecondsPerMeasure = visualObj[0].millisecondsPerMeasure?.(tempo) || 2000;

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
        stopRenderedPlayback();
        timingCallbacksRef.current = null;
      };
    } catch (err) {
      console.error("Error rendering ABC notation:", err);
      renderErrorMessage = "ABC notation could not be rendered. Check the header and note syntax.";
      flushRenderState();
    }

    return () => {
      if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
      stopRenderedPlayback();
      timingCallbacksRef.current = null;
    };
  }, [abcjsModule, abcString, clearActiveNoteHighlight, handleNoteClick, highlightTimingEvent, loopEndMeasure, loopMode, loopStartMeasure, onPlaybackCursor, playFromTimingEvent, renderOptions, setPlaybackState, tempo]);

  return (
    <div aria-label={description ?? title} className="w-full bg-zinc-950 rounded-xl shadow-md overflow-hidden flex flex-col border border-zinc-800">
      {(controls || showLoopControls) && (
        <div className="flex flex-wrap gap-y-3 items-center justify-between bg-[#1e1e1e] text-zinc-300 px-4 py-2.5 text-sm border-b border-black shadow-inner">
          {/* Left: Transport & Time */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <button
                id="midi-btn-stop"
                onClick={stopSynth}
                className="hover:text-white transition-colors cursor-pointer"
                title="Rewind to start"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>
              {!isPlaying ? (
                <button
                  id="midi-btn-play"
                  onClick={playSynth}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Play"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </button>
              ) : (
                <button
                  id="midi-btn-pause"
                  onClick={pauseSynth}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Pause"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                </button>
              )}
              {showLoopControls && (
                <button
                  onClick={() => setLoopMode(loopMode === 'range' ? 'whole' : 'range')}
                  className={`transition-colors cursor-pointer ${loopMode === 'range' ? 'text-amber-500' : 'hover:text-white'}`}
                  title="Toggle Loop Range"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
            </div>

            <span className="font-mono text-[11px] opacity-70 tracking-widest">
              {formatTime(currentSeconds)} / {formatTime(durationSeconds)}
            </span>
          </div>

          {/* Center: BPM */}
          {controls && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-[#121212] rounded-lg px-2 py-1 border border-zinc-800">
                <span className="text-[10px] font-semibold opacity-60 uppercase tracking-widest mr-1">BPM</span>
                <button
                  onClick={() => { const t = Math.max(60, tempo - 5); setTempo(t); stopSynth(); }}
                  className="px-1.5 hover:text-white hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                >
                  −
                </button>
                <span className="w-7 text-center text-[11px] font-mono">{tempo}</span>
                <button
                  onClick={() => { const t = Math.min(200, tempo + 5); setTempo(t); stopSynth(); }}
                  className="px-1.5 hover:text-white hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Right: Loop range sliders (condensed) */}
          <div className="flex items-center gap-3 min-w-[140px] justify-end">
            {showLoopControls && loopMode === 'range' && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="opacity-50 uppercase tracking-widest">Measure</span>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, totalMeasures)}
                  value={loopStartMeasure}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLoopStartMeasure(val);
                    if (val > loopEndMeasure) setLoopEndMeasure(val);
                  }}
                  className="w-10 bg-[#121212] text-center border border-zinc-800 rounded py-0.5 outline-none focus:border-amber-500 transition-colors"
                />
                <span className="opacity-50">to</span>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, totalMeasures)}
                  value={loopEndMeasure}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLoopEndMeasure(val);
                    if (val < loopStartMeasure) setLoopStartMeasure(val);
                  }}
                  className="w-10 bg-[#121212] text-center border border-zinc-800 rounded py-0.5 outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {renderError && (
        <div
          id="music-sheet-render-error"
          className="border-b border-rose-900/70 bg-rose-950/30 px-4 py-3 text-sm text-rose-300"
        >
          {renderError}
        </div>
      )}

      <div className={`${sheetViewportClassName} bg-white ${paperClassName}`}>
        {title && !controls && !showLoopControls && (
          <h3 className="font-semibold text-zinc-900 mb-2">{title}</h3>
        )}
        {!abcjsModule && !renderError && (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
