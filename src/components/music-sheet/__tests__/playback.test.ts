import { describe, expect, it } from "vitest";
import { normalizeLoopRange, resolveLoopSeek } from "../playback";

describe("Music Sheet playback loop behavior", () => {
  it("treats whole-sheet playback as a zero-to-duration loop", () => {
    expect(normalizeLoopRange({ mode: "whole", durationSeconds: 18.4 })).toEqual({
      mode: "whole",
      startSeconds: 0,
      endSeconds: 18.4,
    });
  });

  it("keeps custom loop ranges within the rendered sheet duration", () => {
    expect(
      normalizeLoopRange({
        mode: "range",
        startSeconds: -4,
        endSeconds: 120,
        durationSeconds: 32,
      })
    ).toEqual({
      mode: "range",
      startSeconds: 0,
      endSeconds: 32,
    });
  });

  it("seeks back to the loop start when playback crosses the selected range end", () => {
    const loop = normalizeLoopRange({
      mode: "range",
      startSeconds: 4,
      endSeconds: 8,
      durationSeconds: 16,
    });

    expect(resolveLoopSeek({ loop, cursorSeconds: 7.9 })).toBeNull();
    expect(resolveLoopSeek({ loop, cursorSeconds: 8 })).toBe(4);
  });
});
