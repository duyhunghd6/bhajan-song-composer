import { describe, it, expect } from "vitest";
import type { DPNoteEvent } from "../dp-types";
import { DPDiagnosticLogger } from "../dp-types";
import { optimizeFingerstylePath } from "../dp-optimizer";
import { positionMovementCost } from "../dp-cost";

/**
 * Diagnostic test: Reproduce the exact M3→M4 transition from
 * the Ganesha fingerstyle log to verify the DP handles the
 * Em open (pos 0) → Am fret 5-7 (pos 6) jump correctly.
 */
describe("M3→M4 position jump feasibility", () => {
  it("should find finite cost for Em open → Am fret 5-7 transition", () => {
    // Reproduce: M3/step13 E4(64)+E2(40) → M4/step1 B4(71)+A2(45)
    // Duration: 4 steps (1 beat at 120 BPM)
    const cost = positionMovementCost(0, 6, 4, 120, "intermediate");
    console.log("positionMovementCost(0→6, 4steps, intermediate):", cost);
    // This SHOULD be finite — it's a common guitar move
    // But maxHandJumpPerBeat=5 blocks 6-fret jump in 1 beat → Infinity
  });

  it("traces the full Ganesha M2-M4 sequence through Viterbi", () => {
    const log = new DPDiagnosticLogger();
    
    // Last 3 events of M3 + all 4 events of M4
    // This is the critical boundary the optimizer must handle
    const events: DPNoteEvent[] = [
      // M3/step9: G4 + bass E2
      { index: 0, melodyMidi: 67, bassMidi: 40, chord: "Em", durationSteps: 2, bpm: 120, isRest: false },
      // M3/step11: F#4 melody only
      { index: 1, melodyMidi: 66, bassMidi: null, chord: "Em", durationSteps: 2, bpm: 120, isRest: false },
      // M3/step13: E4 + bass E2
      { index: 2, melodyMidi: 64, bassMidi: 40, chord: "Em", durationSteps: 4, bpm: 120, isRest: false },
      // M4/step1: B4 + bass A2
      { index: 3, melodyMidi: 71, bassMidi: 45, chord: "Am", durationSteps: 4, bpm: 120, isRest: false },
      // M4/step5: A4 + bass A2
      { index: 4, melodyMidi: 69, bassMidi: 45, chord: "Am", durationSteps: 4, bpm: 120, isRest: false },
      // M4/step9: G4 + bass A2
      { index: 5, melodyMidi: 67, bassMidi: 45, chord: "Am", durationSteps: 4, bpm: 120, isRest: false },
      // M4/step13: A4 + bass A2
      { index: 6, melodyMidi: 69, bassMidi: 45, chord: "Am", durationSteps: 4, bpm: 120, isRest: false },
    ];

    const result = optimizeFingerstylePath(events, "intermediate", 0, log);
    
    console.log("\n=== VITERBI RESULT ===");
    console.log("Total cost:", result.totalCost);
    console.log("Is finite?", isFinite(result.totalCost));
    console.log("\nPath:");
    for (let i = 0; i < result.path.length; i++) {
      const c = result.path[i];
      console.log(`  [${i}] mel:s${c.melodyString}/f${c.melodyFret} bass:s${c.bassString}/f${c.bassFret} pos=${c.handPosition} tech=${c.melodyTechnique}`);
    }
    console.log("\nDiagnostic logs:");
    for (const line of result.logs) {
      console.log(line);
    }

    // Assert the optimizer found a path with finite cost
    expect(isFinite(result.totalCost)).toBe(true);
  });
});
