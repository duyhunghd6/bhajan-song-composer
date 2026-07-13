import type { TimeSliceGridStep } from "./time-slice";
import { type GuitarStringNumber } from "../fingerstyle-compressor";
import { validateGuitarTab, type GuitarTabEvent } from "../guitar-tab-validation";
import { scientificPitchForStringFret } from "../guitar-playability";

export interface FingerstylePhysicsOptions {
  /** Fill density from the style profile: "none", "few", or "all". Defaults to "few". */
  fillDensity?: string;
}

export function validateFingerstylePhysics(
  grid: TimeSliceGridStep[],
  options?: FingerstylePhysicsOptions
): { valid: boolean; message: string } {
  const messages: string[] = [];
  const tabEvents: GuitarTabEvent[] = [];

  for (let i = 0; i < grid.length; i++) {
    const step = grid[i];
    
    // Build tab events and do basic checks
    if (step.tablature && step.tablature.length > 0) {
      if (step.tablature.length > 6) {
        messages.push(`Step ${step.step}: Exceeds physical guitar limit of 6 strings. Got ${step.tablature.length} notes.`);
      } else if (step.tablature.length > 4) {
        // A strum is allowed for 5 or 6 strings if played as a sweep (multiple notes on thumb 'p' or has a strum role)
        const pCount = step.tablature.filter(t => t.finger === "p").length;
        const isStrum = pCount >= 2;
        if (!isStrum) {
          messages.push(`Step ${step.step}: Exceeds picking finger budget. A guitarist can pinch up to 4 strings simultaneously (P, I, M, A) unless it is a strum/roll. Got ${step.tablature.length} notes.`);
        }
      }

      // Check fret span playability across all fretted notes in this step:
      const frettedNotes = step.tablature.filter(t => typeof t.fret === "number" && t.fret > 0);
      if (frettedNotes.length >= 2) {
        const allFrets = frettedNotes.map(t => t.fret);
        const minFret = Math.min(...allFrets);
        const maxFret = Math.max(...allFrets);
        const fretSpan = maxFret - minFret;
        // Position-aware: max 3 frets of left-hand stretch for fingerstyle
        const maxAllowedFretSpan = 3;
        if (fretSpan > maxAllowedFretSpan) {
          messages.push(`Step ${step.step}: Left-hand fret span ${fretSpan} (frets ${minFret}–${maxFret}) exceeds playable limit of ${maxAllowedFretSpan} frets. Notes: ${frettedNotes.map(t => `Str${t.string}/Fr${t.fret}`).join(", ")}.`);
        }
      }

      const stringsInUse = new Set<number>();
      for (const tab of step.tablature) {
        if (stringsInUse.has(tab.string)) {
          messages.push(`Step ${step.step}: Multiple notes assigned to string ${tab.string}.`);
        }
        stringsInUse.add(tab.string);

        const notePitch = scientificPitchForStringFret(tab.string as any, tab.fret);

        if (tab.role === "melody" && step.melody.pitch) {
          if (notePitch !== step.melody.pitch) {
            messages.push(`Step ${step.step}: Melody pitch mismatch. Expected ${step.melody.pitch}, got ${notePitch} on string ${tab.string} fret ${tab.fret}.`);
          }
        }

        tabEvents.push({
          measureIndex: 0,
          beat: step.step,
          note: notePitch,
          string: tab.string as 1 | 2 | 3 | 4 | 5 | 6,
          fret: tab.fret,
          role: tab.role
        });
      }
    }
  }

  const playabilityResult = validateGuitarTab(tabEvents, {
    guitarProfile: "guitar-classic",
    requireScientificPitch: true,
  });

  if (!playabilityResult.valid) {
    for (const issue of playabilityResult.issues) {
      messages.push(`Step ${issue.beat}: ${issue.message}`);
    }
  }

  // Check if any fill interrupts the melody
  // The melody pitch is mapped to a string. If step.melody.state === "sustain", 
  // no fill should be played on the string where the melody attack happened.
  let melodyString: GuitarStringNumber | null = null;
  for (let i = 0; i < grid.length; i++) {
    const step = grid[i];
    if (step.melody.state === "attack") {
      const melodyTab = step.tablature?.find(t => t.role === "melody");
      if (melodyTab) melodyString = melodyTab.string as GuitarStringNumber;
    }
    
    if (step.melody.state === "sustain" && melodyString !== null) {
      const fillOnMelodyString = step.tablature?.find(t => t.string === melodyString && t.role !== "melody");
      if (fillOnMelodyString) {
        messages.push(`Step ${step.step}: Fill played on string ${melodyString} which is currently sustaining the melody note.`);
      }
    }

    if (step.melody.state === "rest") {
      melodyString = null;
    }
  }

  // --- Density enforcement: Bass placement rule ---
  // Bass notes must only appear on steps with a metric weight marker (⬤, ●, or *).
  // Placing bass on unweighted steps clutters the arrangement.
  for (const step of grid) {
    if (step.tablature && step.tablature.length > 0) {
      const hasBass = step.tablature.some(t => t.role === "bass");
      if (hasBass && !step.weight) {
        messages.push(`Step ${step.step}: Bass note on unweighted step. Bass should only play on strong (⬤), medium (●), or weak (*) beat positions.`);
      }
    }
  }

  // --- Density enforcement: Fill count rule ---
  // Enforce the fill_density budget across the entire grid (one measure).
  const fillDensity = options?.fillDensity ?? "few";
  const totalFills = grid.reduce((count, step) => {
    if (!step.tablature) return count;
    return count + step.tablature.filter(t => t.role === "fill").length;
  }, 0);

  if (fillDensity === "none" && totalFills > 0) {
    messages.push(`Fill density violation: ${totalFills} fill attack(s) found but fill_density "none" allows 0.`);
  } else if (fillDensity === "few" && totalFills > 4) {
    messages.push(`Fill density violation: ${totalFills} fill attacks found but fill_density "few" allows at most 4.`);
  }
  // "all" density has no limit — skip check.

  return {
    valid: messages.length === 0,
    message: messages.length === 0 ? "Valid." : messages.join(" "),
  };
}
