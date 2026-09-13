# Universal ID Registry
<!-- beads-id: br-registry-universal-id -->

> **Scope:** every Markdown document in [`docs/`](./).  
> **Authority:** this registry is the canonical allocation record for Universal IDs; the inline `beads-id` comment immediately below a heading is the source of truth for that heading.

## Registry rules
<!-- beads-id: br-registry-universal-id-s01 -->

- Each document has one stable root ID; every substantive heading has one stable section or element ID directly below it.
- Metadata is a single-line HTML comment in the form `&lt;!-- beads-id: br-... --&gt;` or `&lt;!-- beads-id: br-... | satisfies: br-... --&gt;`.
- `satisfies` always points from a lower-level design, plan, or trace artifact to a requirement it covers. It is not added where the relationship is only incidental.
- IDs are never silently reused. Rename/move operations retain the ID; retired IDs are recorded here before removal.

## Active document allocations
<!-- beads-id: br-registry-universal-id-s02 -->

| Document | Root ID | Heading allocation | Role / upstream trace |
|---|---|---|---|
| [`README.md`](./README.md) | `br-docs-index` | `br-docs-index-sNN` | Documentation index and source-of-truth matrix. |
| [`product/PRD.md`](./product/PRD.md) | `br-prd01` | `br-prd01-s1`–`br-prd01-s55` (original), `br-prd01-s56`–`br-prd01-s62` (Amendments 2026-09) | Product requirements source. |
| [`product/PLAN.md`](./product/PLAN.md) | `br-plan-00` | `br-plan-01`–`br-plan-15` | Implementation plan; plan elements satisfy PRD sections. `br-plan-13`–`15` cover the 2026-09 amendments. |
| [`product/PRD-to-PLAN-statematrix.md`](./product/PRD-to-PLAN-statematrix.md) | `br-rtm-01` | `br-rtm-01-sNN` | Trace matrix; root satisfies `br-prd01`. |
| [`product/use-cases-guitar-piano-singer-accompaniment.md`](./product/use-cases-guitar-piano-singer-accompaniment.md) | `br-usecase-singer-accompaniment` | `br-usecase-singer-accompaniment-s01`–`s10` | Vietnamese use cases for the primary Guitar Classic and Piano singer-accompaniment paths, including the timeline/profile/voicing decision model; satisfies `br-prd01-s2`, `s31`, `s45`, `s57`, `s58`, `s62`. |
| [`design/UI.md`](./design/UI.md) | `br-ds-ui-document` | `br-ds-ui-*` | UI/design-system specification; only explicit requirement links use `satisfies`. |
| [`design/guitar-piano-singer-accompaniment-system-design.md`](./design/guitar-piano-singer-accompaniment-system-design.md) | `br-design-singer-accompaniment` | `br-design-singer-accompaniment-s01`–`s12` | Vietnamese target system-design analysis for the primary accompaniment paths, including LLM-led candidate orchestration and the timeline/profile/voicing model; satisfies `br-prd01-s2`, `s31`, `s39`–`s46`, `s57`, `s58`, `s62`. |
| [`design/guitar-piano-singer-accompaniment-low-fi-ui.md`](./design/guitar-piano-singer-accompaniment-low-fi-ui.md) | `br-ds-lowfi-singer-accompaniment` | `br-ds-lowfi-singer-accompaniment-s01`–`s10` | Vietnamese low-fidelity widescreen UI specification for the primary accompaniment workflow, including LLM option generation/repair; satisfies `br-prd01-s2`, `s31`, `s45`, `s46`, `s57`, `s58`, `s62`. |
| [`adr/0001-composer-publication-and-practice.md`](./adr/0001-composer-publication-and-practice.md) | `br-adr-0001` | `br-adr-0001-sNN` | Architecture decision record; satisfies `br-prd01-s7`. |
| [`adr/0002-fingerstyle-timegrid-authority.md`](./adr/0002-fingerstyle-timegrid-authority.md) | `br-adr-0002` | `br-adr-0002-sNN` | Architecture decision record; satisfies `br-prd01-s33`, `br-prd01-s59`. |
| [`adr/0003-llm-function-call-boundary.md`](./adr/0003-llm-function-call-boundary.md) | `br-adr-0003` | `br-adr-0003-sNN` | Architecture decision record; satisfies `br-prd01-s59`, `br-prd01-s60`. |
| [`guides/composer-source-flow.md`](./guides/composer-source-flow.md) | `br-guide-composer-source-flow` | `br-guide-composer-source-flow-sNN` | Directed source flow, invalidation, authority matrix. |
| [`guides/accompaniment-workflow.md`](./guides/accompaniment-workflow.md) | `br-guide-accompaniment-workflow` | `br-guide-accompaniment-workflow-sNN` | Accompaniment wizard workflow contract; satisfies `br-prd01-s60`, with `s17` also satisfying `br-prd01-s62`. |
| [`guides/singer-accompaniment-decision-model.md`](./guides/singer-accompaniment-decision-model.md) | `br-guide-singer-accompaniment-decision-model` | `br-guide-singer-accompaniment-decision-model-s01`–`s07` | Shared timeline / comping-profile / voicing-plan contract for Guitar Classic and target Piano accompaniment; explicitly satisfies `br-prd01-s62`. |
| [`guides/ensemble-workflow.md`](./guides/ensemble-workflow.md) | `br-guide-ensemble-workflow` | `br-guide-ensemble-workflow-sNN` | Experimental ensemble workflow guide (step ids, rules, promotion criteria). |
| [`guides/guitar-fingerstyle-arrangement-guide.md`](./guides/guitar-fingerstyle-arrangement-guide.md) | `br-guide-fingerstyle-arrangement` | `br-guide-fingerstyle-arrangement-sNN`; §10 retains `br-guide-fingerstyle-heuristic` and `br-guide-fingerstyle-heuristic-sNN` (merged from the former `OptimizeFingerStyleHeuristic.md`) | Fingerstyle arrangement guide; satisfies `br-prd01-s59`. |
| [`guides/timegrid-conversion-guide.md`](./guides/timegrid-conversion-guide.md) | `br-guide-timegrid-conversion` | `br-guide-timegrid-conversion-sNN` | TimeGrid conversion guide; satisfies `br-prd01-s59`. |
| [`guides/abcjs-tablature-rendering.md`](./guides/abcjs-tablature-rendering.md) | `br-guide-abcjs-tablature` | `br-guide-abcjs-tablature-sNN` | abcjs render boundary and TAB string-mapping rules. |
| [`theory/guitar-arpeggiation-theory.md`](./theory/guitar-arpeggiation-theory.md) | `br-guide-guitar-accompaniment` | `br-guide-guitar-accompaniment-sNN` (s01–s10, s15–s18, s20, s23–s24, s27–s34, s37–s41, s43–s45, s48–s49 active) | Guitar arpeggiation theory (formerly `guitar-accompaniment-theory.md`). |
| [`research/guitar-tab-and-interlude-research.md`](./research/guitar-tab-and-interlude-research.md) | `br-research-guitar-tab-interlude` | `br-research-guitar-tab-interlude-sNN` | Frozen TAB/interlude research notes (superseded). |
| This registry | `br-registry-universal-id` | `br-registry-universal-id-sNN` | Allocation and maintenance authority. |

