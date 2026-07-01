# Arrangement Module: Piano Accompaniment Generation Engine

> **Scope:** This module expands a single baseline melody (Layer 1) into a fully realized two-handed piano accompaniment. Unlike guitar fingerstyle compression, piano generation is an **expansion** problem: it distributes harmony, bass, rhythm, counterpoint, and sustain behavior across 10 fingers and the 88-key frequency spectrum.
>
> **Prerequisite:** The harmonic framework must exist before piano textures are generated. If the input is melody-only, run the Harmonization Pipeline from [`THEORY.md`](./THEORY.md) §6.4 first.

---

## 1. Phase 1: Harmonic Framework & Bass Anchoring (The Foundation)

### 1.1 Harmonic Deduction (Harmonization)

- **Scale Detection & Cadence Parsing:** Analyze the Layer 1 melody to determine key signature and phrase endings. Parse cadence points so the accompaniment resolves naturally at devotional phrase boundaries.
- **Target Note Mapping:** Identify the melody notes landing on structurally strong beats (beats 1 and 3 in 4/4 time).
- **Chord Generation:** Assign chords where the target melody notes act as the root, 3rd, 5th, or 7th of the underlying harmony.

### 1.2 Left Hand (LH) Bass Anchoring

The Left Hand acts as the **bassist and timekeeper** of the arrangement.

| Action | Description | Register |
| ------ | ----------- | -------- |
| **Root Note** | Map the root of the active chord to the lower register | C2–C3 |
| **Octave Foundation** | Expand to octave (1-8) for thicker bass | C2–C3 |
| **Open Fifth** | Expand to 1-5-8 for maximum acoustic foundation | C2–C3 |

**ABC Example — LH Bass Patterns:**
```abc
V:LH clef=bass name="Left Hand"
K:C
L:1/4
% Octave bass foundation
C,C G,G | F,F C,C | G,,G, D,D | C,C z2 |
```

### 1.3 Low Interval Limit (LIL) Enforcement

> **⚠️ CRITICAL ACOUSTIC CONSTRAINT:** Overlapping low frequencies create intermodulation distortion (mud).

| Register | Allowed Intervals | Forbidden |
| -------- | ----------------- | --------- |
| **Below C3** (~130 Hz) | Roots, 5ths, Octaves (wide intervals only) | 3rds, 7ths, dense chord clusters |
| **C3 and above** | All intervals permitted | — |

---

## 2. Phase 2: Spatial Allocation & Voice Leading (The Architecture)

This phase determines *how* the remaining chord notes are distributed to the Right Hand (RH) and ensures fluid physical transitions.

### 2.1 Right Hand (RH) Voicing Logic

The RH acts as the **rhythmic guitar and inner string section**.

| Rule | Description |
| ---- | ----------- |
| **Guide Tone Placement** | Prioritize 3rd and 7th intervals in the mid-register (C3–C5) — they define major/minor/dominant quality |
| **Frequency Avoidance** | If the melody is in C4–C5 range, dynamically invert RH chords to sit *slightly below* the melody to prevent masking the vocalist |
| **Voicing Spread** | Use Drop-2 or open voicings (see THEORY.md §2.3) to avoid dense, muddy clusters |

**ABC Example — RH Voicing (avoiding melody register):**
```abc
V:RH clef=treble name="Right Hand"
K:C
L:1/4
% Melody at c' range — RH sits below at E-G-B
[EGB]2 [EGB]2 | [FAc]2 [FAc]2 | [GBd]2 [GBd]2 | [EGc]4 |
```

### 2.2 Voice Leading Algorithm (Shortest Path Rule)

When transitioning from Chord A to Chord B, inner voices must take the shortest possible path:

| Rule | Description |
| ---- | ----------- |
| **Common Tone Retention** | If Chords A and B share a note (e.g., G in C Major → G Major), lock that note stationary in the RH |
| **Dynamic Inversions** | Use chord inversions instead of jumping root positions — individual RH fingers should move by ≤ 2 semitones |
| **Contrary Motion** | When LH bass leaps (e.g., C → G), RH voices move in the opposite direction |

