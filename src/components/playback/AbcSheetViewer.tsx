"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AbcSheetViewerProps {
  abcString: string;
  songTitle: string;
}

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

export default function AbcSheetViewer({ abcString }: AbcSheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [abcjsModule, setAbcjsModule] = useState<AbcjsType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [tempo, setTempo] = useState(120);
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
  }, []);

  const highlightTimingEvent = useCallback(
    (event: NoteTimingEvent | null) => {
      clearActiveNoteHighlight();

      if (!event?.elements) return;

      const elements = event.elements.flat().filter(Boolean);
      elements.forEach((element) => {
        element.classList.add("abcjs-note-active");
      });
      activeNoteElementsRef.current = elements;
    },
    [clearActiveNoteHighlight]
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
        // Create audio context
        const AudioContextClass = window.AudioContext || win.webkitAudioContext;
        if (!AudioContextClass) return null;
        const audioContext = new AudioContextClass();

        // Create Synth instance
        const CreateSynth = (abcjsModule.synth as { CreateSynth: new () => SynthType }).CreateSynth;
        const synth = new CreateSynth();
        synthRef.current = synth;

        await synth.init({
          visualObj: visualObjRef.current,
          audioContext,
          // Let abcjs derive the measure length from the rendered tune instead of assuming 4/4.
          // This keeps audio seeking and visual highlighting aligned for 3/4 bhajans and other meters.
          millisecondsPerMeasure: visualObjRef.current.millisecondsPerMeasure?.(tempo),
          options: {
            qpm: tempo,
            onEnded: () => {
              // abcjs CreateSynth.seek() stops the current AudioBufferSource before
              // starting the new one. That stop can fire onEnded even though we are
              // intentionally continuing from a clicked note, so suppress that one.
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
        synth.start();
        // abcjs audio does not highlight notes by itself. TimingCallbacks is the
        // visual clock that must start/pause/seek together with CreateSynth.
        timingCallbacksRef.current?.start();
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

      // abcjs click data and timing data are connected by ABC character ranges.
      // Keep this fallback: some clicks hit a child SVG path instead of the selectable wrapper.
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

        // Clicking a note should be a true seek, not just a visual selection:
        // if stopped, start at that note; if already playing, jump there and keep going.
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

  // Load abcjs on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("abcjs").then((mod) => {
        setAbcjsModule(mod.default as unknown as AbcjsType);
      });
    }
  }, []);

  // Render ABC notation when module or string changes
  useEffect(() => {
    if (!abcjsModule || !containerRef.current) return;

    const canvas = containerRef.current;

    try {
      // Clear previous rendering and playback/highlight state before abcjs replaces the SVG.
      stopSynthPlayback();
      timingCallbacksRef.current = null;
      canvas.innerHTML = "";

      const visualObj = abcjsModule.renderAbc(canvas, abcString, {
        responsive: "resize",
        add_classes: true,
        clickListener: handleNoteClick,
      });

      visualObjRef.current = visualObj[0];

      // TimingCallbacks drives note highlighting during playback. It must be recreated
      // after each render because abcjs creates a new SVG element tree every time.
      timingCallbacksRef.current = new abcjsModule.TimingCallbacks(visualObj[0], {
        qpm: tempo,
        eventCallback: (event) => {
          if (!event) {
            clearActiveNoteHighlight();
            setPlaybackState(false);
            return;
          }

          highlightTimingEvent(event);
        },
      });

      const handleCanvasClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        const noteElement = target?.closest?.(".abcjs-note") as HTMLElement | null;
        if (!noteElement) return;

        // abcjs' built-in clickListener uses geometric hit-testing that can miss
        // when SVG groups are scaled responsively. Keep this DOM fallback so a
        // direct click on a rendered note always seeks audio to that note.
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

      return () => {
        canvas.removeEventListener("click", handleCanvasClick);
        stopSynthPlayback();
        timingCallbacksRef.current = null;
      };
    } catch (err) {
      console.error("Error rendering ABC notation:", err);
    }

    return () => {
      stopSynthPlayback();
      timingCallbacksRef.current = null;
    };
  }, [abcjsModule, abcString, clearActiveNoteHighlight, handleNoteClick, highlightTimingEvent, playFromTimingEvent, setPlaybackState, stopSynthPlayback, tempo]);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col space-y-6">
      {/* Controls Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Music Sheet Playback
          </h3>
        </div>

        {/* MIDI Control Buttons */}
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

          {/* Tempo Selector */}
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Tempo:</span>
            <input
              id="midi-tempo-input"
              type="range"
              min="60"
              max="200"
              value={tempo}
              onChange={(e) => {
                const newTempo = parseInt(e.target.value);
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
      </div>

      {/* SVG Canvas Container */}
      {/* Keep the ABC sheet as white paper in all themes. abcjs SVG uses currentColor;
          do NOT apply dark:invert/dark:hue-rotate here or the staff turns nearly black
          on the dark page background and becomes unreadable. */}
      <div className="overflow-x-auto p-4 bg-white rounded-xl border border-zinc-200">
        {!abcjsModule && (
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
        {/* abcjs attaches its own SVG classes when add_classes=true.
            The global style below depends on those classes plus the event.elements handles;
            keep this canvas text color dark so the white-paper sheet remains readable. */}
        <div
          ref={containerRef}
          id="abc-music-canvas"
          className="w-full min-w-[600px] text-zinc-950"
        />
      </div>

      {/* Do not move these styles into Tailwind utilities: the active class is added
          imperatively to SVG nodes returned by abcjs TimingCallbacks while audio plays. */}
      <style>{`
        #abc-music-canvas .abcjs-note,
        #abc-music-canvas .abcjs-chord {
          cursor: pointer;
        }

        #abc-music-canvas .abcjs-note-active,
        #abc-music-canvas .abcjs-note-active * {
          fill: #f59e0b !important;
          stroke: #f59e0b !important;
        }
      `}</style>
    </div>
  );
}