## Traceability conventions
<!-- beads-id: br-registry-universal-id-s03 -->

```text
br-prd01 / br-prd01-sNN
  <- satisfies -- br-plan-00 / br-plan-NN
  <- satisfies -- br-rtm-01
  <- satisfies -- br-ds-ui-* (only for explicit UI requirement coverage)
```

`br-guide-*`, `br-research-*`, `br-docs-*`, and `br-adr-*` describe supporting knowledge or decisions. They remain unlinked unless a specific requirement relationship is stated in their text (ADRs 0001–0003 declare explicit `satisfies` links).

## Verification and maintenance
<!-- beads-id: br-registry-universal-id-s04 -->

Run the Universal ID extractor after any metadata change:

```bash
python .agents/skills/agenticse-gmind-universal-id-agentmem/scripts/extract_ids.py docs
```

Before adding a document, reserve its root and section namespace in the allocation table, then add one-line inline comments. The extractor validates syntax and the single-line rule; `npm run docs:check` (`scripts/docs-check.mjs`) runs it and audits uniqueness and that every `satisfies` target resolves to an active ID.

## Retired IDs
<!-- beads-id: br-registry-universal-id-s05 -->

Legacy non-`br-` IDs previously embedded in the PRD/PLAN/RTM were superseded by the canonical IDs above and are not active Universal IDs.

Retired on 2026-09-13 during the documentation restructure (content rewritten in English in `guides/accompaniment-workflow.md`, or removed as malformed headings inside code blocks):

| Retired ID | Former heading (in `guitar-accompaniment-theory.md`) | Replacement |
|---|---|---|
| `br-guide-guitar-accompaniment-s11` … `s14`, `s19`, `s21`, `s22`, `s25` | Phần II: pipeline overview, Step 1 key/scale/cadence prose, Giai đoạn 2 intro, Step 5 voicing prose, Step 6 | Rewritten in English as `br-guide-accompaniment-workflow-s02` … `s10`. (`s15`–`s18`, `s20`, `s23`, `s24` were **kept verbatim** in `theory/guitar-arpeggiation-theory.md` Phần III-B.) |
| `br-guide-guitar-accompaniment-s26` | "Dedicated Guitar Fingerstyle Generation" route/ownership paragraph | Removed; the rule lives in `br-guide-fingerstyle-arrangement` and `br-guide-composer-source-flow`. (`s27`–`s31` were **kept verbatim** in `theory/guitar-arpeggiation-theory.md` Phần III-B.) |
| `br-guide-guitar-accompaniment-s35` | Phần IV checklist | `br-guide-accompaniment-workflow-s15` |
| `br-guide-guitar-accompaniment-s36` | Phần V architecture references (absolute `file:///` links) | `br-guide-accompaniment-workflow-s16` |
| `br-guide-guitar-accompaniment-s42`, `s46`, `s47` | Pseudo-headings inside prompt example code blocks | Removed; prompt example kept under `s45` |
