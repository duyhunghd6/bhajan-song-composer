# PRD to PLAN State Matrix
<!-- beads-id: br-rtm-01 | satisfies: br-prd01 -->

> Source PRD: [`docs/product/PRD.md`](./PRD.md)  
> Source PLAN: [`docs/product/PLAN.md`](./PLAN.md)  
> Generated/updated: 2026-09-13 (recounted against the working tree; Verified requires a test or Playwright spec that exercises the artifact)
> Purpose: calculate PRD-to-PLAN trace coverage and track the implementation state of each child item in `PLAN.md`.

---

## 1. Coverage Rules
<!-- beads-id: br-rtm-01-s01 -->

### 1.1 Trace Coverage
<!-- beads-id: br-rtm-01-s02 -->

A PRD section is counted as **covered by PLAN** when at least one `br-plan-*` metadata tag in `PLAN.md` lists that PRD section in its `satisfies:` field.

```text
trace_coverage_all = covered_prd_sections / total_prd_sections
trace_coverage_actionable = covered_actionable_prd_sections / actionable_prd_sections
```

Current counts from metadata:

| Metric | Formula | Value |
|:---|:---|---:|
| PRD document root coverage | `br-prd01` satisfied by `br-plan-00` | Covered |
| All PRD section coverage | `54 covered / 62 PRD IDs` | **87.1%** |
| Actionable/in-scope PRD coverage | `53 covered / 53 actionable child sections` | **100.0%** |
| Unlinked non-actionable/context sections | `8 unlinked / 62 PRD IDs` | **12.9%** |

The only unlinked sections are context, grouping, exclusion, or reference sections: `br-prd01-s1`, `br-prd01-s5`, `br-prd01-s12`, `br-prd01-s22`, `br-prd01-s23`, `br-prd01-s24`, `br-prd01-s28`, `br-prd01-s56`. The 2026-09 amendments root `br-prd01-s56` is a grouping section; its children `s57`–`s61` are actionable and covered by `br-plan-13`/`br-plan-14`.

### 1.2 Plan Child State Coverage
<!-- beads-id: br-rtm-01-s03 -->

Every bullet item under a `PLAN.md` section is tracked as a child item. A child is counted as complete only when implementation evidence exists.

```text
plan_child_completion = (implemented_children + verified_children) / total_plan_children
plan_child_verification = verified_children / total_plan_children
```

The 2026-09-13 scan of `src/`, `e2e/`, and `scripts/` found implementation files for every original plan area and for the two amendment areas (`br-plan-13` Composer step workflow/Export/Practice, `br-plan-14` Guitar Fingerstyle TimeGrid pipeline). Remaining gaps are test coverage for the piano engine, Flute/Violin/conflict ensemble modules, publication/Practice, and the missing piano POC page.

| Metric | Formula | Value |
|:---|:---|---:|
| Total PLAN child items | `sum(children under br-plan-01..14)` | **74** |
| Planned child items | `1 / 74` | **1.4%** |
| In-progress child items | `1 / 74` | **1.4%** |
| Implemented child items | `23 / 74` | **31.1%** |
| Verified child items | `49 / 74` | **66.2%** |
| Child completion coverage | `(Implemented + Verified) / 74` | **97.3%** |

---

## 2. State Definitions
<!-- beads-id: br-rtm-01-s04 -->

| State | Meaning | Counts as complete? |
|:---|:---|:---:|
| `Planned` | The item exists in `PLAN.md`, but no implementation artifact has been found yet. | No |
| `In Progress` | Work has started and partial files/tasks exist, but acceptance criteria are not satisfied. | No |
| `Implemented` | The required files/features exist and match the PLAN item. | Yes |
| `Verified` | Tests, validation, or manual verification prove the item works. | Yes |
| `Blocked` | The item cannot proceed because a dependency or decision is missing. | No |
| `Deferred` | The item is intentionally postponed while remaining in scope. | No |
| `Out of Scope` | The item is explicitly excluded from the current PRD/PLAN scope. | No |

---

## 3. PRD-to-PLAN Traceability Matrix
<!-- beads-id: br-rtm-01-s05 -->

