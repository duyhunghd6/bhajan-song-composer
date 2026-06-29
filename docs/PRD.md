# Bhajan Song Composer — Product Requirements Document

> **Version**: 1.0  
> **Date**: 2026-06-29  
> **Status**: Draft  
> **Label**: `ready-for-agent`

---

## Problem Statement

Sahaja Yoga practitioners worldwide learn, practice, and perform bhajans (devotional songs) using scattered resources — YouTube videos of varying quality, hand-copied lyric sheets, informal chord charts passed between musicians, and occasionally formal ABC notation sheets maintained by individual contributors. There is **no unified, open-source platform** that:

1. Organizes the entire bhajan repertoire in a searchable, alphabetized catalogue grouped by language/tradition.
2. Offers **multi-format playback** — switching between YouTube video types (Beat Karaoke, Full Performance, Backing Track) and ABC-notation-rendered music sheets (Melody, Backing Track, Piano Background Karaoke).
3. Empowers practitioners to **compose their own arrangements** — layering multiple ABC notation tracks for a single song in different musical styles.
4. Provides **AI-assisted music theory guidance** — chord progression suggestions, guitar chord selection (accompaniment vs. fingerstyle), and piano arrangement suggestions (left hand + right hand for accompaniment and solo styles).
5. **Bridges the gap from melody to full arrangement** — Most bhajan sheets exist only as a single-voice melody on treble clef (G clef). Practitioners who want to play piano accompaniment or guitar fingerstyle have no tool that analyzes the melody and automatically generates the missing parts: bass clef (left hand for piano), chord voicings, strumming/picking patterns, or a combined fingerstyle arrangement.

---

## Solution

**Bhajan Song Composer** is an open-source web application that serves as both a **Playback Hub** and a **Composition Workstation** for Sahaja Yoga devotional music.

### Three Core Modules

| Module | Description |
|:---|:---|
| **🎵 Playback** | Browse the song catalogue (organized by language → A-Z), select a song, and choose between embedded YouTube video players or ABC notation music sheet renderers. Toggle between multiple video types and sheet types per song. |
| **🎼 Composer** | Create and edit songs using the same data format as the Playback module. Layer multiple ABC notation tracks (melody, backing, bass line, etc.) for a single song. Export and share compositions. |
| **🤖 AI Theory Assistant** | Rule-based music theory engine that **analyzes a melody-only treble clef sheet** and auto-generates: harmonized chord progressions, guitar chord voicings (accompaniment and fingerstyle), and piano arrangements (accompaniment and solo, both left and right hand) based on the song's key, scale, and raga. |

### Song Data Model

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

### Playback Module

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
12. As a **practitioner**, I want the currently playing note to be highlighted on the music sheet during MIDI playback, so that I can follow along visually.
13. As a **practitioner**, I want to share a direct URL to a specific song (with the selected video type or sheet type), so that I can share resources with other practitioners.
14. As a **practitioner**, I want the song page to be SEO-optimized with proper meta tags, so that searching for "{song name} bhajan" on Google surfaces the page.
15. As a **practitioner**, I want the app to be fully responsive and work well on mobile devices, so that I can use it during group meditation sessions from my phone.

### Composer Module

