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

const GANESHA_PHRASE_ABC = `X:1
T:Ganesha, Ganesha — Voice-leading Option 1 Sparse Bass
L:1/8
M:4/4
Q:1/2=120
K:G
%%score (Melody) (Guitar)
V:Melody name="Melody" stem=up
V:Guitar clef=treble-8 name="Guitar" stem=down
%%MIDI program 24
[V:Melody] | E3 "D" E3 D D | "Em" E3 B,3 B,2 | E3 "D" E3 D D | "Em" E3 B,3- B,2 |
[V:Guitar] | [!1!e-!5!C]/2 !1!e5/2 !1!e3 [!2!d-!4!D]/2 [!2!d!4!D]/2 !2!d | [!1!e-!6!E,]/2 !1!e5/2 !2!B3/2 [!2!B!3!G]3/2 [!2!B-!6!E,]/2 !2!B3/2 | [!1!e-!5!C]/2 !1!e5/2 !1!e3 [!2!d-!4!D]/2 [!2!d!4!D]/2 !2!d | [!1!e-!6!E,]/2 !1!e5/2 !2!B3 [!2!B!4!E]2 |`;

const GANESHA_PHRASE_RENDER_INPUT = GANESHA_PHRASE_ABC
  .replaceAll(" !1!e5/2", " [!1!e]5/2")
  .replaceAll(" !1!e3", " [!1!e]3")
  .replaceAll(" !2!d |", " [!2!d] |")
  .replaceAll(" !2!B3/2", " [!2!B]3/2")
  .replaceAll(" !2!B3 ", " [!2!B]3 ");

describe("prepareAbcjsRenderInput", () => {
  it("adapts forced Ganesha single notes for abcjs TAB pitch decorations", () => {
    expect(
      prepareAbcjsRenderInput({
        abcString: GANESHA_FORCED_ABC,
        tablatureEnabled: true,
      })
    ).toBe(GANESHA_ABCJS_RENDER_INPUT);
  });

  it("preserves the full Ganesha phrase and wraps every forced single note for abcjs", () => {
    const result = prepareAbcjsRenderInput({
      abcString: GANESHA_PHRASE_ABC,
      tablatureEnabled: true,
    });

    expect(result).toBe(GANESHA_PHRASE_RENDER_INPUT);
    expect(result).toContain("[!1!e]5/2 [!1!e]3");
    expect(result).toContain("[!2!d!4!D]/2 [!2!d]");
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
