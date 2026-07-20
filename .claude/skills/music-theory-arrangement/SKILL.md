---
name: music-theory-arrangement
description: Comprehensive music theory knowledge graph for algorithmic composition, harmonic analysis, and arrangement. Use when examining music theory, composing or harmonizing music, analyzing chord progressions, applying voice leading rules, working with scales/modes/keys, generating multi-voice arrangements, or arranging for guitar, piano, or ensemble instruments. Triggers on tasks involving chord progressions, voice leading, key signatures, scales, modes, intervals, cadences, song form, rhythmic analysis, harmonization pipelines, guitar fingerstyle arrangement, piano accompaniment, ensemble orchestration, or any music generation that requires theoretical validation.
argument-hint: <key-or-progression-or-melody>
metadata:
  version: "1.1.0"
  domain: music-theory
---

# Music Theory & Arrangement — Agent Skill

This skill provides the **complete theoretical framework** for algorithmic composition, harmonic analysis, and instrument-specific arrangement. It is the authoritative reference for all music theory and arrangement decisions made by the agent.

## When to Use This Skill

Use this skill when the task involves:

- **Harmonization:** Assigning chords to a melody based on key, scale, and functional harmony
- **Arrangement:** Generating bass lines, piano parts, guitar voicings, or multi-voice textures
- **Guitar Arrangement:** Creating rhythm accompaniment or solo fingerstyle compression
- **Piano Arrangement:** Generating two-handed accompaniment with comping profiles, fills, and pedal automation
- **Ensemble Orchestration:** Adding Djembe, Flute, Violin, or other instruments with yield logic
- **Analysis:** Identifying keys, chord functions, cadences, modulations, or form
- **Composition:** Creating melodies, progressions, or full songs from scratch
- **Validation:** Checking that generated music obeys voice leading, beat counts, pitch alignment, and physical playability constraints

## When NOT to Use This Skill

- For **ABC notation syntax** or **abcjs library API** → use the `abcjs` skill instead
- For **audio playback, MIDI rendering, or UI integration** → use the `abcjs` skill instead
- This skill provides the *theory and arrangement rules*; `abcjs` provides the *notation format and tooling*

---

## Skill Documents

### 📖 Theory Foundation

> **Read [`THEORY.md`](./THEORY.md)** for the core music theory knowledge graph:
>
> 1. **Pitch, Intervals & Scales** — 12-TET, modes, pentatonic, blues, synthetic scales
> 2. **Chords, Extensions & Harmony** — triads through altered dominants, voicings, inversions
> 3. **Functional Harmony & Voice Leading** — diatonic function, secondary dominants, tritone substitution, modal interchange, strict counterpoint rules
> 4. **Rhythm, Meter & Groove** — simple/compound/asymmetric meters, syncopation, swing
> 5. **Form, Structure & Motivic Development** — cadences, song forms, bhajan structure, motivic techniques
> 6. **Output Generation Rules** — validation checklist, harmonization pipeline, ABC output format

### 🎸 Instrument Arrangement Modules

Read these when the task requires **generating arrangement parts** for specific instruments:

| Module | File | Use When |
| ------ | ---- | -------- |
| **Guitar** | [`ARRANGEMENT01-GUITAR.md`](./ARRANGEMENT01-GUITAR.md) | Generating rhythm guitar accompaniment (strumming, arpeggios) or solo fingerstyle arrangements (multi-layer compression into one guitar) |
| **Piano** | [`ARRANGEMENT02-PIANO.md`](./ARRANGEMENT02-PIANO.md) | Generating two-handed piano accompaniment with LH bass anchoring, RH voicing, comping profiles (ballad/rock/classical), fill generation, and pedal automation |
| **Ensemble** | [`ARRANGEMENT03-ESSEMBLE.md`](./ARRANGEMENT03-ESSEMBLE.md) | Expanding a melody+accompaniment foundation into a full ensemble with Djembe (percussion), Flute (melodic highlight), and Violin (harmonic bed) — includes yield logic, frequency stratification, and conflict resolution |

### Arrangement Pipeline and Route Ownership

