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
    expect(highlights.guitarNoteMarkers).toContainEqual({
      id: "guitar-5-3-2.5",
      hand: "left",
      fingerNumber: 3,
      x: 92,
      y: 75,
      noteLabel: "C",
    });
    expect(highlights.pianoNoteMarkers).toContainEqual({
      id: "piano-C5-2.5",
      hand: "right",
      fingerNumber: 1,
      x: 522,
      y: 80,
      noteLabel: "C5",
    });
    expect(highlights.statusText).toBe("Highlighting C5 at 2.5s");
  });

  it("maps a multi-note staff cursor slice to synchronized piano and guitar visual events", () => {
    const chordAbc = `X:1
T:Chord cursor test
M:4/4
L:1/8
K:C
[CE]2 z2 ||
`;
    const startChar = chordAbc.indexOf("CE");
    const highlights = buildSynchronizedInstrumentHighlights(chordAbc, {
      cursorSeconds: 1.25,
      startChar,
      endChar: startChar + 2,
      abcEvent: { milliseconds: 1250 },
    });

    expect(highlights.pianoHighlights).toEqual([
      { note: "C4", label: "♪" },
      { note: "E4", label: "♪" },
    ]);
    expect(highlights.guitarPositions).toEqual([
      { string: 5, fret: 3, note: "C", tone: "melody" },
      { string: 4, fret: 2, note: "E", tone: "melody" },
    ]);
    expect(highlights.guitarNoteMarkers).toEqual([
      expect.objectContaining({ id: "guitar-5-3-1.3", hand: "left", fingerNumber: 3, x: 92, y: 117, noteLabel: "C" }),
      expect.objectContaining({ id: "guitar-4-2-1.3", hand: "left", fingerNumber: 2, x: 126, y: 75, noteLabel: "E" }),
    ]);
    expect(highlights.pianoNoteMarkers).toEqual([
      expect.objectContaining({ id: "piano-C4-1.3", hand: "right", fingerNumber: 1, x: 270, y: 80, noteLabel: "C4" }),
      expect.objectContaining({ id: "piano-E4-1.3", hand: "right", fingerNumber: 1, x: 342, y: 88, noteLabel: "E4" }),
    ]);
    expect(highlights.statusText).toBe("Highlighting C4, E4 at 1.3s");
  });
});
