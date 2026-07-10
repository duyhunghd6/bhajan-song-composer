# Project Instructions

## Model selection

- Force Claude Code model selection to `gpt-5.5` for this project.
- If the model is changed or reset, switch it back with `/model gpt-5.5` before doing substantial project work.
- Do not intentionally downgrade to a smaller model for architecture, music-arrangement, validation, or refactoring tasks.

## Development constraints

- **CRITICAL NOTE**: Do not edit files or modules inside `node_modules/*`. If changes are needed, apply them at the application level or discuss package upgrades.

## Project overview

This is a Next.js bhajan song composition app. It supports ABC notation editing/playback, harmonization, accompaniment generation, ensemble expansion, and visual instrument previews.

Keep modules deep and local:

- Public entrypoint files should stay stable for callers.
- Extract implementation details into nearby subdirectories instead of creating broad global helpers.
- Preserve existing public import paths unless a migration is explicitly requested.
- Keep JS/TS/TSX/HTML/CSS files under 500 LoC when practical.

## Directory structure notes

### Composer UI

Composer UI lives in `src/components/composer/`.

- `ComposerStepWorkspace.tsx` is the step router for melody, harmony, accompaniment, ensemble, and review.
- `workspace/` contains step-specific UI modules:
  - `HarmonyStep.tsx`
  - `AccompanimentStep.tsx`
  - `preview.tsx`
- `LayerManager.tsx` is the public layer-stack entrypoint.
- `layers/layer-manager-parts.tsx` contains layer defaults, parsing/combining utilities, and extracted pipeline/fingerstyle panels.
- `AccompanimentWorkflowWizard.tsx` and `EnsembleWorkflowWizard.tsx` are workflow shells.
- `accompaniment-workflow/wizard-parts.tsx` and `ensemble-workflow/wizard-parts.tsx` contain wizard state transitions and option-list UI.
- `SongForm.tsx` is the metadata form shell.
- `song-form/metadata.ts` contains defaults and YAML serialization.
- `song-form/TextField.tsx` contains the shared text field module.

Composer UI owns React state, local persistence, and user interaction. It should delegate music decisions and ABC generation to `src/lib/theory/`.

### Music sheet / ABCJS playback

Music notation playback lives in `src/components/music-sheet/`.

- `AbcjsPlaybackController.tsx` is the public playback entrypoint.
- `abcjs-playback/types.ts` defines local abcjs adapter types and controller props.
- `abcjs-playback/abc-rendering.ts` contains tempo parsing and SVG post-processing for beat indicators, lyrics, and tablature staff spacing.
- `abcjs-playback/AbcjsPlaybackControls.tsx` contains transport, tempo, metadata override, and loop controls.
- `abcjs-playback/AbcjsPlaybackStyles.tsx` contains scoped rendered-sheet styles.

The playback controller is the abcjs adapter seam. Callers pass ABC text and render/synth options; the implementation owns abcjs rendering, synth lifecycle, click-to-play, cursor events, and visual post-processing.

#### Tablature Rendering and String Mapping Rules

ABCJS rendering of guitar tablature requires strict enforcement of string mapping to prevent auto-assignment errors and layout collapse:

- **String Forcing**: Always prepend ABC notes with the `!N!` string decoration (e.g., `!1!b`, `!6!B`) to explicitly assign the note to string `N` (1-6). This instructs ABCJS's `getStringDecoration()` to bypass its default lowest-fret auto-assignment algorithm.
- **Render-time Forcing**: To catch raw LLM outputs or custom ABC that lacks decorations, the playback entrypoint automatically applies the `ensureGuitarStringForcing()` post-processor at render-time, preserving chord symbols (e.g., `"Em"`) and respecting non-Guitar voice isolation.
- **Duplicate Pitches**: Because string forcing bypasses auto-assignment, it is valid to output the same concert pitch on multiple strings simultaneously (e.g., D3 on string 4 and string 5). Do *not* deduplicate identical ABC pitches in tablature chords.
- **Octave Convention**: Always output concert-pitch ABC tokens for the `treble-8` clef. ABCJS internally applies a `clefTranspose = -12` to the note *before* computing the fret against its un-transposed tuning `stringPitches`. Manually shifting octaves up +1 will cause the fret computation to fail.
- **Key Signature Awareness**: Key signatures (like `K:Em` where F is sharped) must be respected on both input and output paths. On the input path (ABC-to-MIDI), bare notes inherit implied accidentals (bare `F` in `K:Em` represents F# / MIDI 66). On the output path (Pitch-to-ABC), if a physical note is natural but the key signature has a sharp/flat on that note letter (e.g., F-natural in `K:Em`), you must output an explicit natural indicator `=` (e.g., `!1!=f`) so ABCJS does not incorrectly apply the key signature and render it as fret 2. Conversely, omit the accidental if the pitch matches the key signature default.
- **Export Portability**: When exporting or copying ABC notation to the clipboard, `cleanAbcForExport()` automatically strips all `!N!` string decorations (which other software would display as confusing fingering numbers) and normalizes `clef=treble-8` to `clef=treble` so that third-party ABC notation viewers render the staff correctly.

### Theory engine

Music theory and arrangement logic lives in `src/lib/theory/`.

- `piano-accompaniment.ts` is the public piano accompaniment entrypoint.
- `piano-accompaniment/types.ts` contains exported piano accompaniment contracts.
- `piano-accompaniment/pedal-automation.ts` handles sustain pedal automation and UI pedal metadata.
- `piano-accompaniment/output-contract.ts` handles key highlights, fingering metadata, and physical hand events.
- `fingerstyle-arranger.ts` is the public fingerstyle arrangement entrypoint.
- `fingerstyle-arranger/types.ts` contains source-layer, playability, artifact, and output-contract types.
- `accompaniment-workflow.ts` is the public accompaniment workflow entrypoint.
- `accompaniment-workflow/definition.ts` contains accompaniment workflow ids, constants, types, and step definitions.
- `accompaniment-workflow/tool-schema.ts` contains structured LLM tool schemas for accompaniment workflow generation.
- `ensemble-workflow.ts` is the public ensemble workflow entrypoint.
- `ensemble-workflow/definition.ts` contains ensemble workflow ids, constants, default generation plan, types, and step definitions.

### Visual mockups

Visual prototypes live in `src/app/mockups/visual-instruments/`.

- `VisualInstrumentsMockupClient.tsx` is the interactive mockup shell.
- `mockup-parts.tsx` contains sample ABC, marker timelines, state panels, event cards, and variant switching.

### URL to Module Mapping

When you are asked to work on specific Composer URLs, refer to these short lists of primary modules to save time:

- `/compose/:slug/melody`:
  - `src/components/composer/ComposerStepWorkspace.tsx` (Step Router)
  - `src/components/composer/AbcEditor.tsx` (Notation Editor)
  - `src/components/music-sheet/AbcjsPlaybackController.tsx` (Playback)
  - `src/components/composer/useWorkspaceState.ts` (State)

- `/compose/:slug/harmony`:
  - `src/components/composer/workspace/HarmonyStep.tsx` (UI)
  - `src/components/composer/workspace/arrangement-preview-model.ts` (Preview State)
  - `src/components/composer/LayerManager.tsx` (Harmony options/layers)
  - `src/components/composer/AccompanimentWorkflowWizard.tsx` (Wizard Controller)

- `/compose/:slug/accompaniment`:
  - `src/components/composer/workspace/AccompanimentStep.tsx` (UI)
  - `src/components/composer/AccompanimentWorkflowWizard.tsx` (Wizard Controller)
  - `src/lib/theory/accompaniment-workflow/definition.ts` (Workflow Rules)
  - `src/app/actions/accompaniment-workflow.ts` (Server Actions)
  - `src/components/composer/accompaniment-workflow/wizard-parts.tsx` (Wizard UI Parts)

- `/compose/:slug/guitar-fingerstyle`:
  - `src/components/composer/workspace/GuitarFingerstyleStep.tsx` (UI)
  - `src/components/composer/workspace/FingerstyleMeasureCard.tsx` (Measure-level UI)
  - `src/lib/theory/fingerstyle-arranger.ts` (Arrangement Logic)
  - `src/components/composer/fingerstyle-integration.ts` (State Integration)
  - `src/app/actions/fingerstyle-arranger.ts` (Server Actions)

- `/compose/:slug/review`:
  - `src/components/composer/ComposerStepWorkspace.tsx` (Review/Export layout fallback)
  - `src/components/composer/workspace/preview.tsx` (Notation Preview Layout)
  - `src/components/music-sheet/AbcjsPlaybackController.tsx` (Final Playback)

## Music arrangement workflow discipline

The music arrangement flow is intentionally stepwise. Do not collapse small steps into one opaque generation unless the user explicitly requests it.

### Composer steps

High-level Composer step order:

1. Melody
2. Harmony
3. Accompaniment
4. Ensemble
5. Review/export

### Harmony step

Harmony work should preserve the source melody unless the task explicitly asks for melody editing.

Expected small decisions:

1. Detect/confirm key, scale/raga context, and meter.
2. Identify strong beat targets and cadence points.
3. Generate multiple harmonization candidates.
4. Let the user select or accept a candidate.
5. Preview the exact ABC that will feed accompaniment.

### Accompaniment workflow small steps

Accompaniment is a human-in-the-loop workflow hosted on the existing single composer URL `/compose/:slug/accompaniment` (for example `/compose/hari-bol/accompaniment`). Do not add a separate route for internal accompaniment substeps unless a later task explicitly requests deep links.

Before small-step generation, capture the setup defined in `src/lib/theory/accompaniment-workflow/definition.ts`:

- Style: `solo-fingerstyle` or `accompaniment`.
- Ordered instrument stack: Guitar Classic, Guitar Acoustic, Piano, Indian Harmonium, Flute, Djembe, Violin.
- Role hints derive from order: bottom/foundation instruments bias bass/drone/transient support; middle instruments bias comping and sustained support; top instruments bias treble fills, breath, halo, sustained strings, or light rhythmic color.
- New workflows default to combined `accompaniment` with all seven instruments enabled; legacy restored sessions without setup normalize to Guitar Classic + Piano combined accompaniment.

Use the small workflow steps defined in `src/lib/theory/accompaniment-workflow/definition.ts`:
2. `key-scale-cadence` — analyze key, scale/raga context, phrase endings, and cadence targets.
3. `strong-beat-targets` — identify structurally strong melody notes.
4. `chord-tone-mapping` — map strong notes to chord-tone roles, suspensions, or tensions.
5. `chord-progression` — generate chord progression candidates and chord-annotated ABC.
6. `voice-leading-validation` — smooth transitions and validate harmonized ABC.
7. `guitar-comping-profile` — choose guitar comping/picking profile.
8. `guitar-voicing-bass` — plan guitar voicings, bass anchors, and walking motion.
9. `guitar-fills-validation` — validate guitar fills and tablature playability.
10. `guitar-fingerstyle` — generate solo guitar fingerstyle that carries the melody, adds chord-derived bass, and plans intro/interlude/outro form sections.
11. `piano-comping-bass` — choose piano comping profile and left-hand/bass foundation.
12. `piano-rh-voicing` — plan right-hand guide tones and voice-leading.
13. `piano-fills-pedal-validation` — validate gap fills, sustain pedal automation, and piano playability.
14. `harmonium-drone-register` — choose devotional harmonium drone tones, register, sustain density, and melody-yield behavior.
15. `harmonium-chord-voicing-validation` — validate harmonium chord voicings, root-fifth anchors, and collision-safe sustained support.
16. `djembe-groove-interlock` — choose Djembe groove profile and interlock Bass/Tone/Slap strokes with accompaniment transients.
17. `djembe-fill-validation` — validate Djembe fill policy, backbeat/slap behavior, and transient conflict limits.
18. `flute-yield-register` — choose Flute role, register, and melody-yield behavior.
19. `flute-breath-fill-validation` — validate Flute breath intervals, playable gap fills, slurs, and rest policy.
20. `violin-bed-register` — choose Violin harmonic bed, counterline, drone-pad strategy, and register relationship.
21. `violin-expression-validation` — validate Violin bow expression, vibrato/swell, double-stop policy, and melody-safe support.

Dynamic step gating:

- Shared steps 1–6 are always enabled.
- `solo-fingerstyle` enables shared steps plus branch steps for exactly the instruments the user enabled in the ordered setup. If Guitar Classic/Acoustic is enabled, use the Guitar Fingerstyle branch; if Djembe, Flute, Violin, Piano, or Harmonium are enabled, use those enabled instrument branches too. Disabled instrument branches must not appear, block completion, or be required before the accompaniment result is applied.
- Combined `accompaniment` enables branch steps only for enabled instruments in the ordered stack.
- The planned step grid must react whenever an instrument checkbox changes, including after a workflow has started: newly checked instruments add their branch steps, unchecked instruments remove their branch steps and must not block completion.
- Guitar Classic and Guitar Acoustic share the Guitar branch initially; setup context decides tone/role and prevents duplicate branch execution.
- Disabled branches must not block `getNextUncompletedWorkflowStepId` or step unlock checks.

Important accompaniment rules:

- Preserve the melody ABC exactly unless the specific step allows chord annotations.
- For chord ingestion from lyric `w:` lines, treat embedded `[Chord]` symbols as user-supplied progression context.
- Guitar tab validation steps must provide concrete tab events with measure, beat, note, string, fret, and role.
- Guitar Fingerstyle must be a solo guitar plan: the Guitar voice carries the melody itself, adds bass from chord progression roots/fifths/approaches, exposes intro/interlude/outro section metadata, and renders GUITAR TAB.
- Piano output should expose pedal automation, key highlights, fingering metadata, and physical validation where available.
- Djembe, Flute, and Violin accompaniment branches may render support ABC layers directly on the accompaniment page once their validation/polish branch step is selected.
- Keep generated ABC previewable with `AbcjsPlaybackController`.
- For multi-instrument ABC, preserve Melody visual line breaks and group by staff system: `[V:Melody]` line N, then each Guitar/Piano/etc. line N for the same measure range, before moving to line N+1.

### Ensemble workflow small steps

Ensemble is Layer 3 expansion over the Layer 1 melody and Layer 2 accompaniment foundation. Use the small workflow steps defined in `src/lib/theory/ensemble-workflow/definition.ts`:

1. `foundation-handshake` — confirm melody, accompaniment foundation, density grid, bass map, and melodic-gap strategy.
2. `djembe-groove-interlock` — choose Djembe groove profile and bass/transient interlock.
3. `djembe-fill-validation` — choose fill policy, backbeat/slap behavior, and transient conflict limits.
4. `flute-yield-register` — choose Flute role, register, and yield behavior while melody is active.
5. `flute-breath-fill-validation` — choose fill density, breath interval, and playable gap fills.
6. `violin-bed-register` — choose Violin harmonic bed/counterline/drone strategy and register relationship.
7. `violin-expression-validation` — choose bow expression, vibrato/swell, double-stop policy, and playability constraints.
8. `final-conflict-review-apply` — review Djembe/Flute/Violin choices, resolve conflicts, and prepare final Layer 3 ABC bundle.

Important ensemble rules:

- Preserve Layer 1 melody first.
- Preserve Layer 2 accompaniment second.
- Use ensemble instruments to support, not overcrowd, the devotional melody.
- Apply conflict resolution in this order: preserve melody, preserve accompaniment foundation, flatten melodic runs, then remove/soften percussion fills.
- Keep Djembe, Flute, and Violin decisions independently reviewable before final apply.
- Final Layer 3 ABC must inherit the same staff-system grouping as accompaniment: Melody line N, Layer 2 line N, then each Djembe/Flute/Violin line N for the same measure range.

## Validation commands

Use these commands after code changes:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Known project notes:

- `npm test` and `npx tsc --noEmit` are the primary regression checks.
- `npm run lint` currently reports on vendored/minified `public/abcjs-basic-min.js` unless lint config excludes it.
- `npm run build` currently fails when static export is enabled with Server Actions; do not treat that as a refactor regression unless the build config also changes.

## Documentation

- Keep `ARCHITECTURE.md` aligned when moving modules or changing seams.
- If workflow step ids, arrangement rules, or public entrypoints change, update this file and `ARCHITECTURE.md` together.
