import { describe, it, expect } from "vitest";
import { generateFingerstyleArrangement } from "../fingerstyle-arranger";

const ganeshaAbc = `X:1
T:Ganesha
M:4/4
L:1/8
Q:1/4=108
K:G
|: "G"B2 d2 B2 G2 | "Em"e4 d2 B2 | "Am"c2 B2 A2 G2 | "D"A4 z4 |
"G"B2 d2 g2 f2 | "Em"e4 d2 B2 | "C"c2 d2 e2 c2 | "D"d4 z4 |
"C"e2 d2 c2 B2 | "Am"c2 B2 A2 G2 | "C"e2 d2 c2 B2 | "Am"A4 z4 |
"Am"c2 B2 A2 G2 | "Bm"B4 A2 ^F2 | "Em"G4 z2 G2 | "Am"A4 G2 E2 |
"Em"G4 z2 G2 | "Am"A4 z4 | "E"B4 ^G2 E2 | z8 :|`;

describe("ganesha chord fill octave check", () => {
  it("shows all events with frets > 7", () => {
    const arrangement = generateFingerstyleArrangement(ganeshaAbc);
    const events = arrangement.outputContract.artifacts.guitarTabEvents;
    
    const highFrets = events.filter(e => e.fret > 7);
    console.log(`\n=== HIGH FRETS (>7): ${highFrets.length} events ===`);
    for (const event of highFrets) {
      console.log(`  m${event.measureIndex} beat=${event.beat} role=${event.role.padEnd(8)} note=${event.note.padEnd(4)} string=${event.string} fret=${event.fret}`);
    }

    // Show first few measures
    console.log("\n=== FIRST 4 MEASURES ABC ===");
    for (let i = 0; i < Math.min(4, arrangement.measures.length); i++) {
      console.log(`m${i} [${arrangement.measures[i].chord}]: ${arrangement.measures[i].abc}`);
    }
  });
});
