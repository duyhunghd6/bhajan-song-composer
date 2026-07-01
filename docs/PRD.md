# Bhajan Song Composer — Product Requirements Document
<!-- beads-id: prd-bsc -->

> **Version**: 1.0  
> **Date**: 2026-06-29  
> **Status**: Draft  
> **Label**: `ready-for-agent`

---

## Problem Statement
<!-- beads-id: prd-bsc-s1 -->

Sahaja Yoga practitioners worldwide learn, practice, and perform bhajans (devotional songs) using scattered resources — YouTube videos of varying quality, hand-copied lyric sheets, informal chord charts passed between musicians, and occasionally formal ABC notation sheets maintained by individual contributors. There is **no unified, open-source platform** that:

1. Organizes the entire bhajan repertoire in a searchable, alphabetized catalogue grouped by language/tradition.
2. Offers **multi-format playback** — switching between YouTube video types (Beat Karaoke, Full Performance, Backing Track) and ABC-notation-rendered music sheets (Melody, Backing Track, Piano Background Karaoke).
3. Empowers practitioners to **compose their own arrangements** — layering multiple ABC notation tracks for a single song in different musical styles.
4. Provides **AI-assisted music theory guidance** — chord progression suggestions, guitar chord selection (accompaniment vs. fingerstyle), and piano arrangement suggestions (left hand + right hand for accompaniment and solo styles).
5. **Bridges the gap from melody to full arrangement** — Most bhajan sheets exist only as a single-voice melody on treble clef (G clef). Practitioners who want to play piano accompaniment or guitar fingerstyle have no tool that analyzes the melody and automatically generates the missing parts: bass clef (left hand for piano), chord voicings, strumming/picking patterns, or a combined fingerstyle arrangement.

---

## Solution
<!-- beads-id: prd-bsc-s2 -->

**Bhajan Song Composer** is an open-source web application that serves as both a **Playback Hub** and a **Composition Workstation** for Sahaja Yoga devotional music.

### Three Core Modules
<!-- beads-id: prd-bsc-s3 -->

| Module | Description |
|:---|:---|
| **🎵 Playback** | Browse the song catalogue (organized by language → A-Z), select a song, and choose between embedded YouTube video players or ABC notation music sheet renderers. Toggle between multiple video types and sheet types per song. |
| **🎼 Composer** | Create and edit songs using the same data format as the Playback module. Layer multiple ABC notation tracks (melody, backing, bass line, etc.) for a single song. Export and share compositions. |
| **🤖 AI Theory Assistant** | Rule-based music theory engine that **analyzes a melody-only treble clef sheet** and auto-generates: harmonized chord progressions, guitar chord voicings (accompaniment and fingerstyle), and piano arrangements (accompaniment and solo, both left and right hand) based on the song's key, scale, and raga. |

### Arrangement Pipeline (From Zero to Full Track)
<!-- beads-id: prd-bsc-s29 -->

When the user only has **Layer 1: Melody**, the product must not jump directly to **Layer 2: Accompaniment**. It must first deduce the song's harmonic framework, then use that framework to build accompaniment and full-band layers in a musically coherent order.

#### Step 1: Harmonization (Finding the Chords)
<!-- beads-id: prd-bsc-s30 -->

Before generating piano backing, guitar accompaniment, drums, or additional instruments, the system must assign chords to the melody.

- **Theory used**: Diatonic harmony, functional harmony (Roman numeral analysis), and cadences.
- **Method**:
  1. **Identify the key**: Analyze the scale the melody uses, such as C Major, the declared key signature, accidentals, and the raga-to-scale mapping where available.
  2. **Analyze strong beats**: Prioritize notes falling on structurally strong beats, especially beats 1 and 3 in 4/4 time. If the melody places C and E on strong beats, the underlying chord is likely C Major (Tonic) or A Minor (Submediant).
  3. **Establish chord functions**: Use tonic (home), subdominant (away), and dominant (tension) chords to create a progression that supports the melody's emotional contour and cadence points.

#### Step 2: Layer 2 — The Accompaniment (Piano / Rhythm Guitar)
<!-- beads-id: prd-bsc-s31 -->

Once the chord progression exists, the system decides how those chords should be played to support the singer or lead instrument.

- **Theory used**: Voice leading, rhythmic motifs, and bassline construction.
- **Method**:
  1. **Separate the bass**: Extract the lowest note of each chord as the foundation. Use inversions, such as placing the 3rd or 5th of a chord in the bass, to create a smooth walking bassline instead of jumping wildly between root notes.
  2. **Determine the groove (comping)**: Choose whether the piano or guitar plays block chords on the beat, arpeggios / broken chords, or syncopated rhythmic patterns.
  3. **Apply voice leading**: When moving from C Major (C-E-G) to G Major (G-B-D), keep shared tones stable where possible and move other notes by the smallest practical interval. This makes accompaniment sound professional and fluid rather than clunky.

#### Step 3: Layer 3 — Drums & Additional Instruments
<!-- beads-id: prd-bsc-s32 -->

After melody and accompaniment are harmonically grounded, the product can expand the arrangement into a full band or richer polyphonic texture.

- **Theory used**: Orchestration, counterpoint, and frequency-spectrum awareness.
- **Method**:
  1. **Drum / bass lock**: Align the kick drum with the rhythmic hits of the bassline generated in Layer 2. The snare usually defines the backbeat, especially beats 2 and 4 in common time.
  2. **Avoid frequency masking**: Assign instruments to complementary ranges so they do not fight for the same sonic space: bass in the low range, piano / guitar in the mid range, melody / vocals in the high-mid range, and hi-hats or cymbals in the high range.
  3. **Add counter-melodies**: Add secondary instruments, such as strings or lead synths, that move when the main melody pauses. When the singer sustains a long note, the secondary layer can play a tasteful fill.

This arrangement pipeline is a core product workflow: **Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track**.

### Multi-Layer Fingerstyle Arrangement Engine
<!-- beads-id: prd-bsc-s33 -->

The **Multi-Layer Fingerstyle Arrangement Engine** is a major AI Theory Assistant feature that converts musical data across two complementary phases:

1. **Upward Construction**: Build a full multi-track arrangement from a baseline melody.
2. **Downward Compression / Reduction**: Compress the multi-track arrangement — melody, accompaniment, bass, rhythm, and percussion — into a single physically playable solo fingerstyle guitar matrix without exceeding human anatomical constraints.

The engine must treat fingerstyle generation as more than chord labels plus melody notes. It must produce an executable guitar arrangement where melody, bass, harmonic guide tones, percussive effects, and right-hand technique all fit on a six-string instrument with four fretting fingers and a maximum of five picking-hand digits.

#### Phase 1: Upward Construction Pipeline
<!-- beads-id: prd-bsc-s34 -->

The first phase creates the full arrangement context before compression begins. It reuses the core Arrangement Pipeline and makes the intermediate layers explicit so the Composer can inspect and edit them.

- **Layer 1 — Melody**: The source ABC melody is the central logic stream.
- **Harmonization**: The melody is anchored to a chord progression through scale/key detection, strong-beat analysis, and functional progression assignment.
- **Layer 2 — Accompaniment**: The system generates harmonic and rhythmic support, usually piano or rhythm guitar, with bass foundation, chord inversions, groove generation, and voice leading.
- **Layer 3 — Rhythm & Percussion**: The system expands the arrangement with rhythm lock, kick/bass synchronization, snare backbeat placement, and frequency allocation across bass/low, chord/mid, and melody/high registers.

#### Phase 2: Downward Compression Algorithm
<!-- beads-id: prd-bsc-s35 -->

The second phase reduces the full multi-track arrangement into a solo fingerstyle guitar matrix.

- **Lock the anchor points / outer voices**:
  - Route the primary melody exclusively to the top three strings: G, B, and high E.
  - Route root bass notes to the bottom three strings: low E, A, and D.
  - Validate that the primary melody and bass note are physically playable together on Beat 1.
  - If a melody/bass pairing exceeds maximum fret-stretch capabilities, typically more than 4 or 5 frets, trigger a key-transposition fallback that moves bass anchors toward open strings and frees the fretting hand.
- **Isolate the harmonic core / inner voices**:
  - Prune the 5th of accompaniment chords when physical bandwidth is limited because it contributes volume but less harmonic identity.
  - Retain 3rds and 7ths as guide tones because they define major/minor/dominant quality.
  - Place the remaining 1-2 inner voices on weak beats, especially beats 2 and 4, to fill spaces where the primary melody rests.
- **Build the rhythmic illusion / percussion mapping**:
  - Use Travis-picking-style alternating bass as the system clock, with the thumb executing a continuous quarter-note bass pattern.
  - Simulate snare using a string slap on beats 2 and 4, where the side of the thumb strikes lower strings against the frets to produce a percussive transient while melodic plucks continue.

