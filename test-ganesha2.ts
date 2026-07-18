import { generateFingerstyleArrangement } from "./src/lib/theory/fingerstyle-arranger";

const ganeshaAbc = `X:1
T:Ganesha
M:4/4
L:1/8
Q:1/4=108
K:G
|: "G"B2 d2 B2 G2 | "Em"e4 d2 B2 | "Am"c2 B2 A2 G2 | "D"A4 z4 :|`;

const arr = generateFingerstyleArrangement(ganeshaAbc);
console.log(arr.abc);
