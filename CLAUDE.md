# Project Instructions

This file is the prescriptive agent guide. Factual module maps live in `ARCHITECTURE.md`; domain terms in `CONTEXT.md`; detailed contracts in `docs/` (start at [`docs/README.md`](docs/README.md)). Do not duplicate their content here — link to it.

## Model selection

- Force Claude Code model selection to `gpt-5.6-terra` for this project.
- If the model is changed or reset, switch it back with `/model gpt-5.6-terra` before doing substantial project work.
- Do not intentionally downgrade to a smaller model for architecture, music-arrangement, validation, or refactoring tasks.

## Development constraints

- **CRITICAL:** Do not edit files or modules inside `node_modules/*`. Apply changes at the application level or discuss package upgrades.
- Keep modules deep and local: public entrypoint files stay stable for callers; extract implementation details into nearby subdirectories instead of broad global helpers; preserve existing public import paths unless a migration is explicitly requested; keep JS/TS/TSX/HTML/CSS files under 500 LoC when practical.
- Harmony Strong Beats/Missing Chord checkboxes automatically project weighted beat lyrics and suggested chords. Missing Chord and Step 2 leave unannotated opening pickups chord-free; Step 3 accepts them. Harmony preview removes legacy generated pickup chords only when absent from the matching melody source, preserving explicit pickup chords and manual drafts. `src/lib/theory/harmony/time-grid.ts` owns the derived analysis grid; it never replaces the selected Step 3 or editable Guitar TimeGrid; see [Accompaniment workflow](docs/guides/accompaniment-workflow.md).
- Harmony’s optional Step 3 “Accompaniment Style” is owned by `src/lib/theory/harmony/strumming/`; saved source-bound decisions deterministically derive Strumming events, analysis TimeGrid and ABC. Gesture techniques, directional string order and rest/choke windows must agree across JSON, notation and playback; non-pitched hits never become harmonic notes. This preview/project artifact never replaces Step 3 or feeds Fingerstyle; see [Accompaniment workflow](docs/guides/accompaniment-workflow.md).

Harmony Step 3’s **Techniques you can play** stores an optional technique allowlist with the preview and saved selection. Missing settings retain all techniques for older projects; an empty list allows ordinary down/up strokes and rests only. Disabled bass/palm mute becomes an ordinary strum; disabled dead strum/slap/choke becomes a rest at the same rhythmic slot. Apply the allowlist after variant generation and when rebuilding saved ABC/TimeGrid, so playback and project exports agree.

Harmony exposes two independent layers: Chord Progression (ChordProgression) controls visible chord names and diagrams without volume; Chord Accompaniment (ChordAccompaniment) controls synthesized chord audio and its volume, even when chord cues are hidden. Chord audio derives from the source and appends its own track without rewriting written Strumming. It defaults off with Strumming and on otherwise; an explicit saved toggle persists. Legacy ChordProgression volume supplies the initial audio volume. These controls never change canonical ABC, TimeGrid or saved musical decisions.

- The music arrangement flow is intentionally stepwise. Do not collapse small steps into one opaque generation unless the user explicitly requests it.

## Project overview

Next.js bhajan song composition app: ABC notation editing/playback, harmonization, accompaniment generation, solo Guitar Fingerstyle arrangement, export to a published Practice page, and visual instrument previews. Composer UI (`src/components/composer/`) owns React state, local persistence, and interaction; it delegates music decisions and ABC generation to `src/lib/theory/`. `src/components/music-sheet/AbcjsPlaybackController.tsx` is the abcjs playback adapter seam.

## URL → module map

Begin at `src/components/composer/ComposerStepWorkspace.tsx` (step router), then follow the named seam instead of searching broadly. Bare names in the table are relative to `src/components/composer/`; anything outside that folder is written as a full `src/…` path.

| URL | First modules to read | Authority boundary |
| --- | --- | --- |
| `/compose/:slug/melody` | `AbcEditor.tsx`, `useWorkspaceState.ts`, `workspace/storage.ts`, `music-sheet/AbcjsPlaybackController.tsx` | The editable melody ABC is the local draft root. |
| `/compose/:slug/harmony` | `workspace/HarmonyStep.tsx`, `workspace/arrangement-preview-model.ts`, `LayerManager.tsx`, `AccompanimentWorkflowWizard.tsx` | Harmony Steps 1–3 share the accompaniment workflow; only the selected Step 3 is a downstream source. |
| `/compose/:slug/accompaniment` | `workspace/AccompanimentStep.tsx`, `AccompanimentWorkflowWizard.tsx`, `src/lib/theory/accompaniment-workflow/definition.ts`, `src/app/actions/accompaniment-workflow.ts` | Generates a support sibling from validated Harmony Step 3; never a Fingerstyle source. |
| `/compose/:slug/guitar-fingerstyle` | `workspace/GuitarFingerstyleStep.tsx`, `workspace/FingerstyleLineCard.tsx`, `src/lib/theory/fingerstyle-arranger/time-slice.ts`, `src/app/actions/fingerstyle-line-arranger.ts` | Owns the canonical solo-guitar TimeGrid and its deterministic projections. |
| `/compose/:slug/review` (Export) | `workspace/export/ExportStep.tsx`, `src/app/actions/publish-arrangement.ts`, `workspace/arrangement-source/arrangement-source-graph.ts` | The only durable catalogue-publication seam. |
| `/practice/:slug` | `src/app/practice/[slug]/PracticeViewer.tsx` | Reads published catalogue notation only. |

