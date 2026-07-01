export { default as GuitarFretboard } from "./GuitarFretboard";
export type { GuitarFretboardProps, GuitarFretPosition } from "./GuitarFretboard";

export { default as PianoKeyboard } from "./PianoKeyboard";
export type {
  NormalizedPianoNote,
  PianoHandMode,
  PianoHighlightedNote,
  PianoKeyboardProps,
  PianoKeyInfo,
} from "./PianoKeyboard";

export { default as PianoPedalIndicator } from "./PianoPedalIndicator";
export type {
  ActivePianoPedalState,
  PianoPedalDisplayState,
  PianoPedalIndicatorProps,
} from "./PianoPedalIndicator";

export { default as SvgHandsOverlay } from "./SvgHandsOverlay";
export type {
  SvgHandFingeringEvent,
  SvgHandsOverlayProps,
  SvgHandTarget,
} from "./SvgHandsOverlay";
