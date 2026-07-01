import { describe, expect, it } from "vitest";
import { buildMusicSheetPlaybackCursorEvent } from "../playback-cursor";

describe("Music Sheet playback cursor events", () => {
  it("emits synchronization data from timing events even without rendered DOM elements", () => {
    const timingEvent = {
      milliseconds: 1250,
      type: "event",
      startChar: 10,
      endChar: 12,
    };

    expect(buildMusicSheetPlaybackCursorEvent(timingEvent)).toEqual({
      abcEvent: timingEvent,
      cursorSeconds: 1.25,
      startChar: 10,
      endChar: 12,
    });
  });
});