#### Execution Architecture: Physical Hand Mapping
<!-- beads-id: prd-bsc-s36 -->

The generated fingerstyle arrangement must map to the player's hands, not only to abstract pitches.

- **Two-thread motor system / thumb independence**:
  - **Thread 1: Background process** — the thumb acts as the system clock, executing a steady synchronous 4/4 bass loop.
  - **Thread 2: Asynchronous events** — fingers execute melody events in two states:
    - **Synchronous pinch**: A melody finger fires exactly on the downbeat alongside the thumb.
    - **Asynchronous syncopation**: A melody finger fires on the off-beat, halfway between thumb strikes.
- **Output channel mapping profiles**:
  - **Profile A: Strict PIMA, optimized for polyphony / classical playing**:
    - Thumb (P) handles bass strings 6, 5, and 4.
    - Index (I) maps to string 3, middle (M) maps to string 2, and ring (A) maps to string 1.
    - Uses a floating, unanchored hand posture to maximize tonal variation, resonance, and complex polyphony.
  - **Profile B: Folk / Travis Override, optimized for rhythm / groove**:
    - Thumb handles bass.
    - Index and middle fingers dynamically share all treble strings.
    - Uses an anchored posture, with pinky planted on the soundboard, to maximize rhythmic stability, heavy thumb attack, and bass palm-muting.

### Piano Accompaniment Generation Engine
<!-- beads-id: prd-bsc-s39 -->

The **Piano Accompaniment Generation Engine** expands a single baseline melody into a fully realized two-handed piano accompaniment. Unlike guitar fingerstyle compression, piano generation is an expansion problem: it distributes harmony, bass, rhythm, counterpoint, and sustain behavior across ten fingers and the 88-key frequency spectrum.

The engine must produce accompaniment that is musical, readable, and physically playable: the left hand anchors bass and time, the right hand supplies guide tones and rhythmic comping below the melody, and the sustain pedal acts as a controlled third hand without causing harmonic bleeding.

#### Phase 1: Harmonic Framework & Bass Anchoring
<!-- beads-id: prd-bsc-s40 -->

Before piano-specific textures are generated, the system must establish the chordal framework and anchor the lowest frequencies.

- **Harmonic deduction / harmonization**:
  - Detect scale and key from the Layer 1 melody's key signature, accidentals, and raga/scale constraints.
  - Parse cadence points and phrase endings so the accompaniment resolves naturally at devotional phrase boundaries.
  - Identify target melody notes on structurally strong beats, especially beats 1 and 3 in 4/4 time.
  - Assign chords where the target melody notes function as the root, 3rd, 5th, or 7th of the underlying harmony.
- **Left-hand bass anchoring**:
  - Map the active chord root into the lower piano register, typically C2-C3.
  - Expand single bass anchors into octaves (1-8) or open fifth foundations (1-5-8) when the arrangement needs a thicker acoustic base.
- **Low Interval Limit (LIL) enforcement**:
  - Below C3, output only wide intervals such as roots, 5ths, and octaves.
  - Do not generate 3rds, 7ths, or dense chord clusters in the deep bass register because they create acoustic mud and intermodulation distortion.

#### Phase 2: Spatial Allocation & Voice Leading
<!-- beads-id: prd-bsc-s41 -->

After bass anchoring, the system decides how remaining chord tones should be distributed to the right hand and how both hands should move between chords.

- **Right-hand voicing logic**:
  - Prioritize 3rds and 7ths in the mid-register, usually C3-C5, because these guide tones define major, minor, and dominant quality.
  - Dynamically invert right-hand chords to sit slightly below the primary melody when the melody occupies the C4-C5 vocal range, preventing accompaniment from masking the singer or lead instrument.
- **Voice-leading shortest-path rule**:
  - Retain common tones between adjacent chords in the same physical key position when possible.
  - Use dynamic inversions instead of repeated root-position jumps.
  - Prefer right-hand movements where individual fingers move by no more than a whole step (2 semitones) when a musically valid inversion is available.

#### Phase 3: Rhythmic & Stylistic Texturing
<!-- beads-id: prd-bsc-s42 -->

Static block chords are not enough. The engine must apply selectable **Comping Profiles** that turn chord data into continuous accompaniment motion.

- **Profile A: Pop / Ballad — Flowing Arpeggiation**:
  - Left hand executes a flowing 1-5-10 pattern, such as C2 → G2 → E3, in steady 8th notes.
  - Right hand plays sustained or gently pulsing block chords on downbeats, filling harmony below the melody.
- **Profile B: Rock / R&B — Syncopated Comping**:
  - Left hand plays heavy staccato octave roots on downbeats, simulating a kick drum.
  - Right hand plays rhythmically grouped chord inversions on off-beats, such as the "and" of 2 or 4, to create forward drive against the bass.
- **Profile C: Classical / Folk — Alberti Matrix**:
  - Left hand uses a rolling Alberti-bass algorithm: lowest note → highest note → middle note → highest note, for example C-G-E-G.
  - Right hand sustains guide tones with minimal rhythmic interference so the melody remains clear.

#### Phase 4: Dynamic Counterpoint & Automation
<!-- beads-id: prd-bsc-s43 -->

Professional piano accompaniment breathes with the melody. The system must detect melodic gaps and use them for tasteful motion without competing with the singer or lead instrument.

- **Rest-state / gap detection**:
  - Scan Layer 1 melody data for sustained notes longer than a configured threshold, such as a dotted half note, or rests where the singer takes a breath.
  - Mark these spans as **Melodic Gap Events** that can safely receive accompaniment fills.
- **Fill generation / micro-melodies**:
  - During a Melodic Gap Event, allow the right hand to briefly leave its comping profile to play a short scalar run, arpeggiated extension, or devotional-style fill.
  - Apply a strict yield rule: the moment the primary melody resumes active movement, suppress fills and return to the Phase 3 comping profile so the melody keeps priority.

#### Execution Architecture: Piano Physical Validation
<!-- beads-id: prd-bsc-s44 -->

The final piano accompaniment matrix must pass a physical and acoustic validation layer before being accepted into the Composer.

- **Maximum span limitation**:
  - The distance between the lowest and highest note played simultaneously by a single hand must not exceed a major 10th, approximately 16 semitones.
  - If a generated chord exceeds this span, convert it to a rolled / arpeggiated articulation instead of a simultaneous block chord.
- **Hand collision detection**:
  - The left hand and right hand cannot occupy the exact same keys at the same time.
  - If a left-hand arpeggio crosses into the right-hand chord range, shift the left hand down an octave or thin the left-hand texture.
- **Sustain pedal automation (MIDI CC 64)**:
  - Generate Pedal Down on Beat 1 of a new chord to connect the harmony.
  - Generate Pedal Up / Flush immediately before the next chord is struck to prevent harmonic bleeding.
  - Treat pedal data as part of the arrangement output, not as a decorative playback-only effect.

### Ensemble Expansion Engine (Percussion & Orchestral Layers)
<!-- beads-id: prd-bsc-s47 -->

The **Ensemble Expansion Engine** expands a completed two-layer foundation — **Layer 1: Primary Melody** plus **Layer 2: Piano / Guitar Accompaniment** — into a full multi-instrument ensemble. It generates a rhythm layer for **Djembe** and sustaining melodic support layers for **Flute** and/or **Violin**.

The engine must follow a strict support-first rule: auxiliary layers should enhance the bhajan arrangement through rhythmic interlocking, frequency stratification, and counterpoint, but they must never fight the primary melody or accompaniment. The central product constraint is **Yield Logic**: Djembe, Flute, and Violin must know when to play, when to hold, when to simplify, and when to disappear.

#### Phase 0: Integration Handshake (Prerequisite Analysis)
<!-- beads-id: prd-bsc-s48 -->

Before generating any new notes, the system must analyze the existing guitar or piano foundation to determine safe rhythmic and frequency zones for additional instruments.

- **Grid analysis**: Scan Layer 2 to determine rhythmic density, such as whether the guitar is playing busy 16th-note Travis picking or the piano is holding long block chords.
- **Bass map**: Map the exact millisecond placement of the lowest frequencies generated by the guitar thumb or piano left hand.
- **Melodic gap array**: Scan Layer 1 melody to identify rests or sustained notes longer than 1.5 beats. These spans become **Fill Zones** for Flute / Violin counter-melodies and optional Djembe fills.

#### Phase 1: Rhythmic Interlock (Appending the Djembe)
<!-- beads-id: prd-bsc-s49 -->

The Djembe layer must stitch itself mathematically to the rhythmic topography already established by Layer 2.

- **Bass-to-kick sync protocol**:
  - Map the Djembe's low-frequency **Bass** tone / center strike exactly to the transients of the Layer 2 bassline.
  - If the guitar thumb or piano left hand plays a root note on beats 1 and 3, the Djembe Bass fires simultaneously to fuse acoustic bass and drum impact.
