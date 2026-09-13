# Documentation Index
<!-- beads-id: br-docs-index -->

This index tells you which document owns which topic. Root-level files (`README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `CONTEXT.md`) summarize and link into `docs/`; they never restate a contract that a guide owns.

## Layout
<!-- beads-id: br-docs-index-s01 -->

| Path | Lifecycle | Contents |
|---|---|---|
| [`product/PRD.md`](./product/PRD.md) | Product — changes slowly | Product requirements and user stories (`br-prd01`). |
| [`product/PLAN.md`](./product/PLAN.md) | Product | Implementation plan; plan elements `satisfies` PRD sections. |
| [`product/PRD-to-PLAN-statematrix.md`](./product/PRD-to-PLAN-statematrix.md) | Product | Requirements traceability matrix and plan child state. |
| [`product/use-cases-guitar-piano-singer-accompaniment.md`](./product/use-cases-guitar-piano-singer-accompaniment.md) | Product | Vietnamese use cases for the primary Guitar Classic and Piano singer-accompaniment workflow. |
| [`adr/`](./adr/) | Decisions — append-only | Architecture decision records: [0001 publication & Practice](./adr/0001-composer-publication-and-practice.md), [0002 TimeGrid authority](./adr/0002-fingerstyle-timegrid-authority.md), [0003 LLM function-call boundary](./adr/0003-llm-function-call-boundary.md). |
| [`guides/composer-source-flow.md`](./guides/composer-source-flow.md) | Domain contract — changes with code | Directed source flow, invalidation, authority/projection matrix, visibility guardrails, Export/Practice. |
| [`guides/accompaniment-workflow.md`](./guides/accompaniment-workflow.md) | Domain contract | Accompaniment wizard: shared Steps 1–3, Guitar Classic / Harmonium / Djembe branches, gating, rules, code references. |
| [`guides/singer-accompaniment-decision-model.md`](./guides/singer-accompaniment-decision-model.md) | Domain contract | Shared Guitar Classic/Piano model: chord windows, meter-aware comping profiles, register-aware voicing plans, validation, and bounded LLM decisions. |
| [`guides/ensemble-workflow.md`](./guides/ensemble-workflow.md) | Domain contract (experimental) | Ensemble step ids, rules, conflict-resolution order, and promotion criteria; not a shipped Composer step. |
| [`guides/guitar-fingerstyle-arrangement-guide.md`](./guides/guitar-fingerstyle-arrangement-guide.md) | Domain contract | Solo-guitar staged pipeline, fill policy, compact LLM contracts, deterministic foundation placement, diagnostics. |
| [`guides/timegrid-conversion-guide.md`](./guides/timegrid-conversion-guide.md) | Domain contract | TimeGrid model, locked facts, edit operations, validation, ABC/ASCII projection, persistence and v3 interchange. |
| [`guides/abcjs-tablature-rendering.md`](./guides/abcjs-tablature-rendering.md) | Domain contract | abcjs render boundary, TAB option, `!N!` string forcing, octave/key rules, export portability. |
| [`theory/guitar-arpeggiation-theory.md`](./theory/guitar-arpeggiation-theory.md) | Theory reference (Vietnamese) | Arpeggiation patterns, bass protocol, voice leading, worked ABC example, chord-tone reference system. |
| [`design/UI.md`](./design/UI.md) | Design spec | Navigation graph, page layouts, UX flows, responsiveness. |
| [`design/guitar-piano-singer-accompaniment-system-design.md`](./design/guitar-piano-singer-accompaniment-system-design.md) | Design analysis | Vietnamese target system design for Guitar Classic and Piano singer accompaniment. |
| [`design/guitar-piano-singer-accompaniment-low-fi-ui.md`](./design/guitar-piano-singer-accompaniment-low-fi-ui.md) | Design spec | Vietnamese low-fi wireframes and widescreen baseline for the primary accompaniment workflow. |
| [`research/`](./research/) | Frozen | Historical research notes; each file carries a superseded banner. |
| [`universal-id-registry.md`](./universal-id-registry.md) | Registry | Allocation record for Universal (Beads) IDs and retired IDs. |

Language policy: `guides/` and `adr/` are English (shared engineering contracts). `product/`, `design/`, and `theory/` may be written in Vietnamese for analysis, use-case, and worked-example documents, and English for specifications that are shared across the codebase (`product/PRD.md`, `product/PLAN.md`, the traceability matrix, `design/UI.md`).

## Source-of-truth matrix
<!-- beads-id: br-docs-index-s02 -->

| Topic | Source of truth | Other places only summarize and link |
|---|---|---|
| Directed source flow, invalidation, stale guards | `guides/composer-source-flow.md` | `CLAUDE.md`, `ARCHITECTURE.md`, `CONTEXT.md`, ADR 0001 |
| Accompaniment step ids and gating | `src/lib/theory/accompaniment-workflow/definition.ts`, explained in `guides/accompaniment-workflow.md` | `CLAUDE.md`, `ARCHITECTURE.md` |
| Singer-accompaniment timeline / comping / voicing decisions | `guides/singer-accompaniment-decision-model.md` | use cases, target design, Guitar theory reference |
| Ensemble step ids, rules, conflict order (experimental) | `src/lib/theory/ensemble-workflow/definition.ts`, explained in `guides/ensemble-workflow.md` | `CLAUDE.md`, `ARCHITECTURE.md` |
| TimeGrid authority, v3 codec, persistence | `guides/timegrid-conversion-guide.md` | fingerstyle guide, ADR 0002 |
| Staged fill pipeline and LLM contracts | `guides/guitar-fingerstyle-arrangement-guide.md` | `CLAUDE.md`, ADR 0003, research notes |
| abcjs render boundary, TAB, string forcing, `cleanAbcForExport` | `guides/abcjs-tablature-rendering.md` | `CLAUDE.md`, `ARCHITECTURE.md` |
| LLM transport limits and phase-scoped tools | ADR 0003 (decision), `src/app/actions/ai-config.ts` (behavior) | `CLAUDE.md`, `ARCHITECTURE.md` |
| Module map and seams | `ARCHITECTURE.md` | `CLAUDE.md` keeps only the URL → module table |
| Domain vocabulary | `CONTEXT.md` | — |
| Product scope and user stories | `product/PRD.md` | `README.md` |
| Primary accompaniment use cases | `product/use-cases-guitar-piano-singer-accompaniment.md` | `product/PRD.md`, target design and low-fi UI documents |
| Primary accompaniment target architecture | `design/guitar-piano-singer-accompaniment-system-design.md` | `product/PRD.md`, `product/PLAN.md`, low-fi UI document |
| Primary accompaniment low-fi screens | `design/guitar-piano-singer-accompaniment-low-fi-ui.md` | `design/UI.md`, use-case and target-design documents |
| Universal ID allocations | `universal-id-registry.md` | — |

## Update rules
<!-- beads-id: br-docs-index-s03 -->

1. When workflow step ids, arrangement rules, public entrypoints, TimeGrid wire contracts, or LLM phase/tool contracts change, update the owning source-of-truth document **in the same PR** as the code, then fix the summaries that link to it (`CLAUDE.md`, `ARCHITECTURE.md`).
2. New architectural decisions go into `adr/NNNN-*.md` (Status / Context / Decision / Consequences). Do not rewrite an accepted ADR; supersede it with a new one.
3. Research notes are frozen. If a finding becomes a contract, move it into a guide and add a superseded banner to the note.
4. Every substantive heading carries a single-line `beads-id` HTML comment (see the syntax in the registry). Renaming or moving a section keeps its ID; rewriting it allocates a new ID and records the old one under Retired IDs in the registry. Reserve namespaces in the registry before adding a document.
5. Code paths mentioned in `docs/` use repository-relative paths in backticks (never `file:///` links) so they stay valid for every contributor.
6. Run `npm run docs:check` (`scripts/docs-check.mjs`) before opening a PR; it fails on broken links, missing backtick paths and bare filenames (`*.ts`/`*.tsx`/`*.mjs` resolved by basename under `src/`, `scripts/`, `e2e/`, and the repo root), `file:///` URLs, Universal ID syntax errors, duplicate IDs, and unresolved `satisfies` targets. Skill docs under `.claude/skills/` get a links-only scan for links that leave the skills tree. A historical or hypothetical tree or table may be exempted from the path checks by placing `<!-- docs-check: ignore-paths -->` on the line above it: outside a code fence the marker covers the following block up to the next blank line, inside a fence the whole block. Backticks are reserved for paths that exist today; write planned or hypothetical files as plain text (for example "planned: src/app/mockups/piano-accompaniment/page.tsx") so the check stays meaningful inside tables.

## Verification
<!-- beads-id: br-docs-index-s04 -->

Run the Universal ID extractor after any metadata change:

```bash
python .agents/skills/agenticse-gmind-universal-id-agentmem/scripts/extract_ids.py docs
```

It validates comment syntax and the single-line rule. `npm run docs:check` runs it and additionally audits ID uniqueness and that every `satisfies` target resolves to an active ID.
