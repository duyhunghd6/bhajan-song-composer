# Fingerstyle TimeGrid Conversion Guide
<!-- beads-id: br-guide-timegrid-conversion -->

This guide defines the editable representation for solo fingerstyle guitar arrangements. It complements the [Guitar Fingerstyle Arrangement Guide](./guitar-fingerstyle-arrangement-guide.md), which defines the staged AI workflow and fill policy.

> **Agent navigation:** start with `src/lib/theory/fingerstyle-arranger/time-slice.ts` for the canonical source-to-grid contract, `time-slice-abc-renderer.ts` for the notation projection, and `timegrid-document-codec.ts` for import/export. `src/components/composer/workspace/fingerstyle-measure-persistence.ts` owns the distinct browser restore overlay, while `GuitarFingerstyleStep.tsx` owns route-level hydration and generated artifacts. Validate in layers: codec shape/continuity first, source-fingerprint compatibility at import/restore, then source-lock and physical/music validation before committing an arrangement.

## 1. Authority and data flow
<!-- beads-id: br-guide-timegrid-conversion-s01 -->

The meter-aware TimeGrid belongs exclusively to `/compose/:slug/guitar-fingerstyle`. It is compiled from the selected Harmony Step 3 (`voice-leading-validation`) ABC, not from `/compose/:slug/accompaniment` output. The accompaniment workflow may independently plan Guitar Classic comping and voicings, but it never owns, replaces, or serializes the TimeGrid.

Use a meter-aware **Fingerstyle TimeGrid** as the canonical editable and persisted arrangement document:

```text
selected voice-leading-validation ABC
  → compile source melody and context into TimeGrid
  → add, move, resize, or remove validated fingerstyle guitar support events
  → persist TimeGrid JSON
  → deterministically generate Guitar ABC notation
  → deterministically generate ASCII-GuitarTab
  → render/play Guitar ABC with abcjs
```

The authority boundary is deliberate:

| Representation | Purpose | Editable source of truth? |
|---|---|---:|
| Source ABC | Import/source melody, chords, lyrics, meter, key, barlines | Only for source-melody editing workflows |
| `TimeSliceMeasure[]` TimeGrid | Fingerstyle arrangement events and their physical guitar coordinates | Yes |
| Guitar ABC | Generated notation, playback, copy/export | No |
| ASCII-GuitarTab | Generated visual/display/export projection | No |

Do not mutate raw generated ABC text to add a bass note or a fill. Make a structured grid edit, validate the resulting TimeGrid, then regenerate every derived artifact.

### Source-document identity versus generated Guitar ABC
<!-- beads-id: br-guide-timegrid-conversion-s02 -->

`TimeSliceMeasure[]` is a canonical guitar-arrangement model, not a lossless ABC concrete-syntax tree. It does not preserve document-level details such as comments, directives, all voice bodies, token spelling, whitespace, or line endings. An import/test flow that requires exact source-ABC identity must retain the raw input in an immutable document envelope alongside the compiled TimeGrid, then re-emit that raw string unchanged.

This source-identity assertion is distinct from derived-artifact validation:

- **Source identity:** `reEmittedSourceAbc === rawSourceAbc` exactly, including comments, lyrics, directives, voices, repeat/volta syntax, spacing, and line endings.
- **Guitar projection:** generate forced-string Guitar ABC from the validated TimeGrid and verify its physical strings, frets, attacks, durations, and measure timing against that grid. Generated Guitar ABC is expected to differ from imported source ABC.
- **Source-faithful comparison projection:** `buildReconstructedGuitarAbc()` applies string forcing to each measure's preserved `source_abc.melody` text. It preserves source ties, slurs, chord-symbol positions, duration spelling, decorations, repeats, and lyrics for diagnostic comparison, but it intentionally omits generated bass and fill events and is not the production arrangement artifact.

Generated discretionary fills are legal only in source-rest windows at every density. If a legacy or imported physical event overlaps a held Melody, the renderer serializes that physical reality with an interval split and tied continuation rather than hiding it to resemble source notation; server-generated output rejects that overlap before rendering.

### Forced-string Guitar import
<!-- beads-id: br-guide-timegrid-conversion-s03 -->

