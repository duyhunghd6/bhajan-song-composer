# Optimized Fingerstyle Heuristic Algorithm

## 1. Status and production seam

The guitar fingerstyle line workflow supports two arrangement optimization modes:

- **Heuristic** — the default deterministic foundation optimizer.
- **Dynamic Programming** — the existing Viterbi/shortest-path optimizer documented in [`OptimizeFingerStyleDPAlgorithm.md`](./OptimizeFingerStyleDPAlgorithm.md).

The selected mode is persisted with `fingerstyleGenerationSettings.arrangementOptimization`. The staged line workflow keeps the same public action and fill-review loop for both modes:

```text
LLM foundation payload
  → validate source grid
  → heuristic or DP foundation positioning
  → freeze non-fill foundation
  → paginate and select fill opportunities
  → compose and merge accepted fills
  → final physical validation
  → forced-string ABC + ASCII output
```

The heuristic implementation is local to `fingerstyle-arranger/heuristic-time-slice.ts`. It does not call the DP optimizer.

## 2. Four deterministic stages

### 2.1 Melody-first treble anchoring

For each melody attack, the authoritative `TimeSliceGridStep.melody.pitch` is parsed to MIDI. Valid positions are enumerated only on guitar strings 1, 2, and 3 and are retained only when:

```text
midiForStringFret(string, fret) == authoritative melody MIDI
```

Selection prefers an available open string, then the lowest fret, then the submitted/previous melody string, and finally the lowest string number. This deliberately gives open-position and basic open-chord-friendly choices priority over hand movement or preserving a submitted shape. A melody-only high-fret exception may exceed the discretionary skill ceiling when required to preserve the source pitch. Sustain and pickup grid state is never rewritten.

### 2.2 Chord-position and hand-shape preference

Chord symbols are normalized by trimming whitespace and lowercasing. Existing guitar voicing candidates are queried through the shared `getGuitarVoicings()` database/algorithmic fallback. A shape preference is deterministic and local to the line: open and low-fret shapes are preferred, then compatible neighboring hand regions and previously established normalized chord shapes.

A chord may have several valid fretboard positions. Open-position/basic chord choices are preferred, but the diagnostic chord-shape map does not override per-event melody placement: legal open strings and low frets win before continuity with a submitted or recurring hand position. The heuristic does not force every occurrence of a recurring chord into one position when that would collide with the locked melody or violate physical limits.

### 2.3 Bass and support placement

Existing bass events are routed toward strings 6, 5, and 4 while preserving their exact physical MIDI pitch and avoiding occupied melody/support strings. Root, fifth, harmony, and other independent source events remain independent; the optimizer does not collapse duplicate concert pitches that intentionally occupy different strings.

Bass placement is deterministic and weighted attacks remain the preferred anchors. Pickup padding and unweighted empty grid steps are not populated by the foundation pass. The current staged fill pipeline remains responsible for discretionary inner-string notes.

### 2.4 Fill priority

The heuristic foundation ends before fill generation. `fill-opportunities` continues to provide legal windows, candidate scoring, density limits, selection validation, composition validation, and deterministic merge. A fill must not interrupt a sustained melody string, collide with a foundation string, exceed skill limits, or populate pickup padding.

## 3. Hard invariants

Both optimization modes share these contracts:

1. Preserve every authoritative melody pitch and melody state.
2. Bind changes to the structured `TimeSliceMeasure` grid; do not infer physical positions from unrelated ABC pitches.
3. Never place two simultaneous events on the same physical string.
4. Preserve simultaneous duplicate concert pitches when they occur on distinct strings.
5. Validate string/fret MIDI equality after every physical choice.
6. Keep discretionary frets, spans, and techniques within the selected skill profile.
7. Apply changes to a deep copy and retain safe unresolved/fallback behavior.
8. Render ASCII and ABC from the same physical `string`/`fret` events.

A failed foundation or unresolved required event is rejected before the fill stages are allowed to proceed.

## 4. ABCJS and ASCII agreement

`TimeSliceMeasure.tablature` is the canonical physical representation. The ASCII renderer writes its string/fret cells directly from this grid. The time-slice ABC renderer converts each same grid event through `scientificPitchForStringFret()` and emits a forced decoration when requested:

```abc
[!1!e!3!G!6!E,]
```

The `treble-8` guitar voice uses concert-pitch ABC. abcjs applies its internal clef transpose during tablature calculation; the heuristic must not add an octave in the physical-to-ABC conversion. Key signatures use explicit naturals when a physical natural would otherwise inherit a sharp or flat.

At the render boundary, `ensureGuitarStringForcing()` and `prepareGuitarStringForcingForAbcjs()` protect raw or single-note output by preserving `!N!` assignments and wrapping forced notes when abcjs requires a chord event. TAB copied from the rendered SVG is therefore expected to describe the same physical events as the algorithm-generated ASCII view, not merely the same sounding pitches.

## 5. Diagnostics and determinism

The heuristic emits the same versioned diagnostic run shape used by the existing browser projection. Its compatibility log records the selected strategy, skill/BPM inputs, stage boundaries, chord-shape count, changed events, unresolved events, and terminal outcome. Workflow records additionally identify `arrangementOptimization` in the conditioning and foundation event.

For identical source grid, settings, and input tablature, the heuristic uses stable ordering and produces identical output. Its local foundation pass is linear in the number of grid events, plus the bounded guitar-voicing lookup cost; fill analysis retains its existing candidate/window complexity.

## 6. Difference from DP

The heuristic commits local decisions in musical order:

```text
melody → chord shape → bass/support → fills
```

It is fast, explainable, and suitable as the default. DP evaluates a trellis over complete event sequences and can trade local choices against future movement, sustain, technique, and recurring-grip costs. Both modes are required to preserve the same pitch, occupancy, skill, rollback, ABC, and ASCII invariants.

## 7. Verification anchors

Regression coverage should retain the Ganesha final-measure fixture and assert:

- authoritative melody MIDI equality;
- independent root/fifth preservation;
- unique simultaneous physical strings;
- exact forced-string ABC;
- exact ASCII tablature;
- duplicate pitches on distinct strings;
- open/multi-digit frets, rests, ties, naturals, and pickup boundaries;
- stable behavior when switching between Heuristic and Dynamic Programming.
