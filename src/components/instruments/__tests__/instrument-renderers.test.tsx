import { describe, expect, it } from "vitest";
import {
  describeGuitarPosition,
  getGuitarFretY,
  getGuitarStringX,
  getVisibleGuitarPositions,
} from "../GuitarFretboard";
import { buildPianoKeys, findPianoHighlight, normalizePianoNote } from "../PianoKeyboard";

describe("GuitarFretboard helpers", () => {
  it("maps standard string numbers from low E on the left to high E on the right", () => {
    expect(getGuitarStringX(6)).toBeLessThan(getGuitarStringX(1));
  });

  it("places fret markers between fret wires", () => {
    expect(getGuitarFretY(2, 1)).toBeGreaterThan(getGuitarFretY(1, 1));
  });

  it("describes visible finger positions for accessible SVG titles", () => {
    expect(describeGuitarPosition({ string: 2, fret: 3, finger: 3, note: "D" })).toBe(
      "D string 2, fret 3 with finger 3"
    );
    expect(describeGuitarPosition({ string: 1, fret: 0, note: "E" })).toBe("E open string 1");
  });

  it("filters positions to the current fret window", () => {
    const positions = [
      { string: 6, fret: 1 },
      { string: 5, fret: 3 },
      { string: 4, fret: 6 },
    ];

    expect(getVisibleGuitarPositions(positions, 1, 4)).toEqual(positions.slice(0, 2));
  });
});

describe("PianoKeyboard helpers", () => {
  it("builds white and black keys for the requested octave range", () => {
    const keys = buildPianoKeys(3, 1);

    expect(keys.filter((key) => key.color === "white")).toHaveLength(7);
    expect(keys.filter((key) => key.color === "black")).toHaveLength(5);
    expect(keys[0]).toMatchObject({ id: "C3", pitchClass: "C", color: "white" });
  });

  it("normalizes flats and ABC accidentals to sharp pitch classes", () => {
    expect(normalizePianoNote("Bb4")).toEqual({ pitchClass: "A#", octave: 4 });
    expect(normalizePianoNote("^F")).toEqual({ pitchClass: "F#", octave: undefined });
  });

  it("matches octave-specific and pitch-class highlights", () => {
    const keys = buildPianoKeys(3, 2);
    const c3 = keys.find((key) => key.id === "C3");
    const c4 = keys.find((key) => key.id === "C4");
    const fSharp3 = keys.find((key) => key.id === "F#3");

    expect(c3).toBeDefined();
    expect(c4).toBeDefined();
    expect(fSharp3).toBeDefined();

    if (!c3 || !c4 || !fSharp3) {
      throw new Error("Expected piano keys were not generated");
    }

    expect(findPianoHighlight(c3, [{ note: "C3", finger: 1 }])?.finger).toBe(1);
    expect(findPianoHighlight(c4, [{ note: "C3", finger: 1 }])).toBeUndefined();
    expect(findPianoHighlight(fSharp3, [{ note: "Gb", finger: 2 }])?.finger).toBe(2);
  });
});
