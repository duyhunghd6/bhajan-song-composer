"use client";
import { ScoreViewport } from "./score-workspace/ScoreViewport";
import { noteEditKeepsRhythm, retainedScorePosition } from "./score-workspace/note-transport";
import { attachNoteInteractions } from "./score-workspace/note-interactions";
import { useCallback, useEffect, useEffectEvent, useMemo, useId, useRef, useState } from "react";
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
import { postProcessBeats, postProcessChords, postProcessVisualMarkers, parseAbcTempo } from "./abcjs-playback/abc-rendering";
import { prepareAbcjsRenderInput, renderPreparedAbc } from "./abcjs-playback/render-input";
import { isSynthReadyForPlayback } from "./abcjs-playback/synth-readiness";
import { AbcjsScoreActions } from "./abcjs-playback/AbcjsScoreActions";
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
import { attachScoreKeyboard, registerKeyboardPlayer } from "./abcjs-playback/score-keyboard";
import { useScoreSourceSelection } from "./abcjs-playback/useScoreSourceSelection";
export type { AbcjsPlaybackSynthOptions, MusicSheetPlaybackCursorEvent } from "./abcjs-playback/types";
export type { SourceRange } from "./abcjs-playback/source-map";
export default function AbcjsPlaybackController({
  abcString,
  title = "Music Sheet Playback",
  description,
  controls = true,
  showLoopControls = controls,
  canvasId,
  minWidthClassName = "min-w-0",
  paperClassName = "bg-white",
  sheetViewportClassName = "p-4",
  renderOptions,
  synthOptions,
  onPlaybackCursor,
  useContainerWidth = true,
  notationScale = 1,
  hideVoiceNames = false,
  showExactRenderAbcCopy = false,
  allowPdfDownload = true,
  visualMarkers,
  prepareAudio,
  onScoreRendered,
  sourceSelection,
  onSourceSelect,
  scoreEditing,
  renderScore,
}: AbcjsPlaybackControllerProps) {
  const generatedId = useId().replace(/:/g, "");
  const resolvedCanvasId = canvasId ?? `music-sheet-canvas-${generatedId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [abcjsModule, setAbcjsModule] = useState<AbcjsType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [tempo, setTempo] = useState(() => parseAbcTempo(abcString));
  const [overrideKey, setOverrideKey] = useState<string>("");
  const [overrideMeter, setOverrideMeter] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentSeconds, updateCurrentSeconds] = useState(0);
  const currentSecondsRef = useRef(0);
  const previousRenderedAbcRef = useRef<string | null>(null);
  const previousMeasureSecondsRef = useRef(2);
  const setCurrentSeconds = useCallback((seconds: number) => { currentSecondsRef.current = seconds; updateCurrentSeconds(seconds); }, []);
  const [millisecondsPerMeasure, setMillisecondsPerMeasure] = useState(2000);
  const [loopMode, setLoopMode] = useState<MusicSheetLoopMode>("whole");
  const [loopStartMeasure, setLoopStartMeasure] = useState(1);
  const [loopEndMeasure, setLoopEndMeasure] = useState(4);
  const synthRef = useRef<SynthType | null>(null);
  const synthGenerationRef = useRef(0);
  const synthInitializationRef = useRef<Promise<SynthType | null> | null>(null);
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
  const [controllerSlot, setControllerSlot] = useState<HTMLDivElement | null>(null);

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
        const style = window.getComputedStyle(parent);
        const width = Math.max(1, parent.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0"));
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
  const { indexRenderedScore, selectRenderedRange } = useScoreSourceSelection({
    abcString,
    renderedAbc: finalAbcString,
    sourceSelection,
    onSourceSelect,
    viewportRef,
  });
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
    [clearActiveNoteHighlight, onPlaybackCursor, setCurrentSeconds]
  );
  const stopSynthPlayback = useCallback(() => {
    synthGenerationRef.current++;
    synthInitializationRef.current = null;
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
  }, [clearActiveNoteHighlight, setCurrentSeconds]);
  const stopSynth = useCallback(() => {
    stopSynthPlayback();
    setPlaybackState(false);
    releasePlayback(resolvedCanvasId);
  }, [setPlaybackState, stopSynthPlayback, resolvedCanvasId]);
  const initSynth = useCallback(async () => {
    if (synthRef.current && isSynthReadyForPlayback(synthRef.current)) {
      return synthRef.current;
    }
    if (synthRef.current) {
      try {
        synthRef.current.stop();
      } catch {
        // An unprimed synth has no sources to stop.
      }
      synthRef.current = null;
    }
    if (synthInitializationRef.current) return synthInitializationRef.current;
    if (!abcjsModule || !visualObjRef.current) return null;

    const generation = synthGenerationRef.current;
    const initialization = (async () => {
      try {
        const win = window as Window & { webkitAudioContext?: typeof AudioContext };
        if (typeof window === "undefined" || (!window.AudioContext && !win.webkitAudioContext)) return null;
        const AudioContextClass = window.AudioContext || win.webkitAudioContext;
        if (!AudioContextClass) return null;
        const audioContext = new AudioContextClass();
        const CreateSynth = (abcjsModule.synth as { CreateSynth: new () => SynthType }).CreateSynth;
        const synth = new CreateSynth();
        await synth.init({
          visualObj: prepareAudio ? prepareAudio(visualObjRef.current!) : visualObjRef.current!,
          audioContext,
          millisecondsPerMeasure: visualObjRef.current!.millisecondsPerMeasure?.(tempo),
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
        if (generation !== synthGenerationRef.current || !isSynthReadyForPlayback(synth)) return null;
        synthRef.current = synth;
        return synth;
      } catch (err) {
        console.error("Error initializing synth:", err);
        return null;
      }
    })();

    synthInitializationRef.current = initialization;
    try {
      return await initialization;
    } finally {
      if (synthInitializationRef.current === initialization) {
        synthInitializationRef.current = null;
      }
    }
  }, [abcjsModule, clearActiveNoteHighlight, setPlaybackState, synthOptions, tempo, prepareAudio]);
  const playSynth = async () => {
    if (isPlayingRef.current || synthInitializationRef.current) return;
    // Stop any other controller that is currently playing
    claimPlayback(resolvedCanvasId);
    const generation = synthGenerationRef.current;
    try {
      let synth = synthRef.current;
      if (!isSynthReadyForPlayback(synth)) {
        synth = await initSynth();
      }
      if (generation !== synthGenerationRef.current) return;
      if (!synth) {
        setPlaybackState(false);
        releasePlayback(resolvedCanvasId);
        return;
      }
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
          stopSynthPlayback();
          setPlaybackState(false);
          releasePlayback(resolvedCanvasId);
        } else {
          throw startErr;
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
  // Score clicks and Enter only select (and reveal the source range); audio
  // starts exclusively from the Play control.
  const handleNoteClick = useEffectEvent(
    (abcElement: AbcElement, _tuneNumber: number, _classes: string, analysis?: ClickListenerAnalysis) => {
      analysis?.selectableElement?.closest<HTMLElement>("[data-score-item]")?.focus({ preventScroll: true });
      if (abcElement.startChar === undefined || abcElement.endChar === undefined) return;
      selectRenderedRange(abcElement.startChar, abcElement.endChar);
    },
  );
  const handleTimingEvent = useEffectEvent((event: NoteTimingEvent | null, nextDuration: number) => {
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
  });
  const selectForScoreEdit = useEffectEvent((start: number, end: number) => selectRenderedRange(start, end));
  const pauseForScoreEdit = useEffectEvent(() => pauseSynth());
  const playFromScore = useEffectEvent((seconds: number) => {
    if (isPlayingRef.current) stopSynth();
    isPausedRef.current = true;
    pausedSecondsRef.current = seconds;
    void playSynth();
  });
  const activateScoreNote = useEffectEvent((event: NoteTimingEvent) => {
    if (event.startChar !== undefined && event.endChar !== undefined) selectRenderedRange(event.startChar, event.endChar);
  });
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
    const savedSeconds = currentSecondsRef.current;
    const savedMeasureSeconds = previousMeasureSecondsRef.current;
    const previousAbc = previousRenderedAbcRef.current;
    const retainPosition = Boolean(scoreEditing && previousAbc && previousAbc !== finalAbcString && noteEditKeepsRhythm(previousAbc, finalAbcString));
    previousRenderedAbcRef.current = finalAbcString;
    const previousItems = Array.from(canvas.querySelectorAll("[data-score-item]"));
    const focusedIndex = previousItems.indexOf(document.activeElement!);
    const hadCanvasFocus = document.activeElement === canvas;
    let renderErrorMessage: string | null = null;
    let nextDuration = 0;
    let nextMillisecondsPerMeasure = 2000;
    let stateTimeoutId: number | null = null;
    let cleanupScore: void | (() => void);
    let cleanupEditing: (() => void) | undefined;
    let cleanupKeyboard: (() => void) | undefined;
    const stopRenderedPlayback = () => {
      cleanupEditing?.();
      cleanupKeyboard?.();
      cleanupScore?.();
      synthGenerationRef.current++;
      synthInitializationRef.current = null;
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
      isPausedRef.current = false;
      pausedSecondsRef.current = 0;
      releasePlayback(resolvedCanvasId);
    };
    const flushRenderState = () => {
      stateTimeoutId = window.setTimeout(() => {
        setRenderError(renderErrorMessage);
        setDurationSeconds(nextDuration);
        setMillisecondsPerMeasure(nextMillisecondsPerMeasure);
        const retainedSeconds = retainPosition ? retainedScorePosition(savedSeconds, savedMeasureSeconds, nextMillisecondsPerMeasure / 1000, nextDuration) : 0;
        setCurrentSeconds(retainedSeconds);
        previousMeasureSecondsRef.current = nextMillisecondsPerMeasure / 1000;
        if (retainedSeconds > 0) {
          isPausedRef.current = true; pausedSecondsRef.current = retainedSeconds;
          timingCallbacksRef.current?.setProgress(retainedSeconds, 'seconds');
          const anchor = timingCallbacksRef.current?.noteTimings.filter(event => event.type === 'event' && event.milliseconds <= retainedSeconds * 1000).at(-1);
          if (anchor) highlightTimingEvent(anchor);
          setCurrentSeconds(retainedSeconds);
        }
        setPlaybackState(false);
        if (document.activeElement === document.body && (focusedIndex >= 0 || hadCanvasFocus)) {
          const items = canvas.querySelectorAll<HTMLElement>("[data-score-item]");
          (items[Math.min(focusedIndex, items.length - 1)] ?? canvas).focus({ preventScroll: true });
        }
      }, 0);
    };
    try {
      stopRenderedPlayback();
      timingCallbacksRef.current = null;
      canvas.innerHTML = "";
      const mergedRenderOptions = {
        responsive: "resize" as const,
        wrap: { minSpacing: 1.7, maxSpacing: 2.5, preferredMeasuresPerLine: 4, lastLineLimit: 0.6 },
        add_classes: true,
        stafftopmargin: 0,
        paddingbottom: 30,
        // abcjs's own click selection would leave a stale red note behind; the
        // visible selection is the source-linked `abcjs-source-selected` class.
        selectionColor: "currentColor",
        ...renderOptions,
        // Responsive abcjs ignores its scale option. A wider engraving coordinate
        // space scales the complete score (including TAB and hit targets) together.
        ...(useContainerWidth && containerWidth ? { staffwidth: containerWidth / notationScale } : {}),
        clickListener: (...args: Parameters<typeof handleNoteClick>) => handleNoteClick(...args),
      };
      const visualObj = renderPreparedAbc(abcjsModule, canvas, finalAbcString, mergedRenderOptions);
      // Post-process beat indicator circles below the lyric line
      postProcessBeats(canvas);
      // Reposition chord symbols above TAB staves to prevent overlap
      postProcessChords(canvas);
      indexRenderedScore(visualObj?.[0] ?? null);
      if (!visualObj || visualObj.length === 0) {
        renderErrorMessage = "ABC notation could not be rendered. Check the header and note syntax.";
        flushRenderState();
        return () => {
          if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
          stopRenderedPlayback();
          timingCallbacksRef.current = null;
        };
      }
      cleanupScore = onScoreRendered?.(canvas, visualObj[0]);
      visualObjRef.current = visualObj[0];
      timingCallbacksRef.current = new abcjsModule.TimingCallbacks(visualObj[0], {
        qpm: tempo,
        eventCallback: (event) => handleTimingEvent(event, nextDuration),
      });
      cleanupKeyboard = attachScoreKeyboard(canvas, timingCallbacksRef.current.noteTimings, (event) => activateScoreNote(event));
      if (scoreEditing) cleanupEditing = attachNoteInteractions(canvas, finalAbcString, scoreEditing.sourceAbc ?? abcString, timingCallbacksRef.current.noteTimings, scoreEditing, (start, end) => selectForScoreEdit(start, end), seconds => playFromScore(seconds), () => pauseForScoreEdit(), visualObj[0]);
      postProcessVisualMarkers(canvas, visualMarkers);
      nextDuration = getSheetDurationSeconds(timingCallbacksRef.current.noteTimings);
      nextMillisecondsPerMeasure = visualObj[0].millisecondsPerMeasure?.(tempo) || 2000;
      // NOTE: Score clicks are handled exclusively by the abcjs `clickListener`
      // option (handleNoteClick) above. Do NOT add a redundant DOM click listener
      // here — it would fire on the same click event and select twice.
      flushRenderState();
      return () => {
        if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
        stopRenderedPlayback();
        timingCallbacksRef.current = null;
      };
    } catch (err) {
      console.warn("Error rendering ABC notation:", err);
      renderErrorMessage = "ABC notation could not be rendered. Check the header and note syntax.";
      flushRenderState();
    }
    return () => {
      if (stateTimeoutId !== null) window.clearTimeout(stateTimeoutId);
      stopRenderedPlayback();
      timingCallbacksRef.current = null;
    };
  }, [abcjsModule, finalAbcString, clearActiveNoteHighlight, highlightTimingEvent, indexRenderedScore, onPlaybackCursor, renderOptions, setPlaybackState, tempo, useContainerWidth, notationScale, containerWidth, visualMarkers, onScoreRendered, resolvedCanvasId, scoreEditing, abcString, setCurrentSeconds]);

  const toggleKeyboardPlayback = useEffectEvent(() => {
    if (isPlayingRef.current || synthInitializationRef.current) stopSynth();
    else void playSynth();
  });
  const toggleWorkspacePlayback = () => {
    document.getElementById(resolvedCanvasId)?.dispatchEvent(new CustomEvent("score-workspace-toggle-playback", { bubbles: true }));
  };
  useEffect(() => {
    if (!controls || !containerRef.current) return;
    return registerKeyboardPlayer(resolvedCanvasId, {
      canvas: containerRef.current,
      playing: () => isPlayingRef.current,
      toggle: () => toggleKeyboardPlayback(),
    });
  }, [controls, resolvedCanvasId]);

  // Register this instance with the global playback registry for exclusive playback
  useEffect(() => {
    registerPlayback(resolvedCanvasId, () => {
      synthGenerationRef.current++;
      synthInitializationRef.current = null;
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
  }, [resolvedCanvasId, setCurrentSeconds]);

  // Audio projections can change without changing the rendered ABC (e.g. guitar shapes).
  const synthOptionsKey = JSON.stringify(synthOptions ?? {});
  useEffect(() => {
    synthGenerationRef.current++;
    synthInitializationRef.current = null;
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
  }, [synthOptionsKey, prepareAudio, setPlaybackState]);
  const scoreActions = (showExactRenderAbcCopy || allowPdfDownload) ? (
    <AbcjsScoreActions
      allowPdfDownload={allowPdfDownload}
      showExactRenderAbcCopy={showExactRenderAbcCopy}
      isDownloadingPdf={isDownloadingPdf}
      copied={exactRenderCopyStatus === "copied"}
      onDownloadPdf={handleDownloadPdf}
      onCopyAbc={handleCopyExactRenderAbc}
    />
  ) : null;
  const scoreSurface = (
      <div ref={viewportRef} className={`${sheetViewportClassName} bg-white ${paperClassName}`}>
        {title && !controls && !showLoopControls && <h3 className="font-semibold text-zinc-900 mb-2">{title}</h3>}
        {!abcjsModule && !renderError && <div className="flex items-center justify-center py-12 text-sm text-zinc-400">Loading Music Notation Renderer...</div>}
        <div tabIndex={0} role="group" aria-label="Music score. Arrow keys select notes; Enter selects; Space controls playback; context menu opens note actions." ref={containerRef} id={resolvedCanvasId} className={`w-full ${minWidthClassName} text-black`} />
      </div>
  );
  return (
    <div aria-label={description ?? title} className="w-full bg-zinc-950 rounded-xl shadow-md overflow-hidden flex flex-col border border-zinc-800">
      {title && <h3 className="sr-only">{title}</h3>}
      {(controls || showLoopControls) && (
        <AbcjsPlaybackControls
          actions={scoreActions}
          viewportTools={<div ref={setControllerSlot} className="flex items-center gap-1" />}
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
      {!controls && !showLoopControls && (
        <div data-ui-tone="inverse" className="flex flex-wrap justify-end gap-1 bg-surface p-1">{scoreActions}<div ref={setControllerSlot} className="flex items-center gap-1" /></div>
      )}
      {renderError && (
        <div
          id="music-sheet-render-error"
          className="border-b border-rose-900/70 bg-rose-950/30 px-4 py-3 text-sm text-rose-300"
        >
          {renderError}
        </div>
      )}
      {renderScore ? renderScore(scoreSurface, { isPlaying, togglePlayback: toggleWorkspacePlayback, controllerSlot }) : (
        <ScoreViewport embedded height="auto" controllerSlot={controllerSlot} label={title}>{scoreSurface}</ScoreViewport>
      )}
      <AbcjsPlaybackStyles resolvedCanvasId={resolvedCanvasId} />
    </div>
  );
}