- **Subdivision weave / frequency masking**:
  - Populate subdivisions that Layer 2 is not playing.
  - If piano or guitar occupies the downbeats, place low-velocity Djembe **Mid-Tone** fingertip taps on the off-beats, such as the "ands," to create motion without overwhelming the accompaniment.
- **Transient matching / backbeat snap**:
  - Map the Djembe high-frequency **Slap** tone to the backbeat, usually beats 2 and 4.
  - When the guitar fingerstyle layer already includes percussive string slaps, align the Djembe Slap with those events to reinforce physical groove impact without creating conflicting transients.

#### Phase 2: Melodic Support (Appending Flute & Violin)
<!-- beads-id: prd-bsc-s50 -->

Flute and Violin act as sustaining pads and counterpoint textures. Their job is to fill spatial and temporal voids while leaving the lead melody intelligible.

- **Frequency stratification / altitude rule**:
  - **Violin Bed**: When the Violin acts as harmonic support, constrain it to the octave below or interlocking with Layer 2 chords, typically G3-E5, to provide a warm acoustic pad.
  - **Flute Halo**: When the Flute acts as a melodic highlight, constrain it to the octave above Layer 1, typically C5-C6, so its airy tone floats above the arrangement.
- **Temporal interlocking / counterpoint engine**:
  - **Yield / Background Mode**: When Layer 1 is highly active, Flute and Violin freeze into sustained chord tones from Layer 2 and reduce volume by approximately 20%.
  - **Fill / Foreground Mode**: When the Melodic Gap Array exposes a rest or long held note, Flute and/or Violin may play a short secondary melodic run that bridges the singer's phrases.
- **Anatomical realism**:
  - **Flute Breath Validator**: Track continuous note duration and force a minimum 16th-note rest every 2-4 measures, with slightly reduced velocity on the note immediately before the breath.
  - **Violin Bowing Automation**: Apply slow expression swells using MIDI CC 11 on sustained notes, and delay vibrato using MIDI CC 1 until the note has been held for more than 300ms.

#### Phase 3: Master Output & Conflict Resolution
<!-- beads-id: prd-bsc-s51 -->

Before outputting the final four-to-five-layer ABC notation or MIDI event data, the system must run a final conflict check.

- **Density overload check / too-busy threshold**:
  - Scan vertical timeline slices to detect moments where Layer 1 is active, Layer 2 is playing a complex arpeggio, Djembe is executing a fast fill, and Flute or Violin is playing a run at the same millisecond.
  - Apply the resolution hierarchy: Primary Melody always wins; Flute / Violin is flattened into a sustained note; if the slice is still overloaded, the Djembe fill is removed and reverted to the base groove.
- **Polyphony validation / Violin double stops**:
  - A single violin may play a maximum of two simultaneous notes.
  - If a generated double stop exceeds standard fingerboard hand-stretch limits, typically around a musical 10th, drop the lower note and retain the melodic or harmonically essential upper note.

### Mockup / Proof-of-Concept Demonstration Gate
<!-- beads-id: prd-bsc-s54 -->

Every major arrangement workflow must ship a **mockup product / proof-of-concept demonstration page** before it is integrated into the main feature page or Composer workflow. This applies to:

1. **Arrangement Pipeline** — Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track.
2. **Multi-Layer Fingerstyle Arrangement Engine** — upward construction plus downward compression into a playable solo guitar matrix.
3. **Piano Accompaniment Generation Engine** — melody expansion into two-handed piano accompaniment with profiles, fills, validation, and pedal automation.
4. **Ensemble Expansion Engine** — Djembe, Flute, and Violin layers with yield logic and conflict resolution.

Each proof-of-concept page must be a self-contained product mockup that demonstrates the workflow with representative sample data before production integration. It must show the input melody/layers, the step-by-step generated intermediate decisions, the final generated ABC/playback artifact, and any validation or conflict-resolution report. Integration into the main Composer or Playback feature page is blocked until the mockup page demonstrates the workflow end-to-end and has behavior-focused tests covering its visible output.

### Song Data Model
<!-- beads-id: prd-bsc-s4 -->

Each song is a **Markdown file with YAML frontmatter** stored in `data/songs/{language}/{song-slug}.md`:

```yaml
---
title: "Namostute"
slug: "namostute"
language: "marathi"
category: "praise"
raga: "Bhairav"
taal: "Teentaal"
key: "Em"
timeSignature: "4/4"
videos:
  - type: "beat-karaoke"
    url: "https://youtube.com/watch?v=..."
    label: "Beat Karaoke"
    default: true
  - type: "full-performance"
    url: "https://youtube.com/watch?v=..."
    label: "Full Performance"
  - type: "backing-track"
    url: "https://youtube.com/watch?v=..."
    label: "Backing Track"
abcNotations:
  - type: "melody"
    label: "Melody Music Sheet"
    default: true
  - type: "backing-track"
    label: "Backing Track"
  - type: "piano-karaoke"
    label: "Piano Background Karaoke"
tags: ["bhajan", "marathi", "shri-mataji"]
composer: "Traditional"
contributors: ["community"]
---

## Lyrics

(Song lyrics with transliteration and translation)

## Notes

(Performance notes, raga description, cultural context)
```

The ABC notation content is stored in separate `.abc` files alongside the Markdown, referenced by the `abcNotations` entries:
- `namostute.melody.abc`
- `namostute.backing-track.abc`
- `namostute.piano-karaoke.abc`

---

## User Stories
<!-- beads-id: prd-bsc-s5 -->

### Playback Module
<!-- beads-id: prd-bsc-s6 -->

1. As a **practitioner**, I want to browse songs organized by language/tradition (Hindi, Marathi, Sanskrit, English), so that I can find songs from my cultural background quickly.
2. As a **practitioner**, I want an A-Z alphabetical navigation within each language category, so that I can jump to a specific song by its first letter.
3. As a **practitioner**, I want to search for a song by title, lyrics, raga, or tag, so that I can find songs even when I don't remember the exact title.
4. As a **practitioner**, I want to see a song detail page with both a YouTube video player and an ABC notation music sheet renderer, so that I can choose my preferred learning format.
5. As a **practitioner**, I want to switch between YouTube video types (Beat Karaoke, Full Performance, Backing Track) using a controller/selector, so that I can pick the accompaniment style I need for practice.
6. As a **practitioner**, I want to switch between ABC notation sheet types (Melody, Backing Track, Piano Background Karaoke) using a controller/selector, so that I can view the arrangement relevant to my instrument or role.
7. As a **practitioner**, I want the Melody Music Sheet to be the default ABC notation view, so that the most common use case is immediately visible.
8. As a **practitioner**, I want the Beat Karaoke video to be the default video view, so that I can start singing along immediately.
9. As a **practitioner**, I want the ABC notation sheet to render with proper note heads, time signature, key signature, and lyrics alignment, so that I can read the music accurately.
10. As a **practitioner**, I want MIDI playback of the ABC notation sheet, so that I can hear the melody without needing a YouTube video.
11. As a **practitioner**, I want playback controls (play, pause, stop, tempo adjustment) for the ABC notation MIDI playback, so that I can practice at my own pace.
12. As a **practitioner**, I want loop controls for ABC notation playback (loop whole sheet, selected measures, or a defined practice range), so that I can repeat difficult passages without manually restarting playback.
13. As a **practitioner**, I want the currently playing note to be highlighted on the music sheet during MIDI playback, so that I can follow along visually.
14. As a **practitioner**, I want the same reusable Music Sheet renderer to be used in both Playback and Composer screens, so that ABC rendering, playback, tempo, loop behavior, and note highlighting remain consistent everywhere.
15. As a **guitar or piano learner**, I want optional synchronized instrument highlighting during ABC playback, so that the matching guitar fret/string or piano key lights up at the same time as the note on the staff.
16. As a **guitar or piano learner**, I want the instrument view to show a semi-transparent SVG hand overlay (about 50% opacity) with animated finger movements, so that I can see not only which note is playing but also how the hand and fingers should move to play it.
17. As a **practitioner**, I want to share a direct URL to a specific song (with the selected video type or sheet type), so that I can share resources with other practitioners.
18. As a **practitioner**, I want the song page to be SEO-optimized with proper meta tags, so that searching for "{song name} bhajan" on Google surfaces the page.
19. As a **practitioner**, I want the app to be fully responsive and work well on mobile devices, so that I can use it during group meditation sessions from my phone.

### Composer Module
<!-- beads-id: prd-bsc-s7 -->