| PRD ID | PRD area | Section type | Satisfied by PLAN ID(s) | Trace status | Notes |
|:---|:---|:---|:---|:---|:---|
| `br-prd01` | Product Requirements Document | Root | `br-plan-00`, `br-rtm-01` | Covered | PLAN declares whole-document alignment; this RTM tracks the relationship. |
| `br-prd01-s1` | Problem Statement | Context | — | Unlinked | Narrative/context section; not counted as actionable gap. |
| `br-prd01-s2` | Solution | Actionable | `br-plan-01` | Covered | The product direction prioritizes equal Guitar Classic and Piano singer-accompaniment outcomes from validated harmony. |
| `br-prd01-s3` | Three Core Modules | Actionable | `br-plan-02`, `br-plan-03`, `br-plan-04`, `br-plan-05` | Covered | Data, playback, composer, and AI theory module plans trace to the three core modules. |
| `br-prd01-s4` | Song Data Model | Actionable | `br-plan-02` | Covered | Data schema and loader cover the model. |
| `br-prd01-s5` | User Stories | Grouping | — | Unlinked | Parent grouping section; child story groups are covered. |
| `br-prd01-s6` | Playback Module stories | Actionable | `br-plan-03` | Covered | Playback controller, YouTube integration, shared music sheet renderer, and playback wrapper. |
| `br-prd01-s7` | Composer Module stories | Actionable | `br-plan-04` | Covered | Form editor, ABC editor, layer management, edit routing, and song selection. |
| `br-prd01-s8` | AI Theory Assistant Module | Actionable | `br-plan-05` | Covered | Theory engine core covers assistant logic. |
| `br-prd01-s9` | Melody → Full Arrangement use case | Actionable | `br-plan-05` | Covered | Analyzer, harmonizer, arrangers. |
| `br-prd01-s10` | Chord & Voicing Suggestions | Actionable | `br-plan-05` | Covered | Harmonizer and arranger outputs cover suggestions. |
| `br-prd01-s11` | Community & Open Source | Actionable | `br-plan-07` | Covered | QA, validation, and contribution tooling. |
| `br-prd01-s12` | Implementation Decisions | Grouping | — | Unlinked | Parent grouping section; child decisions are covered. |
| `br-prd01-s13` | Architecture | Actionable | `br-plan-01` | Covered | Next.js/TypeScript/SSG setup. |
| `br-prd01-s14` | Data Flow | Actionable | `br-plan-03` | Covered | Playback flow, shared ABC rendering path, and media switching. |
| `br-prd01-s15` | Key Modules | Actionable | `br-plan-02`, `br-plan-03` | Covered | Catalogue and playback/music-sheet modules are directly planned; other key modules are covered by their own plan sections. |
| `br-prd01-s16` | File Organization | Actionable | `br-plan-01` | Covered | Directory structure scaffolding. |
| `br-prd01-s17` | Instrument-Specific Output Detail | Actionable | `br-plan-06` | Covered | Guitar, piano, synchronized highlighting, numbered note markers, and theory UI outputs. |
| `br-prd01-s18` | Testing Decisions | Actionable | `br-plan-07` | Covered | QA section. |
| `br-prd01-s19` | What Makes a Good Test | Actionable | `br-plan-07` | Covered | Testing approach included in QA scope. |
| `br-prd01-s20` | Modules to Test | Actionable | `br-plan-07` | Covered | Unit, E2E, validation pipeline coverage. |
| `br-prd01-s21` | Testing Tools | Actionable | `br-plan-07` | Covered | Vitest, Playwright, validation tooling. |
| `br-prd01-s22` | Out of Scope | Exclusion | — | Intentionally unlinked | Excluded features should not be fulfilled by PLAN. |
| `br-prd01-s23` | Further Notes | Reference grouping | — | Unlinked | Parent reference section; not counted as actionable gap. |
| `br-prd01-s24` | Relationship to Existing `music-theory` Project | Reference | — | Unlinked | Reference/inspiration only; `br-plan-06` still mentions adaptation from `music-theory`. |
| `br-prd01-s25` | Raga-to-Scale Mapping | Actionable | `br-plan-05`, `br-plan-06` | Covered | Foundational theory owns raga mapping; visual/AI UI uses it for suggestions. |
| `br-prd01-s26` | Contribution Model | Actionable | `br-plan-07` | Covered | Validation pipeline and community tools. |
| `br-prd01-s27` | Deployment Strategy | Actionable | `br-plan-01` | Covered | SSG and zero-cost hosting setup. |
| `br-prd01-s28` | Vietnamese Music Terminology Reference | Reference | — | Unlinked | Glossary/reference section; not counted as actionable gap. |
| `br-prd01-s29` | Arrangement Pipeline | Actionable | `br-plan-08` | Covered | Explicit Melody → Harmonization → Accompaniment → Full Track plan. |
| `br-prd01-s30` | Step 1: Harmonization | Actionable | `br-plan-08` | Covered | Key/scale detection, strong-beat analysis, functional harmony, and cadence annotation. |
| `br-prd01-s31` | Step 2: Layer 2 Accompaniment | Actionable | `br-plan-08` | Covered | Guitar Classic and Piano are equal singer-support outputs, sharing approved harmony while retaining instrument-specific bass, comping, voicing, and validation. |
| `br-prd01-s32` | Step 3: Layer 3 Drums & Additional Instruments | Actionable | `br-plan-08` | Covered | Drum/bass lock, frequency ranges, counter-melody placement. |
| `br-prd01-s33` | Multi-Layer Fingerstyle Arrangement Engine | Actionable | `br-plan-10` | Covered | Fingerstyle engine has dedicated plan coverage. |
| `br-prd01-s34` | Fingerstyle Phase 1: Upward Construction | Actionable | `br-plan-10` | Covered | Source layers and upward construction context. |
| `br-prd01-s35` | Fingerstyle Phase 2: Downward Compression | Actionable | `br-plan-10` | Covered | String routing, pruning, weak-beat inner voices, Travis/percussion mapping. |
| `br-prd01-s36` | Fingerstyle Execution Architecture | Actionable | `br-plan-10`, `br-plan-06` | Covered | Fingering metadata, picking profiles, and visual note-marker events. |
| `br-prd01-s37` | Fingerstyle User Stories | Actionable | `br-plan-10` | Covered | User-facing engine outputs, profile toggles, and visual events are planned. |
| `br-prd01-s38` | Fingerstyle Compression Output Contract | Actionable | `br-plan-10`, `br-plan-06` | Covered | Structured intermediate result and visual event stream are planned. |
| `br-prd01-s39` | Piano Accompaniment Generation Engine | Actionable | `br-plan-11` | Covered | Piano engine has dedicated plan coverage. |
| `br-prd01-s40` | Piano Phase 1: Harmonic Framework & Bass Anchoring | Actionable | `br-plan-11` | Covered | Harmonic deduction, C2-C3 bass anchoring, and LIL enforcement. |
| `br-prd01-s41` | Piano Phase 2: Spatial Allocation & Voice Leading | Actionable | `br-plan-11` | Covered | Right-hand guide tones, inversion, and shortest-path voice leading. |
| `br-prd01-s42` | Piano Phase 3: Rhythmic & Stylistic Texturing | Actionable | `br-plan-11` | Covered | Pop/Ballad, Rock/R&B, and Classical/Folk comping profiles. |
| `br-prd01-s43` | Piano Phase 4: Dynamic Counterpoint & Automation | Actionable | `br-plan-11` | Covered | Gap detection, fills, yield behavior, and pedal metadata. |
| `br-prd01-s44` | Piano Execution Architecture | Actionable | `br-plan-11` | Covered | Hand-span, hand-collision, and pedal validation. |
| `br-prd01-s45` | Piano User Stories | Actionable | `br-plan-11` | Covered | User-facing piano generation requirements are planned. |
| `br-prd01-s46` | Piano Accompaniment Output Contract | Actionable | `br-plan-11`, `br-plan-06` | Covered | Structured piano output, playback, and piano-key highlight events. |
| `br-prd01-s47` | Ensemble Expansion Engine | Actionable | `br-plan-12` | Covered | Ensemble expansion has dedicated plan coverage. |
| `br-prd01-s48` | Ensemble Phase 0: Integration Handshake | Actionable | `br-plan-12` | Covered | Density grid, bass map, and melodic gap array. |
| `br-prd01-s49` | Ensemble Phase 1: Rhythmic Interlock | Actionable | `br-plan-12` | Covered | Djembe bass, mid-tone, and slap event generation. |
| `br-prd01-s50` | Ensemble Phase 2: Melodic Support | Actionable | `br-plan-12` | Covered | Flute/Violin altitude, yield modes, breath, and bow automation. |
| `br-prd01-s51` | Ensemble Phase 3: Master Output & Conflict Resolution | Actionable | `br-plan-12` | Covered | Density overload, hierarchy, and double-stop validation. |
| `br-prd01-s52` | Ensemble User Stories | Actionable | `br-plan-12` | Covered | User-facing Djembe/Flute/Violin requirements are planned. |
| `br-prd01-s53` | Ensemble Expansion Output Contract | Actionable | `br-plan-12`, `br-plan-06` | Covered | Structured ensemble output and visual layer activity metadata. |
| `br-prd01-s54` | Mockup / POC Demonstration Gate | Actionable | `br-plan-09` | Covered | Standalone proof-of-concept pages are required before integration. |
| `br-prd01-s55` | Mockup / POC User Stories | Actionable | `br-plan-09` | Covered | Mockup page behavior, sample data, tests, and review-ready status are planned. |
| `br-prd01-s56` | Amendments (2026-09) | Grouping | — | Unlinked | Parent grouping section for the amendment children below. |
| `br-prd01-s57` | A1. Composer step workflow and directed source flow | Actionable | `br-plan-13` | Covered | Step router, harmony workflow, source graph, and preview projection. |
| `br-prd01-s58` | A2. Export and Practice publication | Actionable | `br-plan-13` | Covered | Export step, `publish-arrangement.ts`, Practice viewer. |
| `br-prd01-s59` | A3. Guitar Fingerstyle TimeGrid authority and staged LLM generation | Actionable | `br-plan-14` | Covered | Canonical TimeGrid, staged Server Action, physics, fills, projections, persistence, UI. |
| `br-prd01-s60` | A4. Accompaniment instrument stack | Actionable | `br-plan-13` | Covered | Guitar Classic / Harmonium / Djembe branch with deterministic `V:GuitarSupport`. |
| `br-prd01-s61` | A5. Ensemble is experimental | Actionable | `br-plan-13` | Covered | Plan 13 keeps Ensemble out of the step router, preview graph, and Export. |

