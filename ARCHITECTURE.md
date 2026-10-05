# Architecture

This project is a Next.js bhajan song composition app. The codebase is organized around a few deep modules: Composer UI, music-sheet playback, theory engines, workflow orchestration, and visual mockups.

## Application areas

### Composer UI

Composer screens live under `src/components/composer/`.

- `ComposerStepWorkspace.tsx` is the step router for melody, harmony, accompaniment, Guitar Fingerstyle, and Export flows.
- `workspace/` contains step-specific modules:
  - `HarmonyStep.tsx` handles harmonization selection and automatic checkbox projections. `src/lib/theory/harmony/analysis-preview.ts` combines optional chords and weighted beat lyrics for both ABC display and playback. `src/lib/theory/harmony/time-grid.ts` derives a read-only analysis grid using the existing `TimeSliceMeasure[]` shape, retaining exact events from `metric-timeline.ts`; `auto-chords.ts` ranks missing-measure triads. Layer controls occupy the left sidebar; source/TimeGrid inspection and workflow remain on the right.
  - `AccompanimentStep.tsx` handles accompaniment workflow review, setup persistence, layer visibility, and instrument previews.
  - `workspace/arrangement-source/arrangement-source-graph.ts` owns the source-current branch graph and exportable raw notation layers.
- `arrangement-preview-model.ts` adapts that source graph into harmony/accompaniment render models, layer visibility, volume directives, and ABCJS options.
- `workspace/export/ExportStep.tsx` selects valid notation layers for publication and links the resulting Practice experience.
  - `fingerstyle-measure-persistence.ts` versions source-bound TimeGrid overlays, safely rejects malformed/stale/physically invalid browser drafts, restores only compatible tablature events, and rebuilds canonical forced Guitar ABC after hydration.
  - `fingerstyle-diagnostic-persistence.ts` retains bounded, source-fingerprint-compatible LLM/TimeGrid workflow diagnostic summaries; it removes LLM payload previews and enforces per-line, per-song, plaintext, event, and storage limits.
  - `GuitarFingerstyleStep.tsx` owns the canonical in-memory TimeGrid document, persists independent player-skill/fill-density settings, imports/exports validated `timegrid-document:v3` JSON, passes previous/next-line measure context, and owns the route-level single-line generation/stale-result lock.
  - `FingerstyleLineCard.tsx` invokes staged line generation, restores compact fill-run summaries, presents the dependency-free plaintext LLM/TimeGrid workflow diagnostic summary through the existing copyable diagnostic terminal, and renders canonical TimeGrid state without treating TOON as an editable authority.
  - `preview.tsx` contains shared preview layout, render options, and harmonization display helpers.
- `AbcEditor.tsx` is the Melody/layer ABC editor entrypoint; `abc-editor/AbcSourceEditor.tsx` is its CodeMirror 6 surface (undo history, `abc-language.ts` highlighting) and exchanges selections with the score preview.
- `LayerManager.tsx` remains the public layer-stack entrypoint.
- `layers/layer-manager-parts.tsx` contains layer stack defaults, layer parsing/combining utilities, and the extracted pipeline/fingerstyle panels.
- `AccompanimentWorkflowWizard.tsx` is the accompaniment workflow shell; the experimental ensemble workflow has only `ensemble-workflow/wizard-parts.tsx` (state transitions and option-list UI), no shipped shell or route.
- `accompaniment-workflow/WorkflowSetupPanel.tsx` contains the setup UI for the ordered accompaniment instrument stack, native drag/drop, and accessible up/down reordering.
- `accompaniment-workflow/wizard-parts.tsx` contains accompaniment wizard presentation helpers and option-list UI.
- `ensemble-workflow/wizard-parts.tsx` contains reusable ensemble wizard state transitions and option-list UI.
- `SongForm.tsx` is the metadata form shell.
- `song-form/metadata.ts` contains metadata defaults and YAML serialization.
- `song-form/TextField.tsx` contains the shared text field module.

The Composer UI owns React state, browser-local draft persistence, and user interaction. It delegates music decisions and ABC construction to theory modules. `publish-arrangement.ts` is the durable publication seam: it validates selected named layers, upserts their metadata and ABC files, and preserves the song Markdown body. Practice is a published-catalogue consumer, not a Composer draft renderer.

The accompaniment workflow is intentionally a single-page wizard under the existing dynamic route `/compose/[slug]/[step]`; `/compose/hari-bol/accompaniment` is handled by `step=accompaniment`, not by a dedicated route folder. Internal accompaniment substeps live in persisted workflow state rather than route segments.

