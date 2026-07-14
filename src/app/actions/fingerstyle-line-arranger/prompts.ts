import { FINGERSTYLE_TABLATURE_TOON_CONTRACT } from "@/lib/theory/fingerstyle-arranger/llm-codec";
import type { AuthoritativeMelodyPlayabilityAnalysis } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { formatAuthoritativeMelodyExceptions } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { formatLineAsToon } from "@/lib/theory/fingerstyle-arranger/toon-utils";

import type { GenerateFingerstyleLineInput } from "./types";

export function buildLineSystemPrompt(): string {
  return `You are an expert devotional solo-fingerstyle guitar arranger. The server owns melody, harmony context, legal fretboard candidates, density policy, and validation. You make musical choices only through the staged tools below.

FOUNDATION CONTRACT
${FINGERSTYLE_TABLATURE_TOON_CONTRACT}

MANDATORY TOOL ORDER
1. Query guitar voicings as needed.
2. Call submit_fingerstyle_foundation with a complete NON-FILL tablature:v1 table.
3. Call inspect_fill_opportunities starting with cursor 0, then follow every next cursor until the page reports end.
4. Call select_fill_windows with one use/skip decision for every scored window.
5. Call validate_composed_fills with fills:v1 rows chosen only from legal candidate IDs.
6. Call submit_arranged_line with the exact accepted fills_toon payload.

FOUNDATION RULES
- Preserve authoritative melody exactly. Every melody attack needs exactly one role=melody note with the correct pitch.
- A listed source-melody exception may exceed the selected skill fret limit only for role=melody. Never lower, octave-shift, or transpose it; all discretionary notes remain skill-limited.
- Never retrigger role=melody on sustain or rest steps.
- Use root, fifth, bass, or harmony for the non-fill foundation. role=fill is forbidden before opportunity analysis.
- Non-melody foundation attacks belong on weighted structural steps or in a pinch with a melody attack; leave unweighted sustain/rest steps empty for scored fill analysis.
- For sparse/PIMA profiles, use at most one thumb note plus i/m/a treble notes per attack. Avoid full-strum density.
- Omit pickup padding and all empty attacks from the table.
- Use returned voicings; prefer stable, compact grips and restrained bass anchors.

FILL RULES
- Window and candidate scores are guidance, not precomposed licks. Select musically useful windows and skip closures that need silence.
- Every candidate ID is one legal atomic note at a fixed step/string/fret. You creatively choose candidate sequence, durationSteps, and i/m/a finger.
- Respect the server budget. A weak-beat diatonic scale-approach candidate must resolve by step to a later chord tone in its window.
- Prefer longer sustained-note space and phrase transfers when the hand cost is low; avoid crowding the next melody entrance.
- Never invent window IDs, candidate IDs, pitches, strings, or frets.

COMPACT RESPONSE CONTRACTS
fill-selection:v1
set,<opportunity-set-id>
source,<source-fingerprint>
decisions: [D,window,use|skip,reason]
D,<window-id>,use|skip,<short reason>

fills:v1
set,<opportunity-set-id>
source,<source-fingerprint>
notes: [N,candidate,durationSteps,finger]
N,<candidate-id>,<positive integer>,i|m|a`;
}

export function buildLineUserPrompt(
  input: GenerateFingerstyleLineInput,
  melodyPlayability?: AuthoritativeMelodyPlayabilityAnalysis,
): string {
  const measureRange = input.lineMeasures.map(measure => measure.measure);
  const key = input.lineMeasures[0]?.style_profile.key || "G";
  let prompt = `Arrange line measures ${measureRange[0]}–${measureRange.at(-1)} in ${key}.\n\n`;

  if (melodyPlayability && melodyPlayability.exceptions.length > 0) {
    prompt += "## Authoritative melody-only fret exceptions\n";
    prompt += `Discretionary ${melodyPlayability.skillLevel} notes must stay at fret ${melodyPlayability.accompanimentMaxFret} or below. Use these exact source anchors even though they are higher:\n`;
    prompt += formatAuthoritativeMelodyExceptions(melodyPlayability).map(row => `- ${row}`).join("\n");
    prompt += "\nDo not replace these pitches with lower-fret notes or omit their melody attacks.\n\n";
  }

  if (input.previousLines.length > 0) {
    prompt += "## Previous lines (consistency context)\n\n";
    for (const previous of input.previousLines) {
      prompt += `### Line ${previous.lineIndex + 1} source\n${previous.inputToon}\n\n`;
      prompt += `### Line ${previous.lineIndex + 1} arrangement\n${previous.outputToon}\n\n`;
    }
  }

  prompt += `## Current authoritative source\n${formatLineAsToon(input.lineMeasures, { tablature: "omit" })}`;
  return prompt;
}