`abc-timegrid-import.ts` imports the supported `V:Guitar` subset into physical TimeGrid events without treating it as a replacement for `source.rawAbc`. It recognizes `!1!`–`!6!` string forcing, notes and bracket chords, rests, explicit durations, quoted chord symbols, trailing event ties, and per-member chord ties. A tie extends only the same adjacent pitch on the same physical string; it never creates a fresh attack or becomes a slur. Explicit ties and matched parentheses may cross exactly one adjacent barline: the origin measure stores `guitarTiesToNext` / `guitarSlursToNext`, while local parentheses remain one-based inclusive/exclusive `guitarSlurs` boundaries. Equal adjacent pitches never infer a tie.

Tuplets, broken rhythm, grace syntax, non-grid durations, malformed ties, unforced Guitar notes, overlapping same-string attacks, and out-of-range positions are not lossless TimeGrid syntax. The importer uses deterministic nearest-step normalization when a physical event can still be represented and emits a diagnostic; it retains the original source unchanged regardless. A document with no forced Guitar strings continues through the Melody diagnostic projection rather than inventing physical string assignments.

### Source loops, repeats, voltas, and visual line breaks
<!-- beads-id: br-guide-timegrid-conversion-s04 -->

Source ABC may contain repeat-start (`|:`), repeat-end (`:|`), volta endings (`|[1`, `|[2`), and intentional visual line breaks. These are source-structure facts, not discretionary guitar edits.

- The immutable raw source envelope preserves their exact spelling, placement, whitespace, and `LF`/`CRLF` line breaks for source-document identity.
- During compilation, each Melody measure retains its source visual-line ordinal in `lineIndex` and its repeat/volta metadata in `barline` (`repeatStart`, `repeatEnd`, and `volta`).
- The TimeGrid-to-Guitar-ABC renderer must replay stored repeat/volta barlines when joining generated measures. It may choose canonical generated line wrapping; it must not claim that this generated layout is an exact reproduction of source visual line breaks.
- Tests for imported ABC must cover both layers: exact raw source re-emission, plus `lineIndex` and repeat/volta metadata preservation in the compiled TimeGrid and generated Guitar projection.

## 2. Meter-aware TimeGrid model
<!-- beads-id: br-guide-timegrid-conversion-s05 -->

The implementation uses the `TimeSliceMeasure` and `TimeSliceGridStep` contracts in `src/lib/theory/fingerstyle-arranger/time-slice.ts`.

- A measure contains `grid` steps, source context, and optional barline/pickup metadata.
- A grid contains four quantized steps per notated beat.
- Therefore 4/4 has 16 steps, 3/4 has 12, and a supported meter has `numerator × 4` steps. The format is **not** globally fixed at 16 steps.
- A tablature event is an attack beginning on its containing grid step. `durationSteps` tells the renderer how many grid steps it sounds.
- Guitar strings use `1` for the high E string through `6` for the low E string.

### Three working TimeGrid layers: canonical object, v3 interchange, and local persistence
<!-- beads-id: br-guide-timegrid-conversion-s06 -->

The working TimeGrid has three deliberately distinct versioned representations. Do not conflate the internal `version: 1` value with an old wire-format version.

| Layer | Current shape/version | Authority and use |
|---|---|---|
| In-memory canonical document | `{ version: 1, source: { rawAbc }, measures: TimeSliceMeasure[] }` | Compiler and renderer model. It keeps the immutable raw source envelope beside the editable physical grid. |
| Import/copy/download interchange | `format: "timegrid-document:v3"` | The only currently emitted readable JSON document. Legacy `timegrid-document:v1`/`v2` are migration-only parser inputs. |
| Production local persistence | `{ version: 1, sourceFingerprint, measures }` | A restore overlay, not a new source document. It restores compatible visual-tab and tablature data onto freshly compiled source measures. |

`timegrid-document:v3` is normal indented JSON and keeps literal musical meaning. Its actual root shape is:

```json
{
  "format": "timegrid-document:v3",
  "source": { "rawAbc": "exact imported ABC" },
  "style": { "key": "Em", "comp": "…", "voice": "…" },
  "styleOverrides": [{ "measureIndex": 2, "style": { "key": "Em", "comp": "…", "voice": "…" } }],
  "measures": []
}
```

