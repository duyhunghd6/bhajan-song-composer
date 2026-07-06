# Comprehensive Music Theory Knowledge Graph

> **Purpose:** This document provides the theoretical foundation for algorithmic composition, harmonic analysis, and music generation. It is a companion to `SKILL.md` (ABC Notation & abcjs library). When generating, analyzing, or processing music, strictly adhere to these frameworks to ensure harmonic validity, rhythmic coherence, and structural logic.

---

## 1. PITCH, INTERVALS, AND SCALES (The Micro-Level)

### 1.1 Pitch & Tuning

- **System:** 12-tone equal temperament (12-TET).
- **Enharmonic Equivalence:** C# = Db, F# = Gb, etc., but spell correctly according to the key signature (e.g., in G Major, use F#, not Gb).
- **Octave Designation:** Use Scientific Pitch Notation (e.g., C4 = middle C).

**ABC Notation Mapping:**

| Scientific Pitch | ABC Notation |
| ---------------- | ------------ |
| C3               | `C,`         |
| C4 (middle C)    | `C`          |
| C5               | `c`          |
| C6               | `c'`         |

### 1.2 Intervals

Intervals are the mathematical distance between two pitches, defined by **Number** and **Quality**.

| Quality              | Intervals                                                                  |
| -------------------- | -------------------------------------------------------------------------- |
| **Perfect (P)**      | Unison (0 semitones), 4th (5), 5th (7), Octave (12)                       |
| **Major (M)**        | 2nd (2 semitones), 3rd (4), 6th (9), 7th (11)                             |
| **Minor (m)**        | 2nd (1 semitone), 3rd (3), 6th (8), 7th (10)                              |
| **Diminished (d)**   | A Perfect or Minor interval narrowed by 1 semitone                        |
| **Augmented (A)**    | A Perfect or Major interval widened by 1 semitone                         |
| **Tritone**          | A4 or d5 = 6 semitones — the most dissonant diatonic interval             |

### 1.3 Scales & Modes

Construct pitch sets using strict interval patterns (W = Whole step/2 semitones, H = Half step/1 semitone).

#### Diatonic Scales

| Scale              | Pattern                   | Notes                    |
| ------------------ | ------------------------- | ------------------------ |
| **Major (Ionian)** | W-W-H-W-W-W-H            | 1 2 3 4 5 6 7            |
| **Natural Minor (Aeolian)** | W-H-W-W-H-W-W   | 1 2 b3 4 5 b6 b7         |
| **Harmonic Minor** | W-H-W-W-H-(W+H)-H        | 1 2 b3 4 5 b6 7          |
| **Melodic Minor**  | W-H-W-W-W-W-H (ascending) | 1 2 b3 4 5 6 7 (asc), reverts to natural minor (desc) |

#### The Seven Modes of the Major Scale

| Mode           | Character                  | Defining Interval     |
| -------------- | -------------------------- | --------------------- |
| **Ionian**     | Major                      | Natural 4, natural 7  |
| **Dorian**     | Minor with brightness      | Natural 6 (vs Aeolian)|
| **Phrygian**   | Minor with darkness        | Flat 2                |
| **Lydian**     | Major with brightness      | Sharp 4               |
| **Mixolydian** | Major with bluesy edge     | Flat 7                |
| **Aeolian**    | Natural Minor              | Flat 6, flat 7        |
| **Locrian**    | Diminished / unstable      | Flat 2, flat 5        |

#### Symmetrical & Synthetic Scales

| Scale             | Formula                      | Notes                |
| ----------------- | ---------------------------- | -------------------- |
| **Major Pentatonic** | 1-2-3-5-6                 | Removes 4th and 7th  |
| **Minor Pentatonic** | 1-b3-4-5-b7              | Removes 2nd and 6th  |
| **Blues Scale**    | 1-b3-4-b5-5-b7              | Minor pent + b5      |
| **Whole-Tone**    | 6 notes, all W               | Augmented, dreamlike |
| **Octatonic (Dim)** | Alternating W-H or H-W    | 8 notes, symmetric   |
| **Chromatic**      | All 12 semitones            | No tonal center      |

---

