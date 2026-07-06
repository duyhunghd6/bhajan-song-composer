# Arrangement Module: Guitar

> **Scope:** This module covers two guitar arrangement modes:
> **Mode A — Accompaniment** (rhythm guitar supporting a singer/lead) and
> **Mode B — Solo Fingerstyle** (compressing a full arrangement into one playable guitar part).
> Both modes share the same Harmonization prerequisite from [`THEORY.md`](./THEORY.md) §3 and §6.4.

---

## 1. Shared Foundation: Harmonization

Before generating any guitar part, the harmonic framework must exist. If the input is melody-only, run the Harmonization Pipeline from [`THEORY.md`](./THEORY.md) §6.4:

```
Melody → Key Detection → Strong-Beat Analysis → Chord Assignment → Voice Leading Validation
```

The output of this step is a chord-annotated melody in ABC format:

```abc
K:G
"G"G2 B2 | "C"c2 E2 | "D7"D2 ^F2 | "G"G4 |
```

---

## 2. Setup-driven Mode Selection

The `/compose/:slug/accompaniment` setup chooses whether guitar participates as a combined accompaniment branch or as the terminal `solo-fingerstyle` route.

- In `solo-fingerstyle`, enable the Guitar branch only. The final `guitar-fingerstyle` step must carry the melody on the Guitar voice, add chord-derived bass from roots/fifths/approach notes, expose intro/interlude/outro section metadata, and render GUITAR TAB.
- In combined `accompaniment`, Guitar Classic and Guitar Acoustic share the Guitar branch initially. Use setup order and role notes to decide whether the guitar emphasizes foundation/bass arpeggios, middle comping, or treble fills.
- Do not combine Solo/Fingerstyle compression with Piano/Harmonium/Djembe/Flute branches in the same workflow run unless the user explicitly asks for separate outputs.
- If both Guitar Classic and Guitar Acoustic are enabled, avoid duplicate generic `V:Guitar` responsibilities; treat the setup as one guitar branch until unique voice policies are implemented.

---

## 3. Mode A: Rhythm Guitar Accompaniment

### 2.1 Role Definition

The rhythm guitar is **Layer 2** — it supports the melody with harmonic and rhythmic motion. It must NOT compete with the vocalist or lead instrument.

### 2.2 Voicing Rules

| Rule | Description |
| ---- | ----------- |
| **Open voicings preferred** | Use standard open chord shapes (C, G, Am, Em, D, etc.) in first position when possible |
| **Barre for out-of-key chords** | Use barre shapes when the progression requires chords outside common open positions |
| **Avoid melody register** | If the melody sits in the high-E / B string range, use voicings that emphasize the lower 4 strings |
| **Guide tones** | Ensure the 3rd and 7th of each chord are present — they define major/minor/dominant quality |

### 2.3 Harmonium Retarget for Exact `Guitar Left Hand`

If a generation path or source layer is explicitly named `Guitar Left Hand`, treat that target as **Harmonium / Reed Organ accompaniment** instead of guitar. Emit `V:Harmonium` with `%%MIDI program 20`, use sustained devotional chord support, and do not retarget similarly named guitar layers such as `Guitar LH Accompaniment` or `Guitar Right Hand`.

### 2.4 Strumming Patterns (Comping Profiles)

#### Profile A: Ballad / Devotional (Fingerpicked Arpeggiation)

Gentle, flowing patterns for bhajans and slow songs.

```abc
%%MIDI program 24
V:Guitar clef=treble name="Guitar"
K:C
L:1/8
% Pattern: Bass-3rd-5th-root (broken chord, steady 8ths)
"C"C,EGc GEGC, | "Am"A,CEA ECEA, | "F"F,ACf CACF, | "G"G,BDg DBDG, |
```

**LH (Thumb) Protocol:** Alternating bass — thumb plays root on beat 1, then 5th on beat 3.
**RH (Fingers) Protocol:** i-m-a pattern across treble strings on beats 2 and 4.

#### Profile B: Pop / Folk (Strummed Chords)

Rhythmic strumming with accent patterns.

```abc
%%MIDI program 24
V:Guitar clef=treble name="Guitar"
K:G
L:1/8
% Pattern: Down-Down-Up-Up-Down-Up (standard folk strum)
"G"[G,B,DGB]2 [G,B,DGB] z [G,B,DGB][G,B,DGB] | "C"[C,EGce]2 [C,EGce] z [C,EGce][C,EGce] |
```

#### Profile C: Rock / Upbeat (Power Chord Drive)

Heavier rhythmic patterns with emphasis on downbeats.

```abc
%%MIDI program 29
V:Guitar clef=treble name="Guitar"
K:E
L:1/8
% Power chords on downbeats, palm-muted 8ths between
"E5"[E,B,e]2 E,E, [E,B,e]2 E,E, | "A5"[A,EA]2 A,A, [A,EA]2 A,A, |
```