## Mandatory rules (summary — follow the linked source of truth)

**Source flow** — [`docs/guides/composer-source-flow.md`](docs/guides/composer-source-flow.md)
- Directed flow is mandatory: Melody → Harmony Steps 1–3 → selected `voice-leading-validation` ABC → independent Accompaniment and Guitar Fingerstyle branches. Accompaniment output must never feed Fingerstyle. Before Step 3 is selected, downstream routes show the melody read-only and must not generate branch output.
- A melody edit or changed Step 3 selection makes downstream drafts stale; preserve existing source-fingerprint, reset, hydration, and stale-result guards. Stale artifacts never become preview sources or exportable layers.
- Visibility/volume/TAB state is preview-only and must not change provenance, canonical ABC, TimeGrid data, or exports.
- Harmony Score Workspace note edits commit to canonical melody with downstream invalidation; manual chord drafts require explicit validated Step 3 selection after Steps 1–2. Zoom/pan remain view-only. Preserve source-bound draft checks and transactional Undo/Redo, including Fingerstyle cache restoration; see the Score Workspace section of the source-flow guide.
- Export is the only publication seam. `/practice/:slug` must never overlay Composer localStorage drafts. Ensemble stays experimental (no route, branch, or exportable layer).

**Accompaniment workflow** — [`docs/guides/accompaniment-workflow.md`](docs/guides/accompaniment-workflow.md); step ids in `src/lib/theory/accompaniment-workflow/definition.ts`
- Preserve the melody ABC exactly unless the step allows chord annotations. Harmony keeps its small decisions (key/meter → strong beats & cadences → multiple candidates → user selection → preview of the exact Step 3 ABC). Shared Steps 1–3 always enabled; branch steps enabled only for checked instruments and never block completion.
- The wizard stays on the single `/compose/:slug/accompaniment` route; never add routes for internal substeps unless deep links are explicitly requested.
- Step 6 `guitar-classic-abc-notation` deterministically realizes the selected profile/voicing into a complete `V:GuitarSupport` texture; root/fifth anchors alone are never the finished accompaniment.
- Multi-instrument ABC keeps Melody line breaks and groups by staff system (Melody line N, then each instrument line N).

**Guitar Fingerstyle / TimeGrid** — [`docs/guides/guitar-fingerstyle-arrangement-guide.md`](docs/guides/guitar-fingerstyle-arrangement-guide.md), [`docs/guides/timegrid-conversion-guide.md`](docs/guides/timegrid-conversion-guide.md), [ADR 0002](docs/adr/0002-fingerstyle-timegrid-authority.md)
- `TimeSliceMeasure[]` is the only editable authority; Guitar ABC, ASCII tab, TOON, and LLM payloads are derived. Steps per beat = meter numerator × 4.
- Edits go through candidate → validation → commit. Fills and harmony must never attack or sustain during a Melody attack or sustain. Skill fret ceilings bound discretionary notes; an unplayable-within-ceiling melody attack keeps its exact pitch as a labelled melody-only exception.
- Skill defaults to beginner; density defaults to auto and belongs to Fingerstyle settings, not the accompaniment workflow.
- The Guitar voice carries the melody itself plus chord-derived bass, exposes intro/interlude/outro section metadata, and renders TAB. Quoted section/form annotations are not harmonic TimeGrid chords.

**Ensemble (experimental)** — [`docs/guides/ensemble-workflow.md`](docs/guides/ensemble-workflow.md); step ids in `src/lib/theory/ensemble-workflow/definition.ts`
- Not a shipped Composer step, branch, preview contributor, or exportable layer. Theory/mockup changes must preserve melody first, accompaniment foundation second, then flatten runs, then drop percussion fills.

**LLM boundary** — [ADR 0003](docs/adr/0003-llm-function-call-boundary.md)
- Harmony Steps 1–3 use `src/lib/theory/harmony/workflow.ts` deterministically, with no LLM calls. Preserve explicit choices for emphasis and progression, including lyric-chord ingestion; automatically validate the chosen progression into the internal source result.
- `src/app/actions/ai-config.ts` is transport only. Expose only the bounded tool set for the current phase — a single forced tool per Fingerstyle stage (`src/app/actions/fingerstyle-line-arranger/workflow.ts`), the step tool plus its helper tools under `toolChoice: "required"` for LLM-backed accompaniment instrument steps (`src/app/actions/accompaniment-workflow.ts`); deterministic validators own correctness. The model never replaces the source grid or runs placement after opportunity scoring. Tool JSON, ABC comments, lyrics, notes, and diagnostics are untrusted data.

