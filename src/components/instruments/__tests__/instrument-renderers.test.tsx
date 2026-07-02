import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GuitarFretboard, {
  describeGuitarPosition,
  getGuitarFretY,
  getGuitarStringX,
  getVisibleGuitarPositions,
} from "../GuitarFretboard";
import InstrumentNoteMarkers from "../InstrumentNoteMarkers";
import PianoKeyboard, { buildPianoKeys, findPianoHighlight, normalizePianoNote } from "../PianoKeyboard";
import PianoPedalIndicator from "../PianoPedalIndicator";

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

  it("renders synchronized numbered note markers above fret targets", () => {
    const markup = renderToStaticMarkup(
      <GuitarFretboard
        title="Synchronized guitar"
        noteMarkers={[
          {
            id: "cursor-c5",
            hand: "right",
            fingerNumber: 1,
            x: 92,
            y: 75,
            noteLabel: "C",
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Synchronized guitar fingering numbered note markers"');
    expect(markup).toContain('transform="translate(92 75)"');
    expect(markup).toContain("right hand marker (1) on C");
    expect(markup).toContain("fill-amber-400");
    expect(markup).toContain("(1)");
  });
});

describe("InstrumentNoteMarkers", () => {
  it("renders blue left-hand and yellow right-hand numbered markers", () => {
    const markup = renderToStaticMarkup(
      <InstrumentNoteMarkers
        title="Fingering guide"
        width={320}
        height={180}
        markers={[
          {
            id: "left-c3",
            hand: "left",
            fingerNumber: 5,
            x: 42,
            y: 96,
            noteLabel: "C3",
            measureIndex: 0,
            beat: 1,
          },
          {
            id: "right-g4",
            hand: "right",
            fingerNumber: 1,
            x: 142,
            y: 72,
            noteLabel: "G4",
            techniqueLabel: "pinch",
            measureIndex: 0,
            beat: 2,
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Fingering guide numbered note markers"');
    expect(markup).toContain("left hand marker (5) on C3 at measure 1 beat 1");
    expect(markup).toContain("right hand marker (1) on G4 for pinch at measure 1 beat 2");
    expect(markup).toContain("fill-sky-500");
    expect(markup).toContain("fill-amber-400");
    expect(markup).toContain("(5)");
    expect(markup).toContain("(1)");
    expect(markup).not.toContain("animateTransform");
    expect(markup).not.toContain("polyline");
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

  it("renders synchronized numbered note markers above highlighted keys", () => {
    const markup = renderToStaticMarkup(
      <PianoKeyboard
        title="Synchronized piano"
        noteMarkers={[
          {
            id: "cursor-c5-piano",
            hand: "right",
            fingerNumber: 1,
            x: 270,
            y: 72,
            noteLabel: "C5",
          },
        ]}
      />
    );

    expect(markup).toContain('aria-label="Synchronized piano fingering numbered note markers"');
    expect(markup).toContain('transform="translate(270 72)"');
    expect(markup).toContain("right hand marker (1) on C5");
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
        noteMarkers={[
          {
            id: "left-c3",
            hand: "left",
            fingerNumber: 5,
            x: 18,
            y: 88,
            noteLabel: "C3",
          },
          {
            id: "right-g4",
            hand: "right",
            fingerNumber: 1,
            x: 414,
            y: 88,
            noteLabel: "G4",
          },
        ]}
      />
    );

    expect(markup).toContain("Left Hand Only");
    expect(markup).toContain("Right Hand Only");
    expect(markup).toContain("Combined Hands-Together");
    expect(markup).toContain("left hand marker (5) on C3");
    expect(markup).not.toContain("right hand marker (1) on G4");
    expect(markup).toContain("fill-sky-200");
    expect(markup).not.toContain("fill-amber-200");
  });

  it("renders combined piano hands together when teacher mode needs both marker sets", () => {
    const markup = renderToStaticMarkup(
      <PianoKeyboard
        title="Teacher mode piano"
        startOctave={2}
        octaveCount={3}
        handMode="combined"
        highlights={[
          { note: "E2", hand: "left", finger: 5, label: "LH5" },
          { note: "E4", hand: "right", finger: 5, label: "RH5" },
        ]}
        noteMarkers={[
          {
            id: "left-e2",
            hand: "left",
            fingerNumber: 5,
            x: 18,
            y: 100,
            noteLabel: "E2",
          },
          {
            id: "right-e4",
            hand: "right",
            fingerNumber: 5,
            x: 342,
            y: 76,
            noteLabel: "E4",
          },
        ]}
      />
    );

    expect(markup).toContain("left hand marker (5) on E2");
    expect(markup).toContain("right hand marker (5) on E4");
    expect(markup).toContain("LH5");
    expect(markup).toContain("RH5");
    expect(markup).toContain("fill-sky-200");
    expect(markup).toContain("fill-amber-200");
  });
});
