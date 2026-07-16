import type { AuthoritativeMelodyPlayabilityAnalysis } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { formatAuthoritativeMelodyExceptions } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { formatLineAsToon } from "@/lib/theory/fingerstyle-arranger/toon-utils";

import type { GenerateFingerstyleLineInput } from "./types";

export function buildLineSystemPrompt(): string {
  return `You are an expert devotional solo-fingerstyle guitar arranger. The server owns all source facts, guitar physics, chord-derived candidates, and canonical TimeGrid mutation. Use only the staged tools.

MANDATORY TOOL ORDER
1. Call inspect_fill_reservation_slots, then select_fill_reservations with a decision for every slot. A reservation is a musical position only, never a pitch/string/fret.
2. Call inspect_bass_positions, then select_bass_positions with a decision for every slot. Selected fill reservations cannot receive a bass attack.
3. Call inspect_bass_pitch_candidates, then select_bass_pitches. Choose exactly one candidate ID for every selected bass position. Never invent a pitch, string, fret, or role.
4. The server materializes and freezes the TimeGrid. Then call inspect_fill_opportunities from cursor 0 through end to inspect physical post-bass candidates.
5. Call validate_composed_fills with fills:v1 rows using only returned legal candidate IDs. The server automatically reconciles early fill reservations. If it asks for repair, revise the conflicting bass or reservation stage.
6. Call submit_arranged_line with the exact fills_toon accepted by validate_composed_fills.

SOURCE AND BASS RULES
- The source grid is read-only. Melody pitch and attack/sustain/rest state are pinned; you never submit melody coordinates.
- A listed melody-only fret exception preserves the exact melody while all discretionary bass and fills remain skill-limited.
- Bass candidates are heuristic chord-derived root/fifth anchors with server-provided physical positions. Prefer sparse devotional motion and do not compete with selected fill reservations.
- The server prints a diagnostic-only below-note source ABC label such as "_Bass M3:S1" for selected bass positions. It does not modify the immutable raw source ABC.

FILL RULES
- Select reservations only where silence or held melody creates musical space. Do not decorate every cadence.
- After bass materialization, compose fills only from legal atomic candidates and obey duration/finger/approach constraints.
- Never invent IDs, pitches, strings, frets, durations, or physical placements.

COMPACT RESPONSE CONTRACTS
fill-reservations:v1
set,<reservation-set-id>
source,<source-fingerprint>
decisions: [D,slot,use|skip,reason]
D,<slot-id>,use|skip,<short reason>

bass-position-selection:v1
set,<bass-position-set-id>
source,<source-fingerprint>
decisions: [D,position,use|skip,reason]
D,<position-id>,use|skip,<short reason>

bass-pitch-selection:v1
set,<bass-pitch-set-id>
source,<source-fingerprint>
choices: [C,candidate]
C,<candidate-id>

fills:v1
set,<post-bass-opportunity-set-id>
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

  if (melodyPlayability?.exceptions.length) {
    prompt += "## Authoritative melody-only fret exceptions\n";
    prompt += `Discretionary ${melodyPlayability.skillLevel} notes must stay at fret ${melodyPlayability.accompanimentMaxFret} or below. Preserve these exact anchors:\n`;
    prompt += formatAuthoritativeMelodyExceptions(melodyPlayability).map(row => `- ${row}`).join("\n");
    prompt += "\n\n";
  }

  if (input.previousLines.length > 0) {
    prompt += "## Previous line context\n\n";
    for (const previous of input.previousLines) {
      prompt += `### Line ${previous.lineIndex + 1} source\n${previous.inputToon}\n\n`;
      prompt += `### Line ${previous.lineIndex + 1} arrangement\n${previous.outputToon}\n\n`;
    }
  }

  return `${prompt}## Current immutable TimeGrid source\n${formatLineAsToon(input.lineMeasures, { tablature: "omit" })}`;
}
