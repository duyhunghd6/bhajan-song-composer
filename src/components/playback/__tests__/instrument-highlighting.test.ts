import { describe, expect, it } from "vitest";
import { buildSynchronizedInstrumentHighlights } from "../instrument-highlighting";

const melodyAbc = `X:1
T:Cursor test
M:4/4
L:1/8
K:C
C D E F | c2 z2 ||
`;

describe("synchronized instrument highlighting", () => {
  it("maps the active Music Sheet cursor note to piano key and guitar fret highlights", () => {
    const startChar = melodyAbc.indexOf("c2");
    const highlights = buildSynchronizedInstrumentHighlights(melodyAbc, {
      cursorSeconds: 2.5,
      startChar,
      endChar: startChar + 2,
      abcEvent: { milliseconds: 2500 },
    });

    expect(highlights.pianoHighlights).toEqual([
      { note: "C5", label: "♪" },
    ]);
    expect(highlights.guitarPositions).toEqual([
      { string: 5, fret: 3, note: "C", tone: "melody" },
    ]);
    expect(highlights.statusText).toBe("Highlighting C5 at 2.5s");
  });
});
