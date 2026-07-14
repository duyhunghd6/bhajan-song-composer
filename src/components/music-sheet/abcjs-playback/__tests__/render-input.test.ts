import { describe, expect, it, vi } from "vitest";

import { prepareAbcjsRenderInput, renderPreparedAbc } from "../render-input";

const GANESHA_FORCED_ABC = `X:1
T:Ganesha
M:4/4
L:1/8
K:Em
V:Guitar clef=treble-8 name="Fingerstyle Tablature"
[V:Guitar] | [!2!B!3!G!6!E,] !2!e !3!G !2!B4 !3!B |`;

const GANESHA_ABCJS_RENDER_INPUT = `X:1
T:Ganesha
M:4/4
L:1/8
K:Em
V:Guitar clef=treble-8 name="Fingerstyle Tablature"
[V:Guitar] | [!2!B!3!G!6!E,] [!2!e] [!3!G] [!2!B]4 [!3!B] |`;

describe("prepareAbcjsRenderInput", () => {
  it("adapts forced Ganesha single notes for abcjs TAB pitch decorations", () => {
    expect(
      prepareAbcjsRenderInput({
        abcString: GANESHA_FORCED_ABC,
        tablatureEnabled: true,
      })
    ).toBe(GANESHA_ABCJS_RENDER_INPUT);
  });

  it("applies render overrides and hides voice names before forcing TAB strings", () => {
    const input = `X:1
T:Ganesha
M:4/4
L:1/8
K:Em
V:Guitar clef=treble-8 name="Fingerstyle Tablature" snm="Gtr"
[V:Guitar] | B |`;

    const result = prepareAbcjsRenderInput({
      abcString: input,
      overrideKey: "C",
      overrideMeter: "3/4",
      hideVoiceNames: true,
      tablatureEnabled: true,
    });

    expect(result).toContain("M: 3/4");
    expect(result).toContain("K: C");
    expect(result).not.toContain("name=");
    expect(result).not.toContain("snm=");
    expect(result).toContain("[V:Guitar] | [!2!B] |");
  });

  it("strips Guitar string-forcing decorations when TAB is disabled", () => {
    expect(
      prepareAbcjsRenderInput({
        abcString: GANESHA_FORCED_ABC,
        tablatureEnabled: false,
      })
    ).toBe(`X:1
T:Ganesha
M:4/4
L:1/8
K:Em
V:Guitar clef=treble-8 name="Fingerstyle Tablature"
[V:Guitar] | [BGE,] e G B4 B |`);
  });

  it("passes the prepared Ganesha ABC unchanged to the abcjs render boundary", () => {
    const renderAbc = vi.fn(() => []);
    const options = { tablature: [{ instrument: "guitar" }] };

    renderPreparedAbc({ renderAbc }, "canvas", GANESHA_ABCJS_RENDER_INPUT, options);

    expect(renderAbc).toHaveBeenCalledWith("canvas", GANESHA_ABCJS_RENDER_INPUT, options);
  });
});
