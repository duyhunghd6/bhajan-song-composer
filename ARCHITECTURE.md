# Architecture

This project is a Next.js bhajan song composition app. The codebase is organized around a few deep modules: Composer UI, music-sheet playback, theory engines, workflow orchestration, and visual mockups.

## Application areas

### Composer UI

Composer screens live under `src/components/composer/`.

- `ComposerStepWorkspace.tsx` is the step router for melody, harmony, accompaniment, ensemble, and review flows.
- `workspace/` contains step-specific modules:
  - `HarmonyStep.tsx` handles harmonization selection and preview.
  - `AccompanimentStep.tsx` handles accompaniment workflow review, setup persistence, layer visibility, and instrument previews.
  - `arrangement-preview-model.ts` derives harmony and accompaniment preview models from workspace state, workflow state, ABC builders, and layer visibility.
  - `fingerstyle-measure-persistence.ts` versions source-bound TimeGrid overlays, safely rejects malformed/stale/physically invalid browser drafts, restores only compatible tablature events, and rebuilds canonical forced Guitar ABC after hydration.
  - `fingerstyle-diagnostic-persistence.ts` retains bounded, source-fingerprint-compatible LLM/TimeGrid workflow diagnostic summaries; it removes LLM payload previews and enforces per-line, per-song, plaintext, event, and storage limits.
  - `GuitarFingerstyleStep.tsx` owns the canonical in-memory TimeGrid document, persists independent player-skill/fill-density settings, imports/exports validated `timegrid-document:v3` JSON, passes previous/next-line measure context, and owns the route-level single-line generation/stale-result lock.
  - `FingerstyleLineCard.tsx` invokes staged line generation, restores compact fill-run summaries, presents the dependency-free plaintext LLM/TimeGrid workflow diagnostic summary through the existing copyable diagnostic terminal, and renders canonical TimeGrid state without treating TOON as an editable authority.
  - `preview.tsx` contains shared preview layout, render options, and harmonization display helpers.
- `LayerManager.tsx` remains the public layer-stack entrypoint.
- `layers/layer-manager-parts.tsx` contains layer stack defaults, layer parsing/combining utilities, and the extracted pipeline/fingerstyle panels.
- `AccompanimentWorkflowWizard.tsx` and `EnsembleWorkflowWizard.tsx` are workflow shells.
- `accompaniment-workflow/WorkflowSetupPanel.tsx` contains the setup UI for accompaniment style, ordered instrument stack, native drag/drop, and accessible up/down reordering.
- `accompaniment-workflow/wizard-parts.tsx` contains accompaniment wizard presentation helpers and option-list UI.
- `ensemble-workflow/wizard-parts.tsx` contains reusable ensemble wizard state transitions and option-list UI.
- `SongForm.tsx` is the metadata form shell.
- `song-form/metadata.ts` contains metadata defaults and YAML serialization.
- `song-form/TextField.tsx` contains the shared text field module.

The Composer UI owns React state, persistence hooks, and user interaction. It delegates music decisions and ABC construction to theory modules.

The accompaniment workflow is intentionally a single-page wizard under the existing dynamic route `/compose/[slug]/[step]`; `/compose/hari-bol/accompaniment` is handled by `step=accompaniment`, not by a dedicated route folder. Internal accompaniment substeps live in persisted workflow state rather than route segments.

### Music sheet / ABCJS playback

Music notation playback lives under `src/components/music-sheet/`.

- `AbcjsPlaybackController.tsx` is the public playback controller entrypoint.
- `abcjs-playback/types.ts` defines the local abcjs adapter types and controller props.
- `abcjs-playback/abc-rendering.ts` contains tempo parsing and SVG post-processing for beat indicators, lyrics, and tablature staff spacing.
- `abcjs-playback/render-input.ts` resolves the exact ABC sent to abcjs, including render-only Guitar forcing, abcjs single-note decoration adaptation, and key/meter/name overrides.
- `abcjs-playback/AbcjsPlaybackControls.tsx` contains transport, metadata override, tempo, and loop-range controls.
- `abcjs-playback/AbcjsPlaybackStyles.tsx` contains the scoped styles applied to rendered abcjs output.

The playback module is intentionally a client-side adapter around abcjs. Callers pass ABC text and optional render/synth settings; the implementation owns abcjs rendering, synth lifecycle, click-to-play, cursor events, and visual post-processing.

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
- `accompaniment-workflow.ts` remains the public accompaniment workflow interface. It owns setup normalization, legacy setup fallback, ordered-instrument role hints, and enabled-step planning. Solo/Fingerstyle and combined Accompaniment planning both enable branch steps only for checked instrument scopes in stack order; active sessions can be re-planned from setup checkbox changes so disabled instruments do not appear or block completion.
- `accompaniment-workflow/definition.ts` contains workflow ids, setup types, instrument branch scopes, constants, and step definitions for shared, Guitar, Piano, Harmonium, Djembe, Flute, and Violin branches.
- `accompaniment-workflow/session-transitions.ts` contains pure workflow session transitions for merging generated runs, selecting options, skipping branch steps, extracting profile hints, and detecting existing step results.
- `accompaniment-workflow/support-layers.ts` adapts completed Djembe, Flute, and Violin accompaniment workflow decisions into playable ABC support layers for the accompaniment page preview, including solo non-guitar support workflows whose enabled branch is one of those instruments.
- `accompaniment-workflow/tool-schema.ts` contains structured LLM tool schemas for accompaniment workflow generation.
- `ensemble-workflow.ts` remains the public ensemble workflow interface.
- `ensemble-workflow/definition.ts` contains ensemble workflow ids, types, default generation plan, and step definitions.

Compatibility entrypoints were preserved so existing callers can continue importing from `@/lib/theory/piano-accompaniment`, `@/lib/theory/fingerstyle-arranger`, `@/lib/theory/accompaniment-workflow`, and `@/lib/theory/ensemble-workflow`.

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

Theory tests are split by module under `src/lib/theory/__tests__/`:

- `accompaniment-stage.test.ts`
- `piano-accompaniment.test.ts`
- `piano-arranger.test.ts`
- `fingerstyle-arranger.test.ts`
- `arranger-fixtures.ts` for shared ABC fixtures

The original `arrangers.test.ts` remains as a skipped pointer so test discovery stays explicit while the real suites live in smaller files.

Recommended validation commands:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Current project note: focused fingerstyle suites and TypeScript checks pass. The repository-wide song-library test currently fails because `jago-kundalini-ma.melody.abc` is header-only. `npm run lint` may report the vendored `public/abcjs-basic-min.js` file, and `npm run build` can fail because the app uses Server Actions with static export.

## File-size and locality guidelines

- Keep public entrypoint files thin where possible.
- Put exported contracts in `types.ts` when a domain has many shared types.
- Prefer local subdirectories for implementation details before introducing global shared modules.
- Extract a module when it gives locality: future changes should happen in one place rather than across many callers.
- Avoid shallow pass-through modules that merely rename a function without hiding implementation complexity.
- Preserve compatibility import paths during structural refactors unless a migration is intentional.
