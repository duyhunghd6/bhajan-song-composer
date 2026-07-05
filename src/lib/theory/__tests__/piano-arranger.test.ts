import { describe, it, expect } from "vitest";
import { generatePianoBassArrangement, generatePianoBassLine } from "../piano-arranger";
import { sampleAbc } from "./arranger-fixtures";

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

