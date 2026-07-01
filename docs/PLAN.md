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
<!-- beads-id: br-plan-03 | satisfies: prd-bsc-s3, prd-bsc-s6, prd-bsc-s14, prd-bsc-s15 -->

- **Playback Controller (`PlaybackController.tsx`)**: Build the unified toggle UI to seamlessly switch between different Video types and ABC notation layers.
- **YouTube Integration (`YouTubePlayer.tsx`)**: Embed the YouTube IFrame API to support dynamic video URL switching.
- **Reusable Music Sheet Renderer (`components/music-sheet/MusicSheetRenderer.tsx`)**: Extract ABCJS SVG rendering and MIDI synthesis into a shared component used by both Playback and Composer. It must provide play/pause/stop, playback speed/tempo control, whole-sheet and range loop controls, staff-note highlighting, render error handling, and playback cursor events for synchronized instrument visualization.
- **Playback Page Wrapper (`AbcSheetViewer.tsx`)**: Keep this as a thin playback-specific wrapper around `MusicSheetRenderer` instead of duplicating ABCJS rendering logic.

## 4. Composer Module
<!-- beads-id: br-plan-04 | satisfies: prd-bsc-s3, prd-bsc-s7 -->

- **Metadata Editor (`SongForm.tsx`)**: Build form inputs bound to the YAML frontmatter schema to assist contributors.
- **Interactive Notation Editor (`AbcEditor.tsx`)**: Develop the core editor with live preview powered by the shared `MusicSheetRenderer`, undo/redo capabilities, and localStorage caching for WIP compositions. The ABC source must stay vertically stacked above the Music Sheet preview; do not place them side-by-side because the editor workflow needs vertical spacing.
- **Layer Management (`LayerManager.tsx`)**: Implement the UI and state management allowing composers to switch between, edit, and layer multiple ABC tracks simultaneously.
- **Workstation Coordinator (`ComposerWorkstation.tsx`)**: Coordinate composer workspace state to load a specific song's metadata and layers if a query parameter is passed (e.g. `/compose?edit={slug}`).
- **Song Edit Selection Page (`app/edit/page.tsx` & `SongEditList.tsx`)**: Implement a dedicated `/edit` page displaying the full list of catalogue songs. Support live text search by song name, and display the key tone and resource icons (Video, Backing Track, Melody, Guitar, Piano) for each song. Provide an "Edit" button to open that song at `/compose?edit={slug}`.

## 5. AI Theory Engine Core
<!-- beads-id: br-plan-05 | satisfies: prd-bsc-s3, prd-bsc-s8, prd-bsc-s9, prd-bsc-s10, prd-bsc-s25 -->

- **Foundational Theory (`scales.ts`, `chords.ts`)**: Implement the diatonic systems, scales, and Raga-to-Western mappings.
- **Melody Analyzer (`melody-analyzer.ts`)**: Construct the parser to evaluate treble-clef ABC notation, detect the key, and identify strong-beat notes.
- **Auto-Harmonizer (`harmonizer.ts`)**: Build the algorithm to align strong-beat melody notes with diatonic triads to generate chord progressions.
- **Arrangers (`piano-arranger.ts`, `fingerstyle-arranger.ts`)**: Implement rule-based generation to output bass clef patterns (for piano) and interleaved melody/bass (for guitar fingerstyle).

## 5A. Arrangement Pipeline: Melody → Full Track
<!-- beads-id: br-plan-08 | satisfies: prd-bsc-s29, prd-bsc-s30, prd-bsc-s31, prd-bsc-s32 -->

