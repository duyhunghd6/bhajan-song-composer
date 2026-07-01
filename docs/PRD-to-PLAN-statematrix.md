# PRD to PLAN State Matrix

<!-- beads-id: doc-rtm | satisfies: prd-bsc -->

> Source PRD: [`docs/PRD.md`](./PRD.md)  
> Source PLAN: [`docs/PLAN.md`](./PLAN.md)  
> Generated/updated: 2026-07-01
> Purpose: calculate PRD-to-PLAN trace coverage and track the implementation state of each child item in `PLAN.md`.

---

## 1. Coverage Rules

### 1.1 Trace Coverage

A PRD section is counted as **covered by PLAN** when at least one `br-plan-*` metadata tag in `PLAN.md` lists that PRD section in its `satisfies:` field.

```text
trace_coverage_all = covered_prd_sections / total_prd_sections
trace_coverage_actionable = covered_actionable_prd_sections / actionable_prd_sections
```

Current counts from metadata:

| Metric | Formula | Value |
|:---|:---|---:|
| PRD document root coverage | `prd-bsc` satisfied by `br-plan` | Covered |
| All PRD section coverage | `49 covered / 56 PRD IDs` | **87.5%** |
| Actionable/in-scope PRD coverage | `48 covered / 48 actionable child sections` | **100.0%** |
| Unlinked non-actionable/context sections | `7 unlinked / 56 PRD IDs` | **12.5%** |

The only unlinked sections are context, grouping, exclusion, or reference sections: `prd-bsc-s1`, `prd-bsc-s5`, `prd-bsc-s12`, `prd-bsc-s22`, `prd-bsc-s23`, `prd-bsc-s24`, `prd-bsc-s28`.

### 1.2 Plan Child State Coverage

Every bullet item under a `PLAN.md` section is tracked as a child item. A child is counted as complete only when implementation evidence exists.

```text
plan_child_completion = (implemented_children + verified_children) / total_plan_children
plan_child_verification = verified_children / total_plan_children
```

Current implementation evidence scan found implementation files for the initial catalogue, playback, composer, theory, instrument, testing, validation work, the standalone mockup gate, and the ensemble expansion output contract. Newly planned advanced arrangement engines and remaining mockup POC pages remain Planned or In Progress until implementation artifacts exist.

| Metric | Formula | Value |
|:---|:---|---:|
| Total PLAN child items | `sum(children under br-plan-01..12)` | **59** |
| Planned child items | `27 / 59` | **45.8%** |
| In-progress child items | `8 / 59` | **13.6%** |
| Implemented child items | `24 / 59` | **40.7%** |
| Verified child items | `0 / 59` | **0.0%** |
| Child completion coverage | `(Implemented + Verified) / 59` | **40.7%** |

---

## 2. State Definitions

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