16. As a **composer**, I want to create a new song entry using the same Markdown+YAML+ABC format as the Playback module, so that my compositions are immediately compatible with the catalogue.
17. As a **composer**, I want a form-based song editor where I can fill in the frontmatter fields (title, language, category, raga, taal, key, time signature, videos, tags), so that I don't need to write raw YAML.
18. As a **composer**, I want an interactive ABC notation editor with live preview rendering, so that I can see the staff notation update in real-time as I type.
19. As a **composer**, I want to create multiple ABC notation layers for a single song (e.g., melody, backing track, bass line, harmony), so that I can build multi-part arrangements.
20. As a **composer**, I want to switch between notation layers in the editor, viewing and editing one layer at a time while optionally seeing other layers in the background, so that I can compose layered arrangements.
21. As a **composer**, I want to add YouTube video URLs to my song entry, categorized by type (Beat Karaoke, Full Performance, Backing Track, or custom labels), so that I can link various performance resources.
22. As a **composer**, I want to export my song as a Markdown file (with ABC files) that can be submitted as a Pull Request to the repository, so that my contribution follows the open-source contribution workflow.
23. As a **composer**, I want to import an existing ABC notation file, so that I can build upon existing transcriptions.
24. As a **composer**, I want to preview the full song page (as it would appear in the Playback module) before exporting, so that I can verify the final presentation.
25. As a **composer**, I want to transpose the entire song to a different key with a single action, so that I can adapt songs for different vocal ranges.
26. As a **composer**, I want undo/redo functionality in the ABC notation editor, so that I can experiment without fear of losing work.
27. As a **composer**, I want to save work-in-progress compositions to browser localStorage, so that I don't lose unsaved work if I accidentally close the tab.

### AI Theory Assistant Module

#### Core Use Case: Melody → Full Arrangement

_The most common scenario: a user has a melody-only ABC sheet (treble clef / G clef only, no bass clef / F clef) and wants to generate piano accompaniment or guitar fingerstyle arrangements._

28. As a **practitioner with only a melody sheet**, I want to load my treble-clef-only ABC notation into the AI assistant, so that it can analyze the melody and generate accompaniment parts I'm missing.
29. As a **practitioner**, I want the AI assistant to **auto-detect the key and scale/raga** from my melody ABC notation (by analyzing the key signature, accidentals, and note patterns), so that I don't need to manually specify the key.
30. As a **practitioner**, I want the AI assistant to **auto-harmonize my melody** by analyzing which notes fall on strong beats and assigning appropriate chords to each measure, so that I get a complete chord progression without needing music theory knowledge.
31. As a **piano player (accompaniment)**, I want the AI assistant to generate a **bass clef (left hand) part** from my melody-only sheet — producing root notes, root-fifth patterns, or Alberti bass patterns that match the auto-detected chord progression — so that I can play piano accompaniment with both hands while someone else sings.
32. As a **piano player (solo)**, I want the AI assistant to generate a **grand staff arrangement** (treble + bass clef) where the right hand carries the original melody and the left hand plays a bass/chord accompaniment pattern, so that I can perform the song as a complete piano piece.
33. As a **guitar player (accompaniment)**, I want the AI assistant to suggest guitar chord voicings (with visual fretboard diagrams) derived from the auto-harmonized chord progression, so that I can strum along while someone sings the melody.
34. As a **guitar player (fingerstyle)**, I want the AI assistant to generate a **combined fingerstyle arrangement** where the thumb plays bass notes (from the chord roots), the fingers play the melody on treble strings, and chord tones fill the gaps between melody notes — so that I can perform the entire song solo on one guitar.
35. As a **practitioner**, I want each generated arrangement to be output as a **separate ABC notation layer** (e.g., `namostute.piano-accompaniment.abc`, `namostute.fingerstyle.abc`) that I can view in the Playback module or edit in the Composer, so that AI-generated arrangements are first-class song content.

#### Chord & Voicing Suggestions

36. As a **practitioner learning music theory**, I want the AI assistant to suggest a chord progression based on the song's key and raga, so that I can understand the harmonic structure.
37. As a **practitioner**, I want the chord suggestions to be rendered as interactive visual diagrams (guitar fretboard with finger positions, piano keyboard with highlighted keys), so that I can learn the voicings visually.
38. As a **practitioner**, I want to see the ABC notation for each suggested arrangement (guitar accompaniment, guitar fingerstyle, piano accompaniment, piano solo), so that I can read and practice from standard notation.
39. As a **composer**, I want to accept AI-suggested chord progressions and arrangements directly into my composition layers, so that I can use them as a starting point for my own arrangement.
40. As a **practitioner**, I want the AI assistant to explain the music theory behind its suggestions (e.g., "Using the natural minor scale of Em, the iv-VII-III-VI progression creates a characteristic Indian devotional mood"), so that I can learn music theory in context.
41. As a **practitioner**, I want to specify constraints for the AI suggestions (e.g., "only open chords", "capo on 2nd fret", "left hand octave bass pattern"), so that the suggestions match my skill level and instrument setup.
42. As a **practitioner**, I want to override individual chords in the auto-harmonized progression (e.g., change one chord from Am to Am7), so that I can fine-tune the arrangement to my taste while keeping the rest of the AI-generated output.