The downstream source graph is directed: Melody feeds Harmony Steps 1–3; the selected Step 3 `voice-leading-validation` ABC then independently feeds Accompaniment and Guitar Fingerstyle, and Export publishes only selected source-current layers that Practice reads. The invalidation table, the authority/projection matrix, and the Layers Visibility guardrails are maintained in [docs/guides/composer-source-flow.md](docs/guides/composer-source-flow.md); see also `CONTEXT.md` and [ADR 0001](docs/adr/0001-composer-publication-and-practice.md).

### Music sheet / ABCJS playback

Music notation playback lives under `src/components/music-sheet/`.

- `AbcjsPlaybackController.tsx` is the public playback controller entrypoint.
- `abcjs-playback/types.ts` defines the local abcjs adapter types and controller props.
- `abcjs-playback/abc-rendering.ts` contains tempo parsing and SVG post-processing for beat indicators, lyrics, and tablature staff spacing.
- `abcjs-playback/render-input.ts` resolves the exact ABC sent to abcjs, including render-only Guitar forcing, abcjs single-note decoration adaptation, and key/meter/name overrides.
- `abcjs-playback/AbcjsPlaybackControls.tsx` contains transport, metadata override, tempo, and loop-range controls.
- `abcjs-playback/AbcjsPlaybackStyles.tsx` contains the scoped styles applied to rendered abcjs output.
- `score-workspace/ScoreViewport.tsx` provides score-only zoom, scroll, pan and focus mode as the shared controller's default score surface; a caller's `renderScore` can supply an alternative viewport. Measures reflow to the observed content width after subtracting padding, with scrollbar tracks hidden and direct Fit/zoom controls on Composer, Practice, playback, and test/mockup pages. Transport controls stay outside the transformed surface. `score-workspace/note-interactions.ts` implements opt-in selection, note menus and drag commands against exact canonical source ranges.
- `score-workspace/viewport-marquee.ts` owns view-only mouse selection and cancellation; `viewport-selection.ts` resolves note glyph bounds and deduplicates chord labels/diagrams. Command/Control-drag pans, plain left-drag selects, and Option/Alt-drag in Edit changes pitch. Single-note selection remains linked to source through the note adapter.
- `src/lib/theory/score-note-edit.ts` preserves note timing and accidental carry when applying pitch edits. `src/lib/theory/score-chord-edit.ts` edits source chord occurrences; manual and generated Step 3 candidates share `src/lib/theory/accompaniment-workflow/harmony-validation.ts` timeline checks.
- Harmony owns edit history, source-bound manual chord drafts and explicit manual Step 3 selection. Its transactions update the canonical melody/workspace and restore or invalidate the Fingerstyle cache together; preview ABC is never saved as melody.
- `abcjs-playback/source-map.ts`, `source-selection.ts`, `lyric-alignment.ts`, and `useScoreSourceSelection.ts` link a caller-ABC selection to engraved elements in both directions (`sourceSelection` / `onSourceSelect` props); score clicks select and never start playback.
- `guitar-chords/GuitarChordAccompaniment.tsx` adds the shared Melody, Harmony and Accompaniment chord-shape picker, audition, and SVG diagrams. It uses source-bound `voicingOverrides`; `src/lib/theory/guitar-chord-score.ts` resolves the first voice’s chord windows and projects physical string/fret pitches into guitar audio before sample loading. `AbcEditor.tsx` receives workspace overrides for persisted Melody choices. The controller’s `prepareAudio` and `onScoreRendered` hooks keep these projections local to preview playback.

The playback module is intentionally a client-side adapter around abcjs. Callers pass ABC text and optional render/synth settings; the implementation owns abcjs rendering, synth lifecycle, click-to-play, cursor events, and visual post-processing. Render-boundary and Guitar TAB string-mapping rules are in [docs/guides/abcjs-tablature-rendering.md](docs/guides/abcjs-tablature-rendering.md).

### Theory engine

Music-theory logic lives under `src/lib/theory/`.

