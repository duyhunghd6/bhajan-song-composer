import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AbcSheetViewer from "../AbcSheetViewer";

const abcString = `X:1
T:Thin wrapper test
M:4/4
L:1/8
K:C
C D E F | G A B c ||
`;

describe("AbcSheetViewer", () => {
  it("configures the shared Music Sheet renderer for playback pages", () => {
    const markup = renderToStaticMarkup(
      <AbcSheetViewer abcString={abcString} songTitle="Govinda Jaya" />
    );

    expect(markup).toContain("Music Sheet Playback");
    expect(markup).toContain("Interactive notation playback for Govinda Jaya.");
    expect(markup).toContain('id="abc-music-canvas"');
    expect(markup).toContain('id="midi-btn-play"');
    expect(markup).toContain("Whole sheet");
    expect(markup).toContain("Instrument highlights");
  });
});