20. As a **composer**, I want to create a new song entry using the same Markdown+YAML+ABC format as the Playback module, so that my compositions are immediately compatible with the catalogue.
21. As a **composer**, I want a form-based song editor where I can fill in the frontmatter fields (title, language, category, raga, taal, key, time signature, videos, tags), so that I don't need to write raw YAML.
22. As a **composer**, I want an interactive ABC notation editor with live preview rendering, so that I can see the staff notation update in real-time as I type.
23. As a **composer**, I want to create multiple ABC notation layers for a single song (e.g., melody, backing track, bass line, harmony), so that I can build multi-part arrangements.
24. As a **composer**, I want to switch between notation layers in the editor, viewing and editing one layer at a time while optionally seeing other layers in the background, so that I can compose layered arrangements.
25. As a **composer**, I want to add YouTube video URLs to my song entry, categorized by type (Beat Karaoke, Full Performance, Backing Track, or custom labels), so that I can link various performance resources.
26. As a **composer**, I want to export my song as a Markdown file (with ABC files) that can be submitted as a Pull Request to the repository, so that my contribution follows the open-source contribution workflow.
27. As a **composer**, I want to import an existing ABC notation file, so that I can build upon existing transcriptions.
28. As a **composer**, I want to preview the full song page (as it would appear in the Playback module) before exporting, so that I can verify the final presentation.
29. As a **composer**, I want to transpose the entire song to a different key with a single action, so that I can adapt songs for different vocal ranges.
30. As a **composer**, I want undo/redo functionality in the ABC notation editor, so that I can experiment without fear of losing work.
31. As a **composer**, I want to save work-in-progress compositions to browser localStorage, so that I don't lose unsaved work if I accidentally close the tab.
32. As a **composer**, I want to browse all catalogue songs in a separate `/edit` page with live search, viewing their key signature and resource indicators (Video, Backing Track, Melody, Guitar, Piano), so that I can easily find and click 'Edit' to load any song into the composer workstation at `/compose?edit={slug}`.

### AI Theory Assistant Module
<!-- beads-id: prd-bsc-s8 -->

#### Core Use Case: Melody → Full Arrangement
<!-- beads-id: prd-bsc-s9 -->

_The most common scenario: a user has a melody-only ABC sheet (treble clef / G clef only, no bass clef / F clef) and wants to generate piano accompaniment or guitar fingerstyle arrangements._

33. As a **practitioner with only a melody sheet**, I want to load my treble-clef-only ABC notation into the AI assistant, so that it can analyze the melody and generate accompaniment parts I'm missing.
34. As a **practitioner**, I want the AI assistant to **auto-detect the key and scale/raga** from my melody ABC notation (by analyzing the key signature, accidentals, and note patterns), so that I don't need to manually specify the key.
35. As a **practitioner**, I want the AI assistant to **auto-harmonize my melody** by analyzing which notes fall on strong beats and assigning appropriate chords to each measure, so that I get a complete chord progression without needing music theory knowledge.
36. As a **piano player (accompaniment)**, I want the AI assistant to generate a **bass clef (left hand) part** from my melody-only sheet — producing root notes, root-fifth patterns, or Alberti bass patterns that match the auto-detected chord progression — so that I can play piano accompaniment with both hands while someone else sings.
37. As a **piano player (solo)**, I want the AI assistant to generate a **grand staff arrangement** (treble + bass clef) where the right hand carries the original melody and the left hand plays a bass/chord accompaniment pattern, so that I can perform the song as a complete piano piece.
38. As a **guitar player (accompaniment)**, I want the AI assistant to suggest guitar chord voicings (with visual fretboard diagrams) derived from the auto-harmonized chord progression, so that I can strum along while someone sings the melody.
39. As a **guitar player (fingerstyle)**, I want the AI assistant to generate a **combined fingerstyle arrangement** where the thumb plays bass notes (from the chord roots), the fingers play the melody on treble strings, and chord tones fill the gaps between melody notes — so that I can perform the entire song solo on one guitar.
40. As a **practitioner**, I want each generated arrangement to be output as a **separate ABC notation layer** (e.g., `namostute.piano-accompaniment.abc`, `namostute.fingerstyle.abc`) that I can view in the Playback module or edit in the Composer, so that AI-generated arrangements are first-class song content.

#### Chord & Voicing Suggestions
<!-- beads-id: prd-bsc-s10 -->

41. As a **practitioner learning music theory**, I want the AI assistant to suggest a chord progression based on the song's key and raga, so that I can understand the harmonic structure.
42. As a **practitioner**, I want the chord suggestions to be rendered as interactive visual diagrams (guitar fretboard with finger positions, piano keyboard with highlighted keys), so that I can learn the voicings visually.
43. As a **practitioner**, I want to see the ABC notation for each suggested arrangement (guitar accompaniment, guitar fingerstyle, piano accompaniment, piano solo), so that I can read and practice from standard notation.
44. As a **composer**, I want to accept AI-suggested chord progressions and arrangements directly into my composition layers, so that I can use them as a starting point for my own arrangement.
45. As a **practitioner**, I want the AI assistant to explain the music theory behind its suggestions (e.g., "Using the natural minor scale of Em, the iv-VII-III-VI progression creates a characteristic Indian devotional mood"), so that I can learn music theory in context.
46. As a **practitioner**, I want to specify constraints for the AI suggestions (e.g., "only open chords", "capo on 2nd fret", "left hand octave bass pattern"), so that the suggestions match my skill level and instrument setup.
47. As a **practitioner**, I want to override individual chords in the auto-harmonized progression (e.g., change one chord from Am to Am7), so that I can fine-tune the arrangement to my taste while keeping the rest of the AI-generated output.

### Multi-Layer Fingerstyle Arrangement Engine
<!-- beads-id: prd-bsc-s37 -->

48. As a **guitar player**, I want the system to build a full multi-track arrangement before reducing it to fingerstyle, so that the solo guitar output preserves melody, harmony, bass movement, and rhythmic feel.
49. As a **fingerstyle guitarist**, I want melody notes routed to the top three strings and bass roots routed to the bottom three strings, so that the arrangement follows idiomatic guitar register usage.
50. As a **fingerstyle guitarist**, I want the system to validate whether Beat 1 melody and bass notes are playable together, so that generated downbeat pinches do not exceed my hand span.
51. As a **fingerstyle guitarist**, I want the system to automatically propose key transposition when bass/melody combinations exceed a 4-5 fret stretch, so that difficult bass anchors can move to open strings.
52. As a **fingerstyle guitarist**, I want accompaniment chords reduced to the 3rd and 7th guide tones when necessary, so that the solo arrangement keeps harmonic identity without becoming unplayable.
53. As a **fingerstyle guitarist**, I want non-essential chord 5ths pruned during compression, so that limited fretting-hand bandwidth is reserved for melody, bass, and guide tones.
54. As a **fingerstyle guitarist**, I want inner voices placed on weak beats where the melody rests, so that the arrangement fills musical gaps without crowding the main tune.
55. As a **fingerstyle guitarist**, I want Travis-picking-style alternating bass generated as a steady thumb clock, so that the solo guitar part has rhythmic momentum even without drums.
56. As a **fingerstyle guitarist**, I want string-slap snare simulation on beats 2 and 4, so that the solo arrangement can suggest the original percussion layer.
57. As a **classical / polyphonic guitarist**, I want a Strict PIMA profile with thumb, index, middle, and ring assigned to fixed string groups, so that generated fingerings support resonance and independent voices.
58. As a **folk / groove guitarist**, I want a Travis Override profile with thumb-driven bass and flexible index/middle treble-string assignment, so that generated fingerings support rhythmic stability and palm-muted bass.
59. As a **composer**, I want to toggle between Strict PIMA and Folk / Travis output profiles, so that I can choose whether the generated arrangement prioritizes polyphony or groove.
60. As a **learner**, I want the visual guitar and SVG hand overlay to show thumb-clock, pinch, syncopation, and string-slap events, so that I can understand how to physically perform the generated fingerstyle matrix.

### Piano Accompaniment Generation Engine
<!-- beads-id: prd-bsc-s45 -->

