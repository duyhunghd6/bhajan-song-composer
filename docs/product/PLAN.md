# Implementation Plan: Bhajan Song Composer
<!-- beads-id: br-plan-00 | satisfies: br-prd01 -->

This document outlines the step-by-step implementation plan for the Bhajan Song Composer, acting as a technical translation of the Product Requirements Document.

**Delivery priority:** the first complete product slice is **singer accompaniment** from validated harmony. Guitar Classic accompaniment and Piano accompaniment are equal Layer 2 outcomes: each must be playable, leave space for the vocal, render/play back as an independent ABC layer, and be publishable for practice. Dedicated Guitar Fingerstyle, ensemble expansion, and full-track polish remain separate extensions and must not block either primary accompaniment path.

## 1. Project Initialization & Core Architecture
<!-- beads-id: br-plan-01 | satisfies: br-prd01-s2, br-prd01-s13, br-prd01-s16, br-prd01-s27 -->

- **Framework Setup**: Initialize a Next.js (App Router) project with TypeScript, Tailwind CSS, and structured for Static Site Generation (SSG) to support zero-cost Vercel/Netlify hosting.
- **Directory Structure**: Scaffold the prescribed directories including `data/songs/`, `src/app/`, `src/components/`, and `src/lib/`.
- **Dependencies**: Install core libraries: `abcjs` (notation/MIDI), `gray-matter` (Markdown/YAML parsing), `zod` (validation).

## 2. Data Layer & Song Catalogue Module
<!-- beads-id: br-plan-02 | satisfies: br-prd01-s3, br-prd01-s4, br-prd01-s15 -->

- **Schema Definition**: Define TypeScript types and Zod schemas (`lib/songs/schema.ts`) for the song data model (YAML frontmatter + ABC configurations).
- **Song Loader**: Implement `lib/songs/loader.ts` to parse the file-system-based Markdown and associative `.abc` files.
- **SSG Pages**: Build the landing page (`app/page.tsx`), language catalog (`app/[language]/page.tsx`), and setup the static paths for individual songs (`app/[language]/[slug]/page.tsx`).

## 3. Playback Module
<!-- beads-id: br-plan-03 | satisfies: br-prd01-s3, br-prd01-s6, br-prd01-s14, br-prd01-s15 -->

- **Playback Controller (`PlaybackController.tsx`)**: Build the unified toggle UI to seamlessly switch between different Video types and ABC notation layers.
- **YouTube Integration (`YouTubePlayer.tsx`)**: Embed the YouTube IFrame API to support dynamic video URL switching.
- **Reusable Music Sheet Renderer (`components/music-sheet/AbcjsPlaybackController.tsx`, originally planned under the name MusicSheetRenderer, never created)**: Extract ABCJS SVG rendering and MIDI synthesis into a shared component used by both Playback and Composer. It must provide play/pause/stop, playback speed/tempo control, whole-sheet and range loop controls, staff-note highlighting, render error handling, and playback cursor events for synchronized instrument visualization.
- **Playback Page Wrapper (`AbcSheetViewer.tsx`)**: Keep this as a thin playback-specific wrapper around `AbcjsPlaybackController` instead of duplicating ABCJS rendering logic.

## 4. Composer Module
<!-- beads-id: br-plan-04 | satisfies: br-prd01-s3, br-prd01-s7 -->

- **Metadata Editor (`SongForm.tsx`)**: Build form inputs bound to the YAML frontmatter schema to assist contributors.
- **Interactive Notation Editor (`AbcEditor.tsx`)**: Develop the core editor with live preview powered by the shared `AbcjsPlaybackController`, undo/redo capabilities, and localStorage caching for WIP compositions. The ABC source must stay vertically stacked above the Music Sheet preview; do not place them side-by-side because the editor workflow needs vertical spacing.
- **Layer Management (`LayerManager.tsx`)**: Implement the UI and state management allowing composers to switch between, edit, and layer multiple ABC tracks simultaneously.
- **Workstation Coordinator (`ComposerWorkstation.tsx`)**: Coordinate composer workspace state to load a specific song's metadata and layers if a query parameter is passed (e.g. `/compose?edit={slug}`).
- **Song Edit Selection Page (`app/edit/page.tsx` & `SongEditList.tsx`)**: Implement a dedicated `/edit` page displaying the full list of catalogue songs. Support live text search by song name, and display the key tone and resource icons (Video, Backing Track, Melody, Guitar, Piano) for each song. Provide an "Edit" button to open that song at `/compose?edit={slug}`.