**Example — Voice Leading C → G → Am → F:**
```
C Major:  E4  G4  C5     (Root position)
G Major:  D4  G4  B4     (Common tone G stays; E→D, C→B = stepwise)
A Minor:  C4  E4  A4     (G→A steps up; B→A steps down)
F Major:  C4  F4  A4     (Common tone C and A stay; E→F = half step)
```

---

## 3. Phase 3: Rhythmic & Stylistic Texturing (The "Groove" Engine)

Raw block chords are unmusical. The system must apply specific **Comping Profiles** (Accompaniment Macros) to translate static chord data into continuous forward motion.

### 3.1 Profile A: Pop / Ballad (Flowing Arpeggiation)

Optimized for lyrical, emotional tracks and devotional bhajans.

| Hand | Pattern | Description |
| ---- | ------- | ----------- |
| **LH** | 1-5-10 Tenths | Flowing sequential pattern (e.g., C2 → G2 → E3) in steady 8ths |
| **RH** | Sustained block chords | Gently pulsing on downbeats, filling harmony below the melody |

```abc
%%score (RH LH)
V:RH clef=treble name="Right Hand"
V:LH clef=bass name="Left Hand"
K:C
L:1/8
[V:RH] "C"[EGc]4 [EGc]4 | "Am"[CEA]4 [CEA]4 | "F"[CFa]4 [CFa]4 | "G"[GBd]4 [GBd]4 |
[V:LH] C,G,E C,G,E C,G, | A,,E,C A,,E,C A,,E, | F,C,A, F,C,A, F,C, | G,,D,B, G,,D,B, G,,D, |
```

### 3.2 Profile B: Rock / R&B (Syncopated Comping)

Optimized for upbeat, driving music.

| Hand | Pattern | Description |
| ---- | ------- | ----------- |
| **LH** | Staccato octave roots | Heavy, precise on downbeats (simulates kick drum) |
| **RH** | Syncopated inversions | Chord stabs on off-beats ("and" of 2 or 4) for forward drive |

```abc
%%score (RH LH)
V:RH clef=treble name="Right Hand"
V:LH clef=bass name="Left Hand"
K:C
L:1/8
[V:RH] "C"z[EGc] z[EGc] z[EGc] z[EGc] | "F"z[FAc] z[FAc] z[FAc] z[FAc] |
[V:LH] C,2 z2 C,2 z2 | F,2 z2 F,2 z2 |
```

### 3.3 Profile C: Classical / Folk (Alberti Matrix)

Optimized for traditional or steady acoustic feels.

| Hand | Pattern | Description |
| ---- | ------- | ----------- |
| **LH** | Alberti Bass | Rolling arpeggio: Lowest → Highest → Middle → Highest (e.g., C-G-E-G) |
| **RH** | Sustained guide tones | Minimal rhythmic interference so melody remains clear |

```abc
%%score (RH LH)
V:RH clef=treble name="Right Hand"
V:LH clef=bass name="Left Hand"
K:C
L:1/8
[V:RH] "C"[EG]4 [EG]4 | "G"[BD]4 [BD]4 |
[V:LH] C,G,E,G, C,G,E,G, | G,,D,B,,D, G,,D,B,,D, |
```

---

## 4. Phase 4: Dynamic Counterpoint & Automation (The Polish)

A professional piano accompaniment is not static — it breathes with the melody.

### 4.1 Rest-State Detection (Gap Triggering)

The system scans the Layer 1 Melody data for **Melodic Gap Events**:

| Trigger Condition | Action |
| ----------------- | ------ |
| Melody sustains a single note > dotted half note | Flag as gap — RH can fill |
| Melody has explicit rest (singer breathes) | Flag as gap — RH can fill |
| Melody is actively moving | **NO fill** — RH stays in comping profile |

### 4.2 Fill Generation (Micro-Melodies)

During a gap, the RH temporarily breaks from its comping profile:

```abc
% Normal comping → Gap detected → Fill → Resume comping
[V:RH] [EGc]4 [EGc]4 | !mf!c'BAG FEDC | [EGc]4 [EGc]4 |
%       comping         ^^^^ fill ^^^^     comping resumes
```

**Yield Rule:** The exact millisecond the primary melody resumes active movement, the accompaniment engine immediately yields frequency space, suppressing fills and returning to Phase 3 rhythmic comping.

### 4.3 Fill Content Rules

| Rule | Description |
| ---- | ----------- |
| **Scale tones only** | Fills must use notes from the active key/chord |
| **Direction** | Prefer descending scalar runs (natural resolution feeling) |
| **Duration** | Fill must be shorter than the gap — leave a 16th-note buffer before melody re-entry |
| **Register** | Fill in the same register as the RH comping, NOT in the melody register |

---

## 5. Execution Architecture: Piano Physical Validation

The final generated matrix must pass through an anatomical constraint validator.

### 5.1 Maximum Span Limitation

| Constraint | Value | Action on Violation |
| ---------- | ----- | ------------------- |
| **Single hand span** | ≤ Major 10th (~16 semitones) | Convert to rolled/arpeggiated articulation |
| **Comfortable span** | ≤ Octave (12 semitones) | Preferred for most passages |

### 5.2 Hand Collision Detection

| Constraint | Action on Violation |
| ---------- | ------------------- |
| LH and RH cannot occupy the same keys simultaneously | Shift LH down an octave or thin LH texture |
| LH arpeggio crosses into RH chord range | Dynamic re-voicing of LH to stay below RH |

### 5.3 Sustain Pedal Automation (MIDI CC 64)

The sustain pedal acts as a controlled "third hand":

| Event | Timing | Purpose |
| ----- | ------ | ------- |
| **Pedal Down** | Beat 1 of a new chord | Connect the harmony, let notes ring |
| **Pedal Up (Flush)** | Immediately before the next chord | Prevent harmonic bleeding between chords |
| **Half-pedal** | On passing chords or chromatic motion | Partial sustain to avoid full mud |

> **⚠️ IMPORTANT:** Pedal data is part of the arrangement output, not a decorative playback-only effect. It must be encoded and validated.

---

## 6. ABC Output Template for Piano Accompaniment

```abc
%abc-2.1
X:1
T:Piano Accompaniment
M:4/4
L:1/8
Q:1/4=120
%%MIDI program 0
%%score {(RH) (LH)}
V:RH clef=treble name="Right Hand" snm="RH"
V:LH clef=bass name="Left Hand" snm="LH"
K:C
%
% Profile A: Ballad/Devotional
[V:RH] "C"[EGc]4 [EGc]4     | "Am"[CEA]4 [CEA]4    | "F"[CFa]4 [CFa]4    | "G7"[FGBd]4 [FGBd]4  |
[V:LH] C,G,E C,G,E C,G,     | A,,E,C A,,E,C A,,E,  | F,C,A, F,C,A, F,C,  | G,,D,B, G,,D,B, G,,D,|
%
% Resolution
[V:RH] "C"[EGc]8             |
[V:LH] C,8                   |
```

---

## 7. Validation Checklist

Before outputting any piano arrangement:

| Check | Rule |
| ----- | ---- |
| ✅ **Hand span** | No simultaneous chord exceeds Major 10th per hand |
| ✅ **Hand collision** | LH and RH never occupy the same keys |
| ✅ **LIL enforcement** | No 3rds/7ths/clusters below C3 |
| ✅ **Guide tones** | 3rd and 7th present in RH voicings |
| ✅ **Melody avoidance** | RH voicings sit below melody register, not competing |
| ✅ **Voice leading** | Adjacent chords follow shortest-path rule (THEORY.md §3.3) |
| ✅ **Beat count** | Both hands' beat counts match time signature |
| ✅ **Gap detection** | Fills only during Melodic Gap Events, immediate yield on melody return |
| ✅ **Pedal automation** | Pedal Down on beat 1, Flush before next chord |