---

## 4. PLAN Parent Rollup
<!-- beads-id: br-rtm-01-s06 -->

| PLAN ID | PLAN section | PRD sections satisfied | Child count | Planned | In Progress | Implemented | Verified | Completion |
|:---|:---|:---|---:|---:|---:|---:|---:|---:|
| `br-plan-01` | Project Initialization & Core Architecture | `br-prd01-s2`, `br-prd01-s13`, `br-prd01-s16`, `br-prd01-s27` | 3 | 0 | 0 | 3 | 0 | 100.0% |
| `br-plan-02` | Data Layer & Song Catalogue Module | `br-prd01-s3`, `br-prd01-s4`, `br-prd01-s15` | 3 | 0 | 0 | 0 | 3 | 100.0% |
| `br-plan-03` | Playback Module | `br-prd01-s3`, `br-prd01-s6`, `br-prd01-s14`, `br-prd01-s15` | 4 | 0 | 0 | 1 | 3 | 100.0% |
| `br-plan-04` | Composer Module | `br-prd01-s3`, `br-prd01-s7` | 5 | 0 | 0 | 1 | 4 | 100.0% |
| `br-plan-05` | AI Theory Engine Core | `br-prd01-s3`, `br-prd01-s8`, `br-prd01-s9`, `br-prd01-s10`, `br-prd01-s25` | 4 | 0 | 0 | 1 | 3 | 100.0% |
| `br-plan-08` | Arrangement Pipeline: Melody → Full Track | `br-prd01-s29`, `br-prd01-s30`, `br-prd01-s31`, `br-prd01-s32` | 6 | 0 | 0 | 0 | 6 | 100.0% |
| `br-plan-09` | Workflow Mockup / Proof-of-Concept Demo Pages | `br-prd01-s54`, `br-prd01-s55` | 7 | 0 | 1 | 1 | 5 | 85.7% |
| `br-plan-10` | Multi-Layer Fingerstyle Arrangement Engine | `br-prd01-s33`, `br-prd01-s34`, `br-prd01-s35`, `br-prd01-s36`, `br-prd01-s37`, `br-prd01-s38` | 6 | 0 | 0 | 3 | 3 | 100.0% |
| `br-plan-11` | Piano Accompaniment Generation Engine | `br-prd01-s39`, `br-prd01-s40`, `br-prd01-s41`, `br-prd01-s42`, `br-prd01-s43`, `br-prd01-s44`, `br-prd01-s45`, `br-prd01-s46` | 7 | 1 | 0 | 6 | 0 | 85.7% |
| `br-plan-12` | Ensemble Expansion Engine | `br-prd01-s47`, `br-prd01-s48`, `br-prd01-s49`, `br-prd01-s50`, `br-prd01-s51`, `br-prd01-s52`, `br-prd01-s53` | 7 | 0 | 0 | 4 | 3 | 100.0% |
| `br-plan-06` | Visual Instruments & AI UI | `br-prd01-s17`, `br-prd01-s25`, `br-prd01-s36`, `br-prd01-s38`, `br-prd01-s46`, `br-prd01-s53` | 4 | 0 | 0 | 0 | 4 | 100.0% |
| `br-plan-07` | Quality Assurance, CI & Community Tools | `br-prd01-s11`, `br-prd01-s18`, `br-prd01-s19`, `br-prd01-s20`, `br-prd01-s21`, `br-prd01-s26` | 3 | 0 | 0 | 0 | 3 | 100.0% |
| `br-plan-13` | Composer Step Workflow, Export & Practice | `br-prd01-s57`, `br-prd01-s58`, `br-prd01-s60`, `br-prd01-s61` | 7 | 0 | 0 | 3 | 4 | 100.0% |
| `br-plan-14` | Guitar Fingerstyle TimeGrid Staged Pipeline | `br-prd01-s59` | 8 | 0 | 0 | 0 | 8 | 100.0% |
| **Total** | — | — | **74** | **1** | **1** | **23** | **49** | **97.3%** |

---

## 5. PLAN Child State Matrix
<!-- beads-id: br-rtm-01-s07 -->