| PRD ID | PRD area | Section type | Satisfied by PLAN ID(s) | Trace status | Notes |
|:---|:---|:---|:---|:---|:---|
| `prd-bsc` | Product Requirements Document | Root | `br-plan`, `doc-rtm` | Covered | PLAN declares whole-document alignment; this RTM tracks the relationship. |
| `prd-bsc-s1` | Problem Statement | Context | — | Unlinked | Narrative/context section; not counted as actionable gap. |
| `prd-bsc-s2` | Solution | Actionable | `br-plan-01` | Covered | Project architecture and initialization support the solution. |
| `prd-bsc-s3` | Three Core Modules | Actionable | `br-plan-02`, `br-plan-03`, `br-plan-04`, `br-plan-05` | Covered | Data, playback, composer, and AI theory module plans trace to the three core modules. |
| `prd-bsc-s4` | Song Data Model | Actionable | `br-plan-02` | Covered | Data schema and loader cover the model. |
| `prd-bsc-s5` | User Stories | Grouping | — | Unlinked | Parent grouping section; child story groups are covered. |
| `prd-bsc-s6` | Playback Module stories | Actionable | `br-plan-03` | Covered | Playback controller, YouTube integration, shared music sheet renderer, and playback wrapper. |
| `prd-bsc-s7` | Composer Module stories | Actionable | `br-plan-04` | Covered | Form editor, ABC editor, layer management, edit routing, and song selection. |
| `prd-bsc-s8` | AI Theory Assistant Module | Actionable | `br-plan-05` | Covered | Theory engine core covers assistant logic. |
| `prd-bsc-s9` | Melody → Full Arrangement use case | Actionable | `br-plan-05` | Covered | Analyzer, harmonizer, arrangers. |
| `prd-bsc-s10` | Chord & Voicing Suggestions | Actionable | `br-plan-05` | Covered | Harmonizer and arranger outputs cover suggestions. |
| `prd-bsc-s11` | Community & Open Source | Actionable | `br-plan-07` | Covered | QA, validation, and contribution tooling. |
| `prd-bsc-s12` | Implementation Decisions | Grouping | — | Unlinked | Parent grouping section; child decisions are covered. |
| `prd-bsc-s13` | Architecture | Actionable | `br-plan-01` | Covered | Next.js/TypeScript/SSG setup. |
| `prd-bsc-s14` | Data Flow | Actionable | `br-plan-03` | Covered | Playback flow, shared ABC rendering path, and media switching. |
| `prd-bsc-s15` | Key Modules | Actionable | `br-plan-02`, `br-plan-03` | Covered | Catalogue and playback/music-sheet modules are directly planned; other key modules are covered by their own plan sections. |
| `prd-bsc-s16` | File Organization | Actionable | `br-plan-01` | Covered | Directory structure scaffolding. |
| `prd-bsc-s17` | Instrument-Specific Output Detail | Actionable | `br-plan-06` | Covered | Guitar, piano, synchronized highlighting, hand overlay, and theory UI outputs. |
| `prd-bsc-s18` | Testing Decisions | Actionable | `br-plan-07` | Covered | QA section. |
| `prd-bsc-s19` | What Makes a Good Test | Actionable | `br-plan-07` | Covered | Testing approach included in QA scope. |
| `prd-bsc-s20` | Modules to Test | Actionable | `br-plan-07` | Covered | Unit, E2E, validation pipeline coverage. |
| `prd-bsc-s21` | Testing Tools | Actionable | `br-plan-07` | Covered | Vitest, Playwright, validation tooling. |
| `prd-bsc-s22` | Out of Scope | Exclusion | — | Intentionally unlinked | Excluded features should not be fulfilled by PLAN. |
| `prd-bsc-s23` | Further Notes | Reference grouping | — | Unlinked | Parent reference section; not counted as actionable gap. |
| `prd-bsc-s24` | Relationship to Existing `music-theory` Project | Reference | — | Unlinked | Reference/inspiration only; `br-plan-06` still mentions adaptation from `music-theory`. |
| `prd-bsc-s25` | Raga-to-Scale Mapping | Actionable | `br-plan-05`, `br-plan-06` | Covered | Foundational theory owns raga mapping; visual/AI UI uses it for suggestions. |
| `prd-bsc-s26` | Contribution Model | Actionable | `br-plan-07` | Covered | Validation pipeline and community tools. |
| `prd-bsc-s27` | Deployment Strategy | Actionable | `br-plan-01` | Covered | SSG and zero-cost hosting setup. |
| `prd-bsc-s28` | Vietnamese Music Terminology Reference | Reference | — | Unlinked | Glossary/reference section; not counted as actionable gap. |
| `prd-bsc-s29` | Arrangement Pipeline | Actionable | `br-plan-08` | Covered | Explicit Melody → Harmonization → Accompaniment → Full Track plan. |
| `prd-bsc-s30` | Step 1: Harmonization | Actionable | `br-plan-08` | Covered | Key/scale detection, strong-beat analysis, functional harmony, and cadence annotation. |
| `prd-bsc-s31` | Step 2: Layer 2 Accompaniment | Actionable | `br-plan-08` | Covered | Bass extraction, comping, inversions, and voice leading. |
| `prd-bsc-s32` | Step 3: Layer 3 Drums & Additional Instruments | Actionable | `br-plan-08` | Covered | Drum/bass lock, frequency ranges, counter-melody placement. |
| `prd-bsc-s33` | Multi-Layer Fingerstyle Arrangement Engine | Actionable | `br-plan-10` | Covered | Fingerstyle engine has dedicated plan coverage. |
| `prd-bsc-s34` | Fingerstyle Phase 1: Upward Construction | Actionable | `br-plan-10` | Covered | Source layers and upward construction context. |
| `prd-bsc-s35` | Fingerstyle Phase 2: Downward Compression | Actionable | `br-plan-10` | Covered | String routing, pruning, weak-beat inner voices, Travis/percussion mapping. |
| `prd-bsc-s36` | Fingerstyle Execution Architecture | Actionable | `br-plan-10`, `br-plan-06` | Covered | Hand mapping, picking profiles, and visual hand-overlay events. |
| `prd-bsc-s37` | Fingerstyle User Stories | Actionable | `br-plan-10` | Covered | User-facing engine outputs, profile toggles, and visual events are planned. |
| `prd-bsc-s38` | Fingerstyle Compression Output Contract | Actionable | `br-plan-10`, `br-plan-06` | Covered | Structured intermediate result and visual event stream are planned. |
| `prd-bsc-s39` | Piano Accompaniment Generation Engine | Actionable | `br-plan-11` | Covered | Piano engine has dedicated plan coverage. |
| `prd-bsc-s40` | Piano Phase 1: Harmonic Framework & Bass Anchoring | Actionable | `br-plan-11` | Covered | Harmonic deduction, C2-C3 bass anchoring, and LIL enforcement. |
| `prd-bsc-s41` | Piano Phase 2: Spatial Allocation & Voice Leading | Actionable | `br-plan-11` | Covered | Right-hand guide tones, inversion, and shortest-path voice leading. |
| `prd-bsc-s42` | Piano Phase 3: Rhythmic & Stylistic Texturing | Actionable | `br-plan-11` | Covered | Pop/Ballad, Rock/R&B, and Classical/Folk comping profiles. |
| `prd-bsc-s43` | Piano Phase 4: Dynamic Counterpoint & Automation | Actionable | `br-plan-11` | Covered | Gap detection, fills, yield behavior, and pedal metadata. |
| `prd-bsc-s44` | Piano Execution Architecture | Actionable | `br-plan-11` | Covered | Hand-span, hand-collision, and pedal validation. |
| `prd-bsc-s45` | Piano User Stories | Actionable | `br-plan-11` | Covered | User-facing piano generation requirements are planned. |
| `prd-bsc-s46` | Piano Accompaniment Output Contract | Actionable | `br-plan-11`, `br-plan-06` | Covered | Structured piano output, playback, and piano-key highlight events. |
| `prd-bsc-s47` | Ensemble Expansion Engine | Actionable | `br-plan-12` | Covered | Ensemble expansion has dedicated plan coverage. |
| `prd-bsc-s48` | Ensemble Phase 0: Integration Handshake | Actionable | `br-plan-12` | Covered | Density grid, bass map, and melodic gap array. |
| `prd-bsc-s49` | Ensemble Phase 1: Rhythmic Interlock | Actionable | `br-plan-12` | Covered | Djembe bass, mid-tone, and slap event generation. |
| `prd-bsc-s50` | Ensemble Phase 2: Melodic Support | Actionable | `br-plan-12` | Covered | Flute/Violin altitude, yield modes, breath, and bow automation. |
| `prd-bsc-s51` | Ensemble Phase 3: Master Output & Conflict Resolution | Actionable | `br-plan-12` | Covered | Density overload, hierarchy, and double-stop validation. |
| `prd-bsc-s52` | Ensemble User Stories | Actionable | `br-plan-12` | Covered | User-facing Djembe/Flute/Violin requirements are planned. |
| `prd-bsc-s53` | Ensemble Expansion Output Contract | Actionable | `br-plan-12`, `br-plan-06` | Covered | Structured ensemble output and visual layer activity metadata. |
| `prd-bsc-s54` | Mockup / POC Demonstration Gate | Actionable | `br-plan-09` | Covered | Standalone proof-of-concept pages are required before integration. |
| `prd-bsc-s55` | Mockup / POC User Stories | Actionable | `br-plan-09` | Covered | Mockup page behavior, sample data, tests, and review-ready status are planned. |