### Community & Open Source

43. As a **contributor**, I want clear documentation on how to add a new song to the catalogue (file format, naming conventions, PR process), so that I can contribute without needing deep technical knowledge.
44. As a **contributor**, I want a song data validation tool that checks my Markdown+YAML+ABC files for correctness before I submit a PR, so that I can fix errors locally.
45. As a **maintainer**, I want automated CI checks that validate new song submissions for correct YAML schema, valid ABC notation, and required fields, so that I can review PRs efficiently.
46. As a **user**, I want the application to be deployed as a static site (or SSG), so that hosting costs remain zero or minimal for the open-source project.

---

## Implementation Decisions

### Architecture

- **Framework**: Next.js with TypeScript, using App Router. Static Site Generation (SSG) for song pages to enable zero-cost hosting on Vercel/Netlify.
- **Song Data Storage**: Markdown files with YAML frontmatter in `data/songs/{language}/` directory. ABC notation in separate `.abc` files alongside the Markdown. Git is the database — community contributes via Pull Requests.
- **ABC Rendering & Playback**: `abcjs` library for all ABC notation rendering (SVG staff notation), MIDI synthesis, and interactive editing. This is the mature, proven choice for web-based ABC notation.
- **YouTube Integration**: YouTube IFrame Player API for embedded video playback with controller UI to switch between video types (Beat Karaoke, Full Performance, Backing Track).
- **AI Theory Engine**: Rule-based music theory engine implemented in TypeScript. No external API dependencies. Covers:
  - **Melody analysis** — parse an input melody ABC to extract note-on-beat patterns, detect key/scale, and identify chord-worthy strong-beat notes
  - **Auto-harmonization** — assign chords to each measure by matching strong-beat melody notes against diatonic triads of the detected scale/raga
  - **Scale/Mode detection** from key signature and raga mapping
  - **Chord progression generation** based on scale degree relationships
  - **Piano arrangement generation** — from a melody-only treble clef, generate a bass clef (left hand) ABC notation with configurable patterns (root-fifth, Alberti bass, arpeggio, block chords)
  - **Guitar fingerstyle arrangement generation** — from a melody + chord progression, produce a combined ABC notation where bass notes (thumb) interleave with melody notes (fingers) on appropriate strings
  - **Guitar chord voicing library** (open chords, barre chords, capo positions) with fretboard diagram data
  - **Piano voicing library** (left hand patterns: root-fifth, Alberti bass, arpeggio; right hand: block chords, broken chords, melody doubling)
  - **ABC notation generation** from chord/voicing data

### Data Flow

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

1. **Song Catalogue Module** — File-system based song registry with language categorization and A-Z index. Uses `fs.readFileSync` + `gray-matter` at build time for SSG.
2. **Playback Controller Module** — Unified controller component that manages the currently active media type (video vs. sheet) and sub-type selection (which video, which sheet notation layer).
3. **ABC Editor Module** — Interactive editor with syntax highlighting, live preview, multi-layer tab management, and undo/redo stack.
4. **AI Theory Engine Module** — Pure TypeScript library with no side effects. Two modes of operation:
   - **Manual mode**: Input: key, scale/raga, time signature. Output: chord progressions, voicings, ABC notation strings.
   - **Auto-harmonize mode**: Input: melody-only ABC notation. Output: detected key, auto-generated chord progression, and full arrangement ABC layers (piano grand staff, guitar fingerstyle, etc.).