61. As a **piano player**, I want the system to expand a melody-only sheet into a two-handed piano accompaniment, so that I can support a singer or lead instrument without writing bass and chord parts manually.
62. As a **piano player**, I want chord choices derived from strong-beat melody notes and cadence points, so that the accompaniment follows the devotional phrase structure.
63. As a **piano player**, I want the left hand to generate roots, octaves, or open fifths in the C2-C3 range, so that the accompaniment has a stable bass foundation.
64. As a **piano player**, I want the Low Interval Limit enforced below C3, so that generated bass parts avoid muddy low-register 3rds, 7ths, or dense clusters.
65. As a **piano player**, I want the right hand to prioritize 3rds and 7ths in the mid-register, so that the accompaniment communicates chord quality clearly.
66. As a **singer accompanied by piano**, I want right-hand chords inverted below the vocal melody when needed, so that accompaniment does not mask the singer's range.
67. As a **piano player**, I want common tones retained and chord inversions chosen by shortest-path voice leading, so that my hand does not jump unnecessarily between chords.
68. As a **composer**, I want to choose Pop / Ballad, Rock / R&B, or Classical / Folk comping profiles, so that the accompaniment matches the song's mood and genre.
69. As a **piano player**, I want a Pop / Ballad profile with flowing 1-5-10 left-hand arpeggiation, so that lyrical bhajans can have a wide emotional accompaniment texture.
70. As a **piano player**, I want a Rock / R&B profile with staccato left-hand octaves and syncopated right-hand off-beat chords, so that upbeat songs gain rhythmic drive.
71. As a **piano player**, I want a Classical / Folk Alberti matrix profile, so that traditional or steady acoustic songs have a rolling, predictable accompaniment.
72. As a **composer**, I want the engine to detect long melody holds and rests as Melodic Gap Events, so that the accompaniment can add tasteful fills only when space exists.
73. As a **singer**, I want accompaniment fills to yield immediately when the melody resumes, so that decorative piano movement never competes with the lead line.
74. As a **piano learner**, I want generated chords converted to rolled articulations when a hand span exceeds a major 10th, so that the arrangement remains playable.
75. As a **piano learner**, I want hand-collision detection between left-hand arpeggios and right-hand chords, so that both hands receive physically realistic note ranges.
76. As a **piano performer**, I want sustain pedal automation with clean Pedal Down and Pedal Up / Flush events, so that the generated accompaniment sounds connected without harmonic bleeding.

### Ensemble Expansion Engine
<!-- beads-id: prd-bsc-s52 -->

77. As a **composer**, I want to add Djembe, Flute, and Violin layers after the melody and piano/guitar foundation are established, so that ensemble expansion starts from a stable arrangement rather than guessing blindly.
78. As a **composer**, I want the system to analyze Layer 2 rhythmic density before adding new instruments, so that percussion and orchestral layers do not overcrowd a busy accompaniment.
79. As a **composer**, I want the system to map the exact bass events from guitar thumb or piano left hand, so that Djembe bass strokes can lock to the existing low-frequency pulse.
80. As a **composer**, I want the system to detect melody rests and held notes longer than 1.5 beats as Fill Zones, so that Flute and Violin know where counter-melodies can safely appear.
81. As a **percussion arranger**, I want Djembe Bass tones aligned exactly with Layer 2 bassline transients, so that drum and accompaniment form one strong rhythmic foundation.
82. As a **percussion arranger**, I want Djembe Mid-Tone taps placed on subdivisions that Layer 2 leaves empty, so that the groove rolls forward without fighting piano or guitar rhythms.
83. As a **percussion arranger**, I want Djembe Slap tones mapped to beats 2 and 4 or aligned with guitar string slaps, so that the backbeat gains impact without conflicting transient attacks.
84. As a **flute arranger**, I want Flute support constrained above the primary melody when used as a halo, so that it adds brightness without masking the singer.
85. As a **violin arranger**, I want Violin support constrained below or interlocked with Layer 2 when used as a bed, so that it adds warmth without colliding with the lead melody.
86. As a **composer**, I want Flute and Violin to hold quiet sustained chord tones when the melody is active, so that the auxiliary instruments support rather than distract.
87. As a **composer**, I want Flute and Violin to trigger short counter-melody fills only in detected Fill Zones, so that the arrangement breathes between vocal phrases.
88. As a **flautist**, I want generated Flute notation to include periodic breath rests every 2-4 measures, so that the part is physically playable.
89. As a **violinist**, I want sustained Violin notes to include expression swells and delayed vibrato, so that generated playback feels bowed rather than static.
90. As an **ensemble arranger**, I want density overload detection across all vertical timeline slices, so that the system simplifies auxiliary parts when too many elements are active simultaneously.
91. As an **ensemble arranger**, I want a clear conflict-resolution hierarchy where Layer 1 melody wins, Flute/Violin yield first, and Djembe fills simplify next, so that the devotional melody stays central.
92. As a **violinist**, I want generated double stops limited to two notes and validated against hand-stretch limits, so that the violin layer remains realistic.

### Mockup / Proof-of-Concept Demonstration Gate
<!-- beads-id: prd-bsc-s55 -->

93. As a **product reviewer**, I want every major arrangement workflow to have a standalone mockup / proof-of-concept page before production integration, so that I can validate the user experience and musical decisions before they affect the main Composer.
94. As a **composer**, I want the Arrangement Pipeline mockup to show melody input, harmonization, accompaniment, full-track expansion, and validation reports, so that I can understand the whole workflow before using it in my songs.
95. As a **fingerstyle guitarist**, I want the Fingerstyle Engine mockup to show upward construction, compression decisions, playability failures, and final guitar matrix output, so that I can trust the arrangement before importing it.
96. As a **piano player**, I want the Piano Accompaniment mockup to show comping profile selection, hand-span validation, gap fills, and pedal automation, so that I can compare accompaniment styles safely.
97. As an **ensemble arranger**, I want the Ensemble Expansion mockup to show Djembe, Flute, and Violin yield/conflict decisions, so that I can hear and inspect how auxiliary layers support the melody.
98. As a **maintainer**, I want each mockup page to include behavior-focused tests before main feature integration, so that experimental workflows are validated at a high seam before becoming production UI.
99. As a **contributor**, I want mockup pages to use representative sample data and visibly labeled intermediate outputs, so that I can review musical logic without reading implementation code.

### Community & Open Source
<!-- beads-id: prd-bsc-s11 -->

100. As a **contributor**, I want clear documentation on how to add a new song to the catalogue (file format, naming conventions, PR process), so that I can contribute without needing deep technical knowledge.
101. As a **contributor**, I want a song data validation tool that checks my Markdown+YAML+ABC files for correctness before I submit a PR, so that I can fix errors locally.
102. As a **maintainer**, I want automated CI checks that validate new song submissions for correct YAML schema, valid ABC notation, and required fields, so that I can review PRs efficiently.
103. As a **user**, I want the application to be deployed as a static site (or SSG), so that hosting costs remain zero or minimal for the open-source project.

---

## Implementation Decisions
<!-- beads-id: prd-bsc-s12 -->

### Architecture
<!-- beads-id: prd-bsc-s13 -->

- **Framework**: Next.js with TypeScript, using App Router. Static Site Generation (SSG) for song pages to enable zero-cost hosting on Vercel/Netlify.
- **Song Data Storage**: Markdown files with YAML frontmatter in `data/songs/{language}/` directory. ABC notation in separate `.abc` files alongside the Markdown. Git is the database — community contributes via Pull Requests.
- **ABC Rendering & Playback**: `abcjs` library for all ABC notation rendering (SVG staff notation), MIDI synthesis, and interactive editing. This is the mature, proven choice for web-based ABC notation.
- **Reusable Music Sheet Renderer**: Playback and Composer must share one reusable Music Sheet component for ABCJS rendering, play/pause/stop, speed/tempo changes, loop range controls, staff-note highlighting, and optional synchronized instrument highlighting. No feature should be implemented separately in only one screen unless explicitly documented.
- **YouTube Integration**: YouTube IFrame Player API for embedded video playback with controller UI to switch between video types (Beat Karaoke, Full Performance, Backing Track).
- **Mockup / Proof-of-Concept Gate**: Major arrangement workflows must first be exposed through standalone demonstration pages before production feature-page integration. These pages must use representative sample data, display intermediate theory decisions, render final ABC/playback artifacts, and show validation/conflict reports so product behavior can be reviewed at a high seam.
- **AI Theory Engine**: Rule-based music theory engine implemented in TypeScript. No external API dependencies. Covers:
  - **Melody analysis** — parse an input melody ABC to extract note-on-beat patterns, detect key/scale, and identify chord-worthy strong-beat notes
  - **Auto-harmonization** — assign chords to each measure by matching strong-beat melody notes against diatonic triads of the detected scale/raga
  - **Scale/Mode detection** from key signature and raga mapping
  - **Chord progression generation** based on scale degree relationships
  - **Piano arrangement generation** — from a melody-only treble clef, generate two-handed piano accompaniment and grand-staff ABC notation with harmonic deduction, left-hand bass anchoring, Low Interval Limit enforcement, right-hand guide-tone voicing, shortest-path voice leading, comping profiles, melodic-gap fills, physical validation, and sustain pedal automation
  - **Guitar fingerstyle arrangement generation** — from a melody + chord progression, produce a combined ABC notation where bass notes (thumb) interleave with melody notes (fingers) on appropriate strings
  - **Multi-layer fingerstyle compression** — reduce melody, accompaniment, bassline, rhythm, and percussion layers into a playable solo guitar matrix with string routing, stretch validation, guide-tone pruning, Travis picking, string-slap events, and PIMA / Travis profile mapping
  - **Ensemble expansion generation** — append Djembe, Flute, and Violin layers after melody and accompaniment exist, using grid analysis, bass-map synchronization, fill-zone detection, yield logic, frequency stratification, breath/bow realism, density overload resolution, and violin double-stop validation
  - **Guitar chord voicing library** (open chords, barre chords, capo positions) with fretboard diagram data
  - **Piano voicing library** (left hand patterns: root-fifth, Alberti bass, arpeggio; right hand: block chords, broken chords, melody doubling)
  - **ABC notation generation** from chord/voicing data