## 5. AI Theory Engine Core
<!-- beads-id: br-plan-05 | satisfies: br-prd01-s3, br-prd01-s8, br-prd01-s9, br-prd01-s10, br-prd01-s25 -->

- **Foundational Theory (`scales.ts`, `chords.ts`)**: Implement the diatonic systems, scales, and Raga-to-Western mappings.
- **Melody Analyzer (`melody-analyzer.ts`)**: Construct the parser to evaluate treble-clef ABC notation, detect the key, and identify strong-beat notes.
- **Auto-Harmonizer (`harmonizer.ts`)**: Build the algorithm to align strong-beat melody notes with diatonic triads to generate chord progressions.
- **Arrangers (`src/lib/theory/piano-arranger.ts`, `src/lib/theory/fingerstyle-arranger.ts`)**: Implement rule-based generation to output bass clef patterns (for piano) and interleaved melody/bass (for guitar fingerstyle).
- **Primary accompaniment contract**: Prioritize a shared, approved harmony timeline that feeds two equal singer-supporting outputs: Guitar Classic voicing/comping and Piano left-hand/right-hand accompaniment. Keep their physical-validation and ABC-output contracts independent, but align chord windows, measure timing, and vocal-yield rules.

## 5A. Arrangement Pipeline: Melody → Full Track
<!-- beads-id: br-plan-08 | satisfies: br-prd01-s29, br-prd01-s30, br-prd01-s31, br-prd01-s32 -->

- **Pipeline Orchestrator**: Implement the product workflow as an explicit sequence: Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track. The UI and theory engine should prevent users from skipping directly from a melody-only layer to full accompaniment without first establishing the harmonic framework.
- **Primary Layer 2 Gate**: Treat Guitar Classic accompaniment and Piano accompaniment as the first release gate after harmonization. Full-track expansion may only follow either stable accompaniment foundation; it is not a prerequisite for practicing or publishing either accompaniment part.
- **Harmonization Stage**: Extend melody analysis and auto-harmonization to identify key/scale, prioritize strong-beat notes, choose chords using diatonic and functional harmony, and annotate chord choices with tonic/subdominant/dominant function and cadence role.
- **Accompaniment Stage**: Generate Layer 2 piano or rhythm-guitar accompaniment from the harmonized chord progression. Include bass-note extraction, inversion-aware bassline smoothing, comping pattern choices (block chords, arpeggios, syncopation), and voice-leading rules that minimize unnecessary note movement between chords.
- **Full-Track Expansion Stage**: Generate Layer 3 arrangement guidance for drums and additional instruments. Align kick patterns with the generated bassline, reserve snare/backbeat placement for groove definition, document frequency-range assignments for each instrument family, and place counter-melodies or fills in spaces where the main melody pauses or sustains.
- **Composer Integration**: Represent each stage as first-class composition layers so users can inspect, edit, accept, or reject generated harmonization, accompaniment, drum, bass, and counter-melody outputs before exporting.
- **Validation & Tests**: Add regression coverage for stage ordering, strong-beat chord selection, smooth bass movement through inversions, voice-leading distance, drum/bass rhythmic alignment, frequency-range metadata, and counter-melody placement during melody rests or held notes.

## 5B. Workflow Mockup / Proof-of-Concept Demo Pages
<!-- beads-id: br-plan-09 | satisfies: br-prd01-s54, br-prd01-s55 -->

