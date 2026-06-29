# PRD to PLAN State Matrix

<!-- beads-id: br-rtm-prd-plan-01 | satisfies: prd-bsc -->

> Source PRD: [`docs/PRD.md`](./PRD.md)  
> Source PLAN: [`docs/PLAN.md`](./PLAN.md)  
> Generated/updated: 2026-06-30  
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
| PRD document root coverage | `prd-bsc` satisfied by `br-plan-00` | Covered |
| All PRD section coverage | `21 covered / 28 PRD sections` | **75.0%** |
| Actionable/in-scope PRD coverage | `21 covered / 21 actionable sections` | **100.0%** |
| Unlinked non-actionable/context sections | `7 unlinked / 28 PRD sections` | **25.0%** |

The unlinked sections are context, grouping, out-of-scope, or reference sections: `prd-bsc-s1`, `prd-bsc-s5`, `prd-bsc-s12`, `prd-bsc-s22`, `prd-bsc-s23`, `prd-bsc-s24`, `prd-bsc-s28`.

### 1.2 Plan Child State Coverage

Every bullet item under a `PLAN.md` section is tracked as a child item. A child is counted as complete only when implementation evidence exists.

```text
plan_child_completion = (implemented_children + verified_children) / total_plan_children
plan_child_verification = verified_children / total_plan_children
```

Current implementation evidence scan found only documentation files (`README.md`, `docs/PRD.md`, `docs/PLAN.md`, and this matrix). Therefore all PLAN child items start in **Planned** state.

| Metric | Formula | Value |
|:---|:---|---:|
| Total PLAN child items | `sum(children under br-plan-01..07)` | **21** |
| Planned child items | `21 / 21` | **100.0%** |
| In-progress child items | `0 / 21` | **0.0%** |
| Implemented child items | `0 / 21` | **0.0%** |
| Verified child items | `0 / 21` | **0.0%** |
| Child completion coverage | `(Implemented + Verified) / 21` | **0.0%** |

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
| `prd-bsc` | Product Requirements Document | Root | `br-plan-00` | Covered | PLAN declares whole-document alignment. |
| `prd-bsc-s1` | Problem Statement | Context | — | Unlinked | Narrative/context section; not counted as actionable gap. |
| `prd-bsc-s2` | Solution | Actionable | `br-plan-01` | Covered | Project architecture and initialization support the solution. |
| `prd-bsc-s3` | Three Core Modules | Actionable | `br-plan-02`, `br-plan-03`, `br-plan-04`, `br-plan-05` | Covered | Data, playback, composer, and AI theory module plans now directly trace to the three core modules. |
| `prd-bsc-s4` | Song Data Model | Actionable | `br-plan-02` | Covered | Data schema and loader cover the model. |
| `prd-bsc-s5` | User Stories | Grouping | — | Unlinked | Parent grouping section; child story groups are covered. |
| `prd-bsc-s6` | Playback Module stories | Actionable | `br-plan-03` | Covered | Playback controller, YouTube integration, ABC viewer. |
| `prd-bsc-s7` | Composer Module stories | Actionable | `br-plan-04` | Covered | Form editor, ABC editor, layer management. |
| `prd-bsc-s8` | AI Theory Assistant Module | Actionable | `br-plan-05` | Covered | Theory engine core covers assistant logic. |
| `prd-bsc-s9` | Melody → Full Arrangement | Actionable | `br-plan-05` | Covered | Analyzer, harmonizer, arrangers. |
| `prd-bsc-s10` | Chord & Voicing Suggestions | Actionable | `br-plan-05` | Covered | Harmonizer and arranger outputs cover suggestions. |
| `prd-bsc-s11` | Community & Open Source | Actionable | `br-plan-07` | Covered | QA, validation, and contribution tooling. |
| `prd-bsc-s12` | Implementation Decisions | Grouping | — | Unlinked | Parent grouping section; child decisions are covered. |
| `prd-bsc-s13` | Architecture | Actionable | `br-plan-01` | Covered | Next.js/TypeScript/SSG setup. |
| `prd-bsc-s14` | Data Flow | Actionable | `br-plan-03` | Covered | Playback flow and ABC rendering path. |
| `prd-bsc-s15` | Key Modules | Actionable | `br-plan-02` | Covered | Data/catalogue module coverage; other modules are detailed separately. |
| `prd-bsc-s16` | File Organization | Actionable | `br-plan-01` | Covered | Directory structure scaffolding. |
| `prd-bsc-s17` | Instrument-Specific Output Detail | Actionable | `br-plan-06` | Covered | Guitar and piano visual renderers. |
| `prd-bsc-s18` | Testing Decisions | Actionable | `br-plan-07` | Covered | QA section. |
| `prd-bsc-s19` | What Makes a Good Test | Actionable | `br-plan-07` | Covered | Testing approach included in QA scope. |
| `prd-bsc-s20` | Modules to Test | Actionable | `br-plan-07` | Covered | Unit, E2E, validation pipeline coverage. |
| `prd-bsc-s21` | Testing Tools | Actionable | `br-plan-07` | Covered | Vitest, Playwright, validation tooling. |
| `prd-bsc-s22` | Out of Scope | Exclusion | — | Intentionally unlinked | Excluded features should not be fulfilled by PLAN. |
| `prd-bsc-s23` | Further Notes | Reference grouping | — | Unlinked | Parent reference section; not counted as actionable gap. |
| `prd-bsc-s24` | Relationship to Existing `music-theory` Project | Reference | — | Unlinked | Reference/inspiration only. `br-plan-06` mentions adaptation from `music-theory`. |
| `prd-bsc-s25` | Raga-to-Scale Mapping | Actionable | `br-plan-05`, `br-plan-06` | Covered | Foundational theory owns raga mapping; visual/AI UI uses it for instrument suggestions. |
| `prd-bsc-s26` | Contribution Model | Actionable | `br-plan-07` | Covered | Validation pipeline and community tools. |
| `prd-bsc-s27` | Deployment Strategy | Actionable | `br-plan-01` | Covered | SSG and zero-cost hosting setup. |
| `prd-bsc-s28` | Vietnamese Music Terminology Reference | Reference | — | Unlinked | Glossary/reference section; not counted as actionable gap. |

