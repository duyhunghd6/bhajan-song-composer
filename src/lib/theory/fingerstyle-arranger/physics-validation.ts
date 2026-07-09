import type { TimeSliceGridStep } from "./time-slice";
import { type GuitarStringNumber } from "../fingerstyle-compressor";
import { validateGuitarTab, type GuitarTabEvent } from "../guitar-tab-validation";
import { scientificPitchForStringFret } from "../guitar-playability";

export function validateFingerstylePhysics(grid: TimeSliceGridStep[]): { valid: boolean; message: string } {
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

      // Check diagonal stretch playability:
      const frettedNotes = step.tablature.filter(t => typeof t.fret === "number" && t.fret > 0);
      for (let j = 0; j < frettedNotes.length; j++) {
        for (let k = j + 1; k < frettedNotes.length; k++) {
          const n1 = frettedNotes[j];
          const n2 = frettedNotes[k];
          const stringDiff = Math.abs(n1.string - n2.string);
          const fretDiff = Math.abs(n1.fret - n2.fret);
          if (stringDiff + fretDiff > 7) {
            messages.push(`Step ${step.step}: Physically impossible diagonal stretch between String ${n1.string} Fret ${n1.fret} and String ${n2.string} Fret ${n2.fret} (effective stretch index ${stringDiff + fretDiff} exceeds maximum limit of 7).`);
          }
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

  return {
    valid: messages.length === 0,
    message: messages.length === 0 ? "Valid." : messages.join(" "),
  };
}