---

## 4. PLAN Parent Rollup

| PLAN ID | PLAN section | PRD sections satisfied | Child count | Planned | In Progress | Implemented | Verified | Completion |
|:---|:---|:---|---:|---:|---:|---:|---:|---:|
| `br-plan-01` | Project Initialization & Core Architecture | `prd-bsc-s2`, `prd-bsc-s13`, `prd-bsc-s16`, `prd-bsc-s27` | 3 | 0 | 0 | 3 | 0 | 100.0% |
| `br-plan-02` | Data Layer & Song Catalogue Module | `prd-bsc-s3`, `prd-bsc-s4`, `prd-bsc-s15` | 3 | 0 | 0 | 3 | 0 | 100.0% |
| `br-plan-03` | Playback Module | `prd-bsc-s3`, `prd-bsc-s6`, `prd-bsc-s14`, `prd-bsc-s15` | 4 | 0 | 0 | 4 | 0 | 100.0% |
| `br-plan-04` | Composer Module | `prd-bsc-s3`, `prd-bsc-s7` | 5 | 0 | 0 | 5 | 0 | 100.0% |
| `br-plan-05` | AI Theory Engine Core | `prd-bsc-s3`, `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s10`, `prd-bsc-s25` | 4 | 0 | 0 | 4 | 0 | 100.0% |
| `br-plan-08` | Arrangement Pipeline: Melody → Full Track | `prd-bsc-s29`, `prd-bsc-s30`, `prd-bsc-s31`, `prd-bsc-s32` | 6 | 0 | 0 | 6 | 0 | 100.0% |
| `br-plan-09` | Workflow Mockup / Proof-of-Concept Demo Pages | `prd-bsc-s54`, `prd-bsc-s55` | 7 | 6 | 0 | 1 | 0 | 14.3% |
| `br-plan-10` | Multi-Layer Fingerstyle Arrangement Engine | `prd-bsc-s33`, `prd-bsc-s34`, `prd-bsc-s35`, `prd-bsc-s36`, `prd-bsc-s37`, `prd-bsc-s38` | 6 | 4 | 2 | 0 | 0 | 0.0% |
| `br-plan-11` | Piano Accompaniment Generation Engine | `prd-bsc-s39`, `prd-bsc-s40`, `prd-bsc-s41`, `prd-bsc-s42`, `prd-bsc-s43`, `prd-bsc-s44`, `prd-bsc-s45`, `prd-bsc-s46` | 7 | 6 | 1 | 0 | 0 | 0.0% |
| `br-plan-12` | Ensemble Expansion Engine | `prd-bsc-s47`, `prd-bsc-s48`, `prd-bsc-s49`, `prd-bsc-s50`, `prd-bsc-s51`, `prd-bsc-s52`, `prd-bsc-s53` | 7 | 6 | 0 | 1 | 0 | 14.3% |
| `br-plan-06` | Visual Instruments & AI UI | `prd-bsc-s17`, `prd-bsc-s25`, `prd-bsc-s36`, `prd-bsc-s38`, `prd-bsc-s46`, `prd-bsc-s53` | 4 | 2 | 1 | 1 | 0 | 25.0% |
| `br-plan-07` | Quality Assurance, CI & Community Tools | `prd-bsc-s11`, `prd-bsc-s18`, `prd-bsc-s19`, `prd-bsc-s20`, `prd-bsc-s21`, `prd-bsc-s26` | 3 | 0 | 0 | 3 | 0 | 100.0% |
| **Total** | — | — | **59** | **24** | **6** | **29** | **0** | **49.2%** |