`styleOverrides` is omitted unless a measure differs from the root baseline; its `measureIndex` is the zero-based array index, not the musical `measure` identity. In each v3 measure, `source_abc` is serialized as `sourceAbc` and `tablature` as `tab`. A grid step carries named `step`, `chord`, optional `weight`, literal `melody: { pitch, state }`, optional `lyric`, and optional `tab` events. A tab event is `{ string, fret, finger, role, durationSteps?, fillWindowId?, fillCandidateId? }`.

The formatter preserves irregular measure and step identities rather than compressing them. It omits absent optional metadata, lyrics, weights, and provenance, while an explicit `tab: []` remains distinct from omitted tablature. The v3 parser restores a full canonical `style_profile` to every measure.

This is compact without sacrificing authority:

- JSON string decoding restores `rawAbc` exactly, including `CRLF`/`LF`, comments, whitespace, directives, voices, and repeat syntax. Do not Base64 encode it.
- The codec preserves optional source, pickup, barline, visual-tab, duration, fill-provenance, local Guitar slur, and adjacent-bar Guitar tie/slur fields, including the distinction between omitted and empty tablature.
- The parser rejects unknown format versions; invalid melody-state/pitch combinations, enum values, strings outside 1–6, negative frets, non-positive durations, duplicate strings in one step, invalid or duplicate style overrides, and dangling or physically mismatched adjacent-bar Guitar continuity. It does not silently drop invalid tab rows.
- Parsing is interchange validation, not complete music validation: physical MIDI equality, overlapping same-string sustains, skill limits, meter/grid consistency, and source-derived lock validation remain compiler/workflow responsibilities.

Production Fingerstyle persistence deliberately uses its separate envelope:

```json
{
  "version": 1,
  "sourceFingerprint": "source-dependent-fingerprint",
  "measures": []
}
```

`sourceFingerprint` binds an arrangement to the source ABC/melody context that produced it. Restore compiles fresh source measures, then overlays compatible persisted visual-tab and tablature data only when the envelope version, fingerprint, measure identities, grid lengths, step identities, and basic tab-coordinate shape match. Freshly compiled source facts remain authoritative; local restore does not compare every saved source field or treat an old full document as a replacement source.

The existing TOON formats have narrower roles. `toon-utils.ts` is readable editable/LLM draft text and has a permissive parser; `llm-codec.ts` is a compact `tablature:v1` replacement payload. Neither format preserves the complete canonical document, so neither is valid persistence or import interchange.

The LLM must never receive a complete TimeGrid document by default. Foundation and fill exchanges use their bounded compact-row codecs; the tool loop enforces prompt, schema, tool-result, message-count, and cumulative-transcript byte budgets, rejecting an oversized semantic payload rather than truncating it.

### Example measure
<!-- beads-id: br-guide-timegrid-conversion-s07 -->

The following is a representative 4/4 excerpt. It illustrates the existing `TimeSliceMeasure` shape; real measures retain the complete 16-step grid and source metadata.

```json
{
  "measure": 1,
  "lineIndex": 0,
  "style_profile": {
    "key": "Em",
    "comping_style": "PIMA devotional fingerstyle",
    "voicing_plan": "Open-position Em",
    "fill_density": "few"
  },
  "grid": [
    {
      "step": 1,
      "chord": "Em",
      "weight": "⬤",
      "melody": { "pitch": "E4", "state": "attack" },
      "lyric": "Ha-",
      "tablature": [
        {
          "string": 1,
          "fret": 0,
          "finger": "a",
          "role": "melody",
          "durationSteps": 4
        },
        {
          "string": 6,
          "fret": 0,
          "finger": "p",
          "role": "bass",
          "durationSteps": 2
        }
      ]
    },
    {
      "step": 2,
      "chord": "Em",
      "weight": null,
      "melody": { "pitch": "E4", "state": "sustain" },
      "lyric": null,
      "tablature": []
    },
    {
      "step": 5,
      "chord": "Em",
      "weight": "*",
      "melody": { "pitch": null, "state": "rest" },
      "lyric": null,
      "tablature": [
        {
          "string": 3,
          "fret": 0,
          "finger": "i",
          "role": "fill",
          "durationSteps": 1
        }
      ]
    }
  ],
  "source_abc": {
    "melody": "E2 ...",
    "lyric": "Ha- ...",
    "beatWeight": "⬤ ..."
  }
}
```