---

## 4. PLAN Parent Rollup

| PLAN ID | PLAN section | PRD sections satisfied | Child count | Planned | In Progress | Implemented | Verified | Completion |
|:---|:---|:---|---:|---:|---:|---:|---:|---:|
| `br-plan-01` | Project Initialization & Core Architecture | `prd-bsc-s2`, `prd-bsc-s13`, `prd-bsc-s16`, `prd-bsc-s27` | 3 | 3 | 0 | 0 | 0 | 0.0% |
| `br-plan-02` | Data Layer & Song Catalogue Module | `prd-bsc-s3`, `prd-bsc-s4`, `prd-bsc-s15` | 3 | 3 | 0 | 0 | 0 | 0.0% |
| `br-plan-03` | Playback Module | `prd-bsc-s3`, `prd-bsc-s6`, `prd-bsc-s14` | 3 | 3 | 0 | 0 | 0 | 0.0% |
| `br-plan-04` | Composer Module | `prd-bsc-s3`, `prd-bsc-s7` | 3 | 3 | 0 | 0 | 0 | 0.0% |
| `br-plan-05` | AI Theory Engine Core | `prd-bsc-s3`, `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s10`, `prd-bsc-s25` | 4 | 4 | 0 | 0 | 0 | 0.0% |
| `br-plan-06` | Visual Instruments & AI UI | `prd-bsc-s17`, `prd-bsc-s25` | 2 | 2 | 0 | 0 | 0 | 0.0% |
| `br-plan-07` | Quality Assurance, CI & Community Tools | `prd-bsc-s11`, `prd-bsc-s18`, `prd-bsc-s19`, `prd-bsc-s20`, `prd-bsc-s21`, `prd-bsc-s26` | 3 | 3 | 0 | 0 | 0 | 0.0% |
| **Total** | — | — | **21** | **21** | **0** | **0** | **0** | **0.0%** |

