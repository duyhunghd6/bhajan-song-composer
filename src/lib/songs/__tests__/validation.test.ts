import { describe, expect, it } from "vitest";
import {
  validateAbcNotation,
  validateSongLibrary,
  validateSongMarkdown,
  validateSongSubmission,
} from "../validation";

const validMarkdown = `---
title: "Namostute"
slug: "namostute"
language: "marathi"
category: "praise"
raga: "Bhairav"
taal: "Teentaal"
key: "Em"
timeSignature: "4/4"
videos:
  - type: "beat-karaoke"
    url: "https://youtube.com/watch?v=abcdef"
    label: "Beat Karaoke"
    default: true
abcNotations:
  - type: "melody"
    label: "Melody Music Sheet"
    default: true
tags: ["bhajan", "marathi"]
composer: "Traditional"
contributors: ["community"]
---

## Lyrics

Namostute Namostute
`;

const validAbc = `X:1
T:Namostute
M:4/4
L:1/8
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 :|`;

describe("song validation", () => {
  it("validates YAML frontmatter against the song metadata schema", () => {
    const result = validateSongMarkdown(validMarkdown, "namostute.md");

    expect(result.issues).toEqual([]);
    expect(result.metadata?.slug).toBe("namostute");
  });

  it("reports schema fields for invalid YAML frontmatter", () => {
    const result = validateSongMarkdown("---\ntitle: Namostute\n---", "invalid.md");

    expect(result.metadata).toBeUndefined();
    expect(result.issues.map((issue) => issue.field)).toContain("slug");
    expect(result.issues.map((issue) => issue.path)).toContain("invalid.md");
  });

  it("validates parseable ABC notation", () => {
    expect(validateAbcNotation(validAbc, "namostute.melody.abc")).toEqual([]);
  });

  it("reports missing ABC headers and body notes", () => {
    const issues = validateAbcNotation("X:1\nT:Broken\n", "broken.abc");

    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "ABC notation is missing required M: header",
        "ABC notation is missing required K: header",
        "ABC notation must contain at least one parseable note or chord token",
      ])
    );
  });

  it("validates API-style song submissions", () => {
    const report = validateSongSubmission({ markdown: validMarkdown, abc: validAbc });

    expect(report.valid).toBe(true);
    expect(report.checked).toEqual({ songs: 1, abcFiles: 1 });
  });

  it("validates the checked-in song library", async () => {
    const report = await validateSongLibrary();

    expect(report.valid).toBe(true);
    expect(report.checked.songs).toBeGreaterThanOrEqual(1);
    expect(report.checked.abcFiles).toBeGreaterThanOrEqual(2);
  });
});
