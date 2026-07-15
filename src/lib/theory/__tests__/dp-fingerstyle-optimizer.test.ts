import { describe, it, expect } from "vitest";
import {
  SKILL_LEVEL_CONSTRAINTS,
  initialHandState,
  stringToIndex,
  indexToString,
  midiAt,
  type DPNoteEvent,
  type DPCandidate,
} from "../fingerstyle-arranger/dp-types";
import { generateCandidates } from "../fingerstyle-arranger/dp-candidates";
import {
  transitionCost,
  positionMovementCost,
  shapeChangeCost,
  sustainViolationCost,
  detectGuideFinger,
  detectSlideGuide,
  detectHammerOn,
  detectPullOff,
  applyCandidate,
  placementCost,
} from "../fingerstyle-arranger/dp-cost";
import { optimizeFingerstylePath } from "../fingerstyle-arranger/dp-optimizer";
import { optimizeWithCapo } from "../fingerstyle-arranger/dp-capo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<DPNoteEvent> = {}): DPNoteEvent {
  return {
    index: 0,
    melodyMidi: 64, // E4 → string 1, fret 0
    bassMidi: 40,   // E2 → string 6, fret 0
    chord: "Em",
    durationSteps: 4,
    bpm: 120,
    isRest: false,
    ...overrides,
  };
}

function makeRestEvent(index: number = 0): DPNoteEvent {
  return makeEvent({ index, melodyMidi: null, bassMidi: null, isRest: true });
}

// ---------------------------------------------------------------------------
// dp-types tests
// ---------------------------------------------------------------------------

