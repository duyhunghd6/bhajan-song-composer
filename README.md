# 🎵 Bhajan Song Composer

> Open-source playback hub & composition workstation for Sahaja Yoga devotional music

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)

---

## ✨ What is Bhajan Song Composer?

Bhajan Song Composer is a free, open-source web application that brings together the global Sahaja Yoga bhajan repertoire into a single, searchable, and interactive platform. It works as both a **Playback Hub** for learning songs and an **AI-assisted Composition Workstation** for creating new arrangements.

Its primary arrangement goal is **singer accompaniment**: from a melody and approved harmony, create a playable **Guitar Classic accompaniment** or **Piano accompaniment** for a practitioner accompanying another singer. Guitar Fingerstyle, piano solo, and ensemble arrangements are additional modes and do not replace these two primary paths.

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
npm run dev
```

Open [http://localhost:9974](http://localhost:9974) in your browser.

This project uses Next.js. The development and production server port is configured in the `dev` and `start` scripts in `package.json`; Playwright uses the same port in `playwright.config.ts`.

### Gemini LLM configuration

Set these server-side variables in `.env` (ignored by Git):

```dotenv
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_API_KEY_BASE64=<base64-encoded Gemini API key>
AI_MODEL=gemini-3.8-flash
```

The existing OpenAI-compatible transport decodes `AI_API_KEY_BASE64` on the server and sends the key as a Bearer token to `/chat/completions`, using [Google's OpenAI compatibility endpoint](https://ai.google.dev/gemini-api/docs/openai). No Gemini-specific SDK is required. Base64 is an encoding, not encryption; keep the file private and never use a `NEXT_PUBLIC_` prefix for the key.

`AI_API_KEY_BASE64` takes precedence over the legacy plain-text `AI_API_KEY`; invalid base64 fails before sending a request. Existing plain-text environment configuration and the `ai-config.json` fallback remain supported. Next.js gives `.env.local` priority over `.env`, so remove conflicting AI variables there and restart `npm run dev` after changing credentials.

Run `npm run test:ai:connection` to test real API calls through the existing transport (uses API quota). It checks forced function calling, then a two-turn local tool loop with final validation, without printing credentials.

### Build for Production

```bash
pnpm build
pnpm start
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Next.js App (App Router)                    │
├──────────────┬──────────────────────────────┬────────────────────┤
│   Playback   │     Composer Workstation     │  Practice/Showcase │
│  / Catalogue │  melody → harmony →          │  /practice/:slug   │
│  /[lang]/    │  accompaniment | fingerstyle │  published layers  │
│  [slug]      │  → Export (review)           │  only              │
├──────────────┴──────────────────────────────┴────────────────────┤
│  music-sheet/AbcjsPlaybackController — shared abcjs adapter       │
├──────────────────────────────────────────────────────────────────┤
│  lib/theory — harmonizer, accompaniment-workflow (Guitar Classic │
│  / Harmonium / Djembe), fingerstyle-arranger (TimeGrid), piano & │
│  ensemble engines (POC), abc-* utilities                          │
├──────────────────────────────────────────────────────────────────┤
│  app/actions — bounded LLM tool loop (ai-config) + Server Actions │
├──────────────────────────────────────────────────────────────────┤
│           Song Data (Markdown + ABC files) • Git = Database       │
└──────────────────────────────────────────────────────────────────┘
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the module map and [`docs/guides/composer-source-flow.md`](docs/guides/composer-source-flow.md) for the directed source flow.

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
├── data/songs/<language>/          # 📁 Song repository (Git = Database)
│   ├── <slug>.md                   #   YAML frontmatter + lyrics
│   ├── <slug>.melody.abc           #   Published notation layers (melody, backing-track,
│   └── <slug>.accompaniment.abc    #   accompaniment, guitar-fingerstyle)
├── src/
│   ├── app/
│   │   ├── page.tsx                # Home: language categories + search
│   │   ├── [language]/[slug]/      # Catalogue list + song Playback page
│   │   ├── edit/                   # Catalogue editor list
│   │   ├── compose/[slug]/[step]/  # Composer steps: melody | harmony | accompaniment | guitar-fingerstyle | review
│   │   ├── practice/[slug]/        # Practice / Showcase (published layers only)
│   │   ├── mockups/                # POC gate pages (arrangement-pipeline, fingerstyle-engine, ensemble-expansion, visual-instruments, beats)
│   │   ├── actions/                # Server Actions + bounded LLM tool loop (ai-config.ts)
│   │   └── api/validate/           # Song validation endpoint
│   ├── components/
│   │   ├── playback/               # PlaybackController, YouTubePlayer, AbcSheetViewer
│   │   ├── music-sheet/            # AbcjsPlaybackController + abcjs-playback/ internals
│   │   ├── composer/               # Step workspace, editor, wizards, workspace/ step modules
│   │   └── instruments/            # GuitarFretboard, PianoKeyboard, note markers, pedal indicator
│   └── lib/
│       ├── theory/                 # Harmonizer, accompaniment-workflow/, fingerstyle-arranger/, piano & ensemble engines
│       └── songs/                  # loader, schema, validation, composer-notation
├── e2e/                            # Playwright specs
├── scripts/validate-songs.mjs      # Song validation CLI (`npm run validate:songs`)
├── docs/                           # See docs/README.md for the index
│   ├── product/                    # PRD, PLAN, traceability matrix
│   ├── guides/                     # Domain contracts (source flow, workflows, TimeGrid, abcjs)
│   ├── adr/                        # Architecture decision records
│   ├── theory/                     # Music theory references
│   ├── design/                     # UI specification
│   └── research/                   # Frozen research notes
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

