import { describe, expect, it } from "vitest";
import { anchoredScroll, clampScoreZoom, fitScoreZoom, wheelZoomDelta } from "./viewport-geometry";

describe("score viewport geometry", () => {
  it("keeps the score point under the cursor stationary during zoom", () => {
    const scroll = anchoredScroll(120, 80, 1, 2);
    expect((scroll + 80) / 2).toBe(200);
  });
  it("bounds zoom and prevents negative scroll offsets", () => {
    expect(clampScoreZoom(0)).toBe(0.25);
    expect(clampScoreZoom(10)).toBe(3);
    expect(anchoredScroll(0, 100, 2, 1)).toBe(0);
  });
  it("fits score width allowing for viewport margins", () => {
    expect(fitScoreZoom(532, 1000)).toBe(0.5);
    expect(fitScoreZoom(1, 1000)).toBe(0.25);
  });
  it("preserves the cursor point when zooming back out", () => {
    expect(anchoredScroll(320, 80, 2, 1)).toBe(120);
  });
  it("keeps invalid zoom input from poisoning layout", () => {
    expect(clampScoreZoom(Number.NaN)).toBe(1);
    expect(clampScoreZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });
  it("normalizes mouse wheel line and page units", () => {
    expect(wheelZoomDelta(2, 1, 500)).toBe(32);
    expect(wheelZoomDelta(1, 2, 500)).toBe(500);
    expect(wheelZoomDelta(Number.NaN, 0, 500)).toBe(0);
  });
});
