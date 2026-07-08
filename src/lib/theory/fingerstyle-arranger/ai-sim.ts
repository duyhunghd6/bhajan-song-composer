import { query_guitar_voicings } from "../guitar-voicings";
import { TimeSliceMeasure } from "./time-slice";

export function generateSimulatedFingerstyle(measure: TimeSliceMeasure): TimeSliceMeasure {
  const newMeasure = JSON.parse(JSON.stringify(measure)) as TimeSliceMeasure;
  
  let currentChord = newMeasure.grid[0].chord || "C";
  let voicing = query_guitar_voicings(currentChord, undefined, "open")[0] || query_guitar_voicings(currentChord)[0];
  
  let lastMelodyString = 1;

  newMeasure.grid.forEach((step) => {
    if (step.chord && step.chord !== currentChord) {
      currentChord = step.chord;
      voicing = query_guitar_voicings(currentChord, undefined, "open")[0] || query_guitar_voicings(currentChord)[0];
    }
    
    if (!voicing) return;
    
    const tablature: any[] = [];
    const hasMelody = step.melody.state === "attack" && step.melody.pitch;
    
    // Strong beats get Bass
    if (step.weight === "⬤" || step.weight === "●") {
      tablature.push({
        string: voicing.bass.string,
        fret: voicing.bass.fret,
        finger: "p",
        role: "bass"
      });
    }
    
    if (hasMelody) {
      // Use voicing melody if matched, otherwise just fall back to string 1
      let mStr = voicing.melody?.string || 1;
      let mFret = voicing.melody?.fret || (typeof voicing.frets[6 - mStr] === "number" ? voicing.frets[6 - mStr] : 0);
      tablature.push({
        string: mStr,
        fret: mFret,
        finger: "a",
        role: "melody"
      });
      lastMelodyString = mStr;
    } else if (step.weight === null || step.weight === "*") {
      // Filler note for empty or soft melody steps without attack
      // Only add filler if it's not a rest and there is no melody attack
      // We will only add filler to empty spaces
      if (step.melody.state !== "rest") {
        const fillStr = voicing.available_inner_strings[0] || 3;
        const fillFret = typeof voicing.frets[6 - fillStr] === "number" ? voicing.frets[6 - fillStr] : 0;
        tablature.push({
          string: fillStr,
          fret: fillFret,
          finger: "i",
          role: "fill"
        });
      }
    }
    
    if (tablature.length > 0) {
      step.tablature = tablature;
    }
  });
  
  return newMeasure;
}