| Child ID | Parent PLAN ID | Child item | Primary PRD coverage | State | Implementation evidence / next artifact |
|:---|:---|:---|:---|:---|:---|
| `br-plan-01.c01` | `br-plan-01` | Framework Setup: initialize Next.js App Router project with TypeScript, Tailwind CSS, and SSG structure. | `br-prd01-s2`, `br-prd01-s13`, `br-prd01-s27` | Implemented | `package.json`, `next.config.ts`, `src/app/`. Build currently fails under static export with Server Actions (see ARCHITECTURE.md), so not marked Verified. |
| `br-plan-01.c02` | `br-plan-01` | Directory Structure: scaffold `data/songs/`, `src/app/`, `src/components/`, and `src/lib/`. | `br-prd01-s16` | Implemented | `data/songs/`, `src/app/`, `src/components/`, `src/lib/`. |
| `br-plan-01.c03` | `br-plan-01` | Dependencies: install `abcjs`, `gray-matter`, and `zod`. | `br-prd01-s4`, `br-prd01-s13`, `br-prd01-s14` | Implemented | Dependencies are present in `package.json`. |
| `br-plan-02.c01` | `br-plan-02` | Schema Definition: define TypeScript types and Zod schemas for YAML frontmatter and ABC configurations. | `br-prd01-s4`, `br-prd01-s15`, `br-prd01-s20` | Verified | `src/lib/songs/schema.ts`; `src/lib/songs/__tests__/schema.test.ts`. |
| `br-plan-02.c02` | `br-plan-02` | Song Loader: parse Markdown frontmatter and associated `.abc` files. | `br-prd01-s3`, `br-prd01-s4`, `br-prd01-s15` | Verified | `src/lib/songs/loader.ts`; `src/lib/songs/__tests__/loader.test.ts`, `loader.integration.test.ts`. |
| `br-plan-02.c03` | `br-plan-02` | SSG Pages: build landing, language catalogue, and static song detail routes. | `br-prd01-s3`, `br-prd01-s6`, `br-prd01-s15`, `br-prd01-s27` | Verified | `src/app/page.tsx`, `src/app/[language]/page.tsx`, `src/app/[language]/[slug]/page.tsx`; `e2e/playback.spec.ts` opens `/marathi/namostute`. |
| `br-plan-03.c01` | `br-plan-03` | Playback Controller: unified toggle UI for video types and ABC notation layers. | `br-prd01-s6`, `br-prd01-s14`, `br-prd01-s15` | Verified | `src/components/playback/PlaybackController.tsx`; `e2e/playback.spec.ts`. |
| `br-plan-03.c02` | `br-plan-03` | YouTube Integration: embed YouTube IFrame API with dynamic video URL switching. | `br-prd01-s6`, `br-prd01-s14` | Implemented | `src/components/playback/YouTubePlayer.tsx`; no dedicated test. |
| `br-plan-03.c03` | `br-plan-03` | Reusable Music Sheet Renderer: shared ABCJS SVG/MIDI playback, tempo, loops, note highlighting, render errors, and cursor events. | `br-prd01-s6`, `br-prd01-s14`, `br-prd01-s15`, `br-prd01-s17` | Verified | `src/components/music-sheet/AbcjsPlaybackController.tsx` (+ `abcjs-playback/`); `src/components/music-sheet/__tests__/AbcjsPlaybackController.test.tsx`, `playback.test.ts`, `playback-cursor.test.ts`, `abcjs-playback/__tests__/render-input.test.ts`. |
| `br-plan-03.c04` | `br-plan-03` | Playback Page Wrapper: keep `AbcSheetViewer.tsx` as a thin wrapper around the shared renderer. | `br-prd01-s6`, `br-prd01-s14`, `br-prd01-s15` | Verified | `src/components/playback/AbcSheetViewer.tsx`; `src/components/playback/__tests__/AbcSheetViewer.test.tsx`. |
| `br-plan-04.c01` | `br-plan-04` | Metadata Editor: form inputs bound to YAML frontmatter schema. | `br-prd01-s4`, `br-prd01-s7` | Implemented | `src/components/composer/SongForm.tsx`, `song-form/metadata.ts`; no dedicated test. |
| `br-plan-04.c02` | `br-plan-04` | Interactive Notation Editor: live preview, undo/redo, localStorage caching, and vertical ABC-over-preview layout. | `br-prd01-s7` | Verified | `src/components/composer/AbcEditor.tsx`, `useWorkspaceState.ts`; `e2e/composer.spec.ts`. |
| `br-plan-04.c03` | `br-plan-04` | Layer Management: switch, edit, and layer multiple ABC tracks. | `br-prd01-s7`, `br-prd01-s9`, `br-prd01-s10` | Verified | `src/components/composer/LayerManager.tsx`, `layers/layer-manager-parts.tsx`; `src/components/composer/__tests__/theory-assistant-layer.test.ts`, `e2e/composer.spec.ts`. |
| `br-plan-04.c04` | `br-plan-04` | Workstation Coordinator: load song metadata and layers from `/compose?edit={slug}`. | `br-prd01-s7` | Verified | `src/components/composer/ComposerWorkstation.tsx`; `e2e/composer-selection.spec.ts` opens `/compose?edit=happy-birthday`. |
| `br-plan-04.c05` | `br-plan-04` | Song Edit Selection Page: searchable `/edit` catalogue with key/resource indicators and edit links. | `br-prd01-s7` | Verified | `src/app/edit/page.tsx`, `src/components/composer/SongEditList.tsx`; `e2e/composer-selection.spec.ts`. |
| `br-plan-05.c01` | `br-plan-05` | Foundational Theory: diatonic systems, scales, and raga-to-Western mappings. | `br-prd01-s8`, `br-prd01-s10`, `br-prd01-s25` | Verified | `src/lib/theory/scales.ts`, `chords.ts`; `src/lib/theory/__tests__/theory.test.ts`. |
| `br-plan-05.c02` | `br-plan-05` | Melody Analyzer: parse treble-clef ABC, detect key, identify strong-beat notes. | `br-prd01-s8`, `br-prd01-s9`, `br-prd01-s20` | Verified | `src/lib/theory/melody-analyzer.ts`; `src/lib/theory/__tests__/melody-analyzer.test.ts`. |
| `br-plan-05.c03` | `br-plan-05` | Auto-Harmonizer: align strong-beat melody notes with diatonic triads. | `br-prd01-s8`, `br-prd01-s9`, `br-prd01-s10`, `br-prd01-s20` | Verified | `src/lib/theory/harmonizer.ts`, `harmonization-candidates.ts`; `src/lib/theory/__tests__/harmonizer.test.ts`, `harmonization-candidates.test.ts`. |
| `br-plan-05.c04` | `br-plan-05` | Arrangers: generate piano bass-clef patterns and guitar fingerstyle arrangements. | `br-prd01-s8`, `br-prd01-s9`, `br-prd01-s10`, `br-prd01-s17` | Implemented | `src/lib/theory/piano-arranger.ts`, `fingerstyle-arranger.ts`; `src/lib/theory/__tests__/fingerstyle-arranger.test.ts` covers guitar only — no `piano-arranger` test exists. |
| `br-plan-08.c01` | `br-plan-08` | Pipeline Orchestrator: enforce Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track ordering. | `br-prd01-s29` | Verified | `src/lib/theory/arrangement-pipeline.ts`; `src/lib/theory/__tests__/arrangement-pipeline.test.ts`. |
| `br-plan-08.c02` | `br-plan-08` | Harmonization Stage: identify key/scale, strong beats, diatonic/functional chords, and cadence roles. | `br-prd01-s29`, `br-prd01-s30` | Verified | `src/lib/theory/harmonizer.ts`; `src/lib/theory/__tests__/harmonizer.test.ts`. |
| `br-plan-08.c03` | `br-plan-08` | Accompaniment Stage: generate Layer 2 piano/rhythm-guitar accompaniment with bass extraction, inversions, comping, and voice leading. | `br-prd01-s29`, `br-prd01-s31` | Verified | `src/lib/theory/accompaniment-stage.ts`; `src/lib/theory/__tests__/accompaniment-stage.test.ts`. Shipped Composer uses the Guitar Classic/Harmonium/Djembe stack instead (Amendment A4). |
| `br-plan-08.c04` | `br-plan-08` | Full-Track Expansion Stage: generate drums/additional instruments, bass/kick alignment, ranges, counter-melodies, and fills. | `br-prd01-s29`, `br-prd01-s32` | Verified | `src/lib/theory/full-track-expansion-stage.ts`; `src/lib/theory/__tests__/full-track-expansion-stage.test.ts`. |
| `br-plan-08.c05` | `br-plan-08` | Composer Integration: expose generated stages as editable first-class composition layers. | `br-prd01-s29`, `br-prd01-s31`, `br-prd01-s32` | Verified | `src/lib/theory/arrangement-pipeline.ts`, `src/components/composer/LayerManager.tsx`; `e2e/composer.spec.ts`. |
| `br-plan-08.c06` | `br-plan-08` | Validation & Tests: cover stage ordering, chord selection, voice leading, drum/bass alignment, range metadata, and counter-melody placement. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s29`, `br-prd01-s30`, `br-prd01-s31`, `br-prd01-s32` | Verified | `arrangement-pipeline.test.ts`, `full-track-expansion-stage.test.ts`, `accompaniment-stage.test.ts`, `harmonizer.test.ts`, `e2e/composer.spec.ts`. |
| `br-plan-09.c01` | `br-plan-09` | Mockup Gate: require standalone POC pages before major arrangement workflow integration. | `br-prd01-s54`, `br-prd01-s55` | Verified | `src/app/mockups/page.tsx`; `e2e/mockup-gate.spec.ts`. |
| `br-plan-09.c02` | `br-plan-09` | Arrangement Pipeline POC: demo melody, key/scale, strong beats, chords, accompaniment, full-track decisions, preview, and validation. | `br-prd01-s54`, `br-prd01-s55` | Verified | `src/app/mockups/arrangement-pipeline/page.tsx` (alias `mockups/arrangement/`); `e2e/arrangement-pipeline-mockup.spec.ts`. |
| `br-plan-09.c03` | `br-plan-09` | Fingerstyle Engine POC: demo upward construction, compression, string routing, pruning, playability, fallback, matrix, preview, and events. | `br-prd01-s54`, `br-prd01-s55` | Verified | `src/app/mockups/fingerstyle-engine/page.tsx` (alias `mockups/fingerstyle/`); `e2e/fingerstyle-mockup.spec.ts`. |
| `br-plan-09.c04` | `br-plan-09` | Piano Accompaniment POC: demo comping, bass, LIL, voice leading, gaps, validation, pedal, preview, and key highlights. | `br-prd01-s54`, `br-prd01-s55` | In Progress | `e2e/piano-accompaniment-mockup.spec.ts` targets `/mockups/piano-accompaniment` and the hub links `/mockups/piano`, but no page exists under `src/app/mockups/`. Next artifact (planned, not yet created): src/app/mockups/piano-accompaniment/page.tsx + alias. |
| `br-plan-09.c05` | `br-plan-09` | Ensemble Expansion POC: demo handshake, density grid, bass map, gaps, Djembe, Flute/Violin yield, conflicts, preview. | `br-prd01-s54`, `br-prd01-s55` | Verified | `src/app/mockups/ensemble-expansion/page.tsx` (alias `mockups/ensemble/`); `e2e/ensemble-expansion-mockup.spec.ts`. |
| `br-plan-09.c06` | `br-plan-09` | Integration Handoff Checklist: show visible pass/fail or review-ready status and block integration until behavior is end-to-end. | `br-prd01-s54`, `br-prd01-s55` | Verified | `src/components/mockups/PocHandoffChecklist.tsx`; `e2e/poc-handoff-checklist.spec.ts`. |
| `br-plan-09.c07` | `br-plan-09` | POC Test Coverage: Playwright coverage for sample input, decisions, final artifact, validation/conflict report, and integration-ready status. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s54`, `br-prd01-s55` | Implemented | `e2e/mockup-gate.spec.ts`, `arrangement-pipeline-mockup.spec.ts`, `fingerstyle-mockup.spec.ts`, `ensemble-expansion-mockup.spec.ts`, `poc-handoff-checklist.spec.ts`, `visual-instruments-mockup.spec.ts` exist; `piano-accompaniment-mockup.spec.ts` cannot pass until `c04` ships. |
| `br-plan-10.c01` | `br-plan-10` | Upward Construction Context: build inspectable source layers before guitar reduction. | `br-prd01-s33`, `br-prd01-s34`, `br-prd01-s37`, `br-prd01-s38` | Verified | `src/lib/theory/fingerstyle-arranger.ts`, `fingerstyle-arranger/types.ts` (source layers); `src/lib/theory/__tests__/fingerstyle-arranger.test.ts`. |
| `br-plan-10.c02` | `br-plan-10` | Downward Compression Algorithm: route strings, validate Beat 1 pairings, prune tones, place guide tones, and propose transposition. | `br-prd01-s33`, `br-prd01-s35`, `br-prd01-s37`, `br-prd01-s38` | Implemented | `src/lib/theory/fingerstyle-compressor.ts`; exercised by `e2e/fingerstyle-mockup.spec.ts` via the POC page, no unit test. Superseded for the shipped Composer by the TimeGrid pipeline (`br-plan-14`). |
| `br-plan-10.c03` | `br-plan-10` | Physical Hand Mapping: fretting/picking validation, Strict PIMA, Travis Override, thumb clock, pinch, syncopation, and string slap. | `br-prd01-s36`, `br-prd01-s37`, `br-prd01-s38` | Implemented | `src/lib/theory/guitar-playability.ts`, `picking-profiles.ts`; `guitar-playability` is covered indirectly by `fingerstyle-arranger/__tests__/heuristic-time-slice.test.ts`; `picking-profiles` has no test. |
| `br-plan-10.c04` | `br-plan-10` | Fingerstyle Output Contract: structured source layers, outer voice map, playability, fallbacks, event maps, profiles, artifacts. | `br-prd01-s38` | Verified | `src/lib/theory/fingerstyle-arranger/types.ts`; `src/lib/theory/__tests__/fingerstyle-arranger.test.ts`. |
| `br-plan-10.c05` | `br-plan-10` | Composer and Visual Integration: profile selection, playability inspection, Composer accept flow, fretboard/note-marker playback events. | `br-prd01-s36`, `br-prd01-s37`, `br-prd01-s38` | Verified | `src/components/composer/fingerstyle-integration.ts`, `workspace/GuitarFingerstyleStep.tsx`, `instruments/VirtualGuitarFretboard.tsx`; `src/components/composer/__tests__/fingerstyle-integration.test.ts`, `e2e/composer.spec.ts` (`/compose/hari-bol/guitar-fingerstyle`). |
| `br-plan-10.c06` | `br-plan-10` | Validation & Tests: cover layer ordering, string routing, stretch failures, fallbacks, pruning, Travis events, profiles, and visuals. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s37`, `br-prd01-s38` | Implemented | `fingerstyle-arranger.test.ts`, `guitar-tab-validation.test.ts`, `guitar-string-forcing.test.ts`, `guitar-voicings.test.ts`, `e2e/fingerstyle-mockup.spec.ts`; compressor pruning/transposition and picking-profile events lack direct tests. |
| `br-plan-11.c01` | `br-plan-11` | Harmonic Framework & Bass Anchoring: melody/chord input, cadences, C2-C3 roots/octaves/fifths/1-5-8, and LIL rules. | `br-prd01-s39`, `br-prd01-s40`, `br-prd01-s45`, `br-prd01-s46` | Implemented | `src/lib/theory/piano-accompaniment.ts`, `piano-arranger.ts`; no dedicated `piano-accompaniment` test (`accompaniment-abc.test.ts` only touches it indirectly). |
| `br-plan-11.c02` | `br-plan-11` | Spatial Allocation & Voice Leading: RH guide tones, melody-masking avoidance, common tones, shortest-path inversions. | `br-prd01-s39`, `br-prd01-s41`, `br-prd01-s45`, `br-prd01-s46` | Implemented | `src/lib/theory/piano-accompaniment.ts`; no dedicated test. |
| `br-plan-11.c03` | `br-plan-11` | Rhythmic & Stylistic Texturing: Pop/Ballad, Rock/R&B, and Classical/Folk comping profiles. | `br-prd01-s39`, `br-prd01-s42`, `br-prd01-s45`, `br-prd01-s46` | Implemented | `src/lib/theory/piano-comping-profiles.ts`; referenced by `accompaniment-workflow.test.ts` only. |
| `br-plan-11.c04` | `br-plan-11` | Dynamic Counterpoint & Automation: Melodic Gap Events, fills, yield behavior, and sustain pedal metadata. | `br-prd01-s39`, `br-prd01-s43`, `br-prd01-s45`, `br-prd01-s46` | Implemented | `src/lib/theory/piano-accompaniment/pedal-automation.ts`, gap handling in `piano-accompaniment.ts`; no dedicated test. |
| `br-plan-11.c05` | `br-plan-11` | Piano Physical Validation: major-10th span, rolled articulation, hand collision, range shifting/thinning, synchronized metadata. | `br-prd01-s39`, `br-prd01-s44`, `br-prd01-s45`, `br-prd01-s46` | Implemented | `src/lib/theory/piano-playability.ts`; no test. |
| `br-plan-11.c06` | `br-plan-11` | Piano Output Contract: source analysis, harmonic framework, LH/RH maps, comping, fills, validation, pedal, ABC, highlights. | `br-prd01-s46` | Implemented | `src/lib/theory/piano-accompaniment/types.ts`, `output-contract.ts`; no contract test. |
| `br-plan-11.c07` | `br-plan-11` | Validation & Tests: cover chord mapping, bass anchoring, LIL, guide tones, comping, fills, validation, pedal, playback metadata. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s45`, `br-prd01-s46` | Planned | No `piano-accompaniment`/`piano-playability`/`pedal-automation` test files exist. Next artifact (planned, not yet created): src/lib/theory/__tests__/piano-accompaniment.test.ts. Piano is not an active Composer step (Amendment A4). |
| `br-plan-12.c01` | `br-plan-12` | Integration Handshake: require Layer 1 + Layer 2, then derive density grid, bass map, and Melodic Gap Array. | `br-prd01-s47`, `br-prd01-s48`, `br-prd01-s52`, `br-prd01-s53` | Verified | `src/lib/theory/ensemble-expander.ts`; `src/lib/theory/__tests__/ensemble-expander.test.ts`. |
| `br-plan-12.c02` | `br-plan-12` | Djembe Rhythmic Interlock: bass, mid-tone, slap events, velocities, and transient conflict avoidance. | `br-prd01-s47`, `br-prd01-s49`, `br-prd01-s52`, `br-prd01-s53` | Verified | `src/lib/theory/djembe-arranger.ts`; `src/lib/theory/__tests__/djembe-arranger.test.ts`. |
| `br-plan-12.c03` | `br-plan-12` | Flute and Violin Melodic Support: altitude rules, bed/halo modes, background holds, and Fill Zone counter-melodies. | `br-prd01-s47`, `br-prd01-s50`, `br-prd01-s52`, `br-prd01-s53` | Implemented | `src/lib/theory/orchestral-arranger.ts`; no direct test (consumed by `ensemble-output-contract.ts`). |
| `br-plan-12.c04` | `br-plan-12` | Anatomical and Expression Realism: Flute breath rests, Violin CC 11 swells, delayed vibrato, and double-stop validation. | `br-prd01-s50`, `br-prd01-s51`, `br-prd01-s52`, `br-prd01-s53` | Implemented | `src/lib/theory/orchestral-arranger.ts`, `ensemble-conflicts.ts`; no direct test. |
| `br-plan-12.c05` | `br-plan-12` | Conflict Resolution: scan timeline density, preserve melody, flatten Flute/Violin, remove Djembe fills as needed. | `br-prd01-s47`, `br-prd01-s51`, `br-prd01-s52`, `br-prd01-s53` | Implemented | `src/lib/theory/ensemble-conflicts.ts`; no direct test. |
| `br-plan-12.c06` | `br-plan-12` | Ensemble Output Contract: handshake, event maps, yield decisions, conflict report, ABC layers, playback/MIDI/visual metadata. | `br-prd01-s53` | Verified | `src/lib/theory/ensemble-output-contract.ts`; `src/lib/theory/__tests__/ensemble-output-contract.test.ts`. |
| `br-plan-12.c07` | `br-plan-12` | Validation & Tests: cover ordering, density, bass sync, Fill Zones, Djembe/Flute/Violin rules, hierarchy, playback sync. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s52`, `br-prd01-s53` | Implemented | `ensemble-expander.test.ts`, `djembe-arranger.test.ts`, `ensemble-output-contract.test.ts`, `ensemble-workflow.test.ts`; Flute/Violin and conflict rules lack direct tests. Ensemble is experimental (Amendment A5). |
| `br-plan-06.c01` | `br-plan-06` | Instrument Renderers: SVG guitar fretboard and piano keyboard components. | `br-prd01-s10`, `br-prd01-s17`, `br-prd01-s25` | Verified | `src/components/instruments/GuitarFretboard.tsx`, `PianoKeyboard.tsx`, `VirtualGuitarFretboard.tsx`; `e2e/visual-instruments-mockup.spec.ts`. |
| `br-plan-06.c02` | `br-plan-06` | Synchronized Instrument Highlighting: connect guitar/piano renderers to Music Sheet playback cursor events. | `br-prd01-s17`, `br-prd01-s38`, `br-prd01-s46`, `br-prd01-s53` | Verified | `src/components/playback/AbcSheetViewer.tsx`, `instrument-highlighting.ts`; `src/components/playback/__tests__/instrument-highlighting.test.ts`, `e2e/visual-instruments-mockup.spec.ts`. |
| `br-plan-06.c03` | `br-plan-06` | Numbered Note Markers: reusable blue/yellow fingering markers with guitar target mapping, split-hand piano modes, and pedal sync. | `br-prd01-s17`, `br-prd01-s36`, `br-prd01-s38`, `br-prd01-s46` | Verified | `src/components/instruments/InstrumentNoteMarkers.tsx`, `PianoKeyboard.tsx`, `PianoPedalIndicator.tsx`; `e2e/visual-instruments-mockup.spec.ts` (`note-markers`, `teacher-mode` variants). |
| `br-plan-06.c04` | `br-plan-06` | Theory Assistant UI: constraints side panel and accept generated arrangements into Composer layers. | `br-prd01-s8`, `br-prd01-s10`, `br-prd01-s17`, `br-prd01-s25` | Verified | `src/components/composer/TheoryAssistant.tsx`, `theory-assistant-layer.ts`; `src/components/composer/__tests__/theory-assistant-layer.test.ts`, `e2e/composer.spec.ts`. |
| `br-plan-07.c01` | `br-plan-07` | Unit Testing: configure Vitest and test theory engine plus song loader. | `br-prd01-s18`, `br-prd01-s19`, `br-prd01-s20`, `br-prd01-s21` | Verified | `vitest.config.ts`; suites under `src/lib/**/__tests__/`, `src/components/**/__tests__/`, `src/app/actions/__tests__/`. |
| `br-plan-07.c02` | `br-plan-07` | E2E Testing: setup Playwright for playback toggles and composer workflow scenarios. | `br-prd01-s18`, `br-prd01-s19`, `br-prd01-s20`, `br-prd01-s21` | Verified | `playwright.config.ts`; `e2e/playback.spec.ts`, `composer.spec.ts`, `composer-selection.spec.ts`, `beat-annotations.spec.ts`, mockup specs. |
| `br-plan-07.c03` | `br-plan-07` | Validation Pipeline: validate submitted song YAML schemas and parseable ABC notation. | `br-prd01-s11`, `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s21`, `br-prd01-s26` | Verified | `scripts/validate-songs.mjs` (`npm run validate:songs`), `src/app/api/validate/route.ts`, `src/lib/songs/validation.ts`; `src/lib/songs/__tests__/validation.test.ts`. |
| `br-plan-13.c01` | `br-plan-13` | Step Router: `melody` / `harmony` / `accompaniment` / `guitar-fingerstyle` / `review` as first-class Composer steps with browser-local drafts. | `br-prd01-s57` | Verified | `src/app/compose/[slug]/[step]/page.tsx`, `src/components/composer/ComposerStepWorkspace.tsx`, `composer-steps.ts`, `workspace/storage.ts`, `storage-pruning.ts`; `workspace/__tests__/storage.test.ts`, `e2e/composer.spec.ts`. |
| `br-plan-13.c02` | `br-plan-13` | Harmony Workflow: shared Steps 1–3 and selection of the `voice-leading-validation` source. | `br-prd01-s57` | Verified | `workspace/HarmonyStep.tsx`, `AccompanimentWorkflowWizard.tsx`, `src/lib/theory/accompaniment-workflow.ts`, `accompaniment-workflow/definition.ts`; `src/lib/theory/__tests__/accompaniment-workflow.test.ts`, `accompaniment-workflow-session-transitions.test.ts`, `src/components/composer/__tests__/accompaniment-workflow-state.test.ts`. |
| `br-plan-13.c03` | `br-plan-13` | Accompaniment Branch: ordered Guitar Classic / Harmonium / Djembe stack with checkbox-gated steps and deterministic `V:GuitarSupport`. | `br-prd01-s60` | Verified | `workspace/AccompanimentStep.tsx`, `accompaniment-workflow/WorkflowSetupPanel.tsx`, `src/lib/theory/accompaniment-workflow/guitar-classic-realization.ts`, `guitar-classic-abc.ts`, `support-layers.ts`; `accompaniment-workflow/__tests__/guitar-classic-abc.test.ts`, `guitar-classic-realization.test.ts`, `src/components/composer/__tests__/accompaniment-workflow-wizard-parts.test.ts`, `e2e/composer.spec.ts` (`/compose/hari-bol/accompaniment`). |
| `br-plan-13.c04` | `br-plan-13` | Source Graph & Preview Projection: source-current provenance, export eligibility, preview-only visibility/volume/TAB. | `br-prd01-s57` | Verified | `workspace/arrangement-source/arrangement-source-graph.ts`, `workspace/arrangement-preview-model.ts`, `LayerVisibilityControls.tsx`, `src/lib/theory/abc-layer-visibility.ts`; `workspace/__tests__/arrangement-preview-model.test.ts`, `ComposerPlaybackPreview.test.tsx`, `LayerVisibilityControls.test.tsx`, `src/lib/theory/__tests__/abc-layer-visibility.test.ts`. |
| `br-plan-13.c05` | `br-plan-13` | Export & Publication: explicit layer selection and durable upsert of `<slug>.<type>.abc` + `abcNotations`. | `br-prd01-s58` | Implemented | `workspace/export/ExportStep.tsx`, `src/app/actions/publish-arrangement.ts`, `src/lib/songs/composer-notation.ts`; no test references `publish-arrangement`. |
| `br-plan-13.c06` | `br-plan-13` | Practice Showcase: render published catalogue notation only. | `br-prd01-s58` | Implemented | `src/app/practice/[slug]/page.tsx`, `PracticeViewer.tsx`; no test. |
| `br-plan-13.c07` | `br-plan-13` | Validation & Tests: step routing, stale-source invalidation, storage pruning, preview projection, publication, Practice isolation. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s57`, `br-prd01-s58` | Implemented | Storage, workflow-state, preview-model, and visibility suites exist; publication and Practice isolation have no coverage. |
| `br-plan-14.c01` | `br-plan-14` | Canonical TimeGrid: meter-aware `TimeSliceMeasure[]` with locked source facts and independent physical events. | `br-prd01-s59` | Verified | `src/lib/theory/fingerstyle-arranger/time-slice.ts`, `types.ts`, `fingerstyle-constraints.ts`; `src/lib/theory/__tests__/time-slice.test.ts`, `fingerstyle-arranger/__tests__/melody-time-grid-round-trip.test.ts`, `cross-measure-tie.test.ts`. |
| `br-plan-14.c02` | `br-plan-14` | Staged Server Action: reservation → bass → candidates → freeze → fills → merge with one phase-scoped tool per turn. | `br-prd01-s59` | Verified | `src/app/actions/fingerstyle-line-arranger.ts` + `fingerstyle-line-arranger/`, `ai-config.ts`, `fingerstyle-tool-contract.ts`; `src/app/actions/__tests__/fingerstyle-line-arranger.test.ts`, `ai-config.test.ts`. |
| `br-plan-14.c03` | `br-plan-14` | Deterministic Placement & Physics: foundation placement, melody-only fret exceptions, collision and skill-limit rejection. | `br-prd01-s59` | Verified | `heuristic-time-slice.ts`, `source-playability.ts`, `physics-validation.ts`, `bass-planning.ts`, `fill-reservations.ts`; matching `fingerstyle-arranger/__tests__/*.test.ts` for each module plus `heuristic-abc-parity.test.ts`. |
| `br-plan-14.c04` | `br-plan-14` | Fill Opportunities & Compact Contracts: 0–100 scoring, paginated `fill-opportunities:v1`, `fill-selection:v1`, `fills:v1`, deterministic merge, fills-unavailable fallback. | `br-prd01-s59` | Verified | `fill-opportunities.ts` + `fill-opportunities/`, `llm-codec.ts`; `fingerstyle-arranger/__tests__/fill-opportunities.test.ts`, `llm-codec.test.ts`, `src/app/actions/__tests__/fingerstyle-line-arranger.test.ts`. |
| `br-plan-14.c05` | `br-plan-14` | Derived Projections: forced-string Guitar ABC, ASCII GuitarTab, TOON, and forced-string ABC import. | `br-prd01-s59` | Verified | `time-slice-abc-renderer.ts`, `guitar-abc-output.ts`, `ascii-guitartab-conversion.ts`, `toon-utils.ts`, `abc-timegrid-import.ts`, `src/lib/theory/guitar-string-forcing.ts`; `time-slice-abc-renderer.test.ts`, `ascii-guitartab-conversion.test.ts`, `abc-ascii-guitartab-validation.test.ts`, `toon-utils.test.ts`, `abc-timegrid-import.test.ts`, `guitar-string-forcing.test.ts`. |
| `br-plan-14.c06` | `br-plan-14` | Interchange & Persistence: `timegrid-document:v3` codec, source-fingerprint-bound browser persistence, bounded diagnostics. | `br-prd01-s59` | Verified | `timegrid-document-codec.ts`, `timegrid-document-codec-v3.ts`, `generation-diagnostics.ts`, `diagnostic-plaintext.ts`, `workspace/fingerstyle-measure-persistence.ts`, `fingerstyle-diagnostic-persistence.ts`; `timegrid-document-codec.test.ts`, `workspace/__tests__/fingerstyle-measure-persistence.test.ts`, `fingerstyle-diagnostic-persistence.test.ts`. |
| `br-plan-14.c07` | `br-plan-14` | Composer UI: line-level generation with skill/density settings, generation lock, stale-result guards, TAB preview, copyable diagnostics. | `br-prd01-s59` | Verified | `workspace/GuitarFingerstyleStep.tsx`, `FingerstyleLineCard.tsx`, `fingerstyle-line-measures.ts`, `src/components/composer/fingerstyle-integration.ts`; `workspace/__tests__/FingerstyleLineCard.test.tsx`, `fingerstyle-line-measures.test.ts`, `src/components/composer/__tests__/fingerstyle-integration.test.ts`, `e2e/composer.spec.ts`. |
| `br-plan-14.c08` | `br-plan-14` | Validation & Tests: melody MIDI equality, unique strings, skill limits, pickup/tie/repeat, ABC/ASCII parity, codec round-trips, staged tool order, fallback. | `br-prd01-s18`, `br-prd01-s20`, `br-prd01-s59` | Verified | 17 suites under `src/lib/theory/fingerstyle-arranger/__tests__/` plus the action, persistence, and UI suites listed above. |

