# Deterministic Fingerstyle TimeGrid Placement

## Status and production seam

The fingerstyle workflow has one deterministic foundation-placement pass. `TimeSliceMeasure[]` is the canonical editable TimeGrid; compact LLM tables can propose tablature attacks, but source facts, physical validation, and derived artifacts remain server-owned.

```text
LLM compact foundation rows
  → reconstruct canonical TimeGrid
  → validate locked source facts
  → deterministic physical placement
  → freeze non-fill foundation
  → paginate/select/compose legal fills
  → validate and merge TimeGrid
  → generate forced-string Guitar ABC and ASCII-GuitarTab
```

`placeFingerstyleFoundationOnTimeGrid()` in `fingerstyle-arranger/heuristic-time-slice.ts` performs the placement pass.

## Placement rules

1. **Melody first:** parse every authoritative `grid[].melody.pitch` attack to MIDI and choose an available exact-pitch position on strings 1–3. Prefer open strings, then lower frets, then submitted/previous strings. A labelled melody-only high-fret exception preserves an otherwise playable source melody without relaxing accompaniment limits.
2. **Bass second:** retain each submitted bass pitch and deterministically route it to strings 6–4 without colliding with simultaneous melody/support events.
3. **Never rewrite source facts:** measure/step identity, meter grid, chord, lyric, melody pitch/state, pickup, line index, and barline metadata are locked. Root, fifth, harmony, and intentional duplicate pitches remain independent events.
4. **Freeze before fills:** the accepted foundation has explicit support durations before the scored fill pipeline enumerates legal windows. No placement pass runs after scoring.

## Hard invariants

- Every source melody attack has exactly one physical, MIDI-equal melody event.
- Simultaneous or sustaining events never reuse a guitar string.
- Discretionary notes meet selected skill fret, span, and PIMA limits.
- All changes occur on a candidate TimeGrid copy and invalid/unresolved foundations are rejected before fill selection.
- Generated Guitar ABC and ASCII-GuitarTab are deterministic projections of the same TimeGrid events. Guitar ABC uses concert pitch, `clef=treble-8`, key-aware accidentals, ties, and explicit `!N!` string forcing.

## Compact LLM boundary and context safety

The LLM never receives a complete TimeGrid document. It exchanges bounded `tablature:v1` foundation rows and paginated `fill-opportunities:v1`, `fill-selection:v1`, and `fills:v1` tables. The tool loop rejects oversized prompts, schemas, tool results, calls per turn, message histories, and total transcripts rather than silently truncating musical rows.

`timegrid-document:v3` is a readable import/copy/download format, not an LLM payload. Production local persistence is a source-fingerprint-bound TimeGrid tab overlay.

## Verification anchors

Keep regressions for source melody MIDI equality, independent root/fifth preservation, unique simultaneous strings, skill limits, Ganesha pickup/tie/repeat behavior, forced-string ABC, ASCII-GuitarTab parity, duplicate pitches on distinct strings, key-aware naturals, and deterministic repeat runs.