- **Pipeline Orchestrator**: Implement the product workflow as an explicit sequence: Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track. The UI and theory engine should prevent users from skipping directly from a melody-only layer to full accompaniment without first establishing the harmonic framework.
- **Harmonization Stage**: Extend melody analysis and auto-harmonization to identify key/scale, prioritize strong-beat notes, choose chords using diatonic and functional harmony, and annotate chord choices with tonic/subdominant/dominant function and cadence role.
- **Accompaniment Stage**: Generate Layer 2 piano or rhythm-guitar accompaniment from the harmonized chord progression. Include bass-note extraction, inversion-aware bassline smoothing, comping pattern choices (block chords, arpeggios, syncopation), and voice-leading rules that minimize unnecessary note movement between chords.
- **Full-Track Expansion Stage**: Generate Layer 3 arrangement guidance for drums and additional instruments. Align kick patterns with the generated bassline, reserve snare/backbeat placement for groove definition, document frequency-range assignments for each instrument family, and place counter-melodies or fills in spaces where the main melody pauses or sustains.
- **Composer Integration**: Represent each stage as first-class composition layers so users can inspect, edit, accept, or reject generated harmonization, accompaniment, drum, bass, and counter-melody outputs before exporting.
- **Validation & Tests**: Add regression coverage for stage ordering, strong-beat chord selection, smooth bass movement through inversions, voice-leading distance, drum/bass rhythmic alignment, frequency-range metadata, and counter-melody placement during melody rests or held notes.

## 5B. Workflow Mockup / Proof-of-Concept Demo Pages
<!-- beads-id: br-plan-09 | satisfies: prd-bsc-s54, prd-bsc-s55 -->

- **Mockup Gate**: Before integrating any major arrangement workflow into the main Composer or feature page, build a standalone proof-of-concept page using representative sample melody and arrangement data. Treat the mockup as a required product review gate, not an optional prototype.
- **Arrangement Pipeline POC**: Build a demo page for Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track. It must show the input melody, detected key/scale, strong-beat analysis, chord functions, generated accompaniment, full-track expansion decisions, final ABC/playback preview, and validation report.
- **Fingerstyle Engine POC**: Build a demo page for the Multi-Layer Fingerstyle Arrangement Engine. It must show upward construction, downward compression decisions, string routing, guide-tone pruning, fret-stretch/playability failures, transposition fallback suggestions, final solo guitar matrix, ABC preview, and visual event metadata.
- **Piano Accompaniment POC**: Build a demo page for the Piano Accompaniment Generation Engine. It must show comping profile selection, left-hand bass anchoring, Low Interval Limit validation, right-hand voice leading, Melodic Gap Event fills, hand-span/collision validation, sustain pedal automation, grand-staff ABC preview, and synchronized piano-key highlights.
- **Ensemble Expansion POC**: Build a demo page for Djembe, Flute, and Violin expansion. It must show the integration handshake, rhythmic density grid, bass map, Melodic Gap Array, Djembe event map, Flute/Violin yield states, density conflict-resolution report, final multi-layer ABC preview, and synchronized playback preview.
- **Integration Handoff Checklist**: Each mockup page must expose visible pass/fail or review-ready status. Main feature integration is blocked until the demo renders the input, intermediate decisions, final artifact, and validation report end-to-end with behavior-focused tests.
- **POC Test Coverage**: Add Playwright coverage for each mockup page at the highest seam: visible sample input, step-by-step decision output, final ABC/playback artifact, validation/conflict report, and integration-ready status.

## 5C. Multi-Layer Fingerstyle Arrangement Engine
<!-- beads-id: br-plan-10 | satisfies: prd-bsc-s33, prd-bsc-s34, prd-bsc-s35, prd-bsc-s36, prd-bsc-s37, prd-bsc-s38 -->