A single step may contain several simultaneous events: a locked melody attack on string 1, a bass event on string 6, and an optional harmony event on an inner string. They become one simultaneous ABC chord at render time.

### Event roles
<!-- beads-id: br-guide-timegrid-conversion-s08 -->

| Role | Intent | Default edit policy |
|---|---|---|
| `melody` | Physical guitar realization of the source melody | Locked to source pitch and timing |
| `bass` | Low thumb foundation | Editable after validation |
| `root` / `fifth` | Chord-derived bass/support anchors | Editable after chord validation |
| `harmony` | Inner chord/support pitch | Editable after chord and playability validation |
| `fill` | Discretionary melodic/gap material | Editable only in legal windows and density limits |
| `imported` | Authoritative forced-string Guitar event imported from source ABC | Preserve until explicitly replaced by an arrangement edit |

The current persisted event type has physical fields (`string`, `fret`, `finger`, `role`, optional `durationSteps`) and optional server-generated fill provenance (`fillWindowId`, `fillCandidateId`). It does not yet persist a general event `id` or `locked` flag. A future UI command layer may add stable IDs and presentation metadata, but it must preserve this canonical physical/event contract or migrate it explicitly.

## 3. Locked source facts versus editable accompaniment
<!-- beads-id: br-guide-timegrid-conversion-s09 -->

The source melody remains independent of its guitar realization. Adding bass or fills must not change its musical pitch or timing.

| Field or event | Editable in an arrangement edit? | Rule |
|---|---:|---|
| `measure`, `lineIndex`, grid order, `step` | No | Preserve source structure and timing grid. |
| `chord`, `weight`, `lyric`, pickup/barline/source-ABC data | No | Source/context facts are recompiled from source ABC. |
| `melody.pitch`, `melody.state` | No | Preserve source melody pitch, attack/sustain/rest timing exactly. |
| Physical `melody` tablature event | No by default | Must realize the locked melody attack at its exact pitch/time. |
| `bass`, `root`, `fifth`, `harmony` | Yes | Must pass chord, timing, and guitar-physics validation. |
| `fill` | Yes | Must pass legal-gap, sustain, density, skill, and approach rules. |
| `fillWindowId`, `fillCandidateId` | Server-owned | Accepted staged fills receive these provenance values; manual edits must not forge them. |

A melody attack that requires a fret above the selected accompaniment skill ceiling remains exact. It is reported as a labeled melody-only exception rather than transposed or used to relax limits for discretionary accompaniment.

## 4. Representation-level edit operations
<!-- beads-id: br-guide-timegrid-conversion-s10 -->

The following commands describe the desired structured edit boundary. They are **not** a claim that every command is already exposed as a UI control. A UI may provide them through click, keyboard, drag, and context-menu interactions.

### Add a bass/root/fifth/harmony/fill attack
<!-- beads-id: br-guide-timegrid-conversion-s11 -->

```json
{
  "type": "add-event",
  "measure": 1,
  "step": 1,
  "event": {
    "role": "bass",
    "string": 6,
    "fret": 0,
    "durationSteps": 2,
    "finger": "p"
  }
}
```

Adding a fill uses the same operation at an eligible empty or safe step:

```json
{
  "type": "add-event",
  "measure": 1,
  "step": 5,
  "event": {
    "role": "fill",
    "string": 3,
    "fret": 0,
    "durationSteps": 1,
    "finger": "i"
  }
}
```

### Change physical placement or duration
<!-- beads-id: br-guide-timegrid-conversion-s12 -->

The command layer must resolve an event by a stable UI ID, or by an unambiguous measure/step/event index while IDs are absent from the persisted schema.

```json
{
  "type": "move-event",
  "target": { "measure": 1, "step": 5, "eventIndex": 0 },
  "string": 2,
  "fret": 1
}
```