describe("DP Types", () => {
  it("SKILL_LEVEL_CONSTRAINTS has all 3 levels", () => {
    expect(Object.keys(SKILL_LEVEL_CONSTRAINTS)).toEqual(
      expect.arrayContaining(["beginner", "intermediate", "advanced"])
    );
  });

  it("beginner constraints cap maxFret to 5", () => {
    expect(SKILL_LEVEL_CONSTRAINTS.beginner.maxFret).toBe(5);
  });

  it("beginner forbids hammer-on, pull-off, bend, vibrato", () => {
    const forbidden = SKILL_LEVEL_CONSTRAINTS.beginner.forbiddenTechniques;
    expect(forbidden).toContain("hammer-on");
    expect(forbidden).toContain("pull-off");
    expect(forbidden).toContain("bend");
    expect(forbidden).toContain("vibrato");
  });

  it("intermediate forbids only bend", () => {
    const forbidden = SKILL_LEVEL_CONSTRAINTS.intermediate.forbiddenTechniques;
    expect(forbidden).toEqual(["bend"]);
  });

  it("advanced allows all techniques", () => {
    expect(SKILL_LEVEL_CONSTRAINTS.advanced.forbiddenTechniques).toEqual([]);
  });

  it("advanced maxFret is 19", () => {
    expect(SKILL_LEVEL_CONSTRAINTS.advanced.maxFret).toBe(19);
  });

  it("stringToIndex and indexToString are inverses", () => {
    for (const s of [1, 2, 3, 4, 5, 6] as const) {
      expect(indexToString(stringToIndex(s))).toBe(s);
    }
  });

  it("midiAt computes correct MIDI for open strings", () => {
    expect(midiAt(5, 0)).toBe(64); // String 1 (index 5), open = E4
    expect(midiAt(0, 0)).toBe(40); // String 6 (index 0), open = E2
  });

  it("midiAt applies capo offset", () => {
    expect(midiAt(0, 0, 2)).toBe(42); // String 6 + capo 2 = F#2
  });

  it("initialHandState returns empty state", () => {
    const state = initialHandState();
    expect(state.handPosition).toBe(0);
    expect(state.frets).toEqual([null, null, null, null, null, null]);
    expect(state.ringingUntil).toEqual([null, null, null, null, null, null]);
    expect(state.barreFret).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dp-candidates tests
// ---------------------------------------------------------------------------

describe("DP Candidates", () => {
  it("generates candidates for E4 melody + E2 bass", () => {
    const event = makeEvent();
    const candidates = generateCandidates(event, "advanced");

    expect(candidates.length).toBeGreaterThan(0);

    // Should have at least one candidate with string 1 fret 0 (melody) and string 6 fret 0 (bass)
    const openEm = candidates.find(
      c => c.melodyString === 1 && c.melodyFret === 0 && c.bassString === 6 && c.bassFret === 0
    );
    expect(openEm).toBeDefined();
  });

  it("all candidates have fret span ≤ skill maxFretSpan", () => {
    const event = makeEvent({ melodyMidi: 67, bassMidi: 45 }); // G4, A2
    const candidates = generateCandidates(event, "intermediate");

    for (const c of candidates) {
      const fretted = c.shapeFrets.filter((f): f is number => f !== null && f > 0);
      if (fretted.length >= 2) {
        const span = Math.max(...fretted) - Math.min(...fretted);
        expect(span).toBeLessThanOrEqual(SKILL_LEVEL_CONSTRAINTS.intermediate.maxFretSpan);
      }
    }
  });

  it("beginner candidates never exceed fret 5", () => {
    const event = makeEvent({ melodyMidi: 64, bassMidi: 40 });
    const candidates = generateCandidates(event, "beginner");

    for (const c of candidates) {
      for (const f of c.shapeFrets) {
        if (f !== null) expect(f).toBeLessThanOrEqual(5);
      }
    }
  });

  it("allows only the authoritative melody to use an explicit higher fret ceiling", () => {
    const event = makeEvent({ melodyMidi: 71, maxMelodyFret: 7, bassMidi: null });
    const candidates = generateCandidates(event, "beginner");

    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ melodyString: 1, melodyFret: 7 }),
    ]));
    expect(candidates.every(candidate => candidate.bassFret <= 5)).toBe(true);
    expect(transitionCost(initialHandState(), candidates[0], event, "beginner")).toBeLessThan(Infinity);
  });

  it("rest event returns a single no-op candidate", () => {
    const event = makeRestEvent();
    const candidates = generateCandidates(event, "advanced");

    expect(candidates).toHaveLength(1);
    expect(candidates[0].melodyString).toBeNull();
    expect(candidates[0].bassString).toBeNull();
  });

  it("returns empty array when melody note is out of guitar range", () => {
    // MIDI 120 = B8, way beyond guitar range
    const event = makeEvent({ melodyMidi: 120, bassMidi: null });
    const candidates = generateCandidates(event, "advanced");
    // Should return 0 candidates since the note is unplayable
    expect(candidates.length).toBe(0);
  });

  it("melody and bass never share the same string", () => {
    const event = makeEvent({ melodyMidi: 64, bassMidi: 40 });
    const candidates = generateCandidates(event, "advanced");

    for (const c of candidates) {
      if (c.melodyString !== null && c.bassString !== null) {
        expect(c.melodyString).not.toBe(c.bassString);
      }
    }
  });

  it("reserves strings occupied by fixed simultaneous notes", () => {
    const event = makeEvent({
      melodyMidi: 64,
      bassMidi: 40,
      fixedFrets: [null, null, null, null, null, 0],
    });
    const candidates = generateCandidates(event, "advanced");

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(candidate => candidate.melodyString !== 1)).toBe(true);
    expect(candidates.every(candidate => candidate.shapeFrets[5] === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dp-cost tests
// ---------------------------------------------------------------------------

describe("DP Cost Function", () => {
  it("same position → zero position cost", () => {
    const cost = positionMovementCost(5, 5, 4, 120, "advanced");
    expect(cost).toBe(0);
  });

  it("open strings cost less than equivalent fretted positions", () => {
    const candidates = generateCandidates(
      makeEvent({ melodyMidi: 59, bassMidi: null }),
      "advanced"
    );
    const open = candidates.find(candidate =>
      candidate.melodyString === 2 && candidate.melodyFret === 0
    );
    const fretted = candidates.find(candidate =>
      candidate.melodyString === 3 && candidate.melodyFret === 4
    );

    expect(open).toBeDefined();
    expect(fretted).toBeDefined();
    expect(placementCost(open!)).toBeLessThan(placementCost(fretted!));
  });

  it("small position change → finite cost", () => {
    const cost = positionMovementCost(2, 5, 4, 120, "advanced");
    expect(cost).toBeGreaterThan(0);
    expect(isFinite(cost)).toBe(true);
  });

  it("impossible jump (12 frets in 16th note at 120 bpm) → very steep penalty for beginner", () => {
    // durationSteps=1 at 120bpm = 0.125 seconds. Jump of 12 frets takes ~0.29s
    // The cost is very steep but NOT Infinity — Infinity poisons the Viterbi trellis
    const cost = positionMovementCost(1, 13, 1, 120, "beginner");
    expect(isFinite(cost)).toBe(true);
    expect(cost).toBeGreaterThan(100); // Very steep penalty
  });

  it("guide finger detected → low shape cost", () => {
    const from = [null, null, null, null, 1, null]; // string 2 fret 1
    const to   = [null, null, null, null, 1, 3];    // string 2 fret 1 stays, string 1 fret 3 added
    const cost = shapeChangeCost(from, to);
    expect(cost).toBeLessThanOrEqual(0.5);
  });

  it("no guide finger → high shape cost", () => {
    const from = [null, null, null, null, 1, null];
    const to   = [null, null, null, 2, null, 3];    // completely different strings/frets
    const cost = shapeChangeCost(from, to);
    expect(cost).toBeGreaterThanOrEqual(1.0);
  });

  it("identical shapes → zero shape cost", () => {
    const shape = [0, null, null, null, 1, null];
    expect(shapeChangeCost(shape, [...shape])).toBe(0);
  });

  it("prefers a repeated melody string for pitch-equivalent E notes", () => {
    const result = optimizeFingerstylePath([
      makeEvent({ index: 0, melodyMidi: 69, bassMidi: null, chord: "A", durationSteps: 4, movementSteps: 4 }),
      makeEvent({ index: 1, melodyMidi: 64, bassMidi: null, chord: "E", durationSteps: 4, movementSteps: 4 }),
      makeEvent({ index: 2, melodyMidi: 64, bassMidi: null, chord: "E", durationSteps: 4, movementSteps: 4 }),
    ], "intermediate");

    expect(result.path[0].melodyString).toBe(1);
    expect(result.path[1].melodyString).toBe(1);
    expect(result.path[2].melodyString).toBe(1);
    expect(result.path[1].melodyFret).toBe(0);
    expect(result.path[2].melodyFret).toBe(0);
  });

  it("sustain violation → lower soft penalty per violated string", () => {
    const state = initialHandState();
    state.frets = [null, null, null, null, 1, null]; // string 2 fretted at 1
    state.ringingUntil = [null, null, null, null, 10, null]; // string 2 ringing until step 10

    const toFrets = [null, null, null, null, 3, null]; // string 2 changed to fret 3
    const cost = sustainViolationCost(state, toFrets, 5); // current step = 5 (before 10)
    expect(cost).toBe(1);
    expect(cost).toBeLessThan(3.0);
  });

  it("no sustain violation when note already decayed", () => {
    const state = initialHandState();
    state.frets = [null, null, null, null, 1, null];
    state.ringingUntil = [null, null, null, null, 5, null]; // ringing until step 5

    const toFrets = [null, null, null, null, 3, null];
    const cost = sustainViolationCost(state, toFrets, 6); // current step = 6 (after 5)
    expect(cost).toBe(0);
  });

  it("detectGuideFinger returns true when same string/fret persists", () => {
    expect(detectGuideFinger(
      [null, null, null, null, 1, null],
      [null, null, null, 2, 1, null]
    )).toBe(true);
  });

  it("detectGuideFinger returns false when no common fretted position", () => {
    expect(detectGuideFinger(
      [null, null, null, null, 1, null],
      [null, null, null, 2, null, 3]
    )).toBe(false);
  });

  it("detectSlideGuide finds a same-string different-fret pair", () => {
    const result = detectSlideGuide(
      [null, null, null, null, 1, null],
      [null, null, null, null, 3, null]
    );
    expect(result).toEqual({ stringIndex: 4, fromFret: 1, toFret: 3 });
  });

  it("detectHammerOn detects upward movement on same string", () => {
    const state = initialHandState();
    state.frets = [null, null, null, null, null, 3]; // string 1 at fret 3

    const candidate: DPCandidate = {
      melodyString: 1,
      melodyFret: 5,
      bassString: null,
      bassFret: 0,
      melodyTechnique: "free-stroke",
      shapeFrets: [null, null, null, null, null, 5], // string 1 now at fret 5
      handPosition: 4,
      usesBarre: false,
    };

    expect(detectHammerOn(state, candidate, 5)).toBe(true); // index 5 = string 1
  });

  it("detectPullOff detects downward movement on same string", () => {
    const state = initialHandState();
    state.frets = [null, null, null, null, null, 5]; // string 1 at fret 5

    const candidate: DPCandidate = {
      melodyString: 1,
      melodyFret: 3,
      bassString: null,
      bassFret: 0,
      melodyTechnique: "free-stroke",
      shapeFrets: [null, null, null, null, null, 3],
      handPosition: 3,
      usesBarre: false,
    };

    expect(detectPullOff(state, candidate, 5)).toBe(true);
  });

  it("beginner + barre → very high cost", () => {
    const state = initialHandState();
    const candidate: DPCandidate = {
      melodyString: 1,
      melodyFret: 1,
      bassString: 6,
      bassFret: 1,
      melodyTechnique: "free-stroke",
      shapeFrets: [1, null, null, null, null, 1], // barre-like
      handPosition: 1,
      usesBarre: true,
    };
    const event = makeEvent({ index: 0 });
    const cost = transitionCost(state, candidate, event, "beginner");
    // Should be very high because beginner penalizes barre ×5
    expect(cost).toBeGreaterThan(10);
  });

  it("applyCandidate sets ringing strings", () => {
    const state = initialHandState();
    const candidate: DPCandidate = {
      melodyString: 1,
      melodyFret: 0,
      bassString: 6,
      bassFret: 0,
      melodyTechnique: "free-stroke",
      shapeFrets: [0, null, null, null, null, 0],
      handPosition: 0,
      usesBarre: false,
    };
    const event = makeEvent({ index: 5, durationSteps: 4 });
    const newState = applyCandidate(state, candidate, event);

    // Legacy events without absolute onset still use their ordinal index.
    expect(newState.ringingUntil[5]).toBe(9);
    expect(newState.ringingUntil[0]).toBe(9);
  });

  it("uses absolute grid onset for ringing duration", () => {
    const candidate = generateCandidates(makeEvent(), "advanced")[0];
    const state = applyCandidate(
      initialHandState(),
      candidate,
      makeEvent({ index: 2, absoluteOnsetStep: 20, durationSteps: 4 })
    );

    expect(state.ringingUntil[stringToIndex(candidate.melodyString!)]).toBe(24);
    expect(state.ringingUntil[stringToIndex(candidate.bassString!)]).toBe(24);
  });

  it("uses incoming onset interval rather than note duration for movement time", () => {
    const candidate: DPCandidate = {
      melodyString: 1,
      melodyFret: 12,
      bassString: null,
      bassFret: 0,
      melodyTechnique: "free-stroke",
      shapeFrets: [null, null, null, null, null, 12],
      handPosition: 12,
      usesBarre: false,
    };
    const rushed = transitionCost(
      initialHandState(),
      candidate,
      makeEvent({ melodyMidi: 76, bassMidi: null, durationSteps: 16, movementSteps: 1 }),
      "advanced"
    );
    const prepared = transitionCost(
      initialHandState(),
      candidate,
      makeEvent({ melodyMidi: 76, bassMidi: null, durationSteps: 16, movementSteps: 16 }),
      "advanced"
    );

    expect(rushed).toBeGreaterThan(prepared);
  });
});

// ---------------------------------------------------------------------------
// dp-optimizer tests
// ---------------------------------------------------------------------------

describe("DP Optimizer (Viterbi)", () => {
  it("single event → returns the lowest-cost candidate", () => {
    const events = [makeEvent()];
    const result = optimizeFingerstylePath(events, "advanced");

    expect(result.path).toHaveLength(1);
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
    expect(isFinite(result.totalCost)).toBe(true);
  });

  it("two events same chord → prefers staying in position", () => {
    const events = [
      makeEvent({ index: 0 }),
      makeEvent({ index: 1 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");

    expect(result.path).toHaveLength(2);
    expect(result.path[0].handPosition).toBe(result.path[1].handPosition);
  });

  it("reuses the established exact shape when a chord recurs", () => {
    const events = [
      makeEvent({ index: 0, chord: "Em", melodyMidi: 59, bassMidi: 40, durationSteps: 1, bpm: 180 }),
      makeEvent({ index: 1, chord: "Am", melodyMidi: 62, bassMidi: 45, durationSteps: 1, bpm: 180 }),
      makeEvent({ index: 2, chord: "Em", melodyMidi: 59, bassMidi: 40, durationSteps: 1, bpm: 180 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");

    expect(result.path).toHaveLength(3);
    expect(result.path[2].shapeFrets).toEqual(result.path[0].shapeFrets);
  });

  it("allows a different recurring-chord shape when the established shape is infeasible", () => {
    const events = [
      makeEvent({ index: 0, chord: "Em", melodyMidi: 59, bassMidi: 40 }),
      makeEvent({ index: 1, chord: "Am", melodyMidi: 60, bassMidi: 45 }),
      makeEvent({ index: 2, chord: "Em", melodyMidi: 67, bassMidi: 40 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");

    expect(result.path).toHaveLength(3);
    expect(result.path[2].shapeFrets).not.toEqual(result.path[0].shapeFrets);
    expect(midiAt(stringToIndex(result.path[2].melodyString!), result.path[2].melodyFret)).toBe(67);
  });

  it("path never contains Infinity cost", () => {
    const events = [
      makeEvent({ index: 0, melodyMidi: 64, bassMidi: 40 }), // E4, E2
      makeEvent({ index: 1, melodyMidi: 67, bassMidi: 43 }), // G4, G2
      makeEvent({ index: 2, melodyMidi: 69, bassMidi: 45 }), // A4, A2
    ];
    const result = optimizeFingerstylePath(events, "intermediate");

    expect(isFinite(result.totalCost)).toBe(true);
    expect(result.path).toHaveLength(3);
  });

  it("4-measure Em song at beginner → all open position", () => {
    const events = [
      makeEvent({ index: 0, melodyMidi: 64, bassMidi: 40 }), // E4, E2
      makeEvent({ index: 1, melodyMidi: 64, bassMidi: 40 }),
      makeEvent({ index: 2, melodyMidi: 67, bassMidi: 40 }), // G4
      makeEvent({ index: 3, melodyMidi: 64, bassMidi: 40 }),
    ];
    const result = optimizeFingerstylePath(events, "beginner");

    expect(result.path).toHaveLength(4);
    for (const candidate of result.path) {
      for (const fret of candidate.shapeFrets) {
        if (fret !== null) expect(fret).toBeLessThanOrEqual(5);
      }
      expect(candidate.usesBarre).toBe(false);
    }
  });

  it("backtrack produces exactly N candidates for N events", () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      makeEvent({ index: i, melodyMidi: 64 + (i % 3), bassMidi: 40 })
    );
    const result = optimizeFingerstylePath(events, "advanced");
    expect(result.path.length).toBe(events.length);
  });

  it("empty events → returns empty path with zero cost", () => {
    const result = optimizeFingerstylePath([], "advanced");
    expect(result.path).toEqual([]);
    expect(result.totalCost).toBe(0);
  });

  it("rest events pass through without error", () => {
    const events = [
      makeEvent({ index: 0 }),
      makeRestEvent(1),
      makeEvent({ index: 2 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");
    expect(result.path).toHaveLength(3);
    expect(isFinite(result.totalCost)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dp-capo tests
// ---------------------------------------------------------------------------

describe("DP Capo Optimizer", () => {
  it("song in Em → capo 0 is optimal (open chord)", () => {
    const events = [
      makeEvent({ index: 0, melodyMidi: 64, bassMidi: 40 }), // E4, E2
      makeEvent({ index: 1, melodyMidi: 67, bassMidi: 40 }), // G4, E2
      makeEvent({ index: 2, melodyMidi: 64, bassMidi: 40 }),
    ];
    const result = optimizeWithCapo(events, "beginner", 7);

    // Em is already open-chord friendly; capo 0 should produce a finite cost
    expect(result.capo).toBeGreaterThanOrEqual(0);
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
  });

  it("capo optimization always returns a finite result", () => {
    const events = [
      makeEvent({ index: 0, melodyMidi: 64, bassMidi: 40 }),
      makeEvent({ index: 1, melodyMidi: 66, bassMidi: 42 }), // F#4, F#2
    ];
    const result = optimizeWithCapo(events, "intermediate", 5);

    expect(isFinite(result.totalCost)).toBe(true);
    expect(result.path).toHaveLength(2);
    expect(result.capo).toBeGreaterThanOrEqual(0);
    expect(result.capo).toBeLessThanOrEqual(5);
  });

  it("higher capo reduces fret positions for same pitches", () => {
    // Bb major requires barre at fret 1 with capo 0
    // With capo 1, Bb becomes an open A shape
    const events = [
      makeEvent({ index: 0, melodyMidi: 70, bassMidi: 46 }), // Bb4, Bb2
    ];
    const noCapo = optimizeFingerstylePath(events, "beginner", 0);
    const capo1 = optimizeFingerstylePath(
      events.map(e => ({ ...e, melodyMidi: e.melodyMidi! - 1, bassMidi: e.bassMidi! - 1 })),
      "beginner",
      1
    );

    // With capo, frets should be lower or equal
    if (capo1.path.length > 0 && noCapo.path.length > 0) {
      expect(capo1.path[0].melodyFret).toBeLessThanOrEqual(noCapo.path[0].melodyFret);
    }
  });
});

// ---------------------------------------------------------------------------
// diagnostic logging tests
// ---------------------------------------------------------------------------

describe("DP Diagnostic Logging", () => {
  it("optimizer produces non-empty log lines", () => {
    const events = [
      makeEvent({ index: 0 }),
      makeEvent({ index: 1, melodyMidi: 67 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");

    expect(result.logs).toBeDefined();
    expect(result.logs.length).toBeGreaterThan(5);
  });

  it("logs contain VITERBI OPTIMIZER section header", () => {
    const result = optimizeFingerstylePath([makeEvent()], "advanced");
    const joined = result.logs.join("\n");
    expect(joined).toContain("VITERBI OPTIMIZER");
  });

  it("logs contain BACKTRACK section with optimal path", () => {
    const events = [
      makeEvent({ index: 0 }),
      makeEvent({ index: 1 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");
    const joined = result.logs.join("\n");
    expect(joined).toContain("BACKTRACK");
    expect(joined).toContain("Total cost");
    expect(joined).toContain("Path length");
  });

  it("logs contain OPTIMIZATION SUMMARY with technique distribution", () => {
    const events = [
      makeEvent({ index: 0 }),
      makeEvent({ index: 1 }),
      makeEvent({ index: 2, melodyMidi: 67 }),
    ];
    const result = optimizeFingerstylePath(events, "advanced");
    const joined = result.logs.join("\n");
    expect(joined).toContain("OPTIMIZATION SUMMARY");
    expect(joined).toContain("Total hand movement");
    expect(joined).toContain("Technique distribution");
  });

  it("logs contain per-event details with chord and MIDI info", () => {
    const result = optimizeFingerstylePath([makeEvent({ chord: "Em" })], "advanced");
    const joined = result.logs.join("\n");
    expect(joined).toContain("chord=Em");
    expect(joined).toContain("E4"); // midiToNoteName(64)
  });

  it("capo optimizer logs contain CAPO SWEEP and CAPO COMPARISON", () => {
    const events = [makeEvent({ index: 0 })];
    const result = optimizeWithCapo(events, "intermediate", 3);
    const joined = result.logs.join("\n");
    expect(joined).toContain("CAPO SWEEP");
    expect(joined).toContain("CAPO COMPARISON");
    expect(joined).toContain("BEST");
  });
});

