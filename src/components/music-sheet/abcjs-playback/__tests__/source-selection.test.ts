import abcjs from "abcjs";
import { describe, expect, it } from "vitest";

import { prepareAbcjsRenderInput } from "../render-input";
import { buildAbcSourceMap, trimSourceRange } from "../source-map";
import { alignLyricUnits, tokenizeLyricLine } from "../lyric-alignment";
import { resolveScoreTargets, type ScoreSourceElement } from "../source-selection";

const GANESHA = `X:1
T:Ganesha, Ganesha
L:1/8
M:4/4
K:G
V:Melody treble nm="Voice" snm="Voice"
V:Melody
B, |: "Em" E E2 F GF E B, | "Em" E E3- E2 z B, |
w: Ga-|ne- sha Ga- ne- * sha Ga-|ne- sha! _ Ga|
"Em" E E2 F GF E B, | "Em" E E3- E2 B,2 |
w: ne- sha Ga- ne- * sha Ga-|ne- sha _ 1.Su-|
w: |* * * 2.Lam-|`;

/** Mirrors the engraver index using parser ranges (the engraver needs a DOM). */
function parsedIndex(source: string, rendered = source): ScoreSourceElement[] {
  const map = buildAbcSourceMap(source, rendered);
  const tune = abcjs.parseOnly(rendered)[0] as unknown as {
    lines: { staff?: { voices: { el_type: string; startChar: number; endChar: number; rest?: unknown }[][] }[] }[];
  };
  const index: ScoreSourceElement[] = [];
  for (const line of tune.lines) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices) {
        for (const element of voice) {
          const kind = element.el_type === "note" ? (element.rest ? "rest" : "note") : element.el_type === "bar" ? "bar" : "other";
          index.push({ start: map.toSource(element.startChar), end: map.toSource(element.endChar), kind, elements: [] });
        }
      }
    }
  }
  return index.sort((a, b) => a.start - b.start);
}

const caretAt = (text: string, needle: string, offset = 0) => {
  const position = text.indexOf(needle);
  expect(position).toBeGreaterThanOrEqual(0);
  return { start: position + offset, end: position + offset };
};

const sourceOf = (text: string, targets: ScoreSourceElement[]) =>
  targets.map((target) => text.slice(trimSourceRange(text, target).start, trimSourceRange(text, target).end));

describe("buildAbcSourceMap", () => {
  it("is the identity when abcjs renders the source unchanged", () => {
    const map = buildAbcSourceMap(GANESHA, GANESHA);
    expect(map.toSource(42)).toBe(42);
    expect(map.toPrepared(GANESHA.length + 10)).toBe(GANESHA.length);
  });

  it("maps offsets across render-only adaptations that change line length", () => {
    const rendered = prepareAbcjsRenderInput({ abcString: GANESHA, hideVoiceNames: true, overrideKey: "Em" });
    expect(rendered).not.toBe(GANESHA);
    const map = buildAbcSourceMap(GANESHA, rendered);
    const note = GANESHA.indexOf("GF E B,");
    expect(rendered.slice(map.toPrepared(note), map.toPrepared(note) + 7)).toBe("GF E B,");
    expect(map.toSource(map.toPrepared(note))).toBe(note);
  });

  it("maps removed characters to the following kept character", () => {
    const map = buildAbcSourceMap("A {} B", "A  B");
    expect(map.toPrepared(2)).toBe(2);
    expect(map.toPrepared(3)).toBe(2);
    expect(map.toSource(3)).toBe(5);
  });
});

describe("resolveScoreTargets", () => {
  const index = parsedIndex(GANESHA);

  it("targets the note under the caret, including its chord symbol", () => {
    expect(sourceOf(GANESHA, resolveScoreTargets(index, GANESHA, caretAt(GANESHA, "\"Em\" E E2")))).toEqual(["\"Em\" E"]);
    expect(sourceOf(GANESHA, resolveScoreTargets(index, GANESHA, caretAt(GANESHA, "GF E B,", 1)))).toEqual(["F"]);
  });

  it("targets every element overlapped by a selection", () => {
    const start = GANESHA.indexOf("GF E B,");
    const targets = resolveScoreTargets(index, GANESHA, { start, end: start + 4 });
    expect(sourceOf(GANESHA, targets)).toEqual(["G", "F", "E"]);
  });

  it("targets nothing from header lines", () => {
    expect(resolveScoreTargets(index, GANESHA, caretAt(GANESHA, "K:G", 2))).toEqual([]);
  });

  it("follows the source map when the rendered ABC differs", () => {
    const rendered = prepareAbcjsRenderInput({ abcString: GANESHA, hideVoiceNames: true });
    const mapped = parsedIndex(GANESHA, rendered);
    expect(sourceOf(GANESHA, resolveScoreTargets(mapped, GANESHA, caretAt(GANESHA, "GF E B,", 1)))).toEqual(["F"]);
  });

  it("aligns lyric syllables, holds, skips, and bar jumps to notes", () => {
    const sha = caretAt(GANESHA, "sha! _ Ga|", 1);
    expect(sourceOf(GANESHA, resolveScoreTargets(index, GANESHA, sha))).toEqual(["E3-"]);
    const hold = caretAt(GANESHA, "_ Ga|");
    expect(sourceOf(GANESHA, resolveScoreTargets(index, GANESHA, hold))).toEqual(["E2"]);
    // `z` takes no syllable, so "Ga" lands on the pickup B, after the rest.
    const pickup = caretAt(GANESHA, "Ga|\n");
    expect(sourceOf(GANESHA, resolveScoreTargets(index, GANESHA, pickup))).toEqual(["B,"]);
    // Verse 2 jumps one bar, then skips three notes.
    const verse = caretAt(GANESHA, "2.Lam-", 3);
    expect(sourceOf(GANESHA, resolveScoreTargets(index, GANESHA, verse))).toEqual(["B,2"]);
  });
});

describe("lyric tokenizer", () => {
  it("treats a hyphen after a space as its own syllable", () => {
    const text = "w: a- - b\\-c~d";
    const units = tokenizeLyricLine(text, { start: 0, end: text.length });
    expect(units.map((unit) => [unit.kind, text.slice(unit.start, unit.end)])).toEqual([
      ["syllable", "a-"],
      ["syllable", "-"],
      ["syllable", "b\\-c~d"],
    ]);
    expect(alignLyricUnits(units, [{ start: 0, end: 1 }, { start: 1, end: 2 }], [], 0)).toEqual([0, 1, null]);
  });

  it("tolerates lyrics that outrun the notes, or a score that is not indexed yet", () => {
    const text = "w: a b c | d";
    const units = tokenizeLyricLine(text, { start: 0, end: text.length });
    expect(alignLyricUnits(units, [{ start: 0, end: 1 }], [], 0)).toEqual([0, null, null, null, null]);
    expect(resolveScoreTargets([], `K:C\nC D |\n${text}`, { start: 20, end: 20 })).toEqual([]);
  });
});