## 2. CHORDS, EXTENSIONS, AND HARMONY (The Meso-Level)

### 2.1 Triads & Seventh Chords

Chords are constructed by stacking thirds.

| Chord Type         | Symbol      | Formula       | Third Stack | ABC Chord Symbol |
| ------------------ | ----------- | ------------- | ----------- | ---------------- |
| **Major**          | Maj / ∆     | 1, 3, 5       | M3 + m3     | `"C"`            |
| **Minor**          | min / -     | 1, b3, 5      | m3 + M3     | `"Cm"`           |
| **Diminished**     | dim / °     | 1, b3, b5     | m3 + m3     | `"Cdim"`         |
| **Augmented**      | aug / +     | 1, 3, #5      | M3 + M3     | `"Caug"`         |

**Seventh Chords:**

| Chord Type         | Symbol      | Formula          | ABC Chord Symbol |
| ------------------ | ----------- | ---------------- | ---------------- |
| **Major 7th**      | Maj7 / ∆7   | 1, 3, 5, 7       | `"Cmaj7"`        |
| **Dominant 7th**   | 7           | 1, 3, 5, b7      | `"C7"`           |
| **Minor 7th**      | min7 / -7   | 1, b3, 5, b7     | `"Cm7"`          |
| **Half-Dim 7th**   | ø7          | 1, b3, b5, b7    | `"Cm7b5"`        |
| **Diminished 7th** | °7          | 1, b3, b5, bb7   | `"Cdim7"`        |
| **Minor-Major 7th**| mMaj7       | 1, b3, 5, 7      | `"CmMaj7"`       |

### 2.2 Extended and Altered Harmony

Extensions occur beyond the octave. They require the presence of the 3rd and 7th to establish chord quality.

- **9ths:** Add the 9th (2nd an octave up) — Major, Minor, or Dominant variants.
- **11ths:** Add the 11th (4th an octave up) — typically omit the 3rd in dominant contexts.
- **13ths:** Add the 13th (6th an octave up) — full voicing.
- **Altered Dominants (alt):** Dominant 7th chords modified with b9, #9, b5, or #5 to create maximum tension pulling to the tonic.
- **Suspended (sus2, sus4):** The 3rd is replaced by the 2nd or 4th, creating an open, ambiguous sound.

### 2.3 Voicing and Inversions

| Inversion          | Bass Note   | Figured Bass | ABC Example       |
| ------------------ | ----------- | ------------ | ----------------- |
| **Root position**  | Root        | 5-3          | `"C"`             |
| **1st Inversion**  | 3rd         | 6-3          | `"C/E"`           |
| **2nd Inversion**  | 5th         | 6-4          | `"C/G"`           |
| **3rd Inversion**  | 7th         | 4-2          | `"C7/Bb"`         |

- **Drop-2 Voicings:** Move the second-highest voice down an octave for spacious, resonant voicings.
- **Open Voicings:** Spread notes across multiple octaves to avoid muddiness.

---

## 3. FUNCTIONAL HARMONY & VOICE LEADING

### 3.1 Diatonic Function

Chords serve specific roles pulling toward or resting at the Tonic.

| Function           | Chords (Major Key) | Role                                    |
| ------------------ | ------------------ | --------------------------------------- |
| **Tonic**          | I, vi, iii         | Stability, resolution, home             |
| **Subdominant**    | IV, ii             | Preparation, moving away from Tonic     |
| **Dominant**       | V, vii°            | Maximum tension, forces resolution to I |

**Diatonic Chord Chart (Major Key):**

| Degree | Triad   | 7th Chord | Function     |
| ------ | ------- | --------- | ------------ |
| I      | Major   | Maj7      | Tonic        |
| ii     | Minor   | min7      | Subdominant  |
| iii    | Minor   | min7      | Tonic        |
| IV     | Major   | Maj7      | Subdominant  |
| V      | Major   | Dom7      | Dominant     |
| vi     | Minor   | min7      | Tonic        |
| vii°   | Dim     | ø7        | Dominant     |

### 3.2 Advanced Harmonic Concepts

#### Secondary Dominants (V/x)

Temporarily tonicize a diatonic chord by preceding it with its own Dominant 7th.

