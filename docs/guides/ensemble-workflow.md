# Ensemble Workflow Guide (experimental)
<!-- beads-id: br-guide-ensemble-workflow -->

Ensemble is Layer 3 expansion (Djembe, Flute, Violin) over the Layer 1 melody and Layer 2 accompaniment foundation. The theory engine, workflow definition, Server Action, and mockup pages exist; the Composer route, source/freshness contract, export mapping, and end-to-end coverage do not. Until they do, Ensemble is **not** an active Composer step, persisted product branch, preview contributor, or exportable layer (see [ADR 0001](../adr/0001-composer-publication-and-practice.md) and [Composer Source Flow](./composer-source-flow.md)).

## 1. Status and code references
<!-- beads-id: br-guide-ensemble-workflow-s01 -->

| Concern | Location |
|---|---|
| Step ids, types, default generation plan, step definitions | `src/lib/theory/ensemble-workflow/definition.ts` |
| Public workflow entrypoint | `src/lib/theory/ensemble-workflow.ts` |
| Server Action | `src/app/actions/ensemble-workflow.ts` |
| Theory engines | `src/lib/theory/ensemble-expander.ts`, `src/lib/theory/djembe-arranger.ts`, `src/lib/theory/orchestral-arranger.ts`, `src/lib/theory/ensemble-conflicts.ts`, `src/lib/theory/ensemble-output-contract.ts` |
| Wizard state transitions and option-list UI (no shipped shell) | `src/components/composer/ensemble-workflow/wizard-parts.tsx` |
| Mockup / POC gate | `src/app/mockups/ensemble-expansion/`, alias `src/app/mockups/ensemble/` |

## 2. Small workflow steps
<!-- beads-id: br-guide-ensemble-workflow-s02 -->

Step ids are defined by `ENSEMBLE_WORKFLOW_STEP_IDS`; the list below explains them and must be kept in sync with `definition.ts`.

1. `foundation-handshake` — confirm melody, accompaniment foundation, density grid, bass map, and melodic-gap strategy.
2. `djembe-groove-interlock` — choose Djembe groove profile and bass/transient interlock.
3. `djembe-fill-validation` — choose fill policy, backbeat/slap behavior, and transient conflict limits.
4. `flute-yield-register` — choose Flute role, register, and yield behavior while melody is active.
5. `flute-breath-fill-validation` — choose fill density, breath interval, and playable gap fills.
6. `violin-bed-register` — choose Violin harmonic bed/counterline/drone strategy and register relationship.
7. `violin-expression-validation` — choose bow expression, vibrato/swell, double-stop policy, and playability constraints.
8. `final-conflict-review-apply` — review Djembe/Flute/Violin choices, resolve conflicts, and prepare the final Layer 3 ABC bundle.

## 3. Rules
<!-- beads-id: br-guide-ensemble-workflow-s03 -->

- Preserve the Layer 1 melody first.
- Preserve the Layer 2 accompaniment foundation second.
- Use ensemble instruments to support, not overcrowd, the devotional melody.
- Apply conflict resolution in this order: preserve melody → preserve accompaniment foundation → flatten melodic runs into sustained notes → remove or soften percussion fills.
- Keep Djembe, Flute, and Violin decisions independently reviewable before the final apply step.
- Final Layer 3 ABC inherits the accompaniment staff-system grouping: Melody line N, Layer 2 line N, then each Djembe/Flute/Violin line N for the same measure range.

## 4. Promotion criteria
<!-- beads-id: br-guide-ensemble-workflow-s04 -->

Ensemble may become a shipped Composer step only with, together: a route under `/compose/:slug/`, a source-current contract derived from the selected Harmony Step 3 ABC plus the accompaniment branch, an Export layer mapping, and end-to-end coverage. That change requires a new ADR and updates to `product/PRD.md`, this guide, and `CLAUDE.md`.
