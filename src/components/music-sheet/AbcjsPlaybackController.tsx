"use client";
import { useCallback, useEffect, useMemo, useId, useRef, useState } from "react";
import {
  getSheetDurationSeconds,
  normalizeLoopRange,
  resolveLoopSeek,
  type MusicSheetLoopMode,
} from "./playback";
import { buildMusicSheetPlaybackCursorEvent } from "./playback-cursor";
import { postProcessBeats, parseAbcTempo } from "./abcjs-playback/abc-rendering";
import { AbcjsPlaybackControls } from "./abcjs-playback/AbcjsPlaybackControls";
import { AbcjsPlaybackStyles } from "./abcjs-playback/AbcjsPlaybackStyles";
import type {
  AbcElement,
  AbcjsPlaybackControllerProps,
  AbcjsType,
  ClickListenerAnalysis,
  NoteTimingEvent,
  SynthType,
  TimingCallbacksType,
  VisualObj,
} from "./abcjs-playback/types";
export type { AbcjsPlaybackSynthOptions, MusicSheetPlaybackCursorEvent } from "./abcjs-playback/types";
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
  synthOptions,
  onPlaybackCursor,
}: AbcjsPlaybackControllerProps) {
  const generatedId = useId().replace(/:/g, "");
  const resolvedCanvasId = canvasId ?? `music-sheet-canvas-${generatedId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [abcjsModule, setAbcjsModule] = useState<AbcjsType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [tempo, setTempo] = useState(() => parseAbcTempo(abcString));
  const [overrideKey, setOverrideKey] = useState<string>("");
  const [overrideMeter, setOverrideMeter] = useState<string>("");
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
  const finalAbcString = useMemo(() => {
    let result = abcString;
    if (overrideKey) result = result.replace(/^\s*K:\s*(.+)$/m, `K: ${overrideKey}`);
    if (overrideMeter) result = result.replace(/^\s*M:\s*(.+)$/m, `M: ${overrideMeter}`);
    return result;
  }, [abcString, overrideKey, overrideMeter]);
  // Sync tempo from the ABC Q: field when the source ABC string changes
  useEffect(() => {
    const parsedBpm = parseAbcTempo(abcString);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tempo UI must resync immediately when the external ABC source changes.
    setTempo(parsedBpm);
  }, [abcString]);
  const keyMatch = finalAbcString.match(/^\s*K:\s*(.+)$/m);
  const parsedKey = keyMatch ? keyMatch[1].trim() : "C";
  const meterMatch = finalAbcString.match(/^\s*M:\s*(.+)$/m);
  const parsedMeter = meterMatch ? meterMatch[1].trim() : "4/4";
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
            ...synthOptions,
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
  }, [abcjsModule, clearActiveNoteHighlight, setPlaybackState, synthOptions, tempo]);
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
        try {
          synth.start();
          setPlaybackState(true);
        } catch (startErr: unknown) {
          const message = startErr instanceof Error ? startErr.message : String(startErr);
          if (message.includes("onended") || message.includes("undefined")) {
            console.warn("abcjs synth.start() failed: Sequence is likely empty (only rests). Playback gracefully skipped.");
            setPlaybackState(false);
          } else {
            throw startErr;
          }
        }
      }
    } catch (err) {
      console.error("Error playing synth:", err);
      setPlaybackState(false);
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
      const mergedRenderOptions = {
        responsive: "resize" as const,
        add_classes: true,
        stafftopmargin: 0,
        paddingbottom: 30,
        ...renderOptions,
        clickListener: handleNoteClick,
      };
      const visualObj = abcjsModule.renderAbc(canvas, finalAbcString, mergedRenderOptions);
      // Post-process beat indicator circles below the lyric line
      postProcessBeats(canvas);
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
  }, [abcjsModule, finalAbcString, clearActiveNoteHighlight, handleNoteClick, highlightTimingEvent, loopEndMeasure, loopMode, loopStartMeasure, onPlaybackCursor, playFromTimingEvent, renderOptions, setPlaybackState, tempo]);
  // Invalidate synth when synthOptions change so next play uses updated voicesOff/chordsOff
  const synthOptionsKey = JSON.stringify(synthOptions ?? {});
  useEffect(() => {
    if (synthRef.current) {
      try {
        synthRef.current.stop();
      } catch { /* ignore */ }
      synthRef.current = null;
    }
    timingCallbacksRef.current?.stop();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synthOptions invalidation must reset the playback UI immediately after the external abcjs synth is stopped.
    setPlaybackState(false);
  }, [synthOptionsKey, setPlaybackState]);
  return (
    <div aria-label={description ?? title} className="w-full bg-zinc-950 rounded-xl shadow-md overflow-hidden flex flex-col border border-zinc-800">
      {title && <h3 className="sr-only">{title}</h3>}
      {(controls || showLoopControls) && (
        <AbcjsPlaybackControls
          controls={controls}
          showLoopControls={showLoopControls}
          isPlaying={isPlaying}
          stopSynth={stopSynth}
          playSynth={playSynth}
          pauseSynth={pauseSynth}
          loopMode={loopMode}
          setLoopMode={setLoopMode}
          currentSeconds={currentSeconds}
          durationSeconds={durationSeconds}
          overrideKey={overrideKey}
          parsedKey={parsedKey}
          setOverrideKey={setOverrideKey}
          overrideMeter={overrideMeter}
          parsedMeter={parsedMeter}
          setOverrideMeter={setOverrideMeter}
          tempo={tempo}
          setTempo={setTempo}
          totalMeasures={totalMeasures}
          loopStartMeasure={loopStartMeasure}
          setLoopStartMeasure={setLoopStartMeasure}
          loopEndMeasure={loopEndMeasure}
          setLoopEndMeasure={setLoopEndMeasure}
        />
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
      <AbcjsPlaybackStyles resolvedCanvasId={resolvedCanvasId} />
    </div>
  );
}
