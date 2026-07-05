# Project Instructions

## Model selection

- Force Claude Code model selection to `gpt-5.5` for this project.
- If the model is changed or reset, switch it back with `/model gpt-5.5` before doing substantial project work.
- Do not intentionally downgrade to a smaller model for architecture, music-arrangement, validation, or refactoring tasks.

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

Accompaniment is a human-in-the-loop workflow. Use the small workflow steps defined in `src/lib/theory/accompaniment-workflow/definition.ts`:

1. `melody-snapshot` — confirm source ABC, key/meter metadata, mood, and melody-preservation constraints.
2. `key-scale-cadence` — analyze key, scale/raga context, phrase endings, and cadence targets.
3. `strong-beat-targets` — identify structurally strong melody notes.
4. `chord-tone-mapping` — map strong notes to chord-tone roles, suspensions, or tensions.
5. `chord-progression` — generate chord progression candidates and chord-annotated ABC.
6. `voice-leading-validation` — smooth transitions and validate harmonized ABC.
7. `guitar-comping-profile` — choose guitar comping/picking profile.
8. `guitar-voicing-bass` — plan guitar voicings, bass anchors, and walking motion.
9. `guitar-fills-validation` — validate guitar fills and tablature playability.
10. `piano-comping-bass` — choose piano comping profile and left-hand/bass foundation.
11. `piano-rh-voicing` — plan right-hand guide tones and voice-leading.
12. `piano-fills-pedal-validation` — validate gap fills, sustain pedal automation, and piano playability.

Important accompaniment rules:

- Preserve the melody ABC exactly unless the specific step allows chord annotations.
- For chord ingestion from lyric `w:` lines, treat embedded `[Chord]` symbols as user-supplied progression context.
- Guitar tab validation steps must provide concrete tab events with measure, beat, note, string, fret, and role.
- Piano output should expose pedal automation, key highlights, fingering metadata, and physical validation where available.
- Keep generated ABC previewable with `AbcjsPlaybackController`.

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
