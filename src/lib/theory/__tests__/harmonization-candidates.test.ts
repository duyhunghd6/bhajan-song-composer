import { describe, expect, it } from "vitest";
import {
  HarmonizationValidationError,
  normalizeHarmonizeResult,
  validateAbcParseability,
  validateNoNewAccompaniment,
  validateStrongBeatSupport,
  type HarmonizeMetadata,
  type HarmonizationOption,
} from "../harmonization-candidates";

const sourceAbc = `X:1
T:Validation Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 |`;

const metadata: HarmonizeMetadata = {
  key: "Em",
  scale: "natural minor",
  timeSignature: "4/4",
  raga: "Bhimpalasi",
  taal: "Keherva",
};

const candidateAbcs = {
  devotional: `X:1
T:Validation Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| "Em"E2 E2 G2 A2 | "Bm"B4 B2 A2 | "G"G2 A2 B2 G2 | "Em"E8 |`,
  ballad: `X:1
T:Validation Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| "Em"E2 E2 G2 A2 | "G"B4 B2 A2 | "Em"G2 A2 B2 G2 | "Em"E8 |`,
  minimal: `X:1
T:Validation Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| "Em"E2 E2 G2 A2 | "Em"B4 B2 A2 | "G"G2 A2 B2 G2 | "Em"E8 |`,
  functional: `X:1
T:Validation Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| "Em"E2 E2 G2 A2 | "Bm"B4 B2 A2 | "Em"G2 A2 B2 G2 | "Em"E8 |`,
  rich: `X:1
T:Validation Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| "Em"E2 E2 G2 A2 | "G"B4 B2 A2 | "Bm"G2 A2 B2 G2 | "Em"E8 |`,
};

function option(id: string, label: string, progression: string[], romanNumerals: string[], harmonizedAbc: string): Omit<HarmonizationOption, "progression_name" | "abc"> {
  return {
    id,
    label,
    style: id,
    progression,
    romanNumerals,
    explanation: `${label} keeps the original melody and supports strong beats with ${progression.join(", ")}.`,
    harmonizedAbc,
    confidence: 0.9,
    warnings: [],
    validationNotes: [],
  };
}

function validRawResult() {
  return {
    detectedKey: "E",
    detectedScale: "natural minor",
    timeSignature: "4/4",
    options: [
      option("simple-devotional", "Simple Devotional", ["Em", "Bm", "G", "Em"], ["i", "v", "III", "i"], candidateAbcs.devotional),
      option("emotional-ballad", "Emotional Ballad", ["Em", "G", "Em", "Em"], ["i", "III", "i", "i"], candidateAbcs.ballad),
      option("raga-aware-minimal", "Raga-Aware Minimal", ["Em", "Em", "G", "Em"], ["i", "i", "III", "i"], candidateAbcs.minimal),
      option("western-functional", "Western Functional", ["Em", "Bm", "Em", "Em"], ["i", "v", "i", "i"], candidateAbcs.functional),
      option("rich-reharmonization", "Rich Reharmonization", ["Em", "G", "Bm", "Em"], ["i", "III", "v", "i"], candidateAbcs.rich),
    ],
  };
}

describe("harmonization candidate validation", () => {
  it("normalizes a valid 5-option response and populates compatibility aliases", () => {
    const result = normalizeHarmonizeResult(validRawResult(), sourceAbc, metadata);

    expect(result.options).toHaveLength(5);
    expect(result.detectedKey).toBe("E");
    expect(result.detectedScale).toBe("natural minor");
    expect(result.options[0]).toMatchObject({
      id: "simple-devotional",
      progression_name: "Simple Devotional",
      abc: candidateAbcs.devotional,
    });
    expect(result.options[0].validationNotes).toContain("Strong-beat melody notes are supported by candidate chord tones.");
  });

  it("rejects responses that do not contain exactly 5 options", () => {
    const raw = validRawResult();
    raw.options = raw.options.slice(0, 4);

    expect(() => normalizeHarmonizeResult(raw, sourceAbc, metadata)).toThrow(HarmonizationValidationError);
  });

  it("rejects duplicate candidate progressions", () => {
    const raw = validRawResult();
    raw.options[1].progression = [...raw.options[0].progression];

    expect(() => normalizeHarmonizeResult(raw, sourceAbc, metadata)).toThrow(/duplicates another candidate progression/);
  });

  it("rejects candidates that change melody notes or durations", () => {
    const raw = validRawResult();
    raw.options[0].harmonizedAbc = raw.options[0].harmonizedAbc.replace("E2 E2", "E2 F2");

    expect(() => normalizeHarmonizeResult(raw, sourceAbc, metadata)).toThrow(/changes melody notes/);
  });

  it("rejects candidates that add accompaniment voices", () => {
    const raw = validRawResult();
    raw.options[0].harmonizedAbc = `${raw.options[0].harmonizedAbc}\nV:Bass clef=bass\n| E,,8 |`;

    expect(() => normalizeHarmonizeResult(raw, sourceAbc, metadata)).toThrow(/adds a new V: voice/);
  });

  it("rejects candidates without inline chord annotations", () => {
    const raw = validRawResult();
    raw.options[0].harmonizedAbc = sourceAbc;

    expect(() => normalizeHarmonizeResult(raw, sourceAbc, metadata)).toThrow(/contains no inline chord symbols/);
  });

  it("reports strong-beat warnings for unsupported chord tones", () => {
    const warnings = validateStrongBeatSupport(
      {
        ...validRawResult().options[0],
        progression_name: "Unsupported",
        abc: candidateAbcs.devotional,
        harmonizedAbc: candidateAbcs.devotional.replace('"Em"E2', '"F"E2'),
        progression: ["F", "Bm", "G", "Em"],
      },
      sourceAbc,
      metadata,
    );

    expect(warnings.some((warning) => warning.includes("strong-beat note E is not in chord F"))).toBe(true);
  });

  it("validates abcjs parseability", () => {
    expect(validateAbcParseability(candidateAbcs.devotional)).toEqual([]);
  });

  it("detects newly-added accompaniment constructs directly", () => {
    expect(validateNoNewAccompaniment(sourceAbc, `${sourceAbc}\n%%score (Melody Bass)`)).toContain("candidate adds a %%score directive");
  });
});