```json
{
  "type": "resize-event",
  "target": { "measure": 1, "step": 1, "eventIndex": 1 },
  "durationSteps": 4
}
```

### Remove discretionary support
<!-- beads-id: br-guide-timegrid-conversion-s13 -->

```json
{
  "type": "remove-event",
  "target": { "measure": 1, "step": 5, "eventIndex": 0 }
}
```

A user experience can map these commands naturally:

| Interaction | Structured result |
|---|---|
| Click an empty cell | Add an allowed bass, harmony, or fill event. |
| Select an existing event | Inspect, change string/fret/finger/role, or remove it. |
| Drag horizontally | Change onset or `durationSteps`. |
| Drag vertically | Select a different string/fret coordinate. |

Locked melody events are not removable, movable, or resizable through these arrangement operations.

## 5. Validate before committing an edit
<!-- beads-id: br-guide-timegrid-conversion-s14 -->

An editor should use a candidate-copy flow rather than mutating canonical state first:

```text
propose structured operation
  → clone current TimeGrid
  → apply operation to clone
  → validate source locks, physics, musical policy, and duration
  → commit valid clone and regenerate artifacts
  → otherwise retain canonical TimeGrid and show a specific diagnostic
```

For example:

> Cannot add fill at measure 4, step 6: string 2 is occupied by a sustained locked melody note until step 9.

### Required validation categories
<!-- beads-id: br-guide-timegrid-conversion-s15 -->

1. **Envelope and structure**
   - Version and source fingerprint are compatible.
   - Measure identity, grid cardinality/order, step numbers, and locked source facts are unchanged.
   - Event enums and coordinates are valid; strings are 1–6 and frets are inside the supported guitar range.
   - `durationSteps` is a positive integer and stays within the active (non-pickup-padding) measure duration.

2. **Melody and guitar physics**
   - Every source melody attack has one exact-pitch physical melody realization.
   - No two overlapping events occupy one guitar string.
   - A fill cannot use a string held by a sustaining melody event.
   - Fret range, fret span, hand movement, and simultaneous-shape constraints respect selected skill.
   - Right-hand assignment remains within PIMA/finger-capacity constraints.

3. **Musical and fill policy**
   - Bass/root/fifth/harmony events fit the active chord context.
   - Fills occur only in legal scored windows, respect density/per-measure budgets, avoid protected melody space, and satisfy scale-approach resolution rules where applicable.
   - Melody attacks retain their exact pitch/timing; a discretionary edit cannot replace or retrigger source melody state.

4. **Derived-artifact integrity**
   - The complete measure duration is correct after rendering.
   - Generated ABC maps every physical event back to the intended string/fret.
   - Generated ASCII-GuitarTab represents the same attack positions.

The persistence helper currently performs compatibility and basic tab-coordinate checks when restoring local data. Full physical and musical validation is enforced in the fingerstyle workflow and final validation paths; do not mistake local-storage shape checks for complete edit validation.

## 6. Deterministic TimeGrid-to-ABC conversion
<!-- beads-id: br-guide-timegrid-conversion-s16 -->

The renderer in `src/lib/theory/fingerstyle-arranger/time-slice-abc-renderer.ts` derives **sounding intervals**, not isolated independent cells:

1. Collect every tablature event attack at its starting grid step.
2. Resolve its sounding end from explicit `durationSteps`.
3. For a legacy persisted event with no duration, infer the duration until the next attack on the same string; melody attacks use source sustain state.
4. Split output at every event start and event end boundary.
5. At each interval, group sounding events by their forced physical string.
6. Render a rest only when no guitar event sounds.
7. Add validated, quantized in-measure tie continuation boundaries from immutable `source_abc.melody` when a matching physical Guitar melody event spans them.
8. Tie an event that continues into the next rendered interval, including an explicit validated `guitarTiesToNext` boundary when ordered adjacent measures are rendered together.
9. Join measures using stored source barlines and respect active pickup duration.

Source tie boundaries preserve notation segmentation such as `E3- E2` as generated Guitar `!1!e3- !1!e2`; they do not change the canonical physical `durationSteps`. This is separate from parenthesized `guitarSlurs`. The ordered renderer replays only explicit, validated adjacent-bar Guitar tie/slur records; it never manufactures continuity from equal pitches.

