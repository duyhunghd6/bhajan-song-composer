# ADR 0002: TimeGrid is the sole Guitar Fingerstyle arrangement authority
<!-- beads-id: br-adr-0002 | satisfies: br-prd01-s33, br-prd01-s59 -->

## Status
<!-- beads-id: br-adr-0002-s1 -->
Accepted — 2026-09-13 (records a decision already in force; extracted from the Fingerstyle guides)

## Context
<!-- beads-id: br-adr-0002-s2 -->

The solo Guitar Fingerstyle branch must carry melody, chord-derived bass, and discretionary fills on one instrument while staying physically playable. Several textual representations exist for the same arrangement — generated Guitar ABC, ASCII GuitarTab, TOON drafts, compact LLM tables, and the `timegrid-document:v3` interchange file. Treating any raw text as an editable authority allowed unvalidated edits to overwrite locked melody facts or produce impossible string/fret combinations.

## Decision
<!-- beads-id: br-adr-0002-s3 | satisfies: br-prd01-s33, br-prd01-s59 -->

- `TimeSliceMeasure[]` from `src/lib/theory/fingerstyle-arranger/time-slice.ts` is the only editable Fingerstyle arrangement authority. Guitar ABC, ASCII GuitarTab, TOON, compact LLM payloads, and diagnostics are derived views or bounded interchange contracts.
- The grid has four quantized steps per notated beat (`meter numerator × 4`), never a fixed 16-step assumption. Source-derived chord, lyric, beat, pickup, barline, and melody attack/sustain/rest facts are locked and preserved.
- All edits follow a structured candidate → validation → commit flow, then regenerate derived artifacts. Discretionary support/fills stay within legal source-rest windows and never override exact melody or guitar-physics guards.
- `timegrid-document:v3` is a readable import/copy/download format; browser persistence is a separate source-fingerprint-bound overlay (`workspace/fingerstyle-measure-persistence.ts`). A changed source fingerprint, unsupported version, or incompatible structure discards the saved arrangement instead of applying it to different music.
- Generated Guitar ABC uses concert pitch, `clef=treble-8`, key-aware accidentals, ties, and explicit `!N!` string forcing; identical pitches on distinct strings are valid.

## Consequences
<!-- beads-id: br-adr-0002-s4 -->

Every Fingerstyle feature — LLM generation, manual edits, import, persistence, TAB rendering, export — converges on one validated data structure, so physical validation runs once and derived views cannot drift. Raw ABC/ASCII imports are still useful but must compile and validate into a TimeGrid before becoming canonical. Contracts: [TimeGrid Conversion Guide](../guides/timegrid-conversion-guide.md), [Guitar Fingerstyle Arrangement Guide](../guides/guitar-fingerstyle-arrangement-guide.md).