- **Mockup Gate**: Before integrating any major arrangement workflow into the main Composer or feature page, build a standalone proof-of-concept page using representative sample melody and arrangement data. Treat the mockup as a required product review gate, not an optional prototype.
- **Arrangement Pipeline POC**: Build a demo page for Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track. It must show the input melody, detected key/scale, strong-beat analysis, chord functions, generated accompaniment, full-track expansion decisions, final ABC/playback preview, and validation report.
- **Fingerstyle Engine POC**: Build a demo page for the Multi-Layer Fingerstyle Arrangement Engine. It must show upward construction, downward compression decisions, string routing, guide-tone pruning, fret-stretch/playability failures, transposition fallback suggestions, final solo guitar matrix, ABC preview, and visual event metadata.
- **Piano Accompaniment POC**: Build a demo page for the Piano Accompaniment Generation Engine. It must show comping profile selection, left-hand bass anchoring, Low Interval Limit validation, right-hand voice leading, Melodic Gap Event fills, hand-span/collision validation, sustain pedal automation, grand-staff ABC preview, and synchronized piano-key highlights.
- **Ensemble Expansion POC**: Build a demo page for Djembe, Flute, and Violin expansion. It must show the integration handshake, rhythmic density grid, bass map, Melodic Gap Array, Djembe event map, Flute/Violin yield states, density conflict-resolution report, final multi-layer ABC preview, and synchronized playback preview.
- **Integration Handoff Checklist**: Each mockup page must expose visible pass/fail or review-ready status. Main feature integration is blocked until the demo renders the input, intermediate decisions, final artifact, and validation report end-to-end with behavior-focused tests.
- **POC Test Coverage**: Add Playwright coverage for each mockup page at the highest seam: visible sample input, step-by-step decision output, final ABC/playback artifact, validation/conflict report, and integration-ready status.

## 5C. Multi-Layer Fingerstyle Arrangement Engine (Extension After Singer Accompaniment)
<!-- beads-id: br-plan-10 | satisfies: br-prd01-s33, br-prd01-s34, br-prd01-s35, br-prd01-s36, br-prd01-s37, br-prd01-s38 -->

- **Upward Construction Context**: Reuse the core arrangement pipeline to build inspectable melody, harmonization, accompaniment, rhythm/percussion, bassline, and optional counter-melody source layers before any guitar reduction begins.
- **Downward Compression Algorithm**: Implement `src/lib/theory/fingerstyle-compressor.ts` to route melody to strings 1-3, route root bass notes to strings 4-6, validate Beat 1 melody/bass pairings, prune non-essential 5ths before 3rds/7ths, place guide tones on weak beats or melody rests, and propose transposition fallbacks when fret-stretch limits exceed 4-5 frets.
- **Physical Hand Mapping**: Implement `src/lib/theory/guitar-playability.ts` and `src/lib/theory/picking-profiles.ts` for fretting-finger count, picking-finger count, Strict PIMA mapping, Folk / Travis Override mapping, thumb-clock bass events, synchronous pinch events, off-beat syncopation, and string-slap snare simulation on beats 2 and 4.
- **Fingerstyle Output Contract**: Expose a structured intermediate result containing source layers, outer voice map, playability report, fallback suggestions, inner voice reduction, rhythmic event map, profile metadata, final ABC layer, tablature/string-position metadata, fretboard-highlight events, and numbered note-marker events.
- **Composer and Visual Integration**: Let composers choose Strict PIMA vs. Folk / Travis profiles, inspect playability failures, accept the generated fingerstyle layer into the Composer, and drive synchronized guitar fretboard and numbered note-marker events during playback.
- **Validation & Tests**: Add behavior-focused coverage for layer ordering, string routing, fret-stretch failures, transposition fallback suggestions, guide-tone pruning, weak-beat placement, Travis thumb-clock timing, string-slap events, profile-specific picking assignments, and visual event streams.

## 5D. Piano Accompaniment Generation Engine (Primary Singer-Accompaniment Path)
<!-- beads-id: br-plan-11 | satisfies: br-prd01-s39, br-prd01-s40, br-prd01-s41, br-prd01-s42, br-prd01-s43, br-prd01-s44, br-prd01-s45, br-prd01-s46 -->

> Superseded for the shipped Composer by PRD Amendment A4 (`br-prd01-s60`): Piano is not an active Composer step; the accompaniment branch ships Guitar Classic, Harmonium, and Djembe. This section remains the plan for the piano theory engine and its mockup.

