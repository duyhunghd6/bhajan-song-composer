import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildChordVoicingInspectorModel,
  ChordVoicingInspector,
  VOICING_OVERRIDE_SCOPE_OPTIONS,
  type VoicingCandidate,
} from "../ChordVoicingInspector";

const candidates: VoicingCandidate[] = [
  {
    id: "am-open",
    instrument: "guitar",
    label: "Am open",
    status: "current",
    details: { shape: "Am", register: "low/mid", strings: "strings 5-1", transition: "easy transition" },
  },
  {
    id: "am-barre-f5",
    instrument: "guitar",
    label: "Am E-form barre f5",
    status: "valid",
    details: { shape: "E-form barre", register: "high", transition: "lift after lyric onset" },
  },
  {
    id: "am-piano-current",
    instrument: "piano",
    label: "Am close RH",
    status: "current",
    details: { leftHand: "A2–E3", rightHand: "A3–C4–E4", inversion: "root position" },
  },
  {
    id: "am-piano-wide",
    instrument: "piano",
    label: "Am wide RH",
    status: "review",
    details: { leftHand: "A2–E3", rightHand: "C4–E4–A4", inversion: "root position", handSpan: "wide span" },
    warning: "Check right-hand collision",
  },
];

describe("ChordVoicingInspector", () => {
  it("keeps the selected strong beat and locked chord identity visible", () => {
    const markup = renderToStaticMarkup(
      <ChordVoicingInspector
        context={{ chordWindowId: "m4-b3", measure: 4, beat: 3, chordIdentity: "Am", singer: { activity: "sustain", note: "E4" }, profileName: "Bhajan strum" }}
        candidates={candidates}
      />,
    );

    expect(markup).toContain("Strong beat: m.4 · beat 3 · Am");
    expect(markup).toContain("Singer: sustain (E4)");
    expect(markup).toContain("profile: Bhajan strum");
    expect(markup).toContain("GUITAR — same chord, different realization");
    expect(markup).toContain("PIANO — same chord, different realization");
    expect(markup).toContain("Am E-form barre f5");
    expect(markup).toContain("A2–E3");
  });

  it("offers exactly chord-window, phrase, and section as edit scopes", () => {
    expect(VOICING_OVERRIDE_SCOPE_OPTIONS.map((option) => option.value)).toEqual(["window", "phrase", "section"]);
    const markup = renderToStaticMarkup(
      <ChordVoicingInspector context={{ chordWindowId: "m4-b3", measure: 4, beat: 3, chordIdentity: "Am" }} candidates={candidates} />,
    );

    expect(markup).toContain("This chord window");
    expect(markup).toContain("Phrase");
    expect(markup).toContain("Section");
    expect(markup).not.toContain("Entire song");
  });

  it("models current/candidate A-B state and prevents a review candidate from applying", () => {
    const model = buildChordVoicingInspectorModel(candidates, "am-piano-wide");
    expect(model.currentCandidate?.id).toBe("am-piano-current");
    expect(model.selectedCandidate?.id).toBe("am-piano-wide");

    const markup = renderToStaticMarkup(
      <ChordVoicingInspector
        context={{ chordWindowId: "m4-b3", measure: 4, beat: 3, chordIdentity: "Am", previewRangeLabel: "m.3–5" }}
        candidates={candidates}
        selectedCandidateId="am-piano-wide"
        auditionMode="ab-loop"
      />,
    );

    expect(markup).toContain("A: Am close RH · B: Am wide RH · Auditioning ab-loop");
    expect(markup).toContain("A/B loop m.3–5");
    expect(markup).toContain("Warning: Check right-hand collision");
    expect(markup).toContain("Apply voicing</button>");
    expect(markup).toMatch(/Apply voicing<\/button>/);
    expect(markup).toContain('disabled=""');
  });
});
