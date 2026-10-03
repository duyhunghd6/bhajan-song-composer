import { describe, expect, it } from "vitest";
import abcjs from "abcjs";
import { buildGuitarChordScore, createGuitarChordOverride, guitarChordShapes, realizeGuitarChordAudio, type GuitarAudioSequence, type GuitarParsedTune } from "../guitar-chord-score";

function audio(abc: string): GuitarAudioSequence {
  return (abcjs.parseOnly(abc)[0] as unknown as GuitarParsedTune).setUpAudio({ chordsOff: true });
}
const SOURCE = 'X:1\nM:4/4\nL:1/4\nQ:1/4=100\nK:Em\n|: "Em" E2 "Am" z2 | "Em" E4 :|';

describe("guitar chord score realization", () => {
  it("offers a complete dominant seventh and respects the bass of slash chords", () => {
    const b7 = guitarChordShapes("B7");
    expect(b7.length).toBeGreaterThan(0);
    expect(new Set(b7[0].midi.map((pitch) => pitch % 12))).toEqual(new Set([11, 3, 6, 9]));
    const inversion = guitarChordShapes("C/E");
    expect(inversion.length).toBeGreaterThan(0);
    expect(inversion.every((shape) => Math.min(...shape.midi) % 12 === 4)).toBe(true);
  });
  it("does not suppress an existing guitar voice when the chord-label layer is hidden", () => {
    const source = 'X:1\nM:4/4\nL:1/4\nK:C\nV:GuitarSupport\n%%MIDI program 24\nE4 |';
    const base = audio(source);
    expect(realizeGuitarChordAudio(base, buildGuitarChordScore(source, source))).toEqual(base);
  });
  it("uses exact open and barre pitches, scoped to one occurrence and retained after JSON persistence", () => {
    const initial = buildGuitarChordScore(SOURCE, SOURCE);
    expect(initial.occurrences.map(({ symbol, beat }) => [symbol, beat])).toEqual([["Em", 1], ["Am", 3], ["Em", 1]]);
    expect(initial.occurrences[0].selected?.midi).toEqual([40, 47, 52, 55, 59, 64]);
    const barre = guitarChordShapes("Em").find((shape) => shape.frets.join(",") === "X,7,9,9,8,7")!;
    expect(barre).toBeDefined();
    expect(barre.midi).toEqual([52, 59, 64, 67, 71]);
    const overrides = JSON.parse(JSON.stringify([createGuitarChordOverride(initial, initial.occurrences[2], barre)]));
    const score = buildGuitarChordScore(SOURCE, SOURCE, overrides);
    expect(score.occurrences[0].selected?.midi).toEqual([40, 47, 52, 55, 59, 64]);
    expect(score.occurrences[2].selected?.id).toBe(barre.id);
    const result = realizeGuitarChordAudio(audio(SOURCE), score);
    const guitar = result.tracks.at(-1)!;
    expect(guitar.filter((event) => event.cmd === "note" && event.start === 1).map((event) => event.pitch)).toEqual(barre.midi);
    expect(guitar.filter((event) => event.cmd === "note" && event.start === 3).map((event) => event.pitch)).toEqual(barre.midi);
    expect(guitar.every((event) => event.instrument === 24)).toBe(true);
    expect(result.tracks[0]).toEqual(audio(SOURCE).tracks[0]);
  });
  it("ignores stale source decisions", () => {
    const score = buildGuitarChordScore(SOURCE, SOURCE);
    const other = score.occurrences[0].shapes[1];
    const override = createGuitarChordOverride(score, score.occurrences[0], other);
    expect(buildGuitarChordScore(SOURCE, SOURCE + '\n% revision', [override]).occurrences[0].selected?.id).toBe(score.occurrences[0].selected?.id);
  });
  it("keeps tuplets, broken rhythms, rests, pickups, and first/second endings aligned", () => {
    const source = 'X:1\nM:4/4\nL:1/8\nK:C\n"Em" E2 |: (3EFG A>B "Am" z4 |1 "Em" E8 :|2 "Am" A8 |]';
    const score = buildGuitarChordScore(source, source);
    expect(score.occurrences[1].beat).toBe(3);
    const guitar = audio(score.carrierAbc);
    expect(guitar.totalDuration).toBeCloseTo(audio(source).totalDuration);
    expect(guitar.tracks[0].filter((event) => event.cmd === "note").every((event) => Number.isFinite(event.duration) && event.duration! > 0)).toBe(true);
  });
  it("honors N.C. and does not manufacture chords for non-harmonic annotations", () => {
    const source = 'X:1\nM:4/4\nL:1/4\nK:C\n"Em" E4 | "N.C." z4 | "^Verse" E4 | "Am" A4 |';
    const score = buildGuitarChordScore(source, source);
    expect(score.occurrences.map((item) => item.symbol)).toEqual(["Em", "N.C.", "Am"]);
    expect(audio(score.carrierAbc).tracks[0].filter((event) => event.cmd === "note" && event.start! >= 1 && event.start! < 3)).toEqual([]);
  });
  it("preserves the rhythm of an existing support voice without doubling the accompaniment", () => {
    const source = 'X:1\nM:4/4\nL:1/4\n%%score Melody GuitarSupport\nK:C\nV:Melody\n"Em" E4 |\nV:GuitarSupport\n%%MIDI program 25\nC, E G c |';
    const score = buildGuitarChordScore(source, source);
    const base = audio(source);
    const result = realizeGuitarChordAudio(base, score);
    expect(result.tracks).toHaveLength(base.tracks.length);
    expect(result.tracks[0]).toEqual(base.tracks[0]);
    const events = result.tracks[1].filter((event) => event.cmd === "note");
    expect(events.map((event) => event.start)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(events.every((event) => score.occurrences[0].selected?.midi.includes(event.pitch!))).toBe(true);
  });
});