- **Harmonic Framework & Bass Anchoring**: Implement `src/lib/theory/piano-accompaniment.ts` to consume melody analysis and harmonized chords, parse cadence points and phrase endings, map chord roots into the C2-C3 register, generate roots/octaves/open fifths/1-5-8 foundations, and enforce Low Interval Limit rules below C3.
- **Product Priority & Composer Integration**: Promote this from a theory-only output to a first-class accompaniment branch alongside Guitar Classic. From the same selected Harmony Step 3 ABC, the practitioner must be able to select a piano comping profile, review a playable two-hand result, and publish its ABC layer without entering solo-piano or ensemble workflows.
- **Spatial Allocation & Voice Leading**: Implement right-hand voicing logic that prioritizes 3rds and 7ths in C3-C5, dynamically inverts chords below the melody to avoid masking the singer, retains common tones, and applies shortest-path voice leading with minimal semitone movement where possible.
- **Rhythmic & Stylistic Texturing**: Implement `src/lib/theory/piano-comping-profiles.ts` for selectable Pop / Ballad 1-5-10 arpeggiation, Rock / R&B staccato octave and syncopated off-beat comping, and Classical / Folk Alberti-bass patterns.
- **Dynamic Counterpoint & Automation**: Detect Melodic Gap Events from long holds or rests, generate scalar runs or arpeggiated fills only during those gaps, immediately yield when the melody resumes, and generate sustain pedal metadata with Pedal Down and Pedal Up / Flush events aligned to chord changes.
- **Piano Physical Validation**: Implement `src/lib/theory/piano-playability.ts` to convert hand spans wider than a major 10th into rolled articulations, detect left/right hand collisions, shift or thin textures when ranges overlap, and keep pedal and playback metadata synchronized with the generated grand-staff ABC.
- **Piano Output Contract**: Expose source analysis, harmonic framework, left-hand bass map, right-hand voicing map, comping profile metadata, counterpoint/fill map, physical validation report, pedal automation, grand-staff ABC, playback events, piano-key highlight events, optional fingering metadata, and pedal-event metadata.
- **Validation & Tests**: Add coverage for strong-beat/cadence chord mapping, C2-C3 bass anchoring, Low Interval Limit enforcement, guide-tone placement, melody-masking avoidance, shortest-path voice leading, all comping profiles, gap-fill yield behavior, hand-span conversion, hand-collision fixes, pedal automation, and synchronized grand-staff playback metadata.

## 5E. Ensemble Expansion Engine
<!-- beads-id: br-plan-12 | satisfies: br-prd01-s47, br-prd01-s48, br-prd01-s49, br-prd01-s50, br-prd01-s51, br-prd01-s52, br-prd01-s53 -->

- **Integration Handshake**: Implement `src/lib/theory/ensemble-expander.ts` to require an established Layer 1 melody plus Layer 2 piano/guitar foundation, then derive a rhythmic density grid, millisecond-level bass map, and Melodic Gap Array of rests or sustained notes longer than 1.5 beats before adding auxiliary instruments.
- **Djembe Rhythmic Interlock**: Implement `src/lib/theory/djembe-arranger.ts` to lock Djembe Bass strokes to Layer 2 bass transients, place Mid-Tone taps on unused subdivisions, map Slap strokes to beats 2 and 4 or existing guitar string-slap events, and assign velocity metadata without creating conflicting transient attacks.
- **Flute and Violin Melodic Support**: Implement `src/lib/theory/orchestral-arranger.ts` to constrain Flute halo support above Layer 1, constrain Violin bed support below or interlocked with Layer 2, hold quiet chord tones in Background Mode while the melody is active, and generate short counter-melody fills only inside detected Fill Zones.
- **Anatomical and Expression Realism**: Add Flute breath validation with periodic 16th-note rests every 2-4 measures and pre-breath velocity dips; add Violin bow-expression metadata with MIDI CC 11 swells, delayed MIDI CC 1 vibrato, and double-stop validation limited to physically playable two-note spans.
- **Conflict Resolution**: Implement `src/lib/theory/ensemble-conflicts.ts` to scan vertical timeline slices for density overload, preserve Layer 1 melody first, flatten Flute/Violin runs into sustained notes next, and remove Djembe fills or revert to the base groove only if overload remains.
- **Ensemble Output Contract**: Expose integration handshake data, Djembe event map, Flute support map, Violin support map, yield decisions, conflict-resolution report, generated Djembe/Flute/Violin ABC layers, combined playback events, optional MIDI control events, and visual layer activity metadata.
- **Validation & Tests**: Add coverage for prerequisite ordering, rhythmic density analysis, bass-map sync, Fill Zone detection, Djembe bass/mid/slap placement, Flute altitude and breath rules, Violin bed/vibrato/double-stop rules, yield hierarchy, density overload simplification, and synchronized ensemble playback events.