---

## 5. PLAN Child State Matrix

| Child ID | Parent PLAN ID | Child item | Primary PRD coverage | State | Implementation evidence / next artifact |
|:---|:---|:---|:---|:---|:---|
| `br-plan-01.c01` | `br-plan-01` | Framework Setup: initialize Next.js App Router project with TypeScript, Tailwind CSS, and SSG structure. | `prd-bsc-s2`, `prd-bsc-s13`, `prd-bsc-s27` | Implemented | `package.json`, `next.config.ts`, `src/app/`. |
| `br-plan-01.c02` | `br-plan-01` | Directory Structure: scaffold `data/songs/`, `src/app/`, `src/components/`, and `src/lib/`. | `prd-bsc-s16` | Implemented | `data/songs/`, `src/app/`, `src/components/`, `src/lib/`. |
| `br-plan-01.c03` | `br-plan-01` | Dependencies: install `abcjs`, `gray-matter`, and `zod`. | `prd-bsc-s4`, `prd-bsc-s13`, `prd-bsc-s14` | Implemented | Dependencies are present in `package.json`. |
| `br-plan-02.c01` | `br-plan-02` | Schema Definition: define TypeScript types and Zod schemas for YAML frontmatter and ABC configurations. | `prd-bsc-s4`, `prd-bsc-s15`, `prd-bsc-s20` | Implemented | `src/lib/songs/schema.ts`; schema tests exist under `src/lib/songs/__tests__/`. |
| `br-plan-02.c02` | `br-plan-02` | Song Loader: parse Markdown frontmatter and associated `.abc` files. | `prd-bsc-s3`, `prd-bsc-s4`, `prd-bsc-s15` | Implemented | `src/lib/songs/loader.ts`; loader tests exist under `src/lib/songs/__tests__/`. |
| `br-plan-02.c03` | `br-plan-02` | SSG Pages: build landing, language catalogue, and static song detail routes. | `prd-bsc-s3`, `prd-bsc-s6`, `prd-bsc-s15`, `prd-bsc-s27` | Implemented | `src/app/page.tsx`, `src/app/[language]/page.tsx`, `src/app/[language]/[slug]/page.tsx`. |
| `br-plan-03.c01` | `br-plan-03` | Playback Controller: unified toggle UI for video types and ABC notation layers. | `prd-bsc-s6`, `prd-bsc-s14`, `prd-bsc-s15` | Implemented | `src/components/playback/PlaybackController.tsx`. |
| `br-plan-03.c02` | `br-plan-03` | YouTube Integration: embed YouTube IFrame API with dynamic video URL switching. | `prd-bsc-s6`, `prd-bsc-s14` | Implemented | `src/components/playback/YouTubePlayer.tsx`. |
| `br-plan-03.c03` | `br-plan-03` | Reusable Music Sheet Renderer: shared ABCJS SVG/MIDI playback, tempo, loops, note highlighting, render errors, and cursor events. | `prd-bsc-s6`, `prd-bsc-s14`, `prd-bsc-s15`, `prd-bsc-s17` | Implemented | `src/components/music-sheet/MusicSheetRenderer.tsx` owns shared ABCJS rendering, MIDI play/pause/stop, tempo, range and whole-sheet loop controls, note highlighting, render errors, and typed playback cursor events. |
| `br-plan-03.c04` | `br-plan-03` | Playback Page Wrapper: keep `AbcSheetViewer.tsx` as a thin wrapper around the shared renderer. | `prd-bsc-s6`, `prd-bsc-s14`, `prd-bsc-s15` | Implemented | `src/components/playback/AbcSheetViewer.tsx` delegates ABCJS rendering/playback to `MusicSheetRenderer` while adding playback-page synchronized instrument highlights. |
| `br-plan-04.c01` | `br-plan-04` | Metadata Editor: form inputs bound to YAML frontmatter schema. | `prd-bsc-s4`, `prd-bsc-s7` | Implemented | `src/components/composer/SongForm.tsx`. |
| `br-plan-04.c02` | `br-plan-04` | Interactive Notation Editor: live preview, undo/redo, localStorage caching, and vertical ABC-over-preview layout. | `prd-bsc-s7` | Implemented | `src/components/composer/AbcEditor.tsx`; shared-renderer alignment remains tracked in `br-plan-03.c03`. |
| `br-plan-04.c03` | `br-plan-04` | Layer Management: switch, edit, and layer multiple ABC tracks. | `prd-bsc-s7`, `prd-bsc-s9`, `prd-bsc-s10` | Implemented | `src/components/composer/LayerManager.tsx`. |
| `br-plan-04.c04` | `br-plan-04` | Workstation Coordinator: load song metadata and layers from `/compose?edit={slug}`. | `prd-bsc-s7` | Implemented | `src/components/composer/ComposerWorkstation.tsx`. |
| `br-plan-04.c05` | `br-plan-04` | Song Edit Selection Page: searchable `/edit` catalogue with key/resource indicators and edit links. | `prd-bsc-s7` | Implemented | `src/app/edit/page.tsx`, `src/components/composer/SongEditList.tsx`, `e2e/composer-selection.spec.ts`. |
| `br-plan-05.c01` | `br-plan-05` | Foundational Theory: diatonic systems, scales, and raga-to-Western mappings. | `prd-bsc-s8`, `prd-bsc-s10`, `prd-bsc-s25` | Implemented | `src/lib/theory/scales.ts`, `src/lib/theory/chords.ts`, theory tests. |
| `br-plan-05.c02` | `br-plan-05` | Melody Analyzer: parse treble-clef ABC, detect key, identify strong-beat notes. | `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s20` | Implemented | `src/lib/theory/melody-analyzer.ts`, melody analyzer tests. |
| `br-plan-05.c03` | `br-plan-05` | Auto-Harmonizer: align strong-beat melody notes with diatonic triads. | `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s10`, `prd-bsc-s20` | Implemented | `src/lib/theory/harmonizer.ts`, harmonizer tests. |
| `br-plan-05.c04` | `br-plan-05` | Arrangers: generate piano bass-clef patterns and guitar fingerstyle arrangements. | `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s10`, `prd-bsc-s17` | Implemented | `src/lib/theory/piano-arranger.ts`, `src/lib/theory/fingerstyle-arranger.ts`, arranger tests. |
| `br-plan-08.c01` | `br-plan-08` | Pipeline Orchestrator: enforce Melody → Harmonization → Accompaniment → Drums & Additional Instruments → Full Track ordering. | `prd-bsc-s29` | Implemented | `src/lib/theory/arrangement-pipeline.ts` exposes the ordered stage sequence, validation gates, and full-track ABC assembly; `src/components/composer/LayerManager.tsx` surfaces the UI stage gate before generation. |
| `br-plan-08.c02` | `br-plan-08` | Harmonization Stage: identify key/scale, strong beats, diatonic/functional chords, and cadence roles. | `prd-bsc-s29`, `prd-bsc-s30` | Implemented | `src/lib/theory/harmonizer.ts` exports harmonization stage metadata with key/scale, strong-beat, diatonic/functional chord, and cadence-role annotations; harmonizer tests cover the contract. |
| `br-plan-08.c03` | `br-plan-08` | Accompaniment Stage: generate Layer 2 piano/rhythm-guitar accompaniment with bass extraction, inversions, comping, and voice leading. | `prd-bsc-s29`, `prd-bsc-s31` | Implemented | `src/lib/theory/accompaniment-stage.ts` exports Layer 2 piano/rhythm-guitar accompaniment with bass extraction, inversion-aware smoothing, comping patterns, upper-voice movement metadata, and arranger tests; advanced piano-specific modules remain tracked in `br-plan-11`. |
| `br-plan-08.c04` | `br-plan-08` | Full-Track Expansion Stage: generate drums/additional instruments, bass/kick alignment, ranges, counter-melodies, and fills. | `prd-bsc-s29`, `prd-bsc-s32` | Implemented | `src/lib/theory/full-track-expansion-stage.ts` exports Layer 3 drum/additional-instrument guidance with bass/kick alignment, frequency-range assignments, melodic-gap detection, counter-melody fill placement, and behavior tests. |
| `br-plan-08.c05` | `br-plan-08` | Composer Integration: expose generated stages as editable first-class composition layers. | `prd-bsc-s29`, `prd-bsc-s31`, `prd-bsc-s32` | Implemented | `src/lib/theory/arrangement-pipeline.ts` adapts harmonization, accompaniment, drum, bass, and counter-melody outputs into editable layer proposals; `src/components/composer/LayerManager.tsx` supports accept/reject into the Composer layer stack. |
| `br-plan-08.c06` | `br-plan-08` | Validation & Tests: cover stage ordering, chord selection, voice leading, drum/bass alignment, range metadata, and counter-melody placement. | `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s29`, `prd-bsc-s30`, `prd-bsc-s31`, `prd-bsc-s32` | Implemented | `src/lib/theory/__tests__/arrangement-pipeline.test.ts`, `src/lib/theory/__tests__/full-track-expansion-stage.test.ts`, harmonizer/accompaniment tests, and `e2e/composer.spec.ts` cover the public pipeline seams and Composer accept/reject flow. |
| `br-plan-09.c01` | `br-plan-09` | Mockup Gate: require standalone POC pages before major arrangement workflow integration. | `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `src/app/mockups/page.tsx` documents the standalone POC gate UI state; `e2e/mockup-gate.spec.ts` verifies integration stays locked until all POC pages are review-ready. |
| `br-plan-09.c02` | `br-plan-09` | Arrangement Pipeline POC: demo melody, key/scale, strong beats, chords, accompaniment, full-track decisions, preview, and validation. | `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `src/app/mockups/arrangement-pipeline/page.tsx` renders the sample melody, detected key/scale, strong-beat analysis, chord functions, accompaniment/full-track decisions, ABC preview, validation report, and review-ready handoff; `e2e/arrangement-pipeline-mockup.spec.ts` covers the POC evidence seam. |
| `br-plan-09.c03` | `br-plan-09` | Fingerstyle Engine POC: demo upward construction, compression, string routing, pruning, playability, fallback, matrix, preview, and events. | `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `src/app/mockups/fingerstyle-engine/page.tsx` renders engine controls, upward construction, compression decisions, string routing, guide-tone pruning, playability/fallback reporting, final guitar matrix, ABC preview, visual event metadata, and shared handoff; `e2e/fingerstyle-mockup.spec.ts` covers the public POC flow. |
| `br-plan-09.c04` | `br-plan-09` | Piano Accompaniment POC: demo comping, bass, LIL, voice leading, gaps, validation, pedal, preview, and key highlights. | `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `src/app/mockups/piano-accompaniment/page.tsx` renders profile selection, left-hand bass anchoring, Low Interval Limit evidence, voice-leading decisions, gap fills, physical validation, pedal automation, grand-staff ABC preview, key highlights, and shared handoff; `e2e/piano-accompaniment-mockup.spec.ts` verifies the review-gate evidence. |
| `br-plan-09.c05` | `br-plan-09` | Ensemble Expansion POC: demo handshake, density grid, bass map, gaps, Djembe, Flute/Violin yield, conflicts, preview. | `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `src/app/mockups/ensemble-expansion/page.tsx` renders integration handshake, density grid, bass map, Melodic Gap Array, Djembe/Flute/Violin event decisions, conflict report, final multi-layer ABC preview, synchronized playback evidence, and shared handoff; `e2e/ensemble-expansion-mockup.spec.ts` covers the POC seam. |
| `br-plan-09.c06` | `br-plan-09` | Integration Handoff Checklist: show visible pass/fail or review-ready status and block integration until behavior is end-to-end. | `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `src/components/mockups/PocHandoffChecklist.tsx` renders a shared review-ready/pass-fail handoff checklist on each POC page; `e2e/poc-handoff-checklist.spec.ts` verifies Composer integration stays blocked until input, decisions, final artifact, and validation evidence are visible. |
| `br-plan-09.c07` | `br-plan-09` | POC Test Coverage: Playwright coverage for sample input, decisions, final artifact, validation/conflict report, and integration-ready status. | `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s54`, `prd-bsc-s55` | Implemented | `e2e/mockup-gate.spec.ts`, `e2e/arrangement-pipeline-mockup.spec.ts`, `e2e/fingerstyle-mockup.spec.ts`, `e2e/piano-accompaniment-mockup.spec.ts`, `e2e/ensemble-expansion-mockup.spec.ts`, and `e2e/poc-handoff-checklist.spec.ts` cover the highest-seam POC inputs, decisions, final artifacts, validation/conflict reports, and integration-ready statuses. |
| `br-plan-10.c01` | `br-plan-10` | Upward Construction Context: build inspectable source layers before guitar reduction. | `prd-bsc-s33`, `prd-bsc-s34`, `prd-bsc-s37`, `prd-bsc-s38` | In Progress | Core analyzer/harmonizer/arranger pieces exist; full source-layer contract is still needed. |
| `br-plan-10.c02` | `br-plan-10` | Downward Compression Algorithm: route strings, validate Beat 1 pairings, prune tones, place guide tones, and propose transposition. | `prd-bsc-s33`, `prd-bsc-s35`, `prd-bsc-s37`, `prd-bsc-s38` | Planned | Add `src/lib/theory/fingerstyle-compressor.ts`. |
| `br-plan-10.c03` | `br-plan-10` | Physical Hand Mapping: fretting/picking validation, Strict PIMA, Travis Override, thumb clock, pinch, syncopation, and string slap. | `prd-bsc-s36`, `prd-bsc-s37`, `prd-bsc-s38` | Planned | Add `src/lib/theory/guitar-playability.ts` and `src/lib/theory/picking-profiles.ts`. |
| `br-plan-10.c04` | `br-plan-10` | Fingerstyle Output Contract: structured source layers, outer voice map, playability, fallbacks, event maps, profiles, artifacts. | `prd-bsc-s38` | Planned | Add exported TypeScript contract and contract tests. |
| `br-plan-10.c05` | `br-plan-10` | Composer and Visual Integration: profile selection, playability inspection, Composer accept flow, fretboard/hand overlay playback events. | `prd-bsc-s36`, `prd-bsc-s37`, `prd-bsc-s38` | In Progress | `GuitarFretboard.tsx` exists; profile UI and SVG hand-overlay events still planned. |
| `br-plan-10.c06` | `br-plan-10` | Validation & Tests: cover layer ordering, string routing, stretch failures, fallbacks, pruning, Travis events, profiles, and visuals. | `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s37`, `prd-bsc-s38` | Planned | Add fingerstyle compressor and visual-event tests. |
| `br-plan-11.c01` | `br-plan-11` | Harmonic Framework & Bass Anchoring: melody/chord input, cadences, C2-C3 roots/octaves/fifths/1-5-8, and LIL rules. | `prd-bsc-s39`, `prd-bsc-s40`, `prd-bsc-s45`, `prd-bsc-s46` | In Progress | `src/lib/theory/piano-arranger.ts` exists; add `piano-accompaniment.ts` for full contract. |
| `br-plan-11.c02` | `br-plan-11` | Spatial Allocation & Voice Leading: RH guide tones, melody-masking avoidance, common tones, shortest-path inversions. | `prd-bsc-s39`, `prd-bsc-s41`, `prd-bsc-s45`, `prd-bsc-s46` | Implemented | `src/lib/theory/piano-accompaniment.ts` exports RH guide-tone voicing below melody targets, common-tone retention, shortest-path movement metadata, grand-staff ABC, and arranger tests. |
| `br-plan-11.c03` | `br-plan-11` | Rhythmic & Stylistic Texturing: Pop/Ballad, Rock/R&B, and Classical/Folk comping profiles. | `prd-bsc-s39`, `prd-bsc-s42`, `prd-bsc-s45`, `prd-bsc-s46` | Planned | Add `src/lib/theory/piano-comping-profiles.ts`. |
| `br-plan-11.c04` | `br-plan-11` | Dynamic Counterpoint & Automation: Melodic Gap Events, fills, yield behavior, and sustain pedal metadata. | `prd-bsc-s39`, `prd-bsc-s43`, `prd-bsc-s45`, `prd-bsc-s46` | Planned | Add gap-fill and pedal automation logic. |
| `br-plan-11.c05` | `br-plan-11` | Piano Physical Validation: major-10th span, rolled articulation, hand collision, range shifting/thinning, synchronized metadata. | `prd-bsc-s39`, `prd-bsc-s44`, `prd-bsc-s45`, `prd-bsc-s46` | Planned | Add `src/lib/theory/piano-playability.ts`. |
| `br-plan-11.c06` | `br-plan-11` | Piano Output Contract: source analysis, harmonic framework, LH/RH maps, comping, fills, validation, pedal, ABC, highlights. | `prd-bsc-s46` | Planned | Add exported TypeScript contract and contract tests. |
| `br-plan-11.c07` | `br-plan-11` | Validation & Tests: cover chord mapping, bass anchoring, LIL, guide tones, comping, fills, validation, pedal, playback metadata. | `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s45`, `prd-bsc-s46` | Planned | Add piano accompaniment tests. |
| `br-plan-12.c01` | `br-plan-12` | Integration Handshake: require Layer 1 + Layer 2, then derive density grid, bass map, and Melodic Gap Array. | `prd-bsc-s47`, `prd-bsc-s48`, `prd-bsc-s52`, `prd-bsc-s53` | Planned | Add `src/lib/theory/ensemble-expander.ts`. |
| `br-plan-12.c02` | `br-plan-12` | Djembe Rhythmic Interlock: bass, mid-tone, slap events, velocities, and transient conflict avoidance. | `prd-bsc-s47`, `prd-bsc-s49`, `prd-bsc-s52`, `prd-bsc-s53` | Planned | Add `src/lib/theory/djembe-arranger.ts`. |
| `br-plan-12.c03` | `br-plan-12` | Flute and Violin Melodic Support: altitude rules, bed/halo modes, background holds, and Fill Zone counter-melodies. | `prd-bsc-s47`, `prd-bsc-s50`, `prd-bsc-s52`, `prd-bsc-s53` | Planned | Add `src/lib/theory/orchestral-arranger.ts`. |
| `br-plan-12.c04` | `br-plan-12` | Anatomical and Expression Realism: Flute breath rests, Violin CC 11 swells, delayed vibrato, and double-stop validation. | `prd-bsc-s50`, `prd-bsc-s51`, `prd-bsc-s52`, `prd-bsc-s53` | Planned | Add breath, bow, vibrato, and double-stop validators. |
| `br-plan-12.c05` | `br-plan-12` | Conflict Resolution: scan timeline density, preserve melody, flatten Flute/Violin, remove Djembe fills as needed. | `prd-bsc-s47`, `prd-bsc-s51`, `prd-bsc-s52`, `prd-bsc-s53` | Planned | Add `src/lib/theory/ensemble-conflicts.ts`. |
| `br-plan-12.c06` | `br-plan-12` | Ensemble Output Contract: handshake, event maps, yield decisions, conflict report, ABC layers, playback/MIDI/visual metadata. | `prd-bsc-s53` | Implemented | `src/lib/theory/ensemble-output-contract.ts` exports the output contract and `src/lib/theory/__tests__/ensemble-output-contract.test.ts` covers handshake, event maps, yield decisions, conflict report, ABC layers, playback/MIDI events, visual activity metadata, and validation flags. |
| `br-plan-12.c07` | `br-plan-12` | Validation & Tests: cover ordering, density, bass sync, Fill Zones, Djembe/Flute/Violin rules, hierarchy, playback sync. | `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s52`, `prd-bsc-s53` | Planned | Add ensemble expansion tests. |
| `br-plan-06.c01` | `br-plan-06` | Instrument Renderers: SVG guitar fretboard and piano keyboard components. | `prd-bsc-s10`, `prd-bsc-s17`, `prd-bsc-s25` | Implemented | `src/components/instruments/GuitarFretboard.tsx`, `src/components/instruments/PianoKeyboard.tsx`, instrument tests. |
| `br-plan-06.c02` | `br-plan-06` | Synchronized Instrument Highlighting: connect guitar/piano renderers to Music Sheet playback cursor events. | `prd-bsc-s17`, `prd-bsc-s38`, `prd-bsc-s46`, `prd-bsc-s53` | In Progress | Instrument components exist; shared cursor event integration depends on `br-plan-03.c03`. |
| `br-plan-06.c03` | `br-plan-06` | Animated Hands Overlay: reusable 50% opacity SVG hands overlays with chord transition pathing, split-hands, and pedal sync. | `prd-bsc-s17`, `prd-bsc-s36`, `prd-bsc-s38`, `prd-bsc-s46` | Planned | Add `src/components/instruments/SvgHandsOverlay.tsx`. |
| `br-plan-06.c04` | `br-plan-06` | Theory Assistant UI: constraints side panel and accept generated arrangements into Composer layers. | `prd-bsc-s8`, `prd-bsc-s10`, `prd-bsc-s17`, `prd-bsc-s25` | Planned | Add `src/components/ai/TheoryAssistant.tsx`. |
| `br-plan-07.c01` | `br-plan-07` | Unit Testing: configure Vitest and test theory engine plus song loader. | `prd-bsc-s18`, `prd-bsc-s19`, `prd-bsc-s20`, `prd-bsc-s21` | Implemented | `vitest.config.ts`; tests under `src/lib/**/__tests__/` and `src/components/instruments/__tests__/`. |
| `br-plan-07.c02` | `br-plan-07` | E2E Testing: setup Playwright for playback toggles and composer workflow scenarios. | `prd-bsc-s18`, `prd-bsc-s19`, `prd-bsc-s20`, `prd-bsc-s21` | Implemented | `playwright.config.ts`; specs under `e2e/`. |
| `br-plan-07.c03` | `br-plan-07` | Validation Pipeline: validate submitted song YAML schemas and parseable ABC notation. | `prd-bsc-s11`, `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s21`, `prd-bsc-s26` | Implemented | `scripts/validate-songs.mjs`, `src/app/api/validate/route.ts`, validation tests. |

