import type { AuthoritativeMelodyPlayabilityAnalysis } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { formatAuthoritativeMelodyExceptions } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { formatLineAsToon } from "@/lib/theory/fingerstyle-arranger/toon-utils";

import type { GenerateFingerstyleLineInput } from "./types";

export function buildLineSystemPrompt(options: { fillDensityOff?: boolean } = {}): string {
  const fillWorkflow = options.fillDensityOff
    ? `4. The server materializes and freezes the TimeGrid, then completes deterministic final validation with no discretionary fills. Do not request fill opportunities or submit an arranged-line payload.`
    : `4. The server materializes and freezes the TimeGrid. Then call inspect_fill_opportunities from cursor 0 through end to inspect physical post-bass candidates.
5. Call select_fill_windows with a decision for every inspected window. Fills are discretionary: an all-skip selection is valid and the server will finalize the bass foundation without further fill calls. Select use only when you can compose a legal fill note from returned candidate IDs; otherwise choose skip. The server automatically reconciles early fill reservations.
6. If reconciliation asks for repair, follow the server-exposed bass or reservation revision stage, then repeat dependent bass and fill stages.
7. When one or more windows are selected, call validate_fill_variants once. Propose up to ten musically distinct combinations using only returned candidate IDs. Each alternative must repeat the accepted use/skip decisions, then provide its own candidate/duration/finger rows. Finally call submit_arranged_line with the exact accepted variants_toon.`;
  return `You are an expert devotional solo-fingerstyle guitar arranger. The server owns all source facts, guitar physics, chord-derived candidates, and canonical TimeGrid mutation. Use only the staged tools.

MANDATORY TOOL ORDER
1. Call inspect_fill_reservation_slots, then select_fill_reservations with a decision for every slot. A reservation is a musical position only, never a pitch/string/fret.
2. Call inspect_bass_positions, then select_bass_positions with a decision for every slot. Selected fill reservations cannot receive a bass attack.
3. Call inspect_bass_pitch_candidates, then select_bass_pitches. Choose exactly one candidate ID for every selected bass position. Never invent a pitch, string, fret, or role.
${fillWorkflow}

SOURCE AND BASS RULES
- The source grid is read-only. Melody pitch and attack/sustain/rest state are pinned; you never submit melody coordinates.
- A listed melody-only fret exception preserves the exact melody while all discretionary bass and fills remain skill-limited.
- Bass candidates are heuristic chord-derived root/fifth anchors with server-provided physical positions. Prefer sparse devotional motion and do not compete with selected fill reservations.
- The server prints a diagnostic-only below-note source ABC label such as "_Bass M3:S1" for selected bass positions. It does not modify the immutable raw source ABC.

FILL RULES
- Select reservations and compose discretionary fills only in actual source-rest or phrase-gap space; Melody attacks and held Melody sustains are always protected. Normal/many density increases the number of legal rest windows that may be selected; it never authorizes sustain decoration. Do not decorate every cadence.
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

fill-selection:v1
set,<post-bass-opportunity-set-id>
source,<source-fingerprint>
decisions: [D,window,use|skip,reason]
D,<window-id>,use|skip,<short reason>

For every window selected with use, every proposed alternative must submit at least one later N row for that same window. If no legal note can be submitted, choose skip. A scale-approach note must resolve in the same window to a non-approach chord tone.

fill-variants:v1
set,<post-bass-opportunity-set-id>
source,<source-fingerprint>
variants: [V,id]
V,<option-id>
D,<option-id>,<window-id>,use|skip,<short reason>
N,<option-id>,<candidate-id>,<positive integer>,i|m|a

Return up to ten alternatives with different candidate/duration/finger combinations. Do not duplicate the same musical composition under another option ID.`;
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