- `piano-accompaniment.ts` remains the public piano accompaniment interface.
- `piano-accompaniment/types.ts` contains the exported piano accompaniment contract.
- `piano-accompaniment/pedal-automation.ts` contains sustain pedal automation and UI metadata generation.
- `piano-accompaniment/output-contract.ts` contains piano key highlights, fingering metadata, and physical hand events.
- `fingerstyle-arranger.ts` remains the public fingerstyle arrangement interface. It generates solo Guitar Fingerstyle parts that carry melody, add chord-derived bass, and emit intro/interlude/outro section markers for staff-system assembly.
- `fingerstyle-arranger/llm-codec.ts` owns the compact model-bound voicing and non-fill foundation tables. It reconstructs canonical grids from server-owned source metadata before physics validation.
- `fingerstyle-arranger/fill-reservations.ts` selects actual source-rest fill positions before bass planning. Density changes selection budgets only; held Melody spans are never discretionary fill targets. Reservations are semantic time locations and are reconciled against later physical candidates.
- `fingerstyle-arranger/bass-planning.ts` enumerates only harmonic legal bass slots, derives chord-based candidate IDs, and materializes selected bass events into the canonical TimeGrid.
- `fingerstyle-arranger/fill-opportunities.ts` is the stable local entrypoint for post-foundation exhaustive safe-window analysis, scored legal atomic candidates, paginated compact contracts, composition validation, and deterministic fill merge; implementation stays in `fingerstyle-arranger/fill-opportunities/`.
- `fingerstyle-arranger/time-slice-abc-renderer.ts` renders sounding intervals, explicit fill durations, source-Melody tie segmentation, tied melody segments, and persisted normalized Guitar slur boundaries while preserving forced guitar strings; `convertTimeSliceMeasureToAbc` remains at its historical import path. `TimeSliceMeasure[]` data is the canonical physical arrangement for UI previews and ABC serialization, and sparse opening pickup padding is excluded from fill/event duration decisions.
- `fingerstyle-arranger/abc-timegrid-import.ts` imports supported forced-string `V:Guitar` ABC into physical TimeGrid events. It preserves byte-exact source identity in `source.rawAbc`, represents ties as same-string duration continuity, and stores Guitar slurs separately as normalized phrase boundaries; generated Guitar ABC is a normalized physical reconstruction, not an exact concrete-syntax re-emission.
- `fingerstyle-arranger/fingerstyle-constraints.ts` owns shared skill-level constraints used by deterministic TimeGrid placement, fill analysis, and physical validation.
- `fingerstyle-arranger/source-playability.ts` preflights authoritative melody attacks against the physical guitar range and derives labelled melody-only fret exceptions; selected-skill limits still apply to every discretionary accompaniment and fill note.
- `fingerstyle-arranger/heuristic-time-slice.ts` deterministically places the validated non-fill foundation on the canonical TimeGrid while preserving authoritative melody pitch and physical-string occupancy.
- `fingerstyle-arranger/generation-diagnostics.ts` combines bounded LLM tool-loop, deterministic placement, and staged foundation/fill workflow events into one browser-safe run, while `diagnostic-plaintext.ts` renders a compact timeline and outcome. The shared tool loop bounds invalid local results, final validation attempts, individual requests, tool output, and total transcript size.
- `src/app/actions/fingerstyle-line-arranger.ts` remains the public Server Action; its local `fingerstyle-line-arranger/` directory enforces fill-position reservation → bass position → chord-derived bass candidate → TimeGrid materialization/freeze → post-bass physical fill composition → server merge → ASCII/Guitar ABC exact-reference order. When bounded discretionary-fill retries fail, it returns the already validated bass foundation with a non-fatal fills-unavailable notice.
- `fingerstyle-arranger/types.ts` contains the exported fingerstyle source-layer, playability, section metadata, validation-compatible guitar tab events, artifact, and output contract types. Diagnostic data remains outside these stable musical artifact contracts.
- `accompaniment-workflow.ts` remains the public accompaniment workflow interface. It owns setup normalization, legacy setup fallback, ordered-instrument role hints, enabled-step planning, and versioned restoration that drops obsolete workflow-step state. Combined accompaniment planning enables branch steps only for checked instrument scopes in stack order; active sessions can be re-planned from setup checkbox changes so disabled instruments do not appear or block completion. Persisted legacy Solo/Fingerstyle setup values normalize to combined accompaniment.
- `harmony/workflow.ts` owns deterministic shared Harmony Steps 1–3: exact metric analysis, bounded progression search, lyric chord ingestion and source-preserving validation. The server action dispatches these steps before any LLM setup; the wizard keeps explicit per-step selection and hides AI controls.
- `accompaniment-workflow/definition.ts` contains workflow ids, setup types, instrument branch scopes, constants, and step definitions for shared, Guitar Classic, Harmonium, and Djembe branches. The Guitar branch owns comping-profile, voicing/bass, and deterministic standard-notation support-ABC materialization; fill density remains an independent Guitar Fingerstyle generation setting.
- `accompaniment-workflow/guitar-classic-realization.ts` deterministically turns the selected Step 4 PIMA/pinch/strum profile plus Step 5 physical anchors into a complete, chord-driven Guitar Classic event plan before rendering; it validates the generated plan without asking another model to compose it.
- `accompaniment-workflow/guitar-classic-abc.ts` converts the realized, validated Guitar Classic timing/string/fret events into the measure-aligned `V:GuitarSupport` singer-support voice; it preserves physical strings for optional accompaniment TAB rendering but never produces a Fingerstyle artifact or Fingerstyle input.
- `accompaniment-workflow/session-transitions.ts` contains pure workflow session transitions for merging generated runs, selecting options, skipping branch steps, extracting profile hints, and detecting existing step results.
- `accompaniment-workflow/support-layers.ts` adapts completed Djembe workflow decisions into a playable Djembe support layer for the accompaniment page preview.
- `accompaniment-workflow/tool-schema.ts` contains structured LLM tool schemas for accompaniment workflow generation.
- `ensemble-workflow.ts` remains the public ensemble workflow interface.
- `ensemble-workflow/definition.ts` contains ensemble workflow ids, types, default generation plan, and step definitions.

