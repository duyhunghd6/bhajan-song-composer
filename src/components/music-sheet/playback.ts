export type MusicSheetLoopMode = "whole" | "range";

export type MusicSheetLoopRange = {
  mode: MusicSheetLoopMode;
  startSeconds: number;
  endSeconds: number;
};

export type NormalizedLoopRangeInput = {
  mode: MusicSheetLoopMode;
  durationSeconds: number;
  startSeconds?: number;
  endSeconds?: number;
};

export type LoopSeekInput = {
  loop: MusicSheetLoopRange | null;
  cursorSeconds: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeLoopRange({
  mode,
  durationSeconds,
  startSeconds = 0,
  endSeconds = durationSeconds,
}: NormalizedLoopRangeInput): MusicSheetLoopRange {
  const safeDuration = Math.max(0, durationSeconds);
  const nextStart = mode === "whole" ? 0 : clamp(startSeconds, 0, safeDuration);
  const nextEnd = mode === "whole" ? safeDuration : clamp(endSeconds, 0, safeDuration);

  if (nextEnd < nextStart) {
    return {
      mode,
      startSeconds: nextEnd,
      endSeconds: nextStart,
    };
  }

  return {
    mode,
    startSeconds: nextStart,
    endSeconds: nextEnd,
  };
}

export function resolveLoopSeek({ loop, cursorSeconds }: LoopSeekInput) {
  if (!loop || loop.endSeconds <= loop.startSeconds) return null;

  return cursorSeconds >= loop.endSeconds ? loop.startSeconds : null;
}

export function getSheetDurationSeconds(noteTimings: { milliseconds: number }[]) {
  if (noteTimings.length === 0) return 0;

  return Math.max(...noteTimings.map((timing) => timing.milliseconds)) / 1000;
}