- **Upward Construction Context**: Reuse the core arrangement pipeline to build inspectable melody, harmonization, accompaniment, rhythm/percussion, bassline, and optional counter-melody source layers before any guitar reduction begins.
- **Downward Compression Algorithm**: Implement `fingerstyle-compressor.ts` to route melody to strings 1-3, route root bass notes to strings 4-6, validate Beat 1 melody/bass pairings, prune non-essential 5ths before 3rds/7ths, place guide tones on weak beats or melody rests, and propose transposition fallbacks when fret-stretch limits exceed 4-5 frets.
- **Physical Hand Mapping**: Implement `guitar-playability.ts` and `picking-profiles.ts` for fretting-finger count, picking-finger count, Strict PIMA mapping, Folk / Travis Override mapping, thumb-clock bass events, synchronous pinch events, off-beat syncopation, and string-slap snare simulation on beats 2 and 4.
- **Fingerstyle Output Contract**: Expose a structured intermediate result containing source layers, outer voice map, playability report, fallback suggestions, inner voice reduction, rhythmic event map, profile metadata, final ABC layer, tablature/string-position metadata, fretboard-highlight events, and SVG hand-overlay animation events.
- **Composer and Visual Integration**: Let composers choose Strict PIMA vs. Folk / Travis profiles, inspect playability failures, accept the generated fingerstyle layer into the Composer, and drive synchronized guitar fretboard and SVG hand-overlay events during playback.
- **Validation & Tests**: Add behavior-focused coverage for layer ordering, string routing, fret-stretch failures, transposition fallback suggestions, guide-tone pruning, weak-beat placement, Travis thumb-clock timing, string-slap events, profile-specific picking assignments, and visual event streams.

## 5D. Piano Accompaniment Generation Engine
<!-- beads-id: br-plan-11 | satisfies: prd-bsc-s39, prd-bsc-s40, prd-bsc-s41, prd-bsc-s42, prd-bsc-s43, prd-bsc-s44, prd-bsc-s45, prd-bsc-s46 -->

- **Harmonic Framework & Bass Anchoring**: Implement `piano-accompaniment.ts` to consume melody analysis and harmonized chords, parse cadence points and phrase endings, map chord roots into the C2-C3 register, generate roots/octaves/open fifths/1-5-8 foundations, and enforce Low Interval Limit rules below C3.
- **Spatial Allocation & Voice Leading**: Implement right-hand voicing logic that prioritizes 3rds and 7ths in C3-C5, dynamically inverts chords below the melody to avoid masking the singer, retains common tones, and applies shortest-path voice leading with minimal semitone movement where possible.
- **Rhythmic & Stylistic Texturing**: Implement `piano-comping-profiles.ts` for selectable Pop / Ballad 1-5-10 arpeggiation, Rock / R&B staccato octave and syncopated off-beat comping, and Classical / Folk Alberti-bass patterns.
- **Dynamic Counterpoint & Automation**: Detect Melodic Gap Events from long holds or rests, generate scalar runs or arpeggiated fills only during those gaps, immediately yield when the melody resumes, and generate sustain pedal metadata with Pedal Down and Pedal Up / Flush events aligned to chord changes.
- **Piano Physical Validation**: Implement `piano-playability.ts` to convert hand spans wider than a major 10th into rolled articulations, detect left/right hand collisions, shift or thin textures when ranges overlap, and keep pedal and playback metadata synchronized with the generated grand-staff ABC.
- **Piano Output Contract**: Expose source analysis, harmonic framework, left-hand bass map, right-hand voicing map, comping profile metadata, counterpoint/fill map, physical validation report, pedal automation, grand-staff ABC, playback events, piano-key highlight events, optional fingering metadata, and pedal-event metadata.
- **Validation & Tests**: Add coverage for strong-beat/cadence chord mapping, C2-C3 bass anchoring, Low Interval Limit enforcement, guide-tone placement, melody-masking avoidance, shortest-path voice leading, all comping profiles, gap-fill yield behavior, hand-span conversion, hand-collision fixes, pedal automation, and synchronized grand-staff playback metadata.

## 5E. Ensemble Expansion Engine
<!-- beads-id: br-plan-12 | satisfies: prd-bsc-s47, prd-bsc-s48, prd-bsc-s49, prd-bsc-s50, prd-bsc-s51, prd-bsc-s52, prd-bsc-s53 -->

