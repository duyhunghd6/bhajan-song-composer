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
| [`PRD.md`](./PRD.md) | `br-prd01` | `br-prd01-sNN` | Product requirements source. |
| [`PLAN.md`](./PLAN.md) | `br-plan-00` | `br-plan-01`–`br-plan-12` | Implementation plan; plan elements satisfy PRD sections. |
| [`PRD-to-PLAN-statematrix.md`](./PRD-to-PLAN-statematrix.md) | `br-rtm-01` | `br-rtm-01-sNN` | Trace matrix; root satisfies `br-prd01`. |
| [`UI.md`](./UI.md) | `br-ds-ui-document` | `br-ds-ui-*` | UI/design-system specification; only explicit requirement links use `satisfies`. |
| [`adr/0001-composer-publication-and-practice.md`](./adr/0001-composer-publication-and-practice.md) | `br-adr-0001` | `br-adr-0001-sNN` | Architecture decision record. |
| [`OptimizeFingerStyleHeuristic.md`](./OptimizeFingerStyleHeuristic.md) | `br-guide-fingerstyle-heuristic` | `br-guide-fingerstyle-heuristic-sNN` | Fingerstyle placement implementation guide. |
| [`guitar-accompaniment-theory.md`](./guitar-accompaniment-theory.md) | `br-guide-guitar-accompaniment` | `br-guide-guitar-accompaniment-sNN` | Guitar accompaniment theory and workflow. |
| [`guitar-fingerstyle-arrangement-guide.md`](./guitar-fingerstyle-arrangement-guide.md) | `br-guide-fingerstyle-arrangement` | `br-guide-fingerstyle-arrangement-sNN` | Fingerstyle arrangement guide. |
| [`guitar-tab-and-interlude-research.md`](./guitar-tab-and-interlude-research.md) | `br-research-guitar-tab-interlude` | `br-research-guitar-tab-interlude-sNN` | TAB/interlude research notes. |
| [`timegrid-conversion-guide.md`](./timegrid-conversion-guide.md) | `br-guide-timegrid-conversion` | `br-guide-timegrid-conversion-sNN` | TimeGrid conversion guide. |
| This registry | `br-registry-universal-id` | `br-registry-universal-id-sNN` | Allocation and maintenance authority. |

## Traceability conventions
<!-- beads-id: br-registry-universal-id-s03 -->

```text
br-prd01 / br-prd01-sNN
  <- satisfies -- br-plan-00 / br-plan-NN
  <- satisfies -- br-rtm-01
  <- satisfies -- br-ds-ui-* (only for explicit UI requirement coverage)
```

`br-guide-*`, `br-research-*`, and `br-adr-*` describe supporting knowledge or decisions. They remain unlinked unless a specific requirement relationship is stated in their text.

## Verification and maintenance
<!-- beads-id: br-registry-universal-id-s04 -->

Run the Universal ID extractor after any metadata change:

```bash
python .agents/skills/agenticse-gmind-universal-id-agentmem/scripts/extract_ids.py docs
```

Before adding a document, reserve its root and section namespace in the allocation table, then add one-line inline comments. The extractor validates syntax and the single-line rule; the repository-wide duplicate/reference audit verifies uniqueness and that every `satisfies` target resolves to an active ID.

## Retired IDs
<!-- beads-id: br-registry-universal-id-s05 -->

None. Legacy non-`br-` IDs previously embedded in the PRD/PLAN/RTM have been superseded by the canonical IDs above and are not active Universal IDs.
