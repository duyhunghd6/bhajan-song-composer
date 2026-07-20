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

### Arrangement Pipeline (Reading Order)

When arranging from a melody-only input, follow this document reading order:

```
1. THEORY.md §6.4           →  Harmonize the melody (find chords)
2. Initial setup            →  Choose style and ordered instrument stack
3. ARRANGEMENT01-GUITAR.md  →  If Guitar Classic/Acoustic or Solo/Fingerstyle is enabled
   OR ARRANGEMENT02-PIANO.md →  If Piano is enabled
   OR harmonium guidance     →  If Indian Harmonium is enabled
4. ARRANGEMENT03-ESSEMBLE.md →  If Djembe/Flute/Violin support or later ensemble expansion is enabled
```

### Initial Accompaniment Setup

The accompaniment workflow starts on the single route `/compose/:slug/accompaniment` (for example `/compose/hari-bol/accompaniment`). Before small-step generation, capture:

1. **Style**
   - `Solo/Fingerstyle` — compress melody, chord support, and chord-derived bass onto the top enabled guitar. Disable Piano, Harmonium, Djembe, Flute, and Violin branches so the solo guitar remains clear.
   - `Accompaniment (combined instruments)` — combine enabled instruments while preserving the devotional melody first.
2. **Ordered instrument stack**
   - Guitar Classic
   - Guitar Acoustic
   - Piano
   - Indian Harmonium
   - Flute
   - Djembe
   - Violin

Use the order as orchestration priority:

- Lower/bottom instruments should take foundation, bass, drone, or transient-support duties.
- Middle instruments should provide comping, guide tones, or sustained support.
- Upper/top instruments should provide treble fills, breath, halo, sustained strings, or light rhythmic color.
- Djembe can support low Bass/Dum events when placed lower, or Tone/Slap transient color when placed higher.
- Violin can provide harmonic bed, drone-pad, or restrained counterline support and should yield before it covers the devotional melody.

Conditional step planning:

- Always run the shared harmonic foundation steps: `key-beats`, `chord-roles-progression`, and `voice-leading-validation`.
- Enable the Accompaniment Guitar steps when Guitar Classic or Guitar Acoustic is active: `guitar-comping-profile` and `guitar-voicing-bass`. Each Guitar step that proposes concrete notes must validate representative `guitarTab.events` against the one-physical-guitar rules in `ARRANGEMENT01-GUITAR.md §4`: one source note maps to one string, every note is within the selected fretboard range, and one left hand can fret the target shape. Fill density and final fill generation remain independent Guitar Fingerstyle settings and stages.
- Enable Piano steps only when Piano is active and the style is combined Accompaniment: `piano-comping-bass`, `piano-rh-voicing`, and `piano-fills-pedal-validation`.
- Enable Harmonium steps only when Indian Harmonium is active and the style is combined Accompaniment: `harmonium-drone-register` and `harmonium-chord-voicing-validation`.
- Enable Djembe steps only when Djembe is active and the style is combined Accompaniment: `djembe-groove-interlock` and `djembe-fill-validation`.
- Enable Flute steps only when Flute is active and the style is combined Accompaniment: `flute-yield-register` and `flute-breath-fill-validation`.
- Enable Violin steps only when Violin is active and the style is combined Accompaniment: `violin-bed-register` and `violin-expression-validation`.

Implementation behavior:

- The setup is persisted with the composer workspace and embedded in each accompaniment workflow session.
- New workflows default to combined Accompaniment with all seven setup instruments enabled in the order listed above.
- Legacy restored sessions without a setup are normalized to the older Guitar Classic + Piano combined-accompaniment behavior so existing localStorage drafts continue to unlock and render predictably.
- Do not create a separate `/music-theory-arrangement` app page for this workflow; this is a Claude skill and a theory reference, not a Next.js route.

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

### 🎸 Guitar Fingerstyle Tab Generation (Time-Slice Grid)

For solo guitar fingerstyle arrangements, the backend translates the melody and chord progression into a quantized 16-step JSON grid. The LLM acts as a logic router to map voicings and fingerpicking filler notes.

#### 1. Quantized JSON Step Grid Schema
The JSON grid contains exactly 16 steps per measure (for 4/4 meter):
```json
{
  "measure": 1,
  "style_profile": {
    "key": "Em",
    "comping_style": "PIMA devotional fingerstyle. Sparse fills.",
    "voicing_plan": "Open-position Em and D shapes. Thumbed E/B and D/A anchors."
  },
  "grid": [
    {"step": 1, "chord": "Em", "weight": "⬤", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "Ha-"},
    {"step": 2, "chord": "Em", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
    {"step": 3, "chord": "Em", "weight": "*", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "ri"},
    {"step": 4, "chord": "Em", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null}
  ]
}
```
* **weight**: Indicates the rhythmic weight. Strong beat downbeat (`⬤`), medium beat (`●`), soft beat (`*`), or off-beat (`null`).
* **melody.state**: Either `"attack"`, `"sustain"`, or `"rest"`.
* **lyric**: Syllable string, melisma (`_`), or skip (`*`).

#### 2. Exposed Arrangement Tools
* **`query_guitar_voicings(chord, melody_pitch, target_position)`**: Returns valid safe left-hand open chord shapes (e.g. `{"bass": {"string": 6, "fret": 0}, "melody": {"string": 1, "fret": 0}, "available_inner_strings": [3, 4]}`).
* **`validate_fingerstyle_physics(proposed_grid)`**: Evaluates playability. Returns an error if any inner-string note is placed on a string holding a sustaining melody note (`"state": "sustain"`).
* **`submit_arranged_measure(final_grid)`**: Submits the verified tablature grid.

#### 3. LLM Guidelines & System Prompt
The LLM must follow this systematic process:
1. **Anchor the Bass**: Place the lowest root bass note (Thumb/P) on `⬤` (Beat 1), and a secondary root/5th on `●` (Beat 3). Do not place heavy bass on `*` (Soft beats).
2. **Lock the Grip**: Query open-position shapes for chords at step 1 and 9 via `query_guitar_voicings()`.
3. **Protect the Melody**: Map melody pitches exactly on the highest treble strings (1-3).
4. **PIMA Fills**: Place sparse filler notes (Index/Middle) on empty `null` steps using available inner strings. Check that no filler notes collide with sustaining melody strings (The Sustain Rule).

---

## Relationship to Other Skills

| Skill                     | Responsibility                                           |
| ------------------------- | -------------------------------------------------------- |
| `music-theory-arrangement`| *What* notes/chords/rhythms to write, *why*, and *how* to arrange them for specific instruments |
| `abcjs`                   | *How* to encode them in ABC notation and render/play them |

When both skills are relevant (e.g., "compose a bhajan and render it"), read the appropriate documents from **this skill** first for theory and arrangement, then use **`abcjs/SKILL.md`** for notation encoding and rendering.