---

## 5. PLAN Child State Matrix

| Child ID | Parent PLAN ID | Child item | Primary PRD coverage | State | Implementation evidence / next artifact |
|:---|:---|:---|:---|:---|:---|
| `br-plan-01.c01` | `br-plan-01` | Framework Setup: initialize Next.js App Router project with TypeScript, Tailwind CSS, and SSG structure. | `prd-bsc-s2`, `prd-bsc-s13`, `prd-bsc-s27` | Planned | Add `package.json`, Next.js config, Tailwind config, `src/app/`. |
| `br-plan-01.c02` | `br-plan-01` | Directory Structure: scaffold `data/songs/`, `src/app/`, `src/components/`, and `src/lib/`. | `prd-bsc-s16` | Planned | Add documented directory tree. |
| `br-plan-01.c03` | `br-plan-01` | Dependencies: install `abcjs`, `gray-matter`, and `zod`. | `prd-bsc-s4`, `prd-bsc-s13`, `prd-bsc-s14` | Planned | Add dependencies to `package.json`/lockfile. |
| `br-plan-02.c01` | `br-plan-02` | Schema Definition: define TypeScript types and Zod schemas for YAML frontmatter and ABC configurations. | `prd-bsc-s4`, `prd-bsc-s15`, `prd-bsc-s20` | Planned | Add `src/lib/songs/schema.ts`. |
| `br-plan-02.c02` | `br-plan-02` | Song Loader: parse Markdown frontmatter and associated `.abc` files. | `prd-bsc-s3`, `prd-bsc-s4`, `prd-bsc-s15` | Planned | Add `src/lib/songs/loader.ts`. |
| `br-plan-02.c03` | `br-plan-02` | SSG Pages: build landing, language catalogue, and static song detail routes. | `prd-bsc-s3`, `prd-bsc-s6`, `prd-bsc-s15`, `prd-bsc-s27` | Planned | Add `src/app/page.tsx`, `src/app/[language]/page.tsx`, `src/app/[language]/[slug]/page.tsx`. |
| `br-plan-03.c01` | `br-plan-03` | Playback Controller: unified toggle UI for video types and ABC notation layers. | `prd-bsc-s6`, `prd-bsc-s14`, `prd-bsc-s15` | Planned | Add `src/components/playback/PlaybackController.tsx`. |
| `br-plan-03.c02` | `br-plan-03` | YouTube Integration: embed YouTube IFrame API with dynamic video URL switching. | `prd-bsc-s6`, `prd-bsc-s14` | Planned | Add `src/components/playback/YouTubePlayer.tsx`. |
| `br-plan-03.c03` | `br-plan-03` | ABC Viewer: render SVG staff notation and provide MIDI playback controls with note highlighting. | `prd-bsc-s6`, `prd-bsc-s14` | Planned | Add `src/components/playback/AbcSheetViewer.tsx`. |
| `br-plan-04.c01` | `br-plan-04` | Metadata Editor: form inputs bound to YAML frontmatter schema. | `prd-bsc-s4`, `prd-bsc-s7` | Planned | Add `src/components/composer/SongForm.tsx`. |
| `br-plan-04.c02` | `br-plan-04` | Interactive Notation Editor: live SVG preview, undo/redo, and localStorage caching. | `prd-bsc-s7` | Planned | Add `src/components/composer/AbcEditor.tsx`. |
| `br-plan-04.c03` | `br-plan-04` | Layer Management: switch, edit, and layer multiple ABC tracks. | `prd-bsc-s7`, `prd-bsc-s9`, `prd-bsc-s10` | Planned | Add `src/components/composer/LayerManager.tsx`. |
| `br-plan-05.c01` | `br-plan-05` | Foundational Theory: diatonic systems, scales, and raga-to-Western mappings. | `prd-bsc-s8`, `prd-bsc-s10`, `prd-bsc-s25` | Planned | Add `src/lib/theory/scales.ts` and `src/lib/theory/chords.ts`. |
| `br-plan-05.c02` | `br-plan-05` | Melody Analyzer: parse treble-clef ABC, detect key, identify strong-beat notes. | `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s20` | Planned | Add `src/lib/theory/melody-analyzer.ts`. |
| `br-plan-05.c03` | `br-plan-05` | Auto-Harmonizer: align strong-beat melody notes with diatonic triads. | `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s10`, `prd-bsc-s20` | Planned | Add `src/lib/theory/harmonizer.ts`. |
| `br-plan-05.c04` | `br-plan-05` | Arrangers: generate piano bass-clef patterns and guitar fingerstyle arrangements. | `prd-bsc-s8`, `prd-bsc-s9`, `prd-bsc-s10`, `prd-bsc-s17` | Planned | Add `src/lib/theory/piano-arranger.ts` and `src/lib/theory/fingerstyle-arranger.ts`. |
| `br-plan-06.c01` | `br-plan-06` | Instrument Renderers: SVG guitar fretboard and piano keyboard components. | `prd-bsc-s10`, `prd-bsc-s17`, `prd-bsc-s25` | Planned | Add `src/components/instruments/GuitarFretboard.tsx` and `src/components/instruments/PianoKeyboard.tsx`. |
| `br-plan-06.c02` | `br-plan-06` | Theory Assistant UI: side panel for constraints and accepting arrangements into Composer layers. | `prd-bsc-s8`, `prd-bsc-s10`, `prd-bsc-s17`, `prd-bsc-s25` | Planned | Add `src/components/ai/TheoryAssistant.tsx`. |
| `br-plan-07.c01` | `br-plan-07` | Unit Testing: configure Vitest and test theory engine plus song loader. | `prd-bsc-s18`, `prd-bsc-s19`, `prd-bsc-s20`, `prd-bsc-s21` | Planned | Add Vitest config and unit test suites. |
| `br-plan-07.c02` | `br-plan-07` | E2E Testing: setup Playwright for playback toggles and composer workflow scenarios. | `prd-bsc-s18`, `prd-bsc-s19`, `prd-bsc-s20`, `prd-bsc-s21` | Planned | Add Playwright config and E2E specs. |
| `br-plan-07.c03` | `br-plan-07` | Validation Pipeline: validate submitted song YAML schemas and parseable ABC notation. | `prd-bsc-s11`, `prd-bsc-s18`, `prd-bsc-s20`, `prd-bsc-s21`, `prd-bsc-s26` | Planned | Add validation script and `src/app/api/validate/route.ts`. |

---

## 6. Gaps and Follow-ups

| Gap / observation | Impact | Recommended follow-up |
|:---|:---|:---|
| `prd-bsc-s1` is not directly linked. | Low; this is the problem statement, not an implementation requirement. | Keep unlinked unless you want context sections included in trace coverage. |
| `prd-bsc-s5`, `prd-bsc-s12`, and `prd-bsc-s23` are unlinked parent/grouping sections. | Low; their actionable children are covered. | Keep unlinked or add parent-level `satisfies` tags if dashboard coverage should include grouping nodes. |
| `prd-bsc-s22` is unlinked. | Expected; out-of-scope items should not be implemented. | Keep unlinked and classify as `Out of Scope` in dashboards. |
| `prd-bsc-s24` is reference-only but partially reflected in `br-plan-06`. | Low. | Optional: add `prd-bsc-s24` to `br-plan-06` only if implementation must explicitly track reuse from `music-theory`. |
| `prd-bsc-s25` now traces to both `br-plan-05` and `br-plan-06`. | Resolved trace precision issue. | Keep both links unless the raga mapping is removed from either the theory engine or visual AI UI scope. |
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
