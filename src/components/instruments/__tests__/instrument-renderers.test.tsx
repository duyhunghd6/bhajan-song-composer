import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GuitarFretboard, {
  describeGuitarPosition,
  getGuitarFretY,
  getGuitarStringX,
  getVisibleGuitarPositions,
} from "../GuitarFretboard";
import PianoKeyboard, { buildPianoKeys, findPianoHighlight, normalizePianoNote } from "../PianoKeyboard";
import SvgHandsOverlay from "../SvgHandsOverlay";

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

  it("renders synchronized SVG hand overlays above fret targets", () => {
    const markup = renderToStaticMarkup(
      <GuitarFretboard
        title="Synchronized guitar"
        handOverlayEvents={[
          {
            id: "cursor-c5",
            instrument: "guitar",
            hand: "right",
            finger: "p",
            target: { x: 92, y: 75, label: "C" },
            cursorSeconds: 2.5,
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Synchronized guitar hands SVG hands overlay"');
    expect(markup).toContain('opacity="0.5"');
    expect(markup).toContain('transform="translate(92 75)"');
  });
});

describe("SvgHandsOverlay", () => {
  it("renders a semi-transparent active fingering event at the target coordinates", () => {
    const markup = renderToStaticMarkup(
      <SvgHandsOverlay
        title="Guitar hands"
        events={[
          {
            id: "cursor-c5",
            instrument: "guitar",
            hand: "right",
            finger: "p",
            target: { x: 142, y: 96, label: "C" },
            cursorSeconds: 2.5,
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Guitar hands SVG hands overlay"');
    expect(markup).toContain('opacity="0.5"');
    expect(markup).toContain('transform="translate(142 96)"');
    expect(markup).toContain("transition:transform 180ms ease-out");
    expect(markup).toContain("right hand finger p on C at 2.5s");
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

  it("renders synchronized SVG hand overlays above highlighted keys", () => {
    const markup = renderToStaticMarkup(
      <PianoKeyboard
        title="Synchronized piano"
        handOverlayEvents={[
          {
            id: "cursor-c5-piano",
            instrument: "piano",
            hand: "right",
            finger: 1,
            target: { x: 270, y: 72, label: "C5" },
            cursorSeconds: 2.5,
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Synchronized piano hands SVG hands overlay"');
    expect(markup).toContain('opacity="0.5"');
    expect(markup).toContain('transform="translate(270 72)"');
  });

  it("renders split-hand piano switches and filters the visible hand", () => {
    const markup = renderToStaticMarkup(
      <PianoKeyboard
        title="Split hands piano"
        handMode="left"
        highlights={[
          { note: "C3", hand: "left", finger: 5 },
          { note: "G4", hand: "right", finger: 1 },
        ]}
        handOverlayEvents={[
          {
            id: "left-c3",
            instrument: "piano",
            hand: "left",
            finger: 5,
            target: { x: 18, y: 88, label: "C3" },
            cursorSeconds: 1,
          },
          {
            id: "right-g4",
            instrument: "piano",
            hand: "right",
            finger: 1,
            target: { x: 414, y: 88, label: "G4" },
            cursorSeconds: 1,
          },
        ]}
      />
    );

    expect(markup).toContain("Left Hand Only");
    expect(markup).toContain("Right Hand Only");
    expect(markup).toContain("Combined Hands-Together");
    expect(markup).toContain("left hand finger 5 on C3 at 1.0s");
    expect(markup).not.toContain("right hand finger 1 on G4 at 1.0s");
    expect(markup).toContain("fill-sky-200");
    expect(markup).not.toContain("fill-amber-200");
  });
});
