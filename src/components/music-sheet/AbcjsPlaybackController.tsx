"use client";
import { useCallback, useEffect, useMemo, useId, useRef, useState } from "react";
import {
  getSheetDurationSeconds,
  normalizeLoopRange,
  resolveLoopSeek,
  type MusicSheetLoopMode,
} from "./playback";
import { buildMusicSheetPlaybackCursorEvent } from "./playback-cursor";
import {
  registerPlayback,
  unregisterPlayback,
  claimPlayback,
  releasePlayback,
} from "./playback-registry";
import { postProcessBeats, postProcessChords, parseAbcTempo } from "./abcjs-playback/abc-rendering";
import { prepareAbcjsRenderInput, renderPreparedAbc } from "./abcjs-playback/render-input";
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
  useContainerWidth = false,
  hideVoiceNames = false,
  showExactRenderAbcCopy = false,
  allowPdfDownload = true,
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
  /** Tracks whether the synth is paused (vs fully stopped). */
  const isPausedRef = useRef(false);
  /** The playback position (in seconds) when the user last paused. */
  const pausedSecondsRef = useRef(0);

  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [exactRenderCopyStatus, setExactRenderCopyStatus] = useState<"idle" | "copied">("idle");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!containerRef.current || !abcjsModule) return;
    try {
      setIsDownloadingPdf(true);
      // Dynamically import to avoid SSR issues
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      // Find all annotation elements and hide them via inline styles 
      // because html-to-image sometimes fails to capture external display: none rules for SVG text
      const annotations = containerRef.current.querySelectorAll('.abcjs-annotation');
      annotations.forEach((node) => {
        (node as HTMLElement).style.setProperty('display', 'none', 'important');
      });
      
      const dataUrl = await toPng(containerRef.current, { backgroundColor: '#ffffff' });
      
      // Restore inline styles (they are still hidden by CSS, but we clean up our inline modification)
      annotations.forEach((node) => {
        (node as HTMLElement).style.removeProperty('display');
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const printableWidth = pdfWidth - margin * 2;
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const ratio = imgProps.width / printableWidth;
      const scaledHeight = imgProps.height / ratio;

      let heightLeft = scaledHeight;
      let position = margin;
      const pageHeightWithoutMargins = pdfHeight - margin * 2;

      pdf.addImage(dataUrl, 'PNG', margin, position, printableWidth, scaledHeight);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F'); // bottom margin
      pdf.rect(0, 0, pdfWidth, margin, 'F'); // top margin
      heightLeft -= pageHeightWithoutMargins;

      while (heightLeft > 0) {
        position -= pageHeightWithoutMargins;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', margin, position, printableWidth, scaledHeight);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, pdfHeight - margin, pdfWidth, margin, 'F'); // bottom margin
        pdf.rect(0, 0, pdfWidth, margin, 'F'); // top margin
        heightLeft -= pageHeightWithoutMargins;
      }
      
      const titleMatch = abcString.match(/^\s*T:\s*(.+)$/m);
      const extractedTitle = titleMatch ? titleMatch[1].trim() : title;
      const keyMatch = abcString.match(/^\s*K:\s*(.+)$/m);
      const extractedKey = keyMatch ? keyMatch[1].trim() : "C";
      const meterMatch = abcString.match(/^\s*M:\s*(.+)$/m);
      const extractedMeter = meterMatch ? meterMatch[1].trim() : "4/4";
      
      const safeTitle = extractedTitle ? extractedTitle.replace(/[\/\\]/g, '-') : 'sheet_music';
      const safeKey = extractedKey.replace(/[\/\\]/g, '-');
      const safeMeter = extractedMeter.replace(/\//g, '-').replace(/[\\]/g, '-');
      
      const filename = `${safeTitle} - Key ${safeKey}, M${safeMeter}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [title, abcString, abcjsModule]);

  useEffect(() => {
    if (!useContainerWidth || typeof window === "undefined" || !containerRef.current) return;

    const updateWidth = () => {
      const parent = containerRef.current?.parentElement;
      if (parent) {
        const width = parent.clientWidth;
        if (width && width > 0) {
          setContainerWidth(width);
        }
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const parent = containerRef.current?.parentElement;
      if (parent) {
        const observer = new ResizeObserver(() => {
          updateWidth();
        });
        observer.observe(parent);
        return () => observer.disconnect();
      }
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [useContainerWidth]);

  // Whether tablature rendering is enabled for this instance
  const tablatureEnabled = Boolean(
    renderOptions && typeof renderOptions === "object" && "tablature" in renderOptions && renderOptions.tablature
  );

  const finalAbcString = useMemo(
    () =>
      prepareAbcjsRenderInput({
        abcString,
        overrideKey,
        overrideMeter,
        hideVoiceNames,
        tablatureEnabled,
      }),
    [abcString, overrideKey, overrideMeter, hideVoiceNames, tablatureEnabled]
  );
  const handleCopyExactRenderAbc = useCallback(() => {
    navigator.clipboard.writeText(finalAbcString).then(() => {
      setExactRenderCopyStatus("copied");
      window.setTimeout(() => setExactRenderCopyStatus("idle"), 2000);
    }).catch((error) => {
      console.error("Failed to copy exact render ABC", error);
    });
  }, [finalAbcString]);
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
    isPausedRef.current = false;
    pausedSecondsRef.current = 0;
  }, [clearActiveNoteHighlight]);
  const stopSynth = useCallback(() => {
    stopSynthPlayback();
    setPlaybackState(false);
    releasePlayback(resolvedCanvasId);
  }, [setPlaybackState, stopSynthPlayback, resolvedCanvasId]);
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
    // Stop any other controller that is currently playing
    claimPlayback(resolvedCanvasId);
    try {
      let synth = synthRef.current;
      if (!synth) {
        synth = await initSynth();
      }
      if (synth) {
        // Determine the resume position
        const resuming = isPausedRef.current;
        const resumeSeconds = resuming ? pausedSecondsRef.current : 0;
        isPausedRef.current = false;

        if (resuming && resumeSeconds > 0) {
          // Resume from the paused position
          synth.seek(resumeSeconds, "seconds");
          timingCallbacksRef.current?.setProgress(resumeSeconds, "seconds");
          timingCallbacksRef.current?.start(resumeSeconds, "seconds");
        } else if (loopMode === "range") {
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
            releasePlayback(resolvedCanvasId);
          } else {
            throw startErr;
          }
        }
      }
    } catch (err) {
      console.error("Error playing synth:", err);
      setPlaybackState(false);
      releasePlayback(resolvedCanvasId);
    }
  };
  const pauseSynth = () => {
    if (!isPlaying || !synthRef.current) return;
    try {
      // Save the current playback position for resume
      isPausedRef.current = true;
      pausedSecondsRef.current = currentSeconds;
      synthRef.current.pause();
      timingCallbacksRef.current?.pause();
      setPlaybackState(false);
      releasePlayback(resolvedCanvasId);
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
      // Stop any other controller that is playing
      claimPlayback(resolvedCanvasId);
      highlightTimingEvent(event);
      // Clear paused state since we're seeking to a new position
      isPausedRef.current = false;
      pausedSecondsRef.current = 0;
      try {
        let synth = synthRef.current;
        const wasRunning = Boolean(synth?.getIsRunning?.());
        if (!synth) {
          synth = await initSynth();
        }
        if (!synth) return;
        if (wasRunning) {
          // Suppress the onEnded callback that fires when we seek mid-play
          suppressNextEndedRef.current = true;
        }
        synth.seek(startSeconds, "seconds");
        timingCallbacksRef.current?.setProgress(startSeconds, "seconds");
        setCurrentSeconds(startSeconds);
        if (!wasRunning) {
          // Synth wasn't running, so we need to start it fresh
          try {
            synth.start();
            timingCallbacksRef.current?.start(startSeconds, "seconds");
          } catch (startErr: unknown) {
            const message = startErr instanceof Error ? startErr.message : String(startErr);
            if (message.includes("onended") || message.includes("undefined")) {
              console.warn("abcjs synth.start() failed from note click: Sequence could not start. Playback gracefully skipped.");
              setPlaybackState(false);
              releasePlayback(resolvedCanvasId);
            } else {
              throw startErr;
            }
          }
        }
        setPlaybackState(true);
      } catch (err) {
        console.error("Error playing from clicked note:", err);
        releasePlayback(resolvedCanvasId);
      }
    },
    [highlightTimingEvent, initSynth, setPlaybackState, resolvedCanvasId]
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
        ...(useContainerWidth && containerWidth ? { staffwidth: containerWidth } : {}),
        clickListener: handleNoteClick,
      };
      const visualObj = renderPreparedAbc(abcjsModule, canvas, finalAbcString, mergedRenderOptions);
      // Post-process beat indicator circles below the lyric line
      postProcessBeats(canvas);
      // Reposition chord symbols above TAB staves to prevent overlap
      postProcessChords(canvas);
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
      // NOTE: Click-to-seek is handled exclusively by the abcjs `clickListener`
      // option (handleNoteClick) above. Do NOT add a redundant DOM click listener
      // here — it would fire on the same click event, causing double playback.
      flushRenderState();
      return () => {
        if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
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
  }, [abcjsModule, finalAbcString, clearActiveNoteHighlight, handleNoteClick, highlightTimingEvent, loopEndMeasure, loopMode, loopStartMeasure, onPlaybackCursor, renderOptions, setPlaybackState, tempo, useContainerWidth, containerWidth]);

  // Register this instance with the global playback registry for exclusive playback
  useEffect(() => {
    registerPlayback(resolvedCanvasId, () => {
      // External stop: called by the registry when another instance claims playback
      if (synthRef.current) {
        try {
          synthRef.current.stop();
        } catch { /* ignore */ }
        synthRef.current = null;
      }
      timingCallbacksRef.current?.stop();
      activeNoteElementsRef.current.forEach((el) => el.classList.remove("abcjs-note-active"));
      activeNoteElementsRef.current = [];
      isPausedRef.current = false;
      pausedSecondsRef.current = 0;
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentSeconds(0);
    });
    return () => {
      unregisterPlayback(resolvedCanvasId);
    };
  }, [resolvedCanvasId]);

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
    isPausedRef.current = false;
    pausedSecondsRef.current = 0;
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
      {(showExactRenderAbcCopy || allowPdfDownload) && (
        <div className="flex justify-end gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          {allowPdfDownload && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition hover:text-white disabled:opacity-50"
            >
              {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
            </button>
          )}
          {showExactRenderAbcCopy && (
            <button
              type="button"
              onClick={handleCopyExactRenderAbc}
              className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition hover:text-white"
            >
              {exactRenderCopyStatus === "copied" ? "Copied exact render ABC" : "Copy exact render ABC"}
            </button>
          )}
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
      <AbcjsPlaybackStyles resolvedCanvasId={resolvedCanvasId} />
    </div>
  );
}
