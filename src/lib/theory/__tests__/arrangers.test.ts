import { describe, it, expect } from "vitest";
import { generateFingerstyleArrangement, generateFingerstyleLine } from "../fingerstyle-arranger";
import { generatePianoBassArrangement, generatePianoBassLine } from "../piano-arranger";

const sampleAbc = `X:1
T:Namostute
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

describe("Piano arranger", () => {
  it("generates bass-clef root-fifth patterns for every chord measure", () => {
    const arrangement = generatePianoBassArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.key).toBe("Em");
    expect(arrangement.timeSignature).toBe("4/4");
    expect(arrangement.measures).toHaveLength(4);
    expect(arrangement.measures[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      notes: ["E,,", "B,,", "E,", "B,,"],
      abc: "E,,2 B,,2 E,2 B,,2",
    });
    expect(arrangement.abc).toContain("V:Bass clef=bass");
    expect(arrangement.abc).toContain("| E,,2 B,,2 E,2 B,,2 |");
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generatePianoBassLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith("V:Bass clef=bass")).toBe(true);
    expect(line).toContain("B,,2");
  });
});

describe("Guitar fingerstyle arranger", () => {
  it("interleaves chord bass notes with melody notes", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.key).toBe("Em");
    expect(arrangement.measures).toHaveLength(4);
    expect(arrangement.measures[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      bassNotes: ["E,", "B,"],
      melodyNotes: ["E", "E"],
      abc: "E,2 E2 B,2 E2",
    });
    expect(arrangement.abc).toContain("V:Guitar clef=treble-8");
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generateFingerstyleLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith("V:Guitar clef=treble-8")).toBe(true);
    expect(line).toContain("E,2 E2 B,2 E2");
  });
});