### 2.4 Bass Line Construction

The guitar bass (strings 6, 5, 4) must follow these rules:

1. **Root on beat 1** — always anchor the chord identity
2. **5th on beat 3** — provides harmonic motion without ambiguity
3. **Walking bass on transitions** — when moving between chords, use stepwise chromatic or scalar approach notes on beat 4 to smoothly connect to the next chord's root
4. **Avoid lowest note doubling** — if the bass guitar/piano already covers the low register in an ensemble, thin the guitar bass

---

## 3. Mode B: Solo Fingerstyle Arrangement Engine

### 3.1 Overview: The Two-Phase Pipeline

Solo fingerstyle is a **compression** problem: take a full multi-track arrangement (melody + chords + bass + rhythm) and compress it into what 4 fretting fingers + 5 picking-hand digits can execute on 6 strings.

```
Phase 1: Upward Construction    →  Build the full arrangement (melody, chords, bass, rhythm)
Phase 2: Downward Compression   →  Reduce to a playable solo guitar matrix
```

### 3.2 Phase 1: Upward Construction

This phase creates the full arrangement context before compression. It reuses the core Arrangement Pipeline:

| Layer | Content | Source |
| ----- | ------- | ------ |
| **Layer 1: Melody** | The source ABC melody — the central logic stream | Input |
| **Harmonization** | Chord progression anchored to the melody | THEORY.md §6.4 |
| **Layer 2: Accompaniment** | Harmonic + rhythmic support (chords, arpeggios) | This module §2 |
| **Layer 3: Rhythm** | Bass foundation + rhythmic groove | Kick/bass sync, backbeat |

### 3.3 Phase 2: Downward Compression Algorithm

#### Step 1: Lock the Anchor Points (Outer Voices)

| Voice | String Assignment | Rule |
| ----- | ----------------- | ---- |
| **Melody** | Strings 1-3 (high E, B, G) | The primary melody is routed exclusively to the top 3 strings |
| **Bass** | Strings 4-6 (D, A, low E) | Root bass notes are routed to the bottom 3 strings |

**Validation:** On beat 1 of every measure, the melody note and bass note must be physically playable together. If the fret stretch exceeds 4-5 frets, trigger a **key-transposition fallback** that moves bass anchors toward open strings.

#### Step 2: Isolate the Harmonic Core (Inner Voices)

After locking melody (top) and bass (bottom), the remaining chord tones fill the middle strings:

| Priority | Action |
| -------- | ------ |
| **Keep 3rds and 7ths** | These define chord quality (major/minor/dominant) — never drop them |
| **Drop the 5th first** | The 5th adds volume but less harmonic identity — prune it when physical bandwidth is limited |
| **Place inner voices on weak beats** | Beats 2 and 4 fill spaces where the melody rests |

#### Step 3: Build the Rhythmic Illusion (Percussion Mapping)

A solo fingerstyle guitar must simulate drums through technique:

| Technique | Beat Placement | Effect |
| --------- | -------------- | ------ |
| **Travis-picking alternating bass** | Continuous quarter-note bass pattern | System clock / kick drum illusion |
| **String slap** | Beats 2 and 4 | Snare illusion — side of thumb strikes lower strings against frets |
| **Ghost notes** | Off-beats ("ands") | Hi-hat illusion — muted string taps between melody notes |

### 3.4 Execution Architecture: Physical Hand Mapping

#### Fretting Hand (LH) Constraints

| Constraint | Value | Action on Violation |
| ---------- | ----- | ------------------- |
| **Max fret stretch** | 4-5 frets across all strings | Transpose key or use open-string substitutions |
| **Max simultaneous fretted notes** | 4 (one per finger) | Drop the least essential chord tone (usually the 5th) |
| **Barre limit** | 1 barre per chord shape | Reshape voicing to avoid double-barre |

#### Picking Hand (RH) Profiles

**Profile A: Strict PIMA (Classical / Polyphonic)**

| Digit | Assignment | Posture |
| ----- | ---------- | ------- |
| **P (Thumb)** | Strings 6, 5, 4 (bass) | Floating, unanchored |
| **I (Index)** | String 3 | Free stroke |
| **M (Middle)** | String 2 | Free stroke |
| **A (Ring)** | String 1 | Free stroke |

Best for: complex polyphony, classical repertoire, maximum tonal variation.

**Profile B: Folk / Travis Override (Rhythmic / Groove)**

| Digit | Assignment | Posture |
| ----- | ---------- | ------- |
| **P (Thumb)** | Bass strings, alternating pattern | Anchored (pinky on soundboard) |
| **I + M** | Dynamically share all treble strings | Anchored |

Best for: rhythmic stability, heavy thumb attack, bass palm-muting, folk/country groove.

#### Two-Thread Motor System (Thumb Independence)

The picking hand operates as two independent threads:

```
Thread 1 (Background/Synchronous): Thumb executes steady 4/4 bass loop
Thread 2 (Asynchronous Events):    Fingers execute melody events in two states:
  ├── Synchronous Pinch:  Melody finger fires ON the downbeat alongside thumb
  └── Asynchronous Syncopation: Melody finger fires on the off-beat, between thumb strikes
```

### 3.5 ABC Output Template for Fingerstyle

For analysis, fingerstyle can be reasoned about as separate melody and bass threads:

```abc
%abc-2.1
X:1
T:Fingerstyle Arrangement Analysis
M:4/4
L:1/8
Q:1/4=100
%%score (Melody Bass)
V:Melody clef=treble name="Melody" snm="M"
V:Bass clef=treble name="Bass" snm="B"
K:C
%
% Beat:  1    &    2    &    3    &    4    &
[V:Melody] "C"e2  z  G   c2   z  E  |  "G"d2  z  B   G2   z  D  |
[V:Bass]    C,  G,  C,  G,  C,  G,  C,  G, |  G,,  D,  G,,  D,  G,,  D,  G,,  D, |
```

In the app, final playable fingerstyle output is emitted as one physical Guitar voice so abcjs can render GUITAR TAB from that staff:

```abc
V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"
%%MIDI program 24
% @fingerstyle-section intro
| E,2 B,2 E2 B,2 |
% @fingerstyle-section body
| E,2 E2 B,2 E2 | B,2 B2 F,2 A2 |
% @fingerstyle-section interlude
| B,2 A2 F,2 A2 |
% @fingerstyle-section outro
| E,2 E2 E,4 |
```

When this Guitar voice is combined with the original Melody staff, preserve the original Melody body systems exactly. Add intro/interlude/outro as extra staff systems where Melody contains full-measure rests and Guitar contains the form material.

### 3.6 Intro, Interlude, Outro, and Fill Policy

Fingerstyle polish sections support the devotional melody; they must not become a competing second song.

| Section | Placement | Source Material | Density Rule | Cadence Behavior |
| ------- | --------- | --------------- | ------------ | ---------------- |
| **Intro** | Before the first Melody system | Tonic/dominant arpeggio or the opening `Sthayi` motive | 1–2 measures by default | Establish key and picking profile before the singer enters |
| **Interlude** | At phrase/cadence boundaries, commonly between `Sthayi` and `Antara` | Short turnaround from the preceding cadence or a recognizable melodic fragment | Keep below melody density; avoid fast runs unless melody is resting | Reconnect smoothly to the next phrase's first chord/root |
| **Outro** | After the final Melody system | Final cadence arpeggio using tonic/root bass and stable top voice | 1–2 measures, thinning toward final note | End on tonic/root bass with consonant top voice |
| **Fill** | Inside vocal gaps only | Neighbor tones, chord tones, or brief motive echo | Yield immediately when melody resumes | Never obscure phrase-ending melody notes |

Hard rules:

1. Derive bass from the selected chord progression: root on beat 1, fifth/root/approach on stronger internal beats.
2. Reuse `Sthayi`/`Antara` motives or cadence targets rather than inventing unrelated new melodies.
3. Put fills in rests or long-note gaps; if the melody is active, simplify to bass + guide tone.
4. Validate every concrete intro/interlude/outro/fill tab event with the same tab-event schema as the main body.
5. If a form section cannot be made playable within fret-span/string rules, shorten it before changing the source melody.

---

## 4. Validation Checklist

Before outputting any guitar arrangement:

Concrete tab events must use the app/tool schema below whenever a workflow step validates voicings, fills, intro, interlude, outro, or final fingerstyle output:

```ts
type GuitarTabEvent = {
  measureIndex: number;
  beat: number;
  subdivision?: string | number;
  simultaneousGroupId?: string;
  note: string;
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  role: "melody" | "bass" | "root" | "third" | "seventh" | "fill" | "percussion" | string;
};
```

Events sharing `measureIndex + beat + subdivision` or the same `simultaneousGroupId` are simultaneous. A simultaneous group must never assign two pitches to the same physical string.

| Check | Rule |
| ----- | ---- |
| ✅ **Fret stretch** | No chord shape exceeds 4-5 fret span |
| ✅ **Simultaneous notes** | Max 6 notes (one per string), max 4 fretted |
| ✅ **String assignment** | Melody on strings 1-3, bass on strings 4-6 (fingerstyle) |
| ✅ **Beat count** | Total beats per measure match time signature |
| ✅ **Chord tone placement** | 3rd and 7th present in every chord voicing |
| ✅ **Voice leading** | Adjacent chords follow shortest-path rule from THEORY.md §3.3 |
| ✅ **Register conflict** | Guitar accompaniment does not mask the primary melody register |
| ✅ **Thumb independence** | Bass pattern is steady and independent of melody rhythm (fingerstyle) |