The Composer is a stepwise workstation at `/compose/:slug/:step`. Drafts stay in the browser until you explicitly publish.

```
1. Melody        /compose/:slug/melody             editable ABC root (+ metadata form)
2. Harmony       /compose/:slug/harmony            key/beats → chord roles → voice-leading validation; pick a result
3. Accompaniment /compose/:slug/accompaniment      Guitar Classic · Harmonium · Djembe support from the selected harmony
3.1 Fingerstyle  /compose/:slug/guitar-fingerstyle solo-guitar TimeGrid with TAB (independent of step 3)
4. Export        /compose/:slug/review             choose layers → publish to data/songs → /practice/:slug
```

- **Directed source flow** — the selected Harmony Step 3 result is the only source for both Accompaniment and Guitar Fingerstyle; editing the melody or re-selecting harmony invalidates downstream drafts.
- **Live preview** — every step renders through the shared abcjs playback controller with per-layer visibility and volume.
- **Export** — publishes only the layers you select (`melody`, `harmony`, `accompaniment`, `guitar-fingerstyle`) as `.abc` files plus metadata; the Practice page reads only what was published.

---

## 🤖 AI Theory Assistant

A **rule-based music theory engine** drives harmonization, accompaniment, and fingerstyle generation. An optional OpenAI-compatible model can be configured for the small, bounded decisions inside each workflow step (chord roles, comping profile, which fill windows to use); every model output is validated by deterministic theory code before it is accepted.

### 🎯 Core Use Case: Melody → Full Arrangement

> _You have a melody-only ABC sheet (treble clef) and want a playable devotional accompaniment or a solo-guitar arrangement._

```
┌────────────────────────────────────────────────────────────┐
│  INPUT: Melody ABC (treble clef only)                      │
│    ↓                                                       │
│  Harmony (shared Steps 1–3)                                │
│    key/scale/raga + strong beats → chord roles → validated │
│    harmonized ABC (user selects one candidate)             │
│    ↓                               ↓                       │
│  Accompaniment branch              Guitar Fingerstyle      │
│    Guitar Classic (PIMA / pinch /   branch                 │
│    strum → V:GuitarSupport)         melody + chord-derived │
│    Harmonium drone & voicing        bass + legal fills on  │
│    Djembe groove & fills            a TimeGrid → ABC + TAB │
│    ↓                               ↓                       │
│  OUTPUT: named .abc layers → Export → Practice             │
└────────────────────────────────────────────────────────────┘
```

