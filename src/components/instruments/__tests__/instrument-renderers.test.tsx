import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GuitarFretboard, {
  describeGuitarPosition,
  getGuitarFretY,
  getGuitarStringX,
  getVisibleGuitarPositions,
} from "../GuitarFretboard";
import PianoKeyboard, { buildPianoKeys, findPianoHighlight, normalizePianoNote } from "../PianoKeyboard";
import PianoPedalIndicator from "../PianoPedalIndicator";
import SvgHandsOverlay, { buildSvgHandTransitionPathEvents } from "../SvgHandsOverlay";

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

  it("renders synchronized guitar transition paths above fret targets", () => {
    const markup = renderToStaticMarkup(
      <GuitarFretboard
        title="Chord passing guitar"
        transitionPathEvents={[
          {
            id: "left-1-c-to-g",
            instrument: "guitar",
            hand: "left",
            finger: 1,
            from: { x: 58, y: 75, label: "C shape" },
            to: { x: 92, y: 117, label: "G shape" },
            cursorSeconds: 2,
            fromMeasureIndex: 0,
            toMeasureIndex: 1,
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Chord passing guitar hands transition paths"');
    expect(markup).toContain("left hand finger 1 moves from C shape in measure 1 to G shape in measure 2");
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

  it("traces measure-synced guitar transition paths for recurring fingers", () => {
    const transitionPathEvents = buildSvgHandTransitionPathEvents([
      {
        id: "m1-left-1-c",
        instrument: "guitar",
        hand: "left",
        finger: 1,
        target: { x: 58, y: 75, label: "string 5 fret 1" },
        cursorSeconds: 0,
        measureIndex: 0,
      },
      {
        id: "m2-left-1-g",
        instrument: "guitar",
        hand: "left",
        finger: 1,
        target: { x: 92, y: 117, label: "string 4 fret 2" },
        cursorSeconds: 2,
        measureIndex: 1,
      },
      {
        id: "m2-left-2-e",
        instrument: "guitar",
        hand: "left",
        finger: 2,
        target: { x: 126, y: 159, label: "string 3 fret 3" },
        cursorSeconds: 2,
        measureIndex: 1,
      },
    ]);

    expect(transitionPathEvents).toEqual([
      expect.objectContaining({
        id: "guitar-left-1-transition-m1-left-1-c-to-m2-left-1-g",
        hand: "left",
        finger: 1,
        fromMeasureIndex: 0,
        toMeasureIndex: 1,
        from: expect.objectContaining({ label: "string 5 fret 1" }),
        to: expect.objectContaining({ label: "string 4 fret 2" }),
      }),
    ]);

    const markup = renderToStaticMarkup(
      <SvgHandsOverlay title="Guitar hands" transitionPathEvents={transitionPathEvents} />
    );

    expect(markup).toContain('aria-label="Guitar hands transition paths"');
    expect(markup).toContain("left hand finger 1 moves from string 5 fret 1 in measure 1 to string 4 fret 2 in measure 2");
    expect(markup).toContain('d="M 58 75 C 75 75, 75 117, 92 117"');
    expect(markup).toContain('stroke-dasharray="6 5"');
  });
});

describe("PianoPedalIndicator", () => {
  it("renders the current pedal flush state from MIDI CC 64 events", () => {
    const markup = renderToStaticMarkup(
      <PianoPedalIndicator
        title="Live sustain pedal"
        currentMeasureIndex={1}
        currentBeat={1}
        pedalAutomation={{
          controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
          events: [
            { measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 },
            { measureIndex: 1, beat: 1, chord: "Bm", type: "pedal-flush", value: 0, previousChord: "Em" },
            { measureIndex: 1, beat: 1.1, chord: "Bm", type: "pedal-down", value: 127 },
          ],
        }}
      />
    );

    expect(markup).toContain('aria-label="Live sustain pedal pedal indicator panel"');
    expect(markup).toContain("MIDI CC 64");
    expect(markup).toContain("Pedal flush");
    expect(markup).toContain("M2 beat 1 · pedal-flush · Bm · CC64 0");
    expect(markup).toContain("changes from Em");
  });

  it("shows a held pedal between down and release events", () => {
    const markup = renderToStaticMarkup(
      <PianoPedalIndicator
        currentMeasureIndex={0}
        currentBeat={3}
        pedalAutomation={{
          controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
          events: [
            { measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 },
            { measureIndex: 0, beat: 4, chord: "Em", type: "pedal-up", value: 0 },
          ],
        }}
      />
    );

    expect(markup).toContain("Pedal hold");
    expect(markup).toContain("CC64 value 127");
    expect(markup).toContain("M1 beat 3");
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