Compatibility entrypoints were preserved so existing callers can continue importing from `@/lib/theory/piano-accompaniment`, `@/lib/theory/fingerstyle-arranger`, `@/lib/theory/accompaniment-workflow`, and `@/lib/theory/ensemble-workflow`.

### Configured LLM function-call boundary

`src/app/actions/ai-config.ts` is the bounded OpenAI-compatible chat-completions/function-call transport and tool-loop control boundary; it is not the authority for arrangement validity. Calling workflows expose only the tool for their current phase, and deterministic theory modules validate source locks, legal candidates, physical guitar constraints, and final artifacts before state is accepted. For Fingerstyle, `src/app/actions/fingerstyle-line-arranger.ts` is the public Server Action and its local `workflow.ts` exposes only the next allowed staged tool. Rationale and limits: [ADR 0003](docs/adr/0003-llm-function-call-boundary.md).

### Routes, playback, catalogue, and Server Actions

- `src/app/` — App Router. `[language]/[slug]/page.tsx` is the public Playback page; `edit/` lists the catalogue for editing; `compose/page.tsx` + `compose/[slug]/[step]/page.tsx` host the Composer (`composer-steps.ts` defines `melody`, `harmony`, `accompaniment`, `guitar-fingerstyle`, `review`); `practice/[slug]/PracticeViewer.tsx` renders published notation only; `mockups/` holds POC gate pages (`arrangement/`, `fingerstyle/`, `ensemble/` are aliases of the `*-pipeline`/`*-engine`/`*-expansion` pages); `test-*/` are developer harness pages.
- `src/components/playback/` — `PlaybackController.tsx` (video/sheet selectors), `YouTubePlayer.tsx`, `AbcSheetViewer.tsx` (thin wrapper over `AbcjsPlaybackController`), `instrument-highlighting.ts` (cursor → fretboard/keyboard events).
- `src/components/instruments/` — `GuitarFretboard.tsx`, `VirtualGuitarFretboard.tsx`, `PianoKeyboard.tsx`, `InstrumentNoteMarkers.tsx`, `PianoPedalIndicator.tsx`.
- `src/lib/songs/` — `schema.ts` (Zod), `loader.ts` (Markdown + `.abc` catalogue), `validation.ts`, `composer-notation.ts` (published-layer naming shared with Export).
- `src/app/actions/` — Server Actions: `harmonize.ts`, `accompaniment-workflow.ts`, `accompaniment.ts`, `ensemble-workflow.ts`, `fingerstyle-line-arranger.ts` (+ local `fingerstyle-line-arranger/`), `fingerstyle-diagnostics.ts`, `fingerstyle-tool-contract.ts`, `publish-arrangement.ts`, `save-abc-to-disk.ts`, `save-song-metadata.ts`, `abc-validation.ts`, and the shared `ai-config.ts` transport. `src/app/api/validate/route.ts` and `scripts/validate-songs.mjs` share `src/lib/songs/validation.ts`.
- Base theory modules not listed above: `scales.ts`, `chords.ts`, `melody-analyzer.ts`, `harmonizer.ts`, `harmonization-candidates.ts`, `chord-tone-reference.ts`, `arrangement-pipeline.ts`, `accompaniment-stage.ts`, `full-track-expansion-stage.ts`, `accompaniment-abc.ts`, `abc-*.ts` utilities, `guitar-string-forcing.ts`, `guitar-tab-validation.ts`, `guitar-voicings.ts`. POC-only engines that are not on the shipped Composer path: `fingerstyle-compressor.ts`, `guitar-playability.ts`, `picking-profiles.ts`, `piano-arranger.ts`, `piano-comping-profiles.ts`, `piano-playability.ts`, `ensemble-expander.ts`, `djembe-arranger.ts`, `orchestral-arranger.ts`, `ensemble-conflicts.ts`, `ensemble-output-contract.ts`.