| Output | What it generates |
|:---|:---|
| **Harmony** | Chord-annotated melody ABC with cadence targets and voice-leading validation. |
| **Accompaniment** | Ordered Guitar Classic / Indian Harmonium / Djembe support voices, each branch enabled per instrument checkbox. |
| **Guitar Fingerstyle** | Solo guitar: melody on strings 1–3, bass on 4–6, discretionary fills only in melody rests, skill-aware fret limits, forced-string TAB. |
| **Piano / Ensemble (POC)** | Piano accompaniment and Djembe/Flute/Violin ensemble engines exist as theory modules and mockup pages; they are not Composer steps yet. |

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
   npm run validate:songs
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
- Run `npm run validate:songs` before submitting

---

## 📖 Documentation

Start at [`docs/README.md`](docs/README.md) — it lists every document and which one owns each topic.

| Document | Description |
|:---|:---|
| [PRD](docs/product/PRD.md) | Product Requirements Document with full user stories |
| [Implementation Plan](docs/product/PLAN.md) | Plan elements traced to PRD sections |
| [Architecture](ARCHITECTURE.md) | Module map and seams |
| [Composer Source Flow](docs/guides/composer-source-flow.md) | How melody → harmony → accompaniment / fingerstyle → export data flows |
| [Guitar Fingerstyle Arrangement Guide](docs/guides/guitar-fingerstyle-arrangement-guide.md) | Solo-guitar TimeGrid pipeline |
| [ADRs](docs/adr/) | Architecture decision records |

---

## 🗺️ Roadmap

Status as of 2026-09-13; detailed per-item state lives in [`docs/product/PRD-to-PLAN-statematrix.md`](docs/product/PRD-to-PLAN-statematrix.md).

### Phase 1 — Foundation 🏗️
- [x] Next.js project setup with App Router
- [x] Song data loader (Markdown + ABC parser)
- [x] Song catalogue page (language → A-Z navigation)
- [x] Song detail page with ABC notation rendering (abcjs)
- [x] MIDI playback with controls

### Phase 2 — Playback Hub 🎵
- [x] YouTube IFrame Player integration
- [x] Playback Controller (video type + sheet type selectors)
- [ ] Mobile-responsive design (not verified)
- [ ] SEO optimization (meta tags, structured data)
- [ ] URL-based state sharing

### Phase 3 — Composer 🎼
- [x] Interactive ABC notation editor with localStorage drafts
- [x] Song form editor (YAML frontmatter)
- [x] Step workflow: Melody → Harmony → Accompaniment / Guitar Fingerstyle → Export
- [x] Export selected layers to the catalogue and Practice page
- [ ] Tests for publication and Practice isolation

### Phase 4 — AI Theory Engine 🤖
- [x] Scale/raga mapping, melody analysis, auto-harmonization with candidates
- [x] Accompaniment workflow: Guitar Classic, Harmonium, Djembe branches
- [x] Guitar Fingerstyle TimeGrid pipeline with staged, validated LLM fills and TAB
- [x] Visual guitar fretboard / piano keyboard with synchronized markers
- [ ] Piano accompaniment engine: unit tests and Composer integration
- [ ] Ensemble (Djembe/Flute/Violin): route, export mapping, end-to-end coverage
- [ ] Piano POC mockup page (`/mockups/piano`)

### Phase 5 — Community 🤝
- [x] Song data validation CLI tool (`npm run validate:songs`)
- [x] Docs CI check (Universal IDs, links)
- [ ] Contributor documentation
- [ ] Sample song catalogue (10+ songs across languages) — 6 today

---

## 📄 License

This project is licensed under the MIT License.

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