When arranging from a melody-only input, first complete the shared Harmony foundation: `key-beats`, `chord-roles-progression`, then the selected `voice-leading-validation` ABC. That selected Step 3 ABC independently feeds two sibling routes:

```text
Harmony Step 3: selected voice-leading-validation ABC
  ├─ /compose/:slug/accompaniment       → combined support workflow
  └─ /compose/:slug/guitar-fingerstyle  → dedicated solo-guitar TimeGrid workflow
```

`/compose/:slug/accompaniment` has one combined accompaniment setup with this ordered, selectable stack:

1. Guitar Classic
2. Indian Harmonium
3. Djembe

Stack order supplies orchestration priority: lower instruments bias foundation/bass/drone/transient support; middle instruments bias comping and sustain; upper instruments bias lighter treble or rhythmic color while yielding to melody.

Conditional accompaniment steps:

- Shared foundation: `key-beats`, `chord-roles-progression`, `voice-leading-validation`.
- Guitar Classic: `guitar-comping-profile`, `guitar-voicing-bass`.
- Indian Harmonium: `harmonium-drone-register`, `harmonium-chord-voicing-validation`.
- Djembe: `djembe-groove-interlock`, `djembe-fill-validation`.

Disabled instrument branches must not appear, block completion, or be required before applying accompaniment output. The route does not offer Solo/Fingerstyle, fill-density, TimeGrid, generated Guitar ABC, or Guitar TAB output.

`/compose/:slug/guitar-fingerstyle` alone owns solo compression, skill and fill-density settings, the meter-aware TimeGrid, physical guitar validation, generated Guitar ABC, and ASCII-GuitarTab. It never waits for or consumes accompaniment output, setup style, branch options, or completion state. Follow [Guitar Fingerstyle Arrangement Guide](../../../docs/guitar-fingerstyle-arrangement-guide.md) and [TimeGrid Conversion Guide](../../../docs/timegrid-conversion-guide.md) for its bounded staged contracts; do not ask the LLM to replace a complete grid.

Do not create a separate `/music-theory-arrangement` app page for this workflow; this is a Claude skill and a theory reference, not a Next.js route.

### 🎹 MIDI Instrument Mapping Guide

When outputting ABC notation for the arranged instruments, use these `%%MIDI` configurations to match the app's soundfont profiles:

| Instrument | MIDI Program / Channel | Key Techniques for Realism |
| ---------- | ---------------------- | -------------------------- |
| **Guitar Classic / Guitar Acoustic** | `%%MIDI program 24` | Use arpeggiated/staggered patterns (no block chords). Guitar Classic favors nylon/fingerstyle warmth; Guitar Acoustic favors brighter folk strum/arpeggio support. |
| **Harmonium / Reed Organ** | `%%MIDI program 20` | Use sustained chordal drones, root-fifth anchors, and devotional comping; this replaces only the exact `Guitar Left Hand` accompaniment target. |
| **Violin** | `%%MIDI program 40` | Use slurs `()` to simulate smooth continuous bowing (legato). |
| **Flute** | `%%MIDI program 73` | Use slurs `()` for legato, and insert 16th-note rests (`z/`) for breath. |
| **Djembe** | `%%MIDI channel 10` | Map Bass (Dum) = `E`, Tone (Go) = `_E`, Slap (Pa) = `D` conga samples. |

Refer to the **`abcjs` Instrument Simulation Guide** in the `abcjs` skill file for complete code examples.

### ABC Multi-Instrument Staff-System Grouping

When an arrangement produces ABC for Melody plus Guitar, Piano, Djembe, Flute, Violin, or any other additional instrument, preserve the source Melody's visual staff systems. Treat each Melody music line as the root line for one staff-system group:

```abc
% Staff system 1
[V:Melody] melody-line-1
[V:Guitar] guitar-line-1
[V:Piano] piano-line-1

% Staff system 2
[V:Melody] melody-line-2
[V:Guitar] guitar-line-2
[V:Piano] piano-line-2
```

Hard rules:

- Every instrument line in a group must cover the same measure range and duration as the Melody line for that group.
- If an instrument is silent for that group, write rests for those measures rather than omitting the voice line.
- Do not output all Melody lines first and all instrument lines later when final ABC contains multiple instruments; interleave by staff system for abcjs rendering/playback alignment.
- Use comments like `% Staff system N` for readability, but avoid blank lines inside one ABC tune because blank lines can split tunes.

### ABC Tablature Rendering and String Mapping

When generating ABC for Guitar (or any string instrument) intended to be rendered as Tablature (`abcjs`), observe these critical string mapping rules to avoid layout collapse or incorrect auto-assignment:

1. **String Forcing (`!N!`)**: Prepend ABC notes with the `!N!` string decoration (e.g. `!1!b`, `!6!B,`) to explicitly force the note to a specific string `N` (1 to 6). This prevents the renderer from placing the note on the wrong string.
   - **Render-time Forcing**: To safeguard against raw LLM outputs or manual ABC input missing these, the playback pipeline automatically runs `ensureGuitarStringForcing()` at render-time, preserving chord symbols (e.g., `"Em"`) and ignoring non-Guitar voices.
2. **Duplicate Pitches**: It is mathematically valid and necessary to output the same concert pitch on multiple strings simultaneously (e.g. D3 on string 4 and string 5). Do **not** deduplicate identical pitches; emit them both with explicit string tags (`[!4!D!5!D]`).
3. **Octave Convention (`treble-8`)**: Always write notes at **standard concert pitch**. The `treble-8` clef causes rendering engines to subtract 12 semitones internally before fret calculation. Do NOT manually shift your ABC notes up +1 octave in code to compensate, otherwise the generated tablature frets will be calculated 12 frets too high.
4. **Key Signature Awareness**: When converting fret/string coordinates back to ABC notation, respect the active key signature. If a physical pitch is natural but the key signature has a sharp/flat on that note letter (e.g., F-natural in `K:Em` where F is sharped), you **MUST** output an explicit natural indicator `=` (e.g., `!1!=f` instead of `!1!f`) so that ABCJS does not incorrectly render it as fret 2. Conversely, omit the sharp/flat accidental if the key signature already implies it.
5. **Export Portability**: When exporting or copying the ABC notation, `cleanAbcForExport()` strips out the `!N!` decorations (since other software would render them as staff fingering numbers) and normalizes `clef=treble-8` to `clef=treble` so that third-party ABC viewers render the staff correctly.

### 🎸 Dedicated Guitar Fingerstyle (TimeGrid)

Use this material only for `/compose/:slug/guitar-fingerstyle`, after a selected Harmony Step 3 (`voice-leading-validation`) ABC exists. The dedicated workflow compiles that source into a meter-aware `TimeSliceMeasure[]` TimeGrid with four quantized steps per notated beat: 4/4 has 16 steps, 3/4 has 12, and supported meters use `numerator × 4` steps.

The server owns locked source facts, physical placement, and TimeGrid mutation. The LLM uses bounded staged contracts—foundation placement, paginated fill opportunities, use/skip selection, and physical candidate composition—rather than receiving or replacing a full grid. Fill density belongs only to the dedicated route, and discretionary fills remain confined to legal source-rest/phrase-gap windows.

Read [Guitar Fingerstyle Arrangement Guide](../../../docs/guitar-fingerstyle-arrangement-guide.md) and [TimeGrid Conversion Guide](../../../docs/timegrid-conversion-guide.md) for the canonical pipeline, contracts, validation rules, and Guitar ABC/TAB projection behavior.

## Relationship to Other Skills

| Skill                     | Responsibility                                           |
| ------------------------- | -------------------------------------------------------- |
| `music-theory-arrangement`| *What* notes/chords/rhythms to write, *why*, and *how* to arrange them for specific instruments |
| `abcjs`                   | *How* to encode them in ABC notation and render/play them |

When both skills are relevant (e.g., "compose a bhajan and render it"), read the appropriate documents from **this skill** first for theory and arrangement, then use **`abcjs/SKILL.md`** for notation encoding and rendering.
