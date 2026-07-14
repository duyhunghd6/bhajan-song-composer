import { normalizeAbcMeasureDuration } from "../src/lib/theory/abc-duration";

const input = "[!2!B!3!G!6!E,] !2!e !3!G !2!B4 !3!B";
const output = normalizeAbcMeasureDuration(input, 8); // targetUnits 8

console.log("Input:", input);
console.log("Output:", output);
