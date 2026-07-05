---
name: music-theory
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
1. THEORY.md §6.4          →  Harmonize the melody (find chords)
2. ARRANGEMENT01-GUITAR.md  →  If guitar arrangement is needed
   OR ARRANGEMENT02-PIANO.md →  If piano arrangement is needed
3. ARRANGEMENT03-ESSEMBLE.md →  If expanding to full ensemble
```

### 🎹 MIDI Instrument Mapping Guide

When outputting ABC notation for the arranged instruments, use these `%%MIDI` configurations to match the app's soundfont profiles:

| Instrument | MIDI Program / Channel | Key Techniques for Realism |
| ---------- | ---------------------- | -------------------------- |
| **Acoustic Guitar** | `%%MIDI program 25` | Use arpeggiated/staggered patterns (no block chords) to simulate fingerpicking. |
| **Violin** | `%%MIDI program 40` | Use slurs `()` to simulate smooth continuous bowing (legato). |
| **Flute** | `%%MIDI program 73` | Use slurs `()` for legato, and insert 16th-note rests (`z/`) for breath. |
| **Djembe** | `%%MIDI channel 10` | Map Bass (Dum) = `E`, Tone (Go) = `_E`, Slap (Pa) = `D` conga samples. |

Refer to the **`abcjs` Instrument Simulation Guide** in the `abcjs` skill file for complete code examples.

---

## Relationship to Other Skills

| Skill                     | Responsibility                                           |
| ------------------------- | -------------------------------------------------------- |
| `music-theory-arrangement`| *What* notes/chords/rhythms to write, *why*, and *how* to arrange them for specific instruments |
| `abcjs`                   | *How* to encode them in ABC notation and render/play them |

When both skills are relevant (e.g., "compose a bhajan and render it"), read the appropriate documents from **this skill** first for theory and arrangement, then use **`abcjs/SKILL.md`** for notation encoding and rendering.
