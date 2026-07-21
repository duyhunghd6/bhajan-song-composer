# 🎵 Bhajan Song Composer

> Open-source playback hub & composition workstation for Sahaja Yoga devotional music

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## ✨ What is Bhajan Song Composer?

Bhajan Song Composer is a free, open-source web application that brings together the global Sahaja Yoga bhajan repertoire into a single, searchable, and interactive platform. It works as both a **Playback Hub** for learning songs and an **AI-assisted Composition Workstation** for creating new arrangements.

### 🎯 Key Features

| Module | Description |
|:---|:---|
| **🎵 Playback** | Browse songs by language (Hindi, Marathi, Sanskrit, English) → A-Z. Switch between YouTube videos (Beat Karaoke, Full Performance, Backing Track) and ABC notation music sheets (Melody, Backing Track, Piano Karaoke). |
| **🎼 Composer** | Create multi-layered song arrangements using an interactive ABC notation editor with live preview. Export compositions as contribution-ready files. |
| **🤖 AI Theory Assistant** | Rule-based music theory engine that suggests chord progressions, guitar chords (accompaniment & fingerstyle), and piano arrangements (accompaniment & solo, both hands). |

---

## 📸 Screenshots

> _Coming soon — the project is in active development._

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [pnpm](https://pnpm.io/) (or npm/yarn)

### Installation

```bash
# Clone the repository
git clone https://github.com/duyhunghd6/bhajan-song-composer.git
cd bhajan-song-composer

# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
pnpm build
pnpm start
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App (SSG)                 │
├───────────────┬────────────────┬─────────────────────┤
│   Playback    │    Composer    │  AI Theory Engine   │
│   Module      │    Module      │                     │
├───────────────┼────────────────┼─────────────────────┤
│ • YouTube     │ • ABC Editor   │ • Scale/Raga Maps   │
│   IFrame API  │ • Layer Mgmt   │ • Chord Generation  │
│ • abcjs       │ • Song Form    │ • Guitar Voicings   │
│   Renderer    │ • Live Preview │ • Piano Voicings    │
│ • MIDI        │ • Export       │ • ABC Generation    │
│   Playback    │                │                     │
├───────────────┴────────────────┴─────────────────────┤
│              Song Data (Markdown + ABC files)        │
│              Git = Database • PRs = Contributions    │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|:---|:---|
| **Framework** | Next.js 15 (App Router, SSG) |
| **Language** | TypeScript |
| **ABC Notation** | [abcjs](https://www.abcjs.net/) — rendering, MIDI playback, interactive editing |
| **Video** | YouTube IFrame Player API |
| **Styling** | Vanilla CSS with design tokens |
| **Testing** | Vitest + Playwright |
| **Validation** | Zod schemas for song data |
| **Deployment** | Vercel / Netlify / GitHub Pages |

---

## 📂 Project Structure

```
bhajan-song-composer/
├── data/
│   └── songs/                    # 📁 Song repository (Git = Database)
│       ├── hindi/
│       │   ├── jai-shri-mataji.md          # Song metadata (YAML frontmatter)
│       │   ├── jai-shri-mataji.melody.abc  # Melody notation
│       │   └── jai-shri-mataji.backing-track.abc
│       ├── marathi/
│       │   ├── namostute.md
│       │   ├── namostute.melody.abc
│       │   ├── namostute.backing-track.abc
│       │   └── namostute.piano-karaoke.abc
│       ├── sanskrit/
│       └── english/
├── src/
│   ├── app/                      # 📁 Next.js App Router pages
│   │   ├── page.tsx              # Home: Language categories + search
│   │   ├── [language]/
│   │   │   ├── page.tsx          # A-Z song list for a language
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Song detail: Playback page
│   │   └── compose/
│   │       └── page.tsx          # Composer editor
│   ├── components/
│   │   ├── playback/             # 📁 Playback module components
│   │   │   ├── PlaybackController.tsx
│   │   │   ├── YouTubePlayer.tsx
│   │   │   └── AbcSheetViewer.tsx
│   │   ├── composer/             # 📁 Composer module components
│   │   │   ├── SongForm.tsx
│   │   │   ├── AbcEditor.tsx
│   │   │   └── LayerManager.tsx
│   │   ├── instruments/          # 📁 Visual instrument diagrams
│   │   │   ├── GuitarFretboard.tsx
│   │   │   └── PianoKeyboard.tsx
│   │   └── ai/                   # 📁 AI Theory Assistant
│   │       ├── TheoryAssistant.tsx
│   │       └── ChordSuggestions.tsx
│   └── lib/
│       ├── theory/               # 📁 Music theory engine (pure TS)
│       │   ├── scales.ts         # Scale definitions + raga mappings
│       │   ├── chords.ts         # Chord generation from scale degrees
│       │   ├── guitar-voicings.ts
│       │   ├── piano-voicings.ts
│       │   ├── progression.ts    # Chord progression algorithms
│       │   └── abc-generator.ts  # Generate ABC from theory data
│       └── songs/                # 📁 Song data layer
│           ├── loader.ts         # Markdown + ABC parser
│           ├── schema.ts         # Zod validation schemas
│           └── index.ts          # Catalogue index builder
├── docs/
│   └── PRD.md                    # Product Requirements Document
└── package.json
```

---

## 🎵 Song Data Format

Each song is a **Markdown file with YAML frontmatter** + companion **ABC notation files**.

### Song Metadata (`data/songs/marathi/namostute.md`)

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

(Lyrics with transliteration and translation)
```

### ABC Notation Files

ABC notation files sit alongside the Markdown file:

```
namostute.melody.abc        # Default melody sheet
namostute.backing-track.abc # Backing track arrangement
namostute.piano-karaoke.abc # Piano background for karaoke
```

**Example ABC notation** (from Namostute melody):

```abc
X: 1
T: Namostute
C: Marathi
M: 4/4
L: 1/8
K: Em
"Em" E4 E2 DE | "D" F6 z2 | "Am" E2 D2 B,2 D2 | "Bm" B,4 z2 B,D |
w: Na-mo-stu-te_ Na-mo-stu-te_ Shri_ Nir-ma-la_
```

---

## 🎮 Playback Controller

The Playback page provides a unified controller to switch between media types:

### Video Player Selector

Switch between YouTube video types embedded in the song page:

| Type | Description |
|:---|:---|
| 🎤 **Beat Karaoke** (default) | Instrumental beat with lyrics overlay for singing along |
| 🎶 **Full Performance** | Complete recorded performance for reference |
| 🎸 **Backing Track** | Instrumental only, for live accompaniment practice |

### Music Sheet Selector

Switch between ABC notation renderings:

| Type | Description |
|:---|:---|
| 🎼 **Melody** (default) | Single-voice melody line with lyrics |
| 🎹 **Backing Track** | Accompaniment notation for instrumentalists |
| 🎹 **Piano Background Karaoke** | Full piano arrangement for karaoke accompaniment |

---

## 🎼 Composer

The Composer is the heart of the open-source contribution model. Any user can create their own song with:

- **Multiple format support** — Same data format as the Playback catalogue
- **Multiple layers** — Stack melody, backing track, bass line, harmony as separate ABC notation tracks
- **Live preview** — See the rendered music sheet update in real-time
- **Export** — Download as Markdown+ABC files ready for a Pull Request

### Multi-Layer Composition

```
Layer 1: Melody     ─────────────────────────── ♪ Main vocal line
Layer 2: Harmony    ─────────────────────────── ♪ Supporting harmony
Layer 3: Bass       ─────────────────────────── ♪ Bass accompaniment
Layer 4: Piano LH   ─────────────────────────── ♪ Piano left hand
Layer 5: Piano RH   ─────────────────────────── ♪ Piano right hand
```

---

## 🤖 AI Theory Assistant

A **rule-based music theory engine** (no API keys required) that analyzes melody sheets and generates full arrangements.

### 🎯 Core Use Case: Melody → Full Arrangement

> _The most common scenario: you have a melody-only ABC sheet (treble clef / G clef only, no bass clef / F clef) and want to generate piano accompaniment or guitar fingerstyle arrangements._

```
┌─────────────────────────────────────────────────────┐
│         Melody → Arrangement Pipeline               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  INPUT: Melody ABC (treble clef only)               │
│    ↓                                                │
│  1. Melody Analyzer                                 │
│     → Detects key, scale/raga, strong-beat notes    │
│    ↓                                                │
│  2. Auto-Harmonizer                                 │
│     → Assigns chords to each measure                │
│    ↓                                                │
│  3. Arrangement Generator                           │
│     ├→ Piano Accompaniment (LH bass clef ABC)       │
│     ├→ Piano Solo (grand staff: treble + bass)      │
│     ├→ Guitar Classic Accompaniment (ABC + diagrams)│
│     └→ Guitar Fingerstyle (melody + bass + chords)  │
│                                                     │
│  OUTPUT: New .abc layers + visual diagrams          │
└─────────────────────────────────────────────────────┘
```

**How it works:**

1. **Load your melody** — Import or paste a treble-clef-only ABC notation
2. **Auto-detect key & scale** — The engine analyzes key signature, accidentals, and note patterns
3. **Auto-harmonize** — Strong-beat notes are matched against diatonic triads to assign chords per measure
4. **Generate arrangements** — Choose your output:

| Output | What it generates |
|:---|:---|
| **Piano Accompaniment** | Bass clef (left hand) with root-fifth, Alberti bass, or arpeggio patterns. You play LH while someone sings the melody. |
| **Piano Solo (Grand Staff)** | Right hand carries the original melody; left hand plays bass/chord accompaniment. Complete piano piece. |
| **Guitar Classic Accompaniment** | Selected validated chord voicings become a separate standard-notation ABC support layer (MIDI program 24), alongside fretboard diagrams and strumming patterns; no TAB is shown on the accompaniment page. |
| **Guitar Fingerstyle** | Combined arrangement: thumb plays bass notes (chord roots on strings 4-6), fingers play melody (strings 1-3), chord tones fill gaps between melody notes. |

Each generated arrangement is saved as a **separate `.abc` layer** — viewable in the Playback module, editable in the Composer.

### Chord Progression Suggestions

Given a song's key and raga, the engine suggests harmonically appropriate chord progressions:

```
Key: Em (Natural Minor / Aeolian)
Suggested: Em → Am → D → G → C → Am → B7 → Em
           i  → iv → VII → III → VI → iv → V7 → i
```

You can also **override individual chords** (e.g., change Am to Am7) to fine-tune the arrangement while keeping the rest of the AI-generated output.

### Guitar Chord Suggestions

#### Accompaniment
- Simple open/barre chord shapes
- Strumming pattern notation
- Visual fretboard diagrams with finger positions

#### Fingerstyle
- Combined melody + bass + chord tones on one guitar
- Right-hand finger assignments (p = thumb/bass, i/m/a = melody+chords)
- Visual fretboard diagrams showing finger positions per beat

### Piano Arrangement Suggestions

#### Accompaniment
- **Left Hand**: Bass clef patterns (root-fifth, Alberti bass, arpeggio) — auto-generated from the chord progression
- **Right Hand**: Melody cues + fill patterns during vocal rests

#### Solo
- **Left Hand**: Bass pattern + full chord voicing (bass clef)
- **Right Hand**: Complete melody + harmony (treble clef, from the original melody sheet)

### Raga-to-Scale Mapping

The engine maps Indian ragas to Western scales for chord generation:

| Raga | Western Scale | Notes |
|:---|:---|:---|
| Bhairav | Double Harmonic Major | C Db E F G Ab B |
| Yaman | Lydian | C D E F# G A B |
| Kafi | Dorian | C D Eb F G A Bb |
| Bhairavi | Phrygian | C Db Eb F G Ab Bb |
| Khamaj | Mixolydian | C D E F G A Bb |
| Bilawal | Ionian (Major) | C D E F G A B |

---

## 🤝 Contributing

We warmly welcome contributions! The most impactful way to contribute is **adding new songs** to the catalogue.

### Adding a New Song

1. **Fork** this repository
2. **Create** the song files in `data/songs/{language}/`:
   - `{song-slug}.md` — Metadata with YAML frontmatter
   - `{song-slug}.melody.abc` — Melody notation (required)
   - `{song-slug}.{type}.abc` — Additional notation layers (optional)
3. **Validate** your files locally:
   ```bash
   pnpm validate
   ```
4. **Submit** a Pull Request

### Song File Naming Convention

```
data/songs/{language}/{song-slug}.md
data/songs/{language}/{song-slug}.{notation-type}.abc
```

- **language**: `hindi`, `marathi`, `sanskrit`, `english`
- **song-slug**: lowercase, hyphenated title (e.g., `jai-shri-mataji`)
- **notation-type**: `melody`, `backing-track`, `piano-karaoke`, `guitar-accompaniment`, `guitar-fingerstyle`, etc.

### Contribution Guidelines

- Follow the [Song Data Format](#-song-data-format) specification
- Include at least the **melody** ABC notation
- Add YouTube video URLs where available
- Include lyrics with transliteration (Devanagari → Latin)
- Run `pnpm validate` before submitting

---

## 📖 Documentation

| Document | Description |
|:---|:---|
| [PRD](docs/PRD.md) | Product Requirements Document with full user stories |
| [CONTRIBUTING](CONTRIBUTING.md) | Contribution guidelines _(coming soon)_ |
| [ABC Notation Guide](docs/abc-guide.md) | How to write ABC notation _(coming soon)_ |

---

## 🗺️ Roadmap

### Phase 1 — Foundation 🏗️
- [ ] Next.js project setup with App Router
- [ ] Song data loader (Markdown + ABC parser)
- [ ] Song catalogue page (language → A-Z navigation)
- [ ] Song detail page with ABC notation rendering (abcjs)
- [ ] MIDI playback with controls

### Phase 2 — Playback Hub 🎵
- [ ] YouTube IFrame Player integration
- [ ] Playback Controller (video type + sheet type selectors)
- [ ] Mobile-responsive design
- [ ] SEO optimization (meta tags, structured data)
- [ ] URL-based state sharing

### Phase 3 — Composer 🎼
- [ ] Interactive ABC notation editor
- [ ] Multi-layer composition support
- [ ] Song form editor (YAML frontmatter)
- [ ] Export to Markdown+ABC files
- [ ] localStorage draft saving

### Phase 4 — AI Theory Assistant 🤖
- [ ] Scale/raga mapping engine
- [ ] Chord progression generator
- [ ] Guitar chord diagram component (accompaniment + fingerstyle)
- [ ] Piano keyboard diagram component (accompaniment + solo)
- [ ] ABC notation generation from theory data

### Phase 5 — Community 🤝
- [ ] Song data validation CLI tool
- [ ] CI/CD pipeline with automated validation
- [ ] Contributor documentation
- [ ] Sample song catalogue (10+ songs across languages)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- **Sahaja Yoga** community worldwide for preserving and sharing devotional music
- [abcjs](https://www.abcjs.net/) — ABC notation rendering library
- [music-theory](https://github.com/duyhunghd6/music-theory) — Inspiration for instrument visualization patterns
- All contributors who add songs to the growing catalogue

---

<p align="center">
  <em>Made with ❤️ for the Sahaja Yoga community</em><br>
  <strong>Jai Shri Mataji 🙏</strong>
</p>