### Visual instrument mockups

Visual prototypes live under `src/app/mockups/visual-instruments/`.

- `VisualInstrumentsMockupClient.tsx` is the interactive mockup shell.
- `mockup-parts.tsx` contains sample ABC, guitar/piano marker timelines, state panels, event cards, and variant switching.

The mockup modules are not production workflow modules, but their generated marker data mirrors the contracts used by the Composer and playback surfaces.

## Module seams

The main seams are:

1. **Composer UI → theory engine**
   - Composer modules call theory modules for arrangements, workflow prompts, ABC annotations, and generated instrument data.
   - Theory modules do not import Composer UI.

2. **Composer UI → music-sheet playback**
   - Composer modules pass ABC strings to `AbcjsPlaybackController`.
   - The playback adapter owns abcjs-specific rendering and synth behavior.

3. **Workflow shells → workflow definitions**
   - Wizard shells manage local UI state and action calls.
   - Workflow definition modules own step ids, labels, dependency rules, prompts, and schemas.
   - Accompaniment wizard setup is persisted before session start; the setup-driven planned step grid previews the exact branch list before start/reset. Once a workflow begins, the normalized setup is embedded in `AccompanimentWorkflowSession` so prompt generation, visible steps, and next-step traversal share one source of truth.

4. **Public entrypoints → extracted implementation modules**
   - Large historical files remain stable import points.
   - Extracted submodules concentrate implementation details behind those import points.

## Testing strategy

Vitest suites sit next to the code they cover:

- `src/lib/theory/__tests__/` — theory engine (`harmonizer`, `melody-analyzer`, `accompaniment-stage`, `accompaniment-workflow*`, `arrangement-pipeline`, `full-track-expansion-stage`, `fingerstyle-arranger`, `guitar-*`, `abc-*`, `ensemble-*`, `djembe-arranger`, `time-slice`), with `arranger-fixtures.ts` for shared ABC fixtures. `arrangers.test.ts` is a `describe.todo` pointer kept so test discovery stays explicit.
- `src/lib/theory/fingerstyle-arranger/__tests__/` and `src/lib/theory/accompaniment-workflow/__tests__/` — module-local suites for the TimeGrid pipeline and Guitar Classic realization.
- `src/app/actions/__tests__/` — bounded LLM tool loop (`ai-config`) and the staged `fingerstyle-line-arranger` action.
- `src/components/**/__tests__/` — Composer workspace state/persistence/preview, music-sheet playback, and playback instrument highlighting.
- `src/lib/songs/__tests__/` — schema, loader, validation. `src/lib/docs/__tests__/` pins the traceability matrix totals.
- `e2e/` — Playwright specs for playback, Composer steps, catalogue editor, and each mockup POC page.

Known coverage gaps (tracked in `docs/product/PRD-to-PLAN-statematrix.md` §6): no dedicated tests for the piano engine (`piano-accompaniment`, `piano-playability`, `piano-arranger`), for `orchestral-arranger`/`ensemble-conflicts`, or for `publish-arrangement` and `PracticeViewer`; `e2e/piano-accompaniment-mockup.spec.ts` targets a page that does not exist yet.

Recommended validation commands:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run docs:check
```

Current project note: `npm run lint` may report the vendored `public/abcjs-basic-min.js` file, and `npm run build` can fail because the app uses Server Actions with static export.

## File-size and locality guidelines

- Keep public entrypoint files thin where possible.
- Put exported contracts in `types.ts` when a domain has many shared types.
- Prefer local subdirectories for implementation details before introducing global shared modules.
- Extract a module when it gives locality: future changes should happen in one place rather than across many callers.
- Avoid shallow pass-through modules that merely rename a function without hiding implementation complexity.
- Preserve compatibility import paths during structural refactors unless a migration is intentional.

The shared guitar diagram adapter gives each diagram a full rectangular hit area. Plain diagram clicks bypass Harmony viewport marquee selection and open the guitar shape picker; modified selection and pan gestures retain their viewport ownership.