### Data Flow
<!-- beads-id: prd-bsc-s14 -->

```
Song Markdown (.md)  →  Next.js SSG Build  →  Static Song Pages
     ↓                                              ↓
ABC Files (.abc)     →  abcjs Renderer    →  SVG Staff + MIDI Playback
     ↓                                              ↓
YouTube URLs         →  IFrame API        →  Embedded Video Player

                    ┌──────────────────────────────────────┐
                    │    Melody → Arrangement Pipeline     │
                    ├──────────────────────────────────────┤
                    │                                      │
Melody ABC (.abc)  ─┤  1. Melody Analyzer                 │
 (Treble clef only) │     ↓ key, scale, beat-note map     │
                    │  2. Auto-Harmonizer                  │
                    │     ↓ chord progression per measure  │
                    │  3. Arrangement Generator            │
                    │     ├→ Piano LH ABC (bass clef)      │
                    │     ├→ Piano Grand Staff ABC          │
                    │     ├→ Guitar Chord Diagrams          │
                    │     └→ Guitar Fingerstyle ABC         │
                    │                                      │
                    │  Output: New .abc layers + diagrams   │
                    └──────────────────────────────────────┘
```

### Key Modules
<!-- beads-id: prd-bsc-s15 -->

1. **Song Catalogue Module** — File-system based song registry with language categorization and A-Z index. Uses `fs.readFileSync` + `gray-matter` at build time for SSG.
2. **Playback Controller Module** — Unified controller component that manages the currently active media type (video vs. sheet) and sub-type selection (which video, which sheet notation layer).
3. **Reusable Music Sheet Module** — Shared ABCJS rendering and MIDI playback component used by both Playback and Composer. It owns tempo/speed controls, loop range controls, staff-note highlighting, ABC render errors, and synchronized events for visual instruments.
4. **ABC Editor Module** — Interactive editor with syntax highlighting, live preview via the shared Music Sheet module, multi-layer tab management, and undo/redo stack.
5. **AI Theory Engine Module** — Pure TypeScript library with no side effects. Five modes of operation:
   - **Manual mode**: Input: key, scale/raga, time signature. Output: chord progressions, voicings, ABC notation strings.
   - **Auto-harmonize mode**: Input: melody-only ABC notation. Output: detected key, auto-generated chord progression, and full arrangement ABC layers (piano grand staff, guitar fingerstyle, etc.).
   - **Piano accompaniment mode**: Input: melody, chord progression, style profile, and hand-span constraints. Output: two-handed piano matrix with left-hand bass anchoring, right-hand voicing, comping events, counterpoint fills, pedal automation, and grand-staff ABC notation.
   - **Fingerstyle compression mode**: Input: full multi-layer arrangement (melody, accompaniment, bassline, rhythm/percussion metadata). Output: a physically validated solo guitar matrix with string assignments, fretting constraints, picking-hand events, transposition fallback suggestions, and ABC notation.
   - **Ensemble expansion mode**: Input: Layer 1 melody, Layer 2 piano/guitar accompaniment, bass map, rhythmic density grid, and melodic gap array. Output: Djembe, Flute, and Violin layers with yield decisions, conflict-resolution metadata, ABC notation, and playback control events.
6. **Piano Accompaniment Generation Module** — Rule-based expander that turns melody and harmony into playable two-handed piano accompaniment. It owns Low Interval Limit enforcement, C2-C3 bass anchoring, right-hand guide-tone placement, shortest-path voice leading, Pop / Ballad, Rock / R&B, and Classical / Folk comping profiles, Melodic Gap Event fill generation, hand-span validation, hand-collision detection, and sustain pedal automation.
7. **Multi-Layer Fingerstyle Arrangement Module** — Rule-based reducer that compresses full-track data into a playable six-string arrangement. It owns outer-voice routing, inner-voice pruning, guide-tone retention, weak-beat fill placement, Travis-picking clock generation, string-slap percussion events, and Strict PIMA / Folk Travis output profiles.
8. **Ensemble Expansion Module** — Rule-based layer appender that adds Djembe, Flute, and Violin after melody and accompaniment are stable. It owns integration handshake analysis, Djembe bass/mid/slap event generation, Flute altitude and breath validation, Violin bed/counterpoint generation, bow-expression automation, density overload detection, yield hierarchy, and double-stop validation.
9. **Workflow Mockup / POC Module** — Standalone demonstration surfaces for major arrangement workflows. Each mockup page owns sample-data setup, step-by-step decision visualization, final ABC/playback preview, validation-report display, and a handoff checklist that must pass before integration into the main Composer or feature page.
10. **Visual Instrument Module** — Reusable guitar fretboard and piano keyboard SVG components that can highlight specific notes/chords, subscribe to Music Sheet playback events, and animate a 50% opacity SVG hand/finger overlay to show the intended hand position and finger movement for each currently playing note. Adapted from patterns in the existing `music-theory` project.

### File Organization
<!-- beads-id: prd-bsc-s16 -->

```
data/
  songs/
    hindi/
      jai-shri-mataji.md
      jai-shri-mataji.melody.abc
      jai-shri-mataji.backing-track.abc
    marathi/
      namostute.md
      namostute.melody.abc
      namostute.backing-track.abc
      namostute.piano-karaoke.abc
    sanskrit/
    english/
src/
  app/
    page.tsx                    # Home: Language categories + search
    [language]/
      page.tsx                  # A-Z song list for a language
      [slug]/
        page.tsx                # Song detail: Playback page
    compose/
      page.tsx                  # Composer editor
    mockups/
      arrangement-pipeline/
        page.tsx                # POC demo before Composer integration
      fingerstyle-engine/
        page.tsx                # POC demo for guitar compression workflow
      piano-accompaniment/
        page.tsx                # POC demo for two-handed piano generation
      ensemble-expansion/
        page.tsx                # POC demo for Djembe/Flute/Violin layers
    api/
      validate/
        route.ts                # Song file validation endpoint
  components/
    playback/
      PlaybackController.tsx    # Video/Sheet type selector
      YouTubePlayer.tsx         # Embedded YouTube player
      AbcSheetViewer.tsx        # Thin playback-page wrapper around reusable MusicSheetRenderer
    music-sheet/
      MusicSheetRenderer.tsx    # Shared ABCJS SVG + MIDI playback, speed, loop, staff highlighting
      MusicSheetControls.tsx    # Play/pause/stop, tempo/speed, loop range controls
      useMusicSheetPlayback.ts  # Shared playback state, timing events, and highlight callbacks
    composer/
      SongForm.tsx              # Frontmatter editor form
      AbcEditor.tsx             # Interactive ABC notation editor using MusicSheetRenderer preview
      LayerManager.tsx          # Multi-layer ABC track management
    instruments/
      GuitarFretboard.tsx       # Visual guitar chord diagram + playback note highlight target
      PianoKeyboard.tsx         # Visual piano keyboard diagram + playback note highlight target
      SvgHandOverlay.tsx        # 50% opacity animated SVG hand/finger overlay for instrument playback
    ai/
      TheoryAssistant.tsx       # AI suggestion panel UI
      ChordSuggestions.tsx      # Chord progression display
  lib/
    theory/
      scales.ts                 # Scale definitions + raga mappings
      chords.ts                 # Chord generation from scale degrees
      melody-analyzer.ts        # Parse melody ABC → beat-note map, key detection
      harmonizer.ts             # Auto-assign chords to measures from melody analysis
      piano-arranger.ts         # Generate piano LH (bass clef) ABC from chords
      piano-accompaniment.ts    # Generate two-handed piano accompaniment matrix and grand staff ABC
      piano-comping-profiles.ts # Pop/Ballad, Rock/R&B, Classical/Folk accompaniment macros
      piano-playability.ts      # Validate hand span, hand collision, low interval limit, pedal events
      fingerstyle-arranger.ts   # Generate guitar fingerstyle ABC (melody+bass+chords)
      fingerstyle-compressor.ts # Reduce multi-layer arrangements into playable solo guitar matrix
      guitar-playability.ts     # Validate fret stretch, string routing, open-string transposition fallbacks
      picking-profiles.ts       # Strict PIMA and Folk / Travis right-hand event mapping
      ensemble-expander.ts      # Append Djembe, Flute, and Violin layers after accompaniment
      djembe-arranger.ts        # Generate bass, mid-tone, and slap events from bass map and rhythmic grid
      orchestral-arranger.ts    # Generate Flute/Violin pads, counter-melodies, and yield decisions
      ensemble-conflicts.ts     # Validate density overload, frequency masking, breath/bow limits, double stops
      guitar-voicings.ts        # Guitar chord voicing library
      piano-voicings.ts         # Piano voicing patterns (LH + RH)
      progression.ts            # Chord progression algorithms
      abc-generator.ts          # Generate ABC notation from theory data
    songs/
      loader.ts                 # Song file parser (Markdown + ABC)
      schema.ts                 # TypeScript types + Zod validation
      index.ts                  # Song catalogue index builder
```