## 6. Visual Instruments & AI UI
<!-- beads-id: br-plan-06 | satisfies: br-prd01-s17, br-prd01-s25, br-prd01-s36, br-prd01-s38, br-prd01-s46, br-prd01-s53 -->

- **Instrument Renderers (`src/components/instruments/GuitarFretboard.tsx`, `PianoKeyboard.tsx`)**: Build the SVG interactive components showing finger positions and highlighted keys, adapting logic from the existing `music-theory` project.
- **Synchronized Instrument Highlighting**: Connect Guitar and Piano renderers to Music Sheet playback cursor events so currently playing ABC notes/chords highlight the matching guitar fret/string or piano key in real time.
- **Numbered Note Markers (`src/components/instruments/InstrumentNoteMarkers.tsx`)**: Implement reusable numbered note markers for Guitar and Piano views. Markers render `(1)` through `(5)` on active fret/string or key targets, using blue for left hand and yellow for right hand, and follow playback note/fingering events.
  - **Guitar Fingering Marker Mapper**: Map chord-shape and fingerstyle events to string/fret marker coordinates, with technique labels synced to the specific measure.
  - **Piano Split-Hand Markers**: Build support for separate left-hand and right-hand markers, and implement UI switches to toggle Left Hand Only, Right Hand Only, or Combined Hands-Together modes.
  - **Pedal Indicator Graphic**: Create a pedal indicator panel rendering pedal down/hold/flush states in real-time, bound to MIDI CC 64 events and measures.
- **Theory Assistant UI (`src/components/composer/TheoryAssistant.tsx`)**: Create the side panel for users to specify constraints (capo, skill level) and review/accept auto-harmonized arrangements into their Composer layers.

## 7. Quality Assurance, CI & Community Tools
<!-- beads-id: br-plan-07 | satisfies: br-prd01-s11, br-prd01-s18, br-prd01-s19, br-prd01-s20, br-prd01-s21, br-prd01-s26 -->

- **Unit Testing**: Configure Vitest and write assertion suites for the Theory Engine (manual mode) and the Song Loader.
- **E2E Testing**: Setup Playwright to assert Playback Module UI toggles and Composer workflow scenarios, including shared Music Sheet rendering in both Playback and Composer, tempo/speed changes, loop controls, note highlighting, and synchronized Guitar/Piano highlight + numbered note-marker behavior.
- **Validation Pipeline**: Build an automated script and an API endpoint (`api/validate/route.ts`) to ensure submitted Pull Requests contain valid YAML schemas and parseable ABC notation.

## 8. Composer Step Workflow, Export & Practice
<!-- beads-id: br-plan-13 | satisfies: br-prd01-s57, br-prd01-s58, br-prd01-s60, br-prd01-s61 -->

