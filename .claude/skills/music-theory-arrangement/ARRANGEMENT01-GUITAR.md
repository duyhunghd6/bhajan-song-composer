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

## 2. Application Ownership Boundary

`/compose/:slug/accompaniment` owns combined accompaniment planning only. Its Guitar Classic branch ends with `guitar-comping-profile` and `guitar-voicing-bass`; use the stack order and role notes to decide whether Guitar Classic emphasizes foundation/bass arpeggios, middle comping, or restrained treble support.

`/compose/:slug/guitar-fingerstyle` exclusively owns solo compression: one physical Guitar voice carries melody, chord-derived bass, and allowed support events; it also owns TimeGrid generation, skill/fill-density settings, physical validation, generated Guitar ABC, and GUITAR TAB. Both routes independently consume the selected Harmony Step 3 (`voice-leading-validation`) ABC. Accompaniment output never becomes a Guitar Fingerstyle input.

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

### 2.3 Devotional singer-support attack policy

This policy applies only to **Guitar Classic accompaniment**. It is not the solo Fingerstyle TimeGrid contract.

- Strings **4–6** are the bass band; strings **1–3** are the treble band. The thumb (`p`) supplies bass/root/fifth/approach motion; `i–m–a` supply inner and treble chord tones.
- For PIMA and pinch profiles, count individual note attacks across the whole realized support voice. Target **30–45% bass-band** and **55–70% treble-band** attacks. A pinch counts as one bass and one treble attack.
- Do not use more than two consecutive bass-only onsets. A third bass-only onset is exceptional transition/cadence material, never routine pulse.
- Walking bass is optional: use it only immediately before a real chord change when it is stepwise, playable, and does not crowd the singer. Do not require a beat-four approach in every bar.
- A pinch is exactly a simultaneous bass-plus-treble support accent on a metric strong beat. If a split chord window has no strong step, use ordinary arpeggio rather than moving the pinch to a weak subdivision.
- In a split bar, restart the active chord window from its own root/voicing context; never sustain tones from a previous chord through an incompatible chord change.

The physical validator confirms strings, frets, timing, simultaneous grip reach, and barres. PIMA right-hand assignments are a deterministic performance convention; Guitar Classic does not yet persist individual `p/i/m/a` metadata.

### 2.4 Harmonium Retarget for Exact `Guitar Left Hand`

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

The guitar bass (strings 6, 5, 4) is a restrained harmonic pulse:

1. **Root at a chord-window start** — anchor identity when a new harmony begins.
2. **Fifth or root later in a stable window** — use only when the complete PIMA/pinch distribution remains treble-led.
3. **Walking bass only at transitions** — an optional, stepwise approach may occupy the final weak subdivision before a new chord root; omit it at arrivals, phrase endings, short windows, or when it crowds the singer.
4. **Avoid lowest-note doubling** — if bass guitar/piano already covers the low register, thin Guitar Classic bass further.

---

## 3. Mode B: Solo Fingerstyle Arrangement Engine

### 3.1 Overview: The Two-Phase Pipeline

Solo fingerstyle is a **compression** problem: derive melody, chord, bass, and restrained rhythmic support that 4 fretting fingers + 5 picking-hand digits can execute on 6 strings. In this application, the operational TimeGrid contract is owned by `/compose/:slug/guitar-fingerstyle`; see `docs/guitar-fingerstyle-arrangement-guide.md` and `docs/timegrid-conversion-guide.md`.

```
Phase 1: Upward Construction    →  Build the full arrangement (melody, chords, bass, rhythm)
Phase 2: Downward Compression   →  Reduce to a playable solo guitar matrix
```

### 3.2 Phase 1: Upward Construction

The production dedicated route derives its locked context directly from the selected `voice-leading-validation` ABC: melody, chords, meter, key, phrase boundaries, and lyric facts. Any full multi-layer construction diagram is analytical theory only; `/compose/:slug/accompaniment` output is never a production input to Guitar Fingerstyle.

| Source fact | Role in dedicated Guitar Fingerstyle |
| ----------- | ------------------------------------ |
| **Melody** | Locked source pitch, timing, sustain, and phrase context |
| **Validated harmonization** | Chord progression and cadence context from Harmony Step 3 |
| **TimeGrid foundation** | Deterministic physical melody and chord-derived bass placement |
| **Legal fill opportunities** | Bounded source-rest/phrase-gap support candidates |

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

> **Note:** Travis-picking bass patterns are realized in the foundation stage of the TimeGrid engine. String slap and ghost-note percussion mapping are **theoretical/aspirational techniques** documented here for completeness and future implementation — the current deterministic engine does not automate them.

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

In the app, final playable fingerstyle output is emitted as one physical Guitar voice so abcjs can render GUITAR TAB from that staff. Analysis may use separate melody/bass threads, but a valid final output is a merged one-player `V:Guitar`; do not emit two simultaneous guitar parts that would require two players.

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
| **Fill** | Inside vocal gaps only | Chord tones, common tones, scale approach tones, neighbor tones, or brief motive echo | Yield immediately when melody resumes | Never obscure phrase-ending melody notes |

#### Fill Note Methods Summary

The following table summarizes all fill note techniques available for solo fingerstyle arrangement, their harmonic basis, placement constraints, and whether the current TimeGrid engine automates them:

| Method | Source Material | Placement Constraint | Engine Support |
| ------ | --------------- | -------------------- | -------------- |
| **Chord Tone Fill** | Root, 3rd, 5th, 7th, extensions of the active chord | Any legal rest window; 3rds prioritized, 5ths dropped first | ✅ Automated — `enumerateFillCandidates` pitch pool |
| **Common Tone Fill** | Notes shared between the current chord and the next chord | Near chord changes; creates smooth voice-leading bridges | ✅ Automated — `common-tone-next-chord` condition with +10 score bonus |
| **Scale Approach Tone** | Key-scale notes not in the active chord | Weak beats / off-beats only; **must resolve** to a chord tone before the fill window ends | ✅ Automated — `scale-approach` role with `resolve-by-window-end` condition |
| **Neighbor Tone Fill** | Upper or lower neighbor (half/whole step) from a target chord tone | Short windows (1–2 steps); must return to the target note | ⚠️ Partial — covered by scale-approach candidates when the neighbor pitch is diatonic |
| **Phrase-Transfer Fill** | Arpeggio or stepwise motion connecting the end of one vocal line to the start of the next | Line-end rest windows; highest scoring opportunity (up to +20 phrase-transfer bonus) | ✅ Automated — `phraseTransfer` scoring component with boundary evidence |
| **Motive Echo / Fragment** | Reuse of Sthayi/Antara motives, cadence targets, or melodic fragments | Intro, interlude, outro, or long rest gaps | ❌ Compositional — LLM or human decision; engine provides legal windows but not motive analysis |
| **Ghost Notes / String Slap** | Muted string taps (hi-hat illusion) or thumb slaps (snare illusion) | Off-beats and beats 2/4 respectively | ❌ Aspirational — documented theory for future implementation |
| **Travis-Picking Bass Pattern** | Alternating root/fifth bass in steady quarter notes | Continuous background pattern on strings 4–6 | ✅ Foundation stage — bass alternation is part of TimeGrid foundation, not fill analysis |

Hard rules:

1. Derive bass from the selected chord progression: root on beat 1, fifth/root/approach on stronger internal beats.
2. Reuse `Sthayi`/`Antara` motives or cadence targets rather than inventing unrelated new melodies.
3. Put fills in rests or long-note gaps; if the melody is active, simplify to bass + guide tone.
4. Validate every concrete intro/interlude/outro/fill tab event with the same tab-event schema as the main body.
5. If a form section cannot be made playable within fret-span/string rules, shorten it before changing the source melody.

---

## 4. Validation Checklist

Before outputting any guitar arrangement:

The accompaniment workflow validates representative Guitar Classic comping and voicing samples. Final Guitar Fingerstyle TimeGrid, fills, section material, and physical-output validation belong exclusively to `/compose/:slug/guitar-fingerstyle`, where fill density is configured independently.

```ts
type GuitarTabEvent = {
  measureIndex: number;
  beat: number;
  subdivision?: string | number;
  simultaneousGroupId?: string;
  sourceEventId?: string;
  note: string; // scientific pitch such as E2, B3, F#4
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  role: "melody" | "bass" | "root" | "third" | "seventh" | "fill" | "percussion" | string;
};
```

### One Physical Guitar Invariant

Events sharing `measureIndex + beat + subdivision` or the same `simultaneousGroupId` are simultaneous. A valid simultaneous group may be a chord across multiple strings, but it must be playable by one guitarist on one six-string instrument:

1. **One pitch event → one string.** A source note/event identified by `sourceEventId` must appear on only one physical string in the simultaneous group.
2. **One string → one sounding pitch.** A simultaneous group must never assign two pitches to the same physical string.
3. **Fretboard range is profile-aware.** `Guitar Classic` and `Guitar Acoustic` use their selected fretboard range; every validated `note` must include octave/register so `string + fret` can be checked against the sounding pitch.
4. **One left hand.** Open strings consume no fretting finger; same-fret multi-string shapes may count as one plausible barre; more than one barre, too many non-barre fretted targets, or a shape exceeding the selected voicing's fret stretch must be rewritten.
5. **Validation is on the merged matrix.** For solo/fingerstyle, validate the final merged physical tab events, not just separate analytical Melody/Bass threads.

| Check | Rule |
| ----- | ---- |
| ✅ **One-guitar source mapping** | One source pitch event is assigned to only one string |
| ✅ **Fret stretch** | No chord shape exceeds the selected profile/voicing stretch, normally 4-5 frets |
| ✅ **Fretboard range** | Every octave-bearing `note` matches `string + fret` and stays under the profile max fret |
| ✅ **Simultaneous notes** | Max 6 notes (one per string), with left-hand fretting count/barre feasibility checked |
| ✅ **String assignment** | Melody on strings 1-3, bass on strings 4-6 (fingerstyle) |
| ✅ **Beat count** | Total beats per measure match time signature |
| ✅ **Chord tone placement** | 3rd and 7th present in every chord voicing when physically possible; drop 5ths first if not |
| ✅ **Voice leading** | Adjacent chords follow shortest-path rule from THEORY.md §3.3 |
| ✅ **Register conflict** | Guitar accompaniment does not mask the primary melody register |
| ✅ **Thumb independence** | Bass pattern is steady and independent of melody rhythm (fingerstyle) |
