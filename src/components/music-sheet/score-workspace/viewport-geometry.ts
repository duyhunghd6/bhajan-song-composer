export const MIN_SCORE_ZOOM = 0.25;
export const MAX_SCORE_ZOOM = 3;

export function clampScoreZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_SCORE_ZOOM, Math.max(MIN_SCORE_ZOOM, zoom));
}

export function wheelZoomDelta(delta: number, mode: number, pageHeight: number) {
  if (!Number.isFinite(delta)) return 0;
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}

export function anchoredScroll(scroll: number, pointer: number, previousZoom: number, nextZoom: number) {
  return Math.max(0, (scroll + pointer) * nextZoom / previousZoom - pointer);
}

export function fitScoreZoom(viewportWidth: number, scoreWidth: number) {
  return clampScoreZoom(Math.max(1, viewportWidth - 32) / Math.max(1, scoreWidth));
}