---

## 6. Gaps and Follow-ups
<!-- beads-id: br-rtm-01-s08 -->

| Gap / observation | Impact | Recommended follow-up |
|:---|:---|:---|
| All actionable PRD sections, including the 2026-09 amendments, trace to at least one `br-plan-*` element. | Resolved; actionable coverage is **100.0%**. | Keep metadata synchronized whenever PRD or PLAN sections change. |
| `br-prd01-s1`, `s5`, `s12`, `s23`, `s56` are context/grouping sections; `s22` is Out of Scope; `s24`, `s28` are reference-only. | Low; children are covered. | Keep unlinked unless dashboards must count grouping nodes. |
| `br-plan-09.c04`: the piano POC page is missing while its Playwright spec and hub link exist. | Medium; `e2e/piano-accompaniment-mockup.spec.ts` fails and `/mockups/piano` 404s. | Add a page at src/app/mockups/piano-accompaniment/page.tsx (planned) plus a `mockups/piano/` alias, or retire the spec and hub link. |
| `br-plan-11` piano engine modules have no dedicated unit tests. | Medium; behavior is unverified though the code exists and is not on the shipped Composer path. | Add `piano-accompaniment`, `piano-playability`, and `pedal-automation` suites before any Composer integration. |
| `br-plan-12.c03`–`c05` (Flute/Violin support, expression validators, conflict resolution) lack direct tests. | Low while Ensemble stays experimental (Amendment A5). | Cover before promoting Ensemble to a Composer route. |
| `br-plan-13.c05`/`c06`: `publish-arrangement.ts` and `PracticeViewer.tsx` have no tests. | Medium; publication is the only durable seam. | Add a Server Action test for upsert/preserve-body behavior and a Practice isolation test. |
| `br-plan-05.c04`: no `piano-arranger` test despite `ARCHITECTURE.md` historically listing one. | Low. | Add a small suite or fold into the piano engine suite above. |
| `br-plan-10` (compression engine) is superseded on the shipped path by `br-plan-14`. | Informational. | Keep for the POC page; do not extend it for Composer work. |
| Child item IDs are defined in this matrix, not in `PLAN.md` metadata comments. | Medium if automated child-level extraction is required. | Promote children into headings or add parser-supported single-line metadata in `PLAN.md`. |
| `src/lib/docs/__tests__/prd-plan-statematrix.test.ts` pins this file's path and totals. | Must be updated whenever totals change. | Keep the test aligned with the Total row and `br-plan-06` rollup. |
---

## 7. Update Procedure
<!-- beads-id: br-rtm-01-s09 -->

1. Update `docs/product/PRD.md` and/or `docs/product/PLAN.md` with valid single-line Beads ID metadata comments.
2. Re-run the ID extractor/linter on `docs/`.
3. Recalculate:
   - all PRD section coverage,
   - actionable PRD section coverage,
   - PLAN child state counts,
   - parent rollups.
4. Update the child state table with implementation evidence paths and verification notes.
5. Move child items from `Planned` → `In Progress` → `Implemented` → `Verified` only when evidence exists.
