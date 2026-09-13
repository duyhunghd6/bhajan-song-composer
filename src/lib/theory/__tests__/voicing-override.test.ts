import { describe, expect, it } from "vitest";
import {
  defaultVoicingOverrideRange,
  isCandidateCompatibleWithOverride,
  revalidateVoicingOverride,
  resolveVoicing,
  type GuitarVoicingCandidate,
  type VoicingOverride,
  type VoicingOverrideValidationReport,
  type VoicingWindowRange,
} from "../voicing-override";

const chordWindow: VoicingWindowRange = {
  scope: "chord-window",
  chordWindowId: "m3-beat1-am",
  start: { measureIndex: 2, beat: 1 },
  end: { measureIndex: 2, beat: 3 },
};

const validCheck = { valid: true, reasons: [] };
const validValidation: VoicingOverrideValidationReport = {
  evaluatedAt: "2026-09-14T00:00:00.000Z",
  candidateAvailable: true,
  chordIdentity: validCheck,
  singerYield: validCheck,
  physical: validCheck,
  leftEdgeTransition: validCheck,
  rightEdgeTransition: validCheck,
  diagnostics: [],
};

const amChordIdentity = {
  symbol: "Am",
  normalizedSymbol: "Amin",
  chordWindowIds: ["m3-beat1-am"],
};

function makeOverride(overrides: Partial<VoicingOverride> = {}): VoicingOverride {
  return {
    id: "override-am-high",
    instrument: "guitar-classic",
    windowRange: chordWindow,
    baseChordIdentity: amChordIdentity,
    voicingId: "guitar-am-e-form-5",
    sourceRevisionId: "harmony-r1",
    createdFromPlanRevisionId: "guitar-plan-r1",
    createdAt: "2026-09-14T00:00:00.000Z",
    validation: validValidation,
    status: "valid",
    ...overrides,
  };
}

describe("VoicingOverride", () => {
  it("defaults an inspector edit to the selected chord window", () => {
    expect(defaultVoicingOverrideRange({
      chordWindowId: "m3-beat1-am",
      start: { measureIndex: 2, beat: 1 },
      end: { measureIndex: 2, beat: 3 },
    })).toEqual(chordWindow);
  });

  it("keeps Guitar candidate metadata bound to the locked chord and selected voicing", () => {
    const override = makeOverride();
    const candidate: GuitarVoicingCandidate = {
      instrument: "guitar-classic",
      voicingId: "guitar-am-e-form-5",
      chordIdentity: override.baseChordIdentity,
      spelledPitches: ["A2", "E3", "A3", "C4", "E4"],
      register: { lowestMidi: 45, highestMidi: 64 },
      transitionCost: 4,
      validation: { chordIdentity: validCheck, singerYield: validCheck, physical: validCheck },
      shapeLabel: "E-form barre at fifth position",
      positionFret: 5,
      frets: [5, 7, 7, 5, 5, 5],
      strings: [6, 5, 4, 3, 2, 1],
      barre: { fret: 5, fromString: 6, toString: 1 },
      fingerCost: 4,
      bassNote: "A2",
      capo: 0,
    };

    expect(isCandidateCompatibleWithOverride(candidate, override)).toBe(true);
    expect(isCandidateCompatibleWithOverride({ ...candidate, voicingId: "open-am" }, override)).toBe(false);
  });

  it("uses the narrowest valid override, then lets an explicit local fill win", () => {
    const sectionOverride = makeOverride({
      id: "section-am",
      voicingId: "guitar-am-open",
      windowRange: {
        scope: "section",
        sectionId: "verse-a",
        start: { measureIndex: 0, beat: 1 },
        end: { measureIndex: 8, beat: 1 },
      },
    });
    const resolution = resolveVoicing({
      instrument: "guitar-classic",
      targetRange: chordWindow,
      targetChordIdentity: amChordIdentity,
      snapshot: { voicingId: "snapshot-am" },
      profilePlan: { voicingId: "profile-am" },
      voicingPlan: { voicingId: "plan-am" },
      overrides: [sectionOverride, makeOverride()],
      localRealizations: [{
        id: "fill-1",
        type: "fill",
        appliesTo: chordWindow,
        replacementVoicingId: "fill-am-high",
      }],
    });

    expect(resolution.voicingId).toBe("fill-am-high");
    expect(resolution.source).toBe("local-realization");
    expect(resolution.appliedOverride?.id).toBe("override-am-high");
  });

  it("does not render review or stale overrides, but leaves their selection intact", () => {
    const resolution = resolveVoicing({
      instrument: "guitar-classic",
      targetRange: chordWindow,
      targetChordIdentity: amChordIdentity,
      snapshot: { voicingId: "snapshot-am" },
      voicingPlan: { voicingId: "plan-am" },
      overrides: [makeOverride({ status: "review" }), makeOverride({ id: "stale", status: "stale" })],
    });

    expect(resolution).toMatchObject({ voicingId: "plan-am", source: "voicing-plan" });
  });

  it("marks a changed source stale without deleting or replacing the chosen voicing", () => {
    const stale = revalidateVoicingOverride({
      override: makeOverride(),
      currentSourceRevisionId: "harmony-r2",
      validation: validValidation,
    });

    expect(stale.status).toBe("stale");
    expect(stale.voicingId).toBe("guitar-am-e-form-5");
    expect(stale.sourceRevisionId).toBe("harmony-r1");
    expect(stale.lastValidatedAgainstRevisionId).toBe("harmony-r2");
  });

  it("keeps a same-source failed edge transition for review", () => {
    const review = revalidateVoicingOverride({
      override: makeOverride(),
      currentSourceRevisionId: "harmony-r1",
      validation: {
        ...validValidation,
        rightEdgeTransition: { valid: false, reasons: ["Next chord requires an unplayable jump."] },
      },
    });

    expect(review.status).toBe("review");
    expect(review.voicingId).toBe("guitar-am-e-form-5");
  });
});
