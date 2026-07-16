import { describe, expect, it } from "vitest";
import { cleanAbcMeasureSegment } from "../../abc-duration";
import { processGuitarLine } from "../../guitar-string-forcing";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";

describe("cross-measure tie preservation", () => {
  const keyAccidentals = getKeyAccidentalsFromAbc("K:G");

  it("preserves trailing tie (-) on the last note after cleanAbcMeasureSegment", () => {
    const input = '"Am" G A2 B- "B7" B4-';
    const cleaned = cleanAbcMeasureSegment(input);
    expect(cleaned).toBe('"Am" G A2 B- "B7" B4-');
    expect(cleaned.endsWith("-")).toBe(true);
  });

  it("strips volta brackets and repeat colons but preserves music", () => {
    const input = "[1,2 B4 B2 z B, :";
    const cleaned = cleanAbcMeasureSegment(input);
    expect(cleaned).toBe("B4 B2 z B,");
    expect(cleaned).not.toContain("[1,2");
    expect(cleaned).not.toContain(":");
  });

  it("preserves trailing tie through processGuitarLine", () => {
    const input = '"Am" G A2 B- "B7" B4-';
    const cleaned = cleanAbcMeasureSegment(input);
    const guitar = processGuitarLine(cleaned, keyAccidentals);
    // The guitar output must end with '-' (cross-measure tie preserved)
    expect(guitar.endsWith("-")).toBe(true);
    // The within-measure tie B- must also be present
    expect(guitar).toContain("-");
    // Count the ties: should have at least 2 (B- and B4-)
    const tieCount = (guitar.match(/-/g) || []).length;
    expect(tieCount).toBeGreaterThanOrEqual(2);
  });

  it("preserves within-measure tie with segno marker", () => {
    const input = "S E E3- E2 z2";
    const cleaned = cleanAbcMeasureSegment(input);
    expect(cleaned).toBe("S E E3- E2 z2");
    const guitar = processGuitarLine(cleaned, keyAccidentals);
    // Tie E3- must be preserved
    expect(guitar).toContain("-");
    // Segno S must be preserved (as gap text)
    expect(guitar).toContain("S");
  });
});