### Instrument-Specific Output Detail
<!-- beads-id: prd-bsc-s17 -->

The AI Theory Assistant provides **visual chord diagrams** as the primary output format:

- **Guitar Fretboard**: SVG rendering showing finger positions, open/muted strings, fret numbers, and optional capo indicator. During Music Sheet playback, the current fret/string must highlight in sync with the currently playing ABC note. Two rendering modes:
  - **Accompaniment**: Shows simple chord shapes with strumming pattern notation
  - **Fingerstyle**: Shows more complex voicings with right-hand finger assignments (p, i, m, a)

- **Piano Keyboard**: SVG rendering highlighting pressed keys with finger numbers. During Music Sheet playback, the current key(s) must highlight in sync with the currently playing ABC note/chord. Two rendering modes:
  - **Accompaniment**: Left hand shows chord pattern; Right hand shows melody cues
  - **Solo**: Left hand shows bass pattern + chord; Right hand shows full melody + harmony

- **Animated SVG Hand Overlay**: Guitar and piano instrument views must support a reusable SVG hand overlay at approximately 50% opacity. The overlay should animate hand position and individual finger movement as playback advances, matching the note/fingering event emitted by the Music Sheet renderer. Animation timing must follow the actual ABCJS playback cursor events rather than an unrelated CSS loop.

- **ABC Notation Layer**: Each suggested arrangement is also available as downloadable ABC notation that can be imported into the Composer as a new layer.

### Fingerstyle Compression Output Contract
<!-- beads-id: prd-bsc-s38 -->

The Multi-Layer Fingerstyle Arrangement Engine must expose a structured intermediate result before generating final ABC notation. This contract is required so the Composer, Visual Instrument views, tests, and future issue tracker tasks can inspect the same musical decisions.

- **Source layers**: Melody, harmonized chords, accompaniment, bassline, rhythm/percussion metadata, and optional counter-melody data.
- **Outer voice map**: Melody notes assigned to strings 1-3 and root bass notes assigned to strings 4-6.
- **Playability report**: Per-beat validation of fret span, simultaneous melody/bass feasibility, fretting-finger count, picking-finger count, and any failed constraints.
- **Fallback suggestions**: Key transposition candidates when open-string bass anchors are needed to satisfy physical stretch limits.
- **Inner voice reduction**: Chord tones retained, chord tones pruned, and reasons for pruning; 3rds and 7ths are preferred over 5ths when bandwidth is limited.
- **Rhythmic event map**: Thumb-clock events, pinch events, off-beat syncopations, weak-beat guide tones, and string-slap snare simulation events.
- **Profile metadata**: Whether the output uses Strict PIMA or Folk / Travis Override, including hand posture and picking-finger assignment.
- **Generated artifacts**: Final ABC layer, guitar tablature/string-position metadata, fretboard-highlight events, and SVG hand-overlay animation events.

### Piano Accompaniment Output Contract
<!-- beads-id: prd-bsc-s46 -->

The Piano Accompaniment Generation Engine must expose a structured intermediate result before emitting final grand-staff ABC notation. This lets the Composer, Piano Keyboard view, playback engine, tests, and future issue tracker tasks inspect the same accompaniment decisions.

- **Source analysis**: Melody phrase map, cadence points, strong-beat target notes, detected key/scale/raga, and chord candidates.
- **Harmonic framework**: Selected chord progression with root, 3rd, 5th, 7th role mapping against the melody target notes.
- **Left-hand bass map**: Bass root, octave, open fifth, or 1-5-8 events, including register placement and Low Interval Limit validation below C3.
- **Right-hand voicing map**: Guide-tone placement, chord inversion choices, melody-masking avoidance, and shortest-path voice-leading distance between adjacent chords.
- **Comping profile metadata**: Selected profile, profile-specific left-hand protocol, right-hand protocol, rhythmic density, and articulation choices.
- **Counterpoint / fill map**: Melodic Gap Events, generated scalar runs or arpeggiated extensions, and yield points where fills stop as the melody resumes.
- **Physical validation report**: Per-hand maximum span, rolled-chord conversions, hand-collision fixes, octave shifts, and texture-thinning decisions.
- **Pedal automation**: MIDI CC 64 Pedal Down and Pedal Up / Flush events aligned to chord changes.
- **Generated artifacts**: Grand-staff ABC layer, playback events, piano-keyboard highlight events, optional fingering metadata, and pedal-event metadata.

### Ensemble Expansion Output Contract
<!-- beads-id: prd-bsc-s53 -->

The Ensemble Expansion Engine must expose a structured intermediate result before emitting final multi-layer ABC notation or MIDI-style playback events. This contract lets the Composer, playback engine, visual layer indicators, tests, and future issue tracker tasks inspect why each auxiliary instrument plays or yields.

- **Integration handshake**: Layer 2 rhythmic density grid, Layer 2 bass map with millisecond-level transient locations, and Layer 1 Melodic Gap Array with all rests or sustained notes longer than 1.5 beats.
- **Djembe event map**: Bass center strikes locked to Layer 2 bass transients, Mid-Tone fingertip taps placed on unused subdivisions, Slap strokes aligned to beats 2 and 4 or guitar string-slap events, and velocity levels for each stroke class.
- **Flute support map**: Altitude assignment above Layer 1, Fill Zone counter-melodies, Background Mode sustained tones, volume-yield changes, forced breath rests every 2-4 measures, and pre-breath velocity dips.
- **Violin support map**: Bed voicings in the G3-E5 support range, Fill Zone counter-melodies, Background Mode sustained chord tones, MIDI CC 11 expression swells, delayed MIDI CC 1 vibrato events, and double-stop validation decisions.
- **Yield decisions**: Per-timeline-slice state showing whether Djembe, Flute, and Violin are in active, background, fill, flattened, muted, or reverted-to-base-groove mode.
- **Conflict-resolution report**: Density overload detections, affected layers, applied hierarchy decisions, deleted Djembe fills, flattened Flute/Violin runs, and preserved Layer 1 melody events.
- **Generated artifacts**: Djembe ABC/percussion layer, Flute ABC layer, Violin ABC layer, combined ensemble playback events, optional MIDI control events, and visual layer activity metadata.

---

## Testing Decisions
<!-- beads-id: prd-bsc-s18 -->

### What Makes a Good Test
<!-- beads-id: prd-bsc-s19 -->

Tests should verify **external behavior and user-visible outcomes**, not implementation details. A good test for this application asks: "Can the user see/hear/interact with the correct output given this input?"

### Modules to Test
<!-- beads-id: prd-bsc-s20 -->

1. **Song Loader** — Given a valid Markdown+ABC file set, assert that the parsed output matches the expected data shape (frontmatter fields, ABC content, correct file associations). Given invalid files, assert meaningful error messages.

2. **AI Theory Engine (Manual Mode)** — Given a key (e.g., `Em`), scale type (e.g., `natural minor`), and time signature, assert that:
   - Generated chord progressions only contain chords diatonic to the scale
   - Guitar voicings are physically playable (no impossible stretches)
   - Piano voicings respect hand span limits
   - Generated ABC notation is syntactically valid (parseable by abcjs)

3. **Melody Analyzer & Auto-Harmonizer** — Given a melody-only ABC notation (treble clef), assert that:
   - Key detection correctly identifies the key from key signature and note distribution
   - Strong-beat notes are correctly identified based on time signature
   - Each generated chord contains at least one of the strong-beat melody notes in that measure
   - The generated chord progression follows common harmonic conventions (e.g., ends on tonic)
   - Piano left-hand ABC output uses bass clef (`K: clef=bass`) and stays within a playable left-hand range (C2–C4)
   - Guitar fingerstyle ABC output places melody on treble strings (1-3) and bass on bass strings (4-6)
   - All generated ABC layers are syntactically valid and produce correct staff rendering in abcjs