5. **Visual Instrument Module** — Reusable guitar fretboard and piano keyboard SVG components that can highlight specific notes/chords. Adapted from patterns in the existing `music-theory` project.

### File Organization

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
    api/
      validate/
        route.ts                # Song file validation endpoint
  components/
    playback/
      PlaybackController.tsx    # Video/Sheet type selector
      YouTubePlayer.tsx         # Embedded YouTube player
      AbcSheetViewer.tsx        # ABC notation renderer + MIDI playback
    composer/
      SongForm.tsx              # Frontmatter editor form
      AbcEditor.tsx             # Interactive ABC notation editor
      LayerManager.tsx          # Multi-layer ABC track management
    instruments/
      GuitarFretboard.tsx       # Visual guitar chord diagram
      PianoKeyboard.tsx         # Visual piano keyboard diagram
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
      fingerstyle-arranger.ts   # Generate guitar fingerstyle ABC (melody+bass+chords)
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

The AI Theory Assistant provides **visual chord diagrams** as the primary output format:

- **Guitar Fretboard**: SVG rendering showing finger positions, open/muted strings, fret numbers, and optional capo indicator. Two rendering modes:
  - **Accompaniment**: Shows simple chord shapes with strumming pattern notation
  - **Fingerstyle**: Shows more complex voicings with right-hand finger assignments (p, i, m, a)

- **Piano Keyboard**: SVG rendering highlighting pressed keys with finger numbers. Two rendering modes:
  - **Accompaniment**: Left hand shows chord pattern; Right hand shows melody cues
  - **Solo**: Left hand shows bass pattern + chord; Right hand shows full melody + harmony

- **ABC Notation Layer**: Each suggested arrangement is also available as downloadable ABC notation that can be imported into the Composer as a new layer.

---

## Testing Decisions

### What Makes a Good Test

Tests should verify **external behavior and user-visible outcomes**, not implementation details. A good test for this application asks: "Can the user see/hear/interact with the correct output given this input?"

### Modules to Test

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

3. **Playback Controller** — Given a song with multiple video types and sheet types, assert that:
   - Default selections are applied correctly
   - Switching types updates the displayed content
   - URL parameters reflect the current selection

4. **Song Data Validation** — CI pipeline tests that validate the `data/songs/` directory:
   - All `.md` files have valid YAML frontmatter matching the schema
   - All referenced `.abc` files exist
   - All ABC notation is parseable
   - No duplicate slugs within the same language

### Testing Tools

- **Vitest** for unit tests (theory engine, song loader, validation)
- **Playwright** for E2E tests (playback controller interactions, composer workflow)
- **Zod schema validation** for song data integrity checks in CI

---

## Out of Scope

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

### Relationship to Existing `music-theory` Project

This project draws architectural inspiration from the existing [`music-theory`](file:///Users/steve/duyhunghd6/music-theory) application, particularly:
- ABC notation rendering patterns (abcjs integration)
- Virtual instrument components (guitar fretboard, piano keyboard)
- Audio engine patterns (MIDI playback via abcjs/Tone.js)

However, Bhajan Song Composer is a **standalone project** with its own repository, focused specifically on the devotional music community's needs rather than general music education.

### Raga-to-Scale Mapping

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

The open-source contribution model follows a "Git is the database" philosophy:
1. Fork the repository
2. Add song files following the documented format
3. Run local validation (`npm run validate`)
4. Submit a Pull Request
5. CI automatically validates the song data
6. Maintainers review and merge

### Deployment Strategy

- **Primary**: Vercel (free tier) with automatic deployments from `main` branch
- **Alternative**: Netlify, GitHub Pages (via `next export`)
- **Domain**: To be determined by the community

### Vietnamese Music Terminology Reference

| Vietnamese | English | Context |
|:---|:---|:---|
| Fingerstyle | Fingerstyle | Plucking individual strings to create melody + harmony |
| Piano Solo | Piano Solo | Full arrangement for piano alone |
| Bản nhạc | Music sheet | A written piece of music |
| Hợp âm | Chord | Multiple notes played together |
