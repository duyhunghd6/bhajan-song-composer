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
    expect(highlights.guitarHandOverlayEvents).toContainEqual({
      id: "guitar-5-3-2.5",
      instrument: "guitar",
      hand: "right",
      finger: "p",
      target: { x: 92, y: 75, label: "C" },
      cursorSeconds: 2.5,
    });
    expect(highlights.pianoHandOverlayEvents).toContainEqual({
      id: "piano-C5-2.5",
      instrument: "piano",
      hand: "right",
      finger: 1,
      target: { x: 522, y: 80, label: "C5" },
      cursorSeconds: 2.5,
    });
    expect(highlights.statusText).toBe("Highlighting C5 at 2.5s");
  });
});
