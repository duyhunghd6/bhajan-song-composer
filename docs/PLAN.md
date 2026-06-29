# Implementation Plan: Bhajan Song Composer

<!-- beads-id: br-plan-00 | satisfies: prd-bsc -->

This document outlines the step-by-step implementation plan for the Bhajan Song Composer, acting as a technical translation of the Product Requirements Document.

## 1. Project Initialization & Core Architecture
<!-- beads-id: br-plan-01 | satisfies: prd-bsc-s2, prd-bsc-s13, prd-bsc-s16, prd-bsc-s27 -->

- **Framework Setup**: Initialize a Next.js (App Router) project with TypeScript, Tailwind CSS, and structured for Static Site Generation (SSG) to support zero-cost Vercel/Netlify hosting.
- **Directory Structure**: Scaffold the prescribed directories including `data/songs/`, `src/app/`, `src/components/`, and `src/lib/`.
- **Dependencies**: Install core libraries: `abcjs` (notation/MIDI), `gray-matter` (Markdown/YAML parsing), `zod` (validation).

## 2. Data Layer & Song Catalogue Module
<!-- beads-id: br-plan-02 | satisfies: prd-bsc-s3, prd-bsc-s4, prd-bsc-s15 -->

- **Schema Definition**: Define TypeScript types and Zod schemas (`lib/songs/schema.ts`) for the song data model (YAML frontmatter + ABC configurations).
- **Song Loader**: Implement `lib/songs/loader.ts` to parse the file-system-based Markdown and associative `.abc` files.
- **SSG Pages**: Build the landing page (`app/page.tsx`), language catalog (`app/[language]/page.tsx`), and setup the static paths for individual songs (`app/[language]/[slug]/page.tsx`).

## 3. Playback Module
<!-- beads-id: br-plan-03 | satisfies: prd-bsc-s3, prd-bsc-s6, prd-bsc-s14 -->

- **Playback Controller (`PlaybackController.tsx`)**: Build the unified toggle UI to seamlessly switch between different Video types and ABC notation layers.
- **YouTube Integration (`YouTubePlayer.tsx`)**: Embed the YouTube IFrame API to support dynamic video URL switching.
- **ABC Viewer (`AbcSheetViewer.tsx`)**: Connect `abcjs` to render SVG staff notation and wire up the interactive MIDI playback controls (Play, Pause, Tempo, Note Highlighting).

## 4. Composer Module
<!-- beads-id: br-plan-04 | satisfies: prd-bsc-s3, prd-bsc-s7 -->

- **Metadata Editor (`SongForm.tsx`)**: Build form inputs bound to the YAML frontmatter schema to assist contributors.
- **Interactive Notation Editor (`AbcEditor.tsx`)**: Develop the core editor with live SVG preview, undo/redo capabilities, and localStorage caching for WIP compositions.
- **Layer Management (`LayerManager.tsx`)**: Implement the UI and state management allowing composers to switch between, edit, and layer multiple ABC tracks simultaneously.

## 5. AI Theory Engine Core
<!-- beads-id: br-plan-05 | satisfies: prd-bsc-s3, prd-bsc-s8, prd-bsc-s9, prd-bsc-s10, prd-bsc-s25 -->

- **Foundational Theory (`scales.ts`, `chords.ts`)**: Implement the diatonic systems, scales, and Raga-to-Western mappings.
- **Melody Analyzer (`melody-analyzer.ts`)**: Construct the parser to evaluate treble-clef ABC notation, detect the key, and identify strong-beat notes.
- **Auto-Harmonizer (`harmonizer.ts`)**: Build the algorithm to align strong-beat melody notes with diatonic triads to generate chord progressions.
- **Arrangers (`piano-arranger.ts`, `fingerstyle-arranger.ts`)**: Implement rule-based generation to output bass clef patterns (for piano) and interleaved melody/bass (for guitar fingerstyle).

## 6. Visual Instruments & AI UI
<!-- beads-id: br-plan-06 | satisfies: prd-bsc-s17, prd-bsc-s25 -->

- **Instrument Renderers (`GuitarFretboard.tsx`, `PianoKeyboard.tsx`)**: Build the SVG interactive components showing finger positions and highlighted keys, adapting logic from the existing `music-theory` project.
- **Theory Assistant UI (`TheoryAssistant.tsx`)**: Create the side panel for users to specify constraints (capo, skill level) and review/accept auto-harmonized arrangements into their Composer layers.

## 7. Quality Assurance, CI & Community Tools
<!-- beads-id: br-plan-07 | satisfies: prd-bsc-s11, prd-bsc-s18, prd-bsc-s19, prd-bsc-s20, prd-bsc-s21, prd-bsc-s26 -->

- **Unit Testing**: Configure Vitest and write assertion suites for the Theory Engine (manual mode) and the Song Loader.
- **E2E Testing**: Setup Playwright to assert Playback Module UI toggles and Composer workflow scenarios.
- **Validation Pipeline**: Build an automated script and an API endpoint (`api/validate/route.ts`) to ensure submitted Pull Requests contain valid YAML schemas and parseable ABC notation.