For the step-1 bass (two steps) plus melody (four steps) example, rendering must split at step 3. It must preserve one sounding melody event with a tie/continuation, rather than creating a second melody attack merely because the bass ended.

### Guitar ABC rules
<!-- beads-id: br-guide-timegrid-conversion-s17 -->

Every generated guitar pitch follows these rules:

- Derive **concert pitch** from the physical `(string, fret)` coordinate.
- Prefix it with `!N!` string forcing, for example `!6!E,` or `!1!e`. This bypasses ABCJS auto-string selection.
- Keep concert pitch with `clef=treble-8`; do not manually octave-shift notes.
- Honor the active key signature. In `K:Em`, a physical F natural emits an explicit `=F`/`=f` form; an F♯ that matches the key signature needs no redundant sharp.
- Retain duplicate concert pitches when they occur on different physical strings, such as `[!4!D!5!D]`.
- Emit ties on continuing segments, including when an added bass/fill begins during a held melody.

The generated Guitar voice is assembled with `clef=treble-8`, MIDI program 24, and source-aware measure barlines. The grid, source key/meter context, and renderer version together determine the exact ABC output.

## 7. Deterministic TimeGrid-to-ASCII-GuitarTab conversion
<!-- beads-id: br-guide-timegrid-conversion-s18 -->

ASCII-GuitarTab is generated from the same accepted TimeGrid as a six-string positional display. It is useful for inspection, copying, and export, but it is not an independent timing database:

- it displays attack positions and string/fret coordinates;
- TimeGrid `durationSteps` retains the authoritative sustain intent;
- edits to ASCII text do not become canonical arrangement edits;
- regenerate ASCII after every accepted TimeGrid change.

The existing ASCII conversion/import path has fixed-width 4/4 assumptions in places. That limitation does not change the TimeGrid contract, which remains meter-aware; do not treat a 16-step ASCII representation as a universal source schema.

## 8. Persistence, restore, and import boundary
<!-- beads-id: br-guide-timegrid-conversion-s19 -->

Persist the versioned TimeGrid envelope after a valid edit. On restore, compile fresh source measures first, then restore only compatible persisted tablature and visual-tab data. A changed source fingerprint, unsupported version, changed measure/grid structure, or incompatible source data discards the saved arrangement rather than applying it to different music.

Raw ABC and ASCII can remain useful import/export formats, but their conversion must produce and validate a TimeGrid before it becomes canonical. The application must not accept a raw string edit as an unvalidated replacement for locked melody/context data or physical guitar events.

## 9. Related implementation and references
<!-- beads-id: br-guide-timegrid-conversion-s20 -->

- `src/lib/theory/fingerstyle-arranger/time-slice.ts` — TimeGrid contracts and compilation.
- `src/lib/theory/fingerstyle-arranger/time-slice-abc-renderer.ts` — interval-based ABC rendering.
- `src/lib/theory/fingerstyle-arranger/timegrid-document-codec.ts` — public v3 readable interchange codec plus legacy v1/v2 migration parsing.
- `src/lib/theory/fingerstyle-arranger/timegrid-document-codec-v3.ts` — current named v3 formatting and parsing with root style overrides.
- `src/components/composer/workspace/fingerstyle-measure-persistence.ts` — production versioned persistence, fingerprint restore, and Guitar ABC assembly.
- `src/lib/theory/fingerstyle-arranger/toon-utils.ts` — editable-draft TOON and ASCII-GuitarTab conversion; not canonical document interchange.
- `src/lib/theory/fingerstyle-arranger/llm-codec.ts` — narrow `tablature:v1` LLM replacement codec; not canonical document interchange.
- [Guitar Fingerstyle Arrangement Guide](./guitar-fingerstyle-arrangement-guide.md) — staged AI generation and fill policy.
- [Guitar Fingerstyle Arrangement Guide § Deterministic foundation placement](./guitar-fingerstyle-arrangement-guide.md#10-deterministic-foundation-placement) — deterministic TimeGrid foundation placement and physical constraints.