- **Step Router (`src/app/compose/[slug]/[step]/page.tsx`, `src/components/composer/ComposerStepWorkspace.tsx`, `composer-steps.ts`)**: Route `melody`, `harmony`, `accompaniment`, `guitar-fingerstyle`, and `review` (Export) as first-class Composer steps with browser-local draft persistence (`workspace/storage.ts`).
- **Harmony Workflow (`workspace/HarmonyStep.tsx`, `AccompanimentWorkflowWizard.tsx`, `src/lib/theory/accompaniment-workflow/definition.ts`)**: Run shared Steps 1–3 and let the user select the `voice-leading-validation` result that becomes the only downstream harmonic source.
- **Accompaniment Branch (`workspace/AccompanimentStep.tsx`, `accompaniment-workflow/guitar-classic-realization.ts`, `guitar-classic-abc.ts`, `support-layers.ts`)**: Ordered Guitar Classic / Harmonium / Djembe stack with checkbox-gated branch steps and deterministic `V:GuitarSupport` materialization.
- **Source Graph & Preview Projection (`workspace/arrangement-source/arrangement-source-graph.ts`, `workspace/arrangement-preview-model.ts`, `src/lib/theory/abc-layer-visibility.ts`)**: Derive source-current provenance and export eligibility; keep visibility/volume/TAB as preview-only projections.
- **Export & Publication (`workspace/export/ExportStep.tsx`, `src/app/actions/publish-arrangement.ts`)**: Explicit layer selection and durable upsert of `<slug>.<type>.abc` plus `abcNotations` metadata, preserving the Markdown body.
- **Practice Showcase (`src/app/practice/[slug]/PracticeViewer.tsx`)**: Render published catalogue notation only, with client-local practice controls.
- **Validation & Tests**: Cover step routing, stale-source invalidation, storage pruning, preview projection, publication, and Practice isolation from Composer drafts.

## 9. Guitar Fingerstyle TimeGrid Staged Pipeline
<!-- beads-id: br-plan-14 | satisfies: br-prd01-s59 -->

- **Canonical TimeGrid (`src/lib/theory/fingerstyle-arranger/time-slice.ts`, `types.ts`, `fingerstyle-constraints.ts`)**: Compile the selected Harmony Step 3 ABC into meter-aware `TimeSliceMeasure[]` with locked melody/chord/lyric/barline facts and independent physical `tablature[]` events.
- **Staged Server Action (`src/app/actions/fingerstyle-line-arranger.ts` + `fingerstyle-line-arranger/`, `ai-config.ts`)**: Enforce fill-position reservation → bass position → chord-derived bass candidates → deterministic materialization/freeze → post-bass fill composition → server merge, exposing one phase-scoped tool per turn.
- **Deterministic Placement & Physics (`heuristic-time-slice.ts`, `source-playability.ts`, `physics-validation.ts`, `bass-planning.ts`, `fill-reservations.ts`)**: Place the non-fill foundation, derive labelled melody-only fret exceptions, and reject string collisions or skill-limit violations.
- **Fill Opportunities & Compact Contracts (`fill-opportunities.ts` + `fill-opportunities/`, `llm-codec.ts`)**: Score legal source-rest windows 0–100, paginate `fill-opportunities:v1`, accept `fill-selection:v1` / `fills:v1`, and merge deterministically; fall back to the validated bass foundation with a non-fatal notice when fills are unavailable.
- **Derived Projections (`time-slice-abc-renderer.ts`, `guitar-abc-output.ts`, `ascii-guitartab-conversion.ts`, `toon-utils.ts`, `abc-timegrid-import.ts`)**: Render forced-string Guitar ABC (`clef=treble-8`, key-aware naturals, ties) and ASCII GuitarTab from the same events; import supported forced-string ABC back into TimeGrid events.
- **Interchange & Persistence (`timegrid-document-codec.ts`, `timegrid-document-codec-v3.ts`, `src/components/composer/workspace/fingerstyle-measure-persistence.ts`, `fingerstyle-diagnostic-persistence.ts`)**: Readable `timegrid-document:v3` import/export separate from source-fingerprint-bound browser persistence and bounded diagnostic summaries.
- **Composer UI (`workspace/GuitarFingerstyleStep.tsx`, `FingerstyleLineCard.tsx`, `fingerstyle-line-measures.ts`)**: Line-level generation with skill/density settings, generation lock, stale-result guards, TAB preview, and copyable diagnostics.
- **Validation & Tests**: Cover melody MIDI equality, unique simultaneous strings, skill limits, pickup/tie/repeat handling, ABC/ASCII parity, codec round-trips, staged tool order, and fills-unavailable fallback.

