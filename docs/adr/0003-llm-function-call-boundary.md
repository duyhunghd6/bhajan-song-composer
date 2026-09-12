# ADR 0003: LLM function calls are bounded decision interfaces, not arrangement authorities
<!-- beads-id: br-adr-0003 | satisfies: br-prd01-s59, br-prd01-s60 -->

## Status
<!-- beads-id: br-adr-0003-s1 -->
Accepted — 2026-09-13 (records a decision already in force; extracted from `CLAUDE.md` and the Fingerstyle guide)

## Context
<!-- beads-id: br-adr-0003-s2 -->

Accompaniment and Guitar Fingerstyle generation use an OpenAI-compatible chat-completions/function-call transport (`src/app/actions/ai-config.ts`). Letting the model receive a full TimeGrid or emit unconstrained ABC produced wrong accidentals, frozen patterns, ignored chord splits, oversized prompts, and physically unplayable output. Musical correctness also depends on facts the model cannot verify (locked source melody, guitar physics, skill limits).

## Decision
<!-- beads-id: br-adr-0003-s3 | satisfies: br-prd01-s59, br-prd01-s60 -->

- `ai-config.ts` is the transport/control loop only. It enforces configured request, transcript, tool-schema, tool-result, calls-per-turn, retry, timeout, and deadline limits and rejects oversized inputs rather than silently truncating musical rows. It is not the authority for arrangement validity.
- Workflow actions and deterministic theory validators own candidate generation, source locking, physical validation, and final merge. The calling workflow exposes only the bounded tool set for its current phase: Fingerstyle stages force a single named tool per turn (`src/app/actions/fingerstyle-line-arranger/workflow.ts`), while accompaniment steps expose the current step tool plus its read-only helper tools (strong-beat icons, guitar-tab validation, voicing lookup, line breaking) under the default `toolChoice: "required"` (`src/app/actions/accompaniment-workflow.ts`, `src/app/actions/ai-config.ts`). The model never sees every tool in every turn.
- For Fingerstyle, generation is staged: fill-position reservations → bass positions → chord-derived bass pitches → deterministic TimeGrid placement and freeze → exhaustive paginated fill opportunities → LLM use/skip selection → LLM candidate/duration composition → deterministic server merge and final validation. The model exchanges only compact versioned tables (`tablature:v1`, `fill-opportunities:v1`, `fill-selection:v1`, `fills:v1`); it never replaces the source grid or runs mutating placement after opportunity scoring.
- Fills are discretionary: after bounded fill-stage retries, the validated bass foundation is returned with a non-fatal fills-unavailable notice rather than discarded.
- Provider tool JSON, ABC comments, lyrics, metadata, user notes, previously generated content, and diagnostics are untrusted data, not instructions. They are delimited and validated at their existing boundaries; raw transcripts are not persisted, and diagnostics are bounded, redacted summaries kept separate from durable musical artifact contracts.

## Consequences
<!-- beads-id: br-adr-0003-s4 -->

Model output can only move the arrangement between server-validated states, so a bad completion degrades to a smaller result instead of an invalid one. Adding a new model-assisted decision means adding a phase-scoped tool plus a deterministic validator, not widening tool access. Broadening tool exposure, persisting transcripts, or weakening validation requires an explicitly requested behavior change and a new ADR. Contracts: [Guitar Fingerstyle Arrangement Guide](../guides/guitar-fingerstyle-arrangement-guide.md), [Accompaniment Workflow Guide](../guides/accompaniment-workflow.md).