```
Key of C Major:
  V/V  = D7  → resolves to G (the V chord)
  V/ii = A7  → resolves to Dm (the ii chord)
  V/vi = E7  → resolves to Am (the vi chord)
  V/IV = C7  → resolves to F (the IV chord)
```

**ABC Example:**
```abc
K:C
"C"C2 E2 | "A7"A,2 ^C2 | "Dm"D2 F2 | "G7"G,2 B,2 | "C"C4 |
```

#### Tritone Substitution (SubV)

Substitute a dominant chord with another dominant chord a tritone (6 semitones) away.

```
G7  → Db7  (both resolve to Cmaj7)
A7  → Eb7  (both resolve to Dm7)
```

#### Modal Interchange (Borrowed Chords)

Borrow chords from the parallel minor or major key.

```
In C Major, borrow from C Minor:
  iv  = Fm     (instead of F Major)
  bVI = Ab     (chromatic color)
  bVII = Bb    (rock cadence: bVII → I)
  bIII = Eb    (film/cinematic sound)
```

#### Modulation Techniques

| Technique          | Description                                          |
| ------------------ | ---------------------------------------------------- |
| **Pivot Chord**    | Use a chord shared by both keys as a bridge          |
| **Direct**         | Abrupt shift to a new key (dramatic effect)          |
| **Sequential**     | Repeat a pattern, each time shifted up/down          |
| **Chromatic**      | Approach new tonic via chromatic voice movement       |

### 3.3 Strict Voice Leading (Counterpoint Rules)

When generating multi-part harmony, these rules are **mandatory**:

1. **Avoid Parallel 5ths and Octaves:** Two voices must NOT move in the same direction to land on a perfect 5th or Octave.
2. **Resolve Tendency Tones:**
   - The **leading tone** (scale degree 7) must resolve **UP** to the tonic (1).
   - The **7th of a dominant chord** (scale degree 4) must resolve **DOWN** to the 3rd of the tonic.
3. **Law of the Shortest Path:** Voices should move by step (a 2nd) or stay on common tones whenever possible. Avoid large leaps in inner voices.
4. **Contrary Motion Preferred:** When the bass leaps, upper voices should move in the opposite direction.
5. **Spacing:** Adjacent upper voices should not exceed an octave apart. Bass may be up to two octaves from the tenor.

---

## 4. RHYTHM, METER, AND GROOVE

### 4.1 Meter Classification

| Type                    | Examples      | Beat Division               | ABC `M:` |
| ----------------------- | ------------- | --------------------------- | -------- |
| **Simple Duple**        | 2/4           | Beats divide into 2         | `M:2/4`  |
| **Simple Triple**       | 3/4           | Beats divide into 2         | `M:3/4`  |
| **Simple Quadruple**    | 4/4           | Beats divide into 2         | `M:4/4`  |
| **Compound Duple**      | 6/8           | Beats divide into 3         | `M:6/8`  |
| **Compound Triple**     | 9/8           | Beats divide into 3         | `M:9/8`  |
| **Compound Quadruple**  | 12/8          | Beats divide into 3         | `M:12/8` |
| **Asymmetrical**        | 5/4, 7/8      | Unequal groupings (2+3, etc)| `M:5/4`  |

### 4.2 Rhythmic Nuance

- **Syncopation:** Accenting weak beats or upbeats. If a note begins on an off-beat and ties into a strong beat, it creates a syncopated groove.
  ```abc
  L:1/8
  M:4/4
  K:C
  z C2 C z C2 C |  % Syncopated pattern
  ```

- **Tuplets:** Fitting irregular numbers of notes into a regular subdivision.
  ```abc
  (3cde (3fga |  % Triplets in ABC
  ```

- **Swing:** Delaying the second eighth-note of a pair closer to a triplet grid. In ABC, annotate with `%%MIDI gchord` or tempo/style directives.

### 4.3 Rhythmic Validation Rule

> **⚠️ CRITICAL:** When generating ABC notation, the total beat count per measure MUST match the time signature. For `M:4/4` with `L:1/8`, each measure must contain exactly 8 unit-length beats worth of notes and rests.

---

