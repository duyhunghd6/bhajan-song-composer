import { generateFingerstyleArrangement } from "./src/lib/theory/fingerstyle-arranger";

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

const arr = generateFingerstyleArrangement(ganeshaAbc);
const events = arr.outputContract.artifacts.guitarTabEvents;
for (const e of events) {
  if (e.fret > 7) {
    console.log(`High fret: ${e.note} on string ${e.string} fret ${e.fret} at m${e.measureIndex} b${e.beat}`);
  }
}
console.log("Done checking frets. Max fret:", Math.max(...events.map(e => e.fret)));
