import { describe, expect, it } from "vitest";

import { isSynthReadyForPlayback } from "../synth-readiness";

describe("isSynthReadyForPlayback", () => {
  it("rejects a synth with no primed audio buffer before seek or start", () => {
    expect(isSynthReadyForPlayback({ getAudioBuffer: () => undefined })).toBe(false);
  });

  it("accepts a synth once abcjs exposes a primed audio buffer", () => {
    expect(isSynthReadyForPlayback({ getAudioBuffer: () => ({ duration: 1.2 }) })).toBe(true);
  });
});