## 5. FORM, STRUCTURE, AND MOTIVIC DEVELOPMENT (The Macro-Level)

### 5.1 Melodic Construction

- **Motif:** A short, identifiable musical idea (rhythmic and/or melodic). Typically 2–4 notes.
- **Phrase / Sentence:** Usually 4 or 8 bars. Must have a distinct cadence:
  - **Half Cadence (HC):** Ends on V — creates expectation.
  - **Perfect Authentic Cadence (PAC):** V → I with soprano on tonic — strongest resolution.
  - **Imperfect Authentic Cadence (IAC):** V → I with soprano NOT on tonic.
  - **Plagal Cadence (PC):** IV → I — the "Amen" cadence.
  - **Deceptive Cadence (DC):** V → vi — surprise resolution.
- **Contour:** Melodies must have a focal point (highest or lowest peak). Balance leaps with subsequent stepwise motion in the opposite direction.
- **Chord Tones on Strong Beats:** Melody notes falling on beat 1 and beat 3 (in 4/4) should ideally be chord tones. Passing tones, neighbor tones, and suspensions occur on weak beats.

### 5.2 Motivic Development Techniques

| Technique          | Description                                         |
| ------------------ | --------------------------------------------------- |
| **Repetition**     | Exact restatement of the motif                      |
| **Sequence**       | Repeat at a different pitch level                   |
| **Inversion**      | Flip the intervals (up becomes down)                |
| **Retrograde**     | Play the motif backwards                            |
| **Augmentation**   | Double the note durations                           |
| **Diminution**     | Halve the note durations                            |
| **Fragmentation**  | Use only part of the motif                          |
| **Extension**      | Add notes to the end of the motif                   |

### 5.3 Standard Forms

When composing, default to one of these macro-structures unless otherwise specified:

| Form               | Structure               | Use Case                    |
| ------------------ | ----------------------- | --------------------------- |
| **Binary (AB)**    | Two contrasting sections | Simple songs, dances        |
| **Ternary (ABA)**  | Statement-contrast-return | Art songs, arias            |
| **Rondo (ABACA)** | Recurring theme with episodes | Lively, celebratory pieces |
| **Sonata-Allegro** | Exposition-Development-Recap | Concert, orchestral        |
| **Popular/Song**   | Intro-Verse-PreChorus-Chorus-Bridge-Outro | Pop, bhajan, devotional |

**Popular Song Form in ABC (structural template):**

```abc
X:1
T:Song Structure Template
M:4/4
L:1/8
K:C
P:A          % Verse
"C"C2DE "Am"E2FG | "F"A2GA "G"G2FE |
P:B          % Chorus
"F"F2GA "C"c2BA | "G"G2AB "C"c4 |
```

### 5.4 Bhajan / Devotional Song Structure

Bhajans typically follow these structural patterns:

| Element        | Description                                           |
| -------------- | ----------------------------------------------------- |
| **Sthayi**     | Main refrain / chorus — the anchor of the song        |
| **Antara**     | Verse — explores higher register, develops the theme  |
| **Sanchari**   | Development — modulation, rhythmic variation          |
| **Abhog**      | Conclusion — returns to sthayi with finality          |

Common bhajan progressions often use:
- Simple I-IV-V-I or I-V-vi-IV patterns
- Modal borrowing from Raga-adjacent scales
- Call-and-response between lead and chorus

---

## 6. OUTPUT GENERATION RULES

When generating music based on a user prompt, apply these validation rules:

### 6.1 Pre-Generation Checklist

1. **Determine the key** — set `K:` correctly in ABC notation.
2. **Determine the scale/mode** — all pitches must belong to the scale unless chromaticism is intentional and annotated.
3. **Determine the time signature** — set `M:` and choose appropriate `L:` (unit note length).
4. **Determine the tempo** — set `Q:` to match the style.
5. **Determine the form** — plan the macro-structure before writing measures.

### 6.2 Validation Rules

