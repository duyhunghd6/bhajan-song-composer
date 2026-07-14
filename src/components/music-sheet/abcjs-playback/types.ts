import type { MusicSheetPlaybackCursorEvent } from "../playback-cursor";
export type { MusicSheetPlaybackCursorEvent } from "../playback-cursor";

export type ProgressUnit = "seconds" | "beats" | "percent";

export type NoteTimingEvent = {
  milliseconds: number;
  type?: string;
  startChar?: number;
  endChar?: number;
  elements?: HTMLElement[][];
};

export type AbcElement = {
  el_type?: string;
  startChar?: number;
  endChar?: number;
  pitches?: unknown[];
  midiPitches?: unknown[];
  rest?: unknown;
};

export type ClickListenerAnalysis = {
  selectableElement?: HTMLElement;
};

export type VisualObj = {
  millisecondsPerMeasure?: (bpm?: number) => number;
  [key: string]: unknown;
};

export type TimingCallbacksType = {
  start(position?: number, units?: ProgressUnit): void;
  pause(): void;
  stop(): void;
  setProgress(position: number, units?: ProgressUnit): void;
  noteTimings: NoteTimingEvent[];
};

export type AbcjsType = {
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

export interface SynthType {
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

/**
 * Options forwarded to abcjs CreateSynth.init() for selective layer muting.
 *
 * ⚠️ IMPORTANT: This is the ONLY safe way to mute melody/chord layers.
 * Do NOT try to mute by replacing ABC notes with rests (z) — abcjs CreateSynth
 * generates zero audio events for rests, producing an empty audio buffer that
 * crashes synth.start() with "Cannot set properties of undefined (setting 'onended')".
 */
export interface AbcjsPlaybackSynthOptions {
  /** Mute all melody/note voices. true = mute all, number[] = mute specific voice indices. */
  voicesOff?: boolean | number[];
  /** Disable chord accompaniment synthesis. */
  chordsOff?: boolean;
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
  /** Options forwarded to abcjs CreateSynth.init() to control voice/chord muting. */
  synthOptions?: AbcjsPlaybackSynthOptions;
  onPlaybackCursor?: (event: MusicSheetPlaybackCursorEvent | null) => void;
  useContainerWidth?: boolean;
  hideVoiceNames?: boolean;
  /** Show a copy action for the exact ABC string passed to abcjs.renderAbc(). */
  showExactRenderAbcCopy?: boolean;
}