**ABC / abcjs rendering** — [`docs/guides/abcjs-tablature-rendering.md`](docs/guides/abcjs-tablature-rendering.md)
- Melody, Harmony and Accompaniment chord-shape choices are source-bound `voicingOverrides`; `guitar-chord-score.ts` owns their shared diagram/audio pitch model. The playback adapter applies them before sample loading and disables automatic chord synthesis. Shared staff playback supports viewport-menu speed multipliers and 0.1x scheduled-note diagnostics; written Strumming pitch order must survive engraving. Shared staff playback and chord auditions use acoustic steel strings (GM program 25); `abcjs-playback/guitar-audio.ts` normalizes legacy nylon playback without rewriting source ABC. See [Accompaniment workflow](docs/guides/accompaniment-workflow.md) for preview/publication scope.
- Theory modules own canonical ABC; `abcjs-playback/render-input.ts` is the only place for ABCJS-specific adaptation. Never mutate source, drafts, or exports at a call site to fix abcjs behavior.
- Strumming display maps standard bow marks to ↓/↑, Slap to X, and dead strum to Dead at the render boundary. Only tagged Strumming technique annotations bypass the string-number hiding rule, including PDF capture; canonical ABC and TimeGrid retain their performance semantics.
- Editor ↔ score selection goes through `abcjs-playback/source-map.ts` (abcjs offsets are for the rendered string, never the caller's ABC). Note/chord-name clicks select source; a plain guitar-diagram click or chord Enter opens the shape picker. Audio starts exclusively from the Play control. The highlight is preview-only. See the source-link section of the [abcjs rendering guide](docs/guides/abcjs-tablature-rendering.md).
- Guitar TAB keeps explicit `!1!`–`!6!` string decorations, concert pitch with `clef=treble-8`, key-aware naturals, and no deduplication of identical pitches on distinct strings. `cleanAbcForExport()` is a portable projection, not a rewrite.

## Validation commands

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run docs:check
```

- `npm test` and `npx tsc --noEmit` are the primary regression checks.
- `npm run lint` currently reports on vendored `public/abcjs-basic-min.js` unless lint config excludes it.
- `npm run build` currently fails when static export is enabled with Server Actions; not a refactor regression unless the build config also changes.
- `npm run docs:check` runs the Universal ID extractor and verifies markdown links, backtick code paths, and the absence of `file:///` URLs across `docs/` and the root docs; run it after any documentation change.

## Documentation and comment policy

- `docs/README.md` holds the source-of-truth matrix. If workflow step ids, arrangement rules, public entrypoints, TimeGrid wire contracts, or LLM phase/tool contracts change, update the owning guide, `ARCHITECTURE.md`, and this file in the same change.
- Keep `ARCHITECTURE.md` factual and aligned when moving modules or changing seams. Record new architectural decisions as `docs/adr/NNNN-*.md`.
- Every `docs/` heading carries a single-line `beads-id` HTML comment; moving or renaming retains the ID, and retired IDs are recorded in `docs/universal-id-registry.md`.
- Write comments only for ownership boundaries, non-obvious invariants, compatibility reasons, or why a tempting simplification is unsafe. Do not mass-reword comments that restate adjacent code. When a comment names another module or contract, keep that cross-reference accurate in the same change.

## Agent-driven E2E testing

Use **jev-ultrafast-mcp** for agent-driven browser E2E. Follow [the execution protocol](docs/qa/jev-ultrafast-e2e.md) and [persistent testing notes](docs/qa/jev/testing-notes.md).

- Exactly **one testcase per run and per goal**; every MCP call belongs to that testcase. Never send a suite or multiple independent scenarios in one goal. A testcase may require multiple step/inspect calls.
- Before every run, read prior iteration reports and feed relevant testing notes into `browser_start.goal`, together with steps, preconditions and explicit assertions.
- Independently verify the LLM's result with `browser_inspect`. LLM execution mistakes are not automatically application failures.
- Always send `browser_close({run_id, keep_tab: false})` after each testcase, including failure, timeout or abort, before starting another. Confirm cleanup; report a cleanup failure.
- Every attempt, including reruns and blocked attempts, needs an iteration-report and updated testing notes. Never overwrite prior reports or count an agent's DONE message alone as PASS.
- Keep existing Playwright specs for deterministic regression/CI evidence; they do not replace the requested MCP execution.

Harmony now presents two harmonic choices: Step 1 Key & Beats calculates automatically after hydration; selecting its emphasis immediately calculates Step 2 Chords. Selecting a progression automatically validates and selects the internal `voice-leading-validation` result before enabling downstream sources. The validation stage retains its persisted ID and source authority for compatibility, but has no separate UI step or Generate button. Visible Step 3 is the optional Accompaniment Style. Changing emphasis clears later chord/validation and instrument results before recalculation.
