import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AbcjsPlaybackController from "../AbcjsPlaybackController";

const abc = "X:1\nT:Ganesha\nM:4/4\nL:1/8\nK:Em\nE2 G2 |";

describe("AbcjsPlaybackController copy action", () => {
  it("shows the ABCJS copy label only when exact render copying is enabled", () => {
    const hiddenCopyMarkup = renderToStaticMarkup(
      <AbcjsPlaybackController abcString={abc} allowPdfDownload={false} />,
    );
    const visibleCopyMarkup = renderToStaticMarkup(
      <AbcjsPlaybackController
        abcString={abc}
        allowPdfDownload={false}
        showExactRenderAbcCopy
      />,
    );

    expect(hiddenCopyMarkup).not.toContain("Copy ABCJS ABC");
    expect(visibleCopyMarkup).toContain("Copy ABCJS ABC");
  });
});