4. **Multi-Layer Fingerstyle Arrangement Engine** — Given melody, accompaniment, bassline, and percussion layers, assert that:
   - Upward construction produces inspectable layers in the correct order: melody, harmonization, accompaniment, rhythm/percussion, then compressed fingerstyle
   - Outer voice routing places melody on strings 1-3 and root bass notes on strings 4-6
   - Beat 1 melody/bass pairings are flagged when they exceed the configured 4-5 fret stretch limit
   - Key-transposition fallback suggestions prefer playable open-string bass anchors when a downbeat pairing fails
   - Inner-voice reduction prunes 5ths before pruning 3rds or 7ths when hand bandwidth is limited
   - Guide tones are placed on weak beats or melody-rest spaces rather than crowding the primary melody
   - Travis-picking thumb-clock events occur on quarter-note pulses, and string-slap snare events occur on beats 2 and 4
   - Strict PIMA profile assigns thumb/index/middle/ring to the expected string groups, while Folk / Travis profile allows index/middle sharing across treble strings
   - The generated visual-event stream can drive fretboard highlighting and SVG hand overlay animation for thumb clock, pinch, syncopation, and string slap events

5. **Piano Accompaniment Generation Engine** — Given a melody-only ABC notation, chord progression, and selected comping profile, assert that:
   - Harmonic deduction maps strong-beat melody notes and cadence points to chords where the melody acts as root, 3rd, 5th, or 7th
   - Left-hand bass anchors are placed in the C2-C3 range unless a profile explicitly requires a safe neighboring register
   - Low Interval Limit rules prevent 3rds, 7ths, and dense clusters below C3 while allowing roots, 5ths, octaves, and 1-5-8 foundations
   - Right-hand voicings prioritize 3rds and 7ths in the C3-C5 range and dynamically invert below the melody when masking would occur
   - Shortest-path voice leading retains common tones and prefers inversions where individual RH notes move by no more than 2 semitones when possible
   - Pop / Ballad profile emits a 1-5-10 left-hand arpeggiation and downbeat or gently pulsing right-hand support
   - Rock / R&B profile emits staccato downbeat octave roots and syncopated right-hand off-beat chord strikes
   - Classical / Folk profile emits the Alberti lowest-highest-middle-highest pattern with sustained guide tones
   - Melodic Gap Events trigger fills only during long holds or rests, and generated fills yield immediately when melody movement resumes
   - Hand-span validation converts chords wider than a major 10th into rolled articulations
   - Hand-collision detection shifts or thins left-hand texture when it overlaps the right-hand keys
   - Sustain pedal automation emits Pedal Down on new-chord Beat 1 and Pedal Up / Flush immediately before the next chord to avoid harmonic bleeding
   - Generated grand-staff ABC, piano-key highlight events, and pedal metadata remain synchronized during playback

6. **Ensemble Expansion Engine** — Given Layer 1 melody and Layer 2 piano/guitar accompaniment, assert that:
   - Integration handshake produces a rhythmic density grid, bass map, and Melodic Gap Array before any Djembe, Flute, or Violin notes are generated
   - Djembe Bass strokes align exactly with Layer 2 bass transients from guitar thumb or piano left hand
   - Djembe Mid-Tone taps populate subdivisions left empty by Layer 2 rather than duplicating already-busy accompaniment attacks
   - Djembe Slap strokes land on beats 2 and 4 or align with existing guitar string-slap events without creating conflicting transient attacks
   - Flute Halo events stay above the primary melody range, and Violin Bed events stay below or interlocked with accompaniment-support ranges
   - Flute and Violin enter Background Mode, reduce volume, and hold static chord tones when Layer 1 melody is rhythmically active
   - Flute and Violin enter Fill Mode only during melody rests or sustained notes longer than 1.5 beats
   - Flute breath validation injects at least a 16th-note rest every 2-4 measures and reduces velocity immediately before the breath
   - Violin bowing automation emits slow expression swells on sustained notes and delays vibrato until notes have held for more than 300ms
   - Density overload resolution preserves Layer 1 melody first, flattens Flute/Violin runs next, and deletes Djembe fills only if overload remains
   - Violin double stops never exceed two simultaneous notes and drop the lower note when hand-stretch validation fails
   - Generated Djembe, Flute, Violin ABC layers and playback events remain synchronized with the source melody and accompaniment layers

7. **Workflow Mockup / Proof-of-Concept Pages** — Given representative sample melodies and arrangement layers, assert that:
   - Each major workflow has a standalone mockup page before production Composer or feature-page integration
   - Arrangement Pipeline mockup displays melody input, harmonization, accompaniment, full-track expansion, final ABC/playback preview, and validation report
   - Fingerstyle Engine mockup displays upward construction, compression decisions, playability report, final guitar matrix, and visual event metadata
   - Piano Accompaniment mockup displays selected comping profile, hand-span validation, gap-fill decisions, pedal automation, and grand-staff preview
   - Ensemble Expansion mockup displays Djembe, Flute, and Violin layer decisions, yield states, density conflict resolution, and synchronized playback preview
   - Each mockup exposes visible pass/fail or review-ready status so integration into the main feature page is blocked until behavior is demonstrated end-to-end

8. **Playback Controller** — Given a song with multiple video types and sheet types, assert that:
   - Default selections are applied correctly
   - Switching types updates the displayed content
   - URL parameters reflect the current selection

9. **Song Data Validation** — CI pipeline tests that validate the `data/songs/` directory:
   - All `.md` files have valid YAML frontmatter matching the schema
   - All referenced `.abc` files exist
   - All ABC notation is parseable
   - No duplicate slugs within the same language

### Testing Tools
<!-- beads-id: prd-bsc-s21 -->

- **Vitest** for unit tests (theory engine, song loader, validation)
- **Playwright** for E2E tests (playback controller interactions, composer workflow)
- **Zod schema validation** for song data integrity checks in CI

---

## Out of Scope
<!-- beads-id: prd-bsc-s22 -->

The following are explicitly **out of scope** for this PRD (v1.0):

1. **User authentication and accounts** — No login, no user profiles. The app is fully public and anonymous.
2. **Server-side song storage** — All songs live in the Git repository. No database, no CMS.
3. **Real-time collaboration** — No multiplayer editing of compositions.
4. **Audio recording or microphone input** — No pitch detection, no vocal practice mode.
5. **LLM-powered AI composition** — The AI assistant is rule-based only. LLM integration (e.g., "compose a bhajan in Raga Bhairavi with 4 verses") is a future enhancement.
6. **Mobile native apps** — Web-only, responsive design. No iOS/Android apps.
7. **Payment or monetization** — Fully free and open-source.
8. **Indian classical notation systems** — No native Bhatkhande/Sargam notation rendering (ABC notation only, with transliteration in lyrics). Raga/Taal metadata is for cataloguing, not for generating strict classical compositions.
9. **MIDI instrument input** — No physical MIDI keyboard input for composition.
10. **Multi-language UI** — English UI only (song content can be in any language).

---

## Further Notes
<!-- beads-id: prd-bsc-s23 -->

### Relationship to Existing `music-theory` Project
<!-- beads-id: prd-bsc-s24 -->

This project draws architectural inspiration from the existing [`music-theory`](file:///Users/steve/duyhunghd6/music-theory) application, particularly:
- ABC notation rendering patterns (abcjs integration)
- Virtual instrument components (guitar fretboard, piano keyboard)
- Audio engine patterns (MIDI playback via abcjs/Tone.js)

However, Bhajan Song Composer is a **standalone project** with its own repository, focused specifically on the devotional music community's needs rather than general music education.

### Raga-to-Scale Mapping
<!-- beads-id: prd-bsc-s25 -->

A key differentiator is the raga-to-Western-scale mapping table that powers the AI Theory Assistant. Common mappings include:

| Raga | Western Equivalent | Notes |
|:---|:---|:---|
| Bhairav | Double Harmonic Major | C Db E F G Ab B |
| Yaman | Lydian Mode | C D E F# G A B |
| Kafi | Dorian Mode | C D Eb F G A Bb |
| Bhairavi | Phrygian Mode | C Db Eb F G Ab Bb |
| Khamaj | Mixolydian Mode | C D E F G A Bb |
| Bilawal | Major Scale (Ionian) | C D E F G A B |

This mapping enables the theory engine to suggest Western chord voicings that are harmonically compatible with Indian raga-based melodies.

### Contribution Model
<!-- beads-id: prd-bsc-s26 -->

The open-source contribution model follows a "Git is the database" philosophy:
1. Fork the repository
2. Add song files following the documented format
3. Run local validation (`npm run validate`)
4. Submit a Pull Request
5. CI automatically validates the song data
6. Maintainers review and merge

### Deployment Strategy
<!-- beads-id: prd-bsc-s27 -->

- **Primary**: Vercel (free tier) with automatic deployments from `main` branch
- **Alternative**: Netlify, GitHub Pages (via `next export`)
- **Domain**: To be determined by the community

### Vietnamese Music Terminology Reference
<!-- beads-id: prd-bsc-s28 -->

| Vietnamese | English | Context |
|:---|:---|:---|
| Fingerstyle | Fingerstyle | Plucking individual strings to create melody + harmony |
| Piano Solo | Piano Solo | Full arrangement for piano alone |
| Bản nhạc | Music sheet | A written piece of music |
| Hợp âm | Chord | Multiple notes played together |