---

## 6. Gaps and Follow-ups

| Gap / observation | Impact | Recommended follow-up |
|:---|:---|:---|
| All actionable PRD child sections now trace to at least one `br-plan-*` element. | Resolved; actionable PRD-to-PLAN coverage is **100.0%**. | Keep metadata synchronized whenever PRD or PLAN sections change. |
| `prd-bsc-s1` is not directly linked. | Low; this is the problem statement, not an implementation requirement. | Keep unlinked unless dashboards must count context sections as covered. |
| `prd-bsc-s5`, `prd-bsc-s12`, and `prd-bsc-s23` are unlinked parent/grouping sections. | Low; their actionable children are covered. | Keep unlinked or add parent-level `satisfies` tags only if dashboard coverage should include grouping nodes. |
| `prd-bsc-s22` is unlinked. | Expected; out-of-scope items should not be implemented. | Keep unlinked and classify as `Out of Scope` in dashboards. |
| `prd-bsc-s24` and `prd-bsc-s28` are reference-only. | Low; no executable requirement is missing. | Keep unlinked unless the project later requires explicit implementation tracking for reference reuse or terminology. |
| Advanced arrangement engine sections are now planned but only partially implemented beyond the core pipeline. | Medium; `br-plan-08` is implemented, while implementation coverage remains early for `br-plan-09` through `br-plan-12`. | Create or continue implementation issues from those remaining plan children and advance states only with concrete artifacts and tests. |
| Child item IDs are defined in this matrix, not in `PLAN.md` metadata comments. | Medium if automated child-level extraction is required. | If needed, promote children into headings or add parser-supported single-line metadata in `PLAN.md`. |

---

## 7. Update Procedure

1. Update `docs/PRD.md` and/or `docs/PLAN.md` with valid single-line Beads ID metadata comments.
2. Re-run the ID extractor/linter on `docs/`.
3. Recalculate:
   - all PRD section coverage,
   - actionable PRD section coverage,
   - PLAN child state counts,
   - parent rollups.
4. Update the child state table with implementation evidence paths and verification notes.
5. Move child items from `Planned` → `In Progress` → `Implemented` → `Verified` only when evidence exists.