- **Integration Handshake**: Implement `ensemble-expander.ts` to require an established Layer 1 melody plus Layer 2 piano/guitar foundation, then derive a rhythmic density grid, millisecond-level bass map, and Melodic Gap Array of rests or sustained notes longer than 1.5 beats before adding auxiliary instruments.
- **Djembe Rhythmic Interlock**: Implement `djembe-arranger.ts` to lock Djembe Bass strokes to Layer 2 bass transients, place Mid-Tone taps on unused subdivisions, map Slap strokes to beats 2 and 4 or existing guitar string-slap events, and assign velocity metadata without creating conflicting transient attacks.
- **Flute and Violin Melodic Support**: Implement `orchestral-arranger.ts` to constrain Flute halo support above Layer 1, constrain Violin bed support below or interlocked with Layer 2, hold quiet chord tones in Background Mode while the melody is active, and generate short counter-melody fills only inside detected Fill Zones.
- **Anatomical and Expression Realism**: Add Flute breath validation with periodic 16th-note rests every 2-4 measures and pre-breath velocity dips; add Violin bow-expression metadata with MIDI CC 11 swells, delayed MIDI CC 1 vibrato, and double-stop validation limited to physically playable two-note spans.
- **Conflict Resolution**: Implement `ensemble-conflicts.ts` to scan vertical timeline slices for density overload, preserve Layer 1 melody first, flatten Flute/Violin runs into sustained notes next, and remove Djembe fills or revert to the base groove only if overload remains.
- **Ensemble Output Contract**: Expose integration handshake data, Djembe event map, Flute support map, Violin support map, yield decisions, conflict-resolution report, generated Djembe/Flute/Violin ABC layers, combined playback events, optional MIDI control events, and visual layer activity metadata.
- **Validation & Tests**: Add coverage for prerequisite ordering, rhythmic density analysis, bass-map sync, Fill Zone detection, Djembe bass/mid/slap placement, Flute altitude and breath rules, Violin bed/vibrato/double-stop rules, yield hierarchy, density overload simplification, and synchronized ensemble playback events.

## 6. Visual Instruments & AI UI
<!-- beads-id: br-plan-06 | satisfies: prd-bsc-s17, prd-bsc-s25, prd-bsc-s36, prd-bsc-s38, prd-bsc-s46, prd-bsc-s53 -->

- **Instrument Renderers (`GuitarFretboard.tsx`, `PianoKeyboard.tsx`)**: Build the SVG interactive components showing finger positions and highlighted keys, adapting logic from the existing `music-theory` project.
- **Synchronized Instrument Highlighting**: Connect Guitar and Piano renderers to Music Sheet playback cursor events so currently playing ABC notes/chords highlight the matching guitar fret/string or piano key in real time.
- **Animated Hand Overlay (`SvgHandOverlay.tsx`)**: Implement a reusable SVG hand image/overlay at approximately 50% opacity for Guitar and Piano views. The overlay must animate hand position and individual finger movement according to the active note/fingering event from playback, not a free-running decorative animation.
- **Theory Assistant UI (`TheoryAssistant.tsx`)**: Create the side panel for users to specify constraints (capo, skill level) and review/accept auto-harmonized arrangements into their Composer layers.

## 7. Quality Assurance, CI & Community Tools
<!-- beads-id: br-plan-07 | satisfies: prd-bsc-s11, prd-bsc-s18, prd-bsc-s19, prd-bsc-s20, prd-bsc-s21, prd-bsc-s26 -->

- **Unit Testing**: Configure Vitest and write assertion suites for the Theory Engine (manual mode) and the Song Loader.
- **E2E Testing**: Setup Playwright to assert Playback Module UI toggles and Composer workflow scenarios, including shared Music Sheet rendering in both Playback and Composer, tempo/speed changes, loop controls, note highlighting, and synchronized Guitar/Piano highlight + SVG hand overlay behavior.
- **Validation Pipeline**: Build an automated script and an API endpoint (`api/validate/route.ts`) to ensure submitted Pull Requests contain valid YAML schemas and parseable ABC notation.