| Rule | Description |
| ---- | ----------- |
| **Beat Count** | Total beat count per measure MUST match the time signature. |
| **Pitch Alignment** | All pitches must align with the specified key signature and harmonic progression. |
| **Bass Lines** | Bass notes should outline root notes or logical inversions. |
| **Melody on Strong Beats** | Chord tones on beats 1 and 3 (in 4/4); passing/neighbor tones on weak beats. |
| **Voice Leading** | Apply counterpoint rules from §3.3 for multi-voice textures. |
| **Accidentals** | Spell enharmonically correct for the key (§1.1). |
| **Instrument Physical Playability** | After generic harmony validation, apply the instrument module's physical validator. Guitar parts must pass `ARRANGEMENT01-GUITAR.md §4` one-physical-guitar checks for string assignment, fretboard range, and left-hand reach. |

### 6.3 ABC Output Format

When outputting ABC notation:

```abc
%abc-2.1
X:1
T:Generated Composition
C:AI Composer
M:4/4
L:1/8
Q:1/4=120
K:C
%%score (V1 V2)
V:V1 clef=treble name="Melody"
V:V2 clef=bass name="Bass"
%
[V:V1] "C"c2 B2 A2 G2 | "F"A2 G2 F2 E2 | "G7"D2 E2 F2 G2 | "C"c8 |
[V:V2] C,4 E,4 | F,4 A,4 | G,4 B,4 | C,8 |
```

### 6.4 Harmonization Pipeline

When harmonizing a melody-only input:

```
Step 1: Analyze the key (from K: header and pitch content)
Step 2: Identify strong-beat pitches in each measure
Step 3: Map strong-beat pitches to likely chord tones
Step 4: Select chords from the diatonic chart (§3.1)
Step 5: Apply voice leading rules (§3.3) to smooth transitions
Step 6: Add chord symbols as ABC annotations ("Am", "G7", etc.)
Step 7: Generate bass line (root → 5th → root movement)
Step 8: Validate beat counts and pitch alignment (§6.2)
Step 9: Apply instrument-specific physical validation before final arrangement output; guitar fingerstyle may revoice/drop nonessential chord tones (drop 5ths first, preserve 3rds/7ths when possible) to satisfy one-guitar constraints.
```

---

## Quick Reference: Common Progressions

| Name                | Numerals          | In C Major              | Style / Feel           |
| ------------------- | ----------------- | ----------------------- | ---------------------- |
| **Canon / Pop**     | I-V-vi-IV         | C-G-Am-F                | Universal, uplifting   |
| **50s / Doo-wop**   | I-vi-IV-V         | C-Am-F-G                | Nostalgic, sweet       |
| **Andalusian**      | iv-bIII-bII-I     | Am-G-F-E                | Spanish, dramatic      |
| **12-Bar Blues**     | I-I-I-I-IV-IV-I-I-V-IV-I-V | C-C-C-C-F-F-C-C-G-F-C-G | Blues, rock    |
| **Jazz ii-V-I**     | ii7-V7-Imaj7      | Dm7-G7-Cmaj7            | Jazz standard          |
| **Axis of Awesome**  | I-V-vi-IV         | C-G-Am-F                | Pop hits               |
| **Royal Road (JP)**  | IV-V-iii-vi       | F-G-Em-Am               | J-Pop, anime, emotional|
| **Devotional/Bhajan**| I-IV-V-I          | C-F-G-C                 | Simple, meditative     |

---

## Quick Reference: Key Signatures in ABC

| Key  | Sharps/Flats      | ABC `K:` |
| ---- | ----------------- | -------- |
| C    | None              | `K:C`   |
| G    | F#                | `K:G`   |
| D    | F#, C#            | `K:D`   |
| A    | F#, C#, G#        | `K:A`   |
| E    | F#, C#, G#, D#    | `K:E`   |
| B    | F#, C#, G#, D#, A#| `K:B`   |
| F    | Bb                | `K:F`   |
| Bb   | Bb, Eb            | `K:Bb`  |
| Eb   | Bb, Eb, Ab        | `K:Eb`  |
| Ab   | Bb, Eb, Ab, Db    | `K:Ab`  |
| Am   | None              | `K:Am`  |
| Em   | F#                | `K:Em`  |
| Dm   | Bb                | `K:Dm`  |
| Gm   | Bb, Eb            | `K:Gm`  |
