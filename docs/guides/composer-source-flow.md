# Composer Source Flow
<!-- beads-id: br-guide-composer-source-flow -->

This guide is the source of truth for **how arrangement data flows through the Composer**: which representation is an authority, which is a projection, what invalidates what, and which seam is allowed to publish. `CLAUDE.md`, `ARCHITECTURE.md`, `CONTEXT.md`, and [ADR 0001](../adr/0001-composer-publication-and-practice.md) summarize and link here; do not duplicate these tables elsewhere.

## 1. Composer steps
<!-- beads-id: br-guide-composer-source-flow-s01 -->

1. Melody — `/compose/:slug/melody`
2. Harmony — `/compose/:slug/harmony`
3. Accompaniment — `/compose/:slug/accompaniment`
4. Guitar Fingerstyle — `/compose/:slug/guitar-fingerstyle` (independent sibling branch)
5. Export — `/compose/:slug/review` (stable route id `review`, displayed as Export)

`/practice/:slug` is the only Showcase experience. Ensemble remains experimental until its route, source contract, export mapping, and end-to-end coverage are implemented; it is not an active Composer step, persisted product branch, preview contributor, or exportable layer.

## 2. Directed source flow
<!-- beads-id: br-guide-composer-source-flow-s02 -->

```text
editable Melody ABC → selected, source-current Harmony Step 3 ABC
                                       ├→ Accompaniment support branch
                                       └→ Guitar Fingerstyle TimeGrid branch
```

- The editable melody ABC is the local draft root.
- Harmony Steps 1–3 share the accompaniment workflow (see [Accompaniment Workflow Guide](./accompaniment-workflow.md)). Only the user-selected Step 3 `voice-leading-validation` ABC is a downstream source.
- Before Step 3 is selected, downstream screens show the raw melody only as a read-only reference and must not generate branch output.
- Accompaniment and Guitar Fingerstyle are **siblings**. Never pass accompaniment ABC, Guitar Classic support data, instrument setup, options, completion state, or generated layers into the Fingerstyle branch.
- The Fingerstyle branch owns the canonical solo-guitar TimeGrid (see [TimeGrid Conversion Guide](./timegrid-conversion-guide.md)) and its deterministic projections.

## 3. Invalidation
<!-- beads-id: br-guide-composer-source-flow-s03 -->

A melody edit or a changed Harmony Step 3 selection makes affected workflow/branch drafts stale. Preserve the existing source-fingerprint, reset, hydration, and stale-result guards; stale artifacts must not become preview sources or exportable layers.

| Change | Invalidated draft state | Durable catalogue effect |
| --- | --- | --- |
| Melody changes | Harmony workflow and both downstream branches become source-stale; branch outputs cannot export | None until explicit Export |
| Harmony Step 3 selection changes | Accompaniment/Guitar Fingerstyle branch results and persisted Fingerstyle measures are cleared | None until explicit Export |
| Accompaniment or Fingerstyle changes | Only that sibling artifact changes | None until explicit Export |
| Storage pruning/quota failure | Missing draft artifacts are excluded from Export with warnings | No published files change |
| Export | No implicit draft reset | Selected named layer files and metadata are upserted; unselected layers and the Markdown body are preserved |

## 4. Authority and projection matrix
<!-- beads-id: br-guide-composer-source-flow-s04 -->

| Representation | Owner / purpose | May become a downstream source or durable layer? |
| --- | --- | --- |
| Editable melody ABC | Composer workspace draft root | Yes: it feeds the source-current Harmony workflow. |
| Selected Harmony Step 3 ABC | `voice-leading-validation` result | Yes: it is the only harmonic source for Accompaniment and Fingerstyle. |
| Accompaniment support ABC | Accompaniment sibling branch | Yes for its own preview/export layer; never Fingerstyle input. |
| `TimeSliceMeasure[]` | Guitar Fingerstyle physical arrangement authority | Yes for Fingerstyle editing and deterministic Guitar projections. |
| Generated Guitar ABC / ASCII tab | TimeGrid projection | Preview/export/display artifact; never an alternate edit authority. |
| `ArrangementSourceGraph.exportableLayers` | Source-current export eligibility | Candidate layers only; Export requires explicit user selection. |
| Published catalogue notation | `publish-arrangement.ts` output | The sole source for Practice/Showcase. |

Module roles:

- `src/components/composer/workspace/arrangement-source/arrangement-source-graph.ts` establishes source-current provenance and named export eligibility.
- `src/components/composer/workspace/arrangement-preview-model.ts` is a projection adapter that applies visibility, volumes, synth choices, and TAB options to that graph. Its rendered ABC must not be persisted as a new source.
- `src/lib/theory/abc-layer-visibility.ts` transforms the display/playback projection; `cleanAbcForExport()` produces portable export text. Neither changes upstream authority.

## 5. Layers Visibility guardrails
<!-- beads-id: br-guide-composer-source-flow-s05 -->

- `abc-layer-visibility.ts` is the canonical semantic visibility/volume transformation. `arrangement-preview-model.ts` composes source-graph output with that projection and computes synth/TAB render options.
- Visibility and volume state is preview/playback state only: it must not change branch provenance, source-current eligibility, canonical arrangement ABC, TimeGrid data, or exported layer contents.
- Preserve strong-beat gating until `key-beats` completes. Keep a Melody carrier when visible lyrics or chord symbols need it.
- `TAB` is a render-only option enabled only for a visible TAB-capable Guitar voice; it is not an ABC text layer or an independent audio authority. See [ABCJS Tablature Rendering](./abcjs-tablature-rendering.md).

## 6. Export and Practice
<!-- beads-id: br-guide-composer-source-flow-s06 -->

- Export (`src/components/composer/workspace/export/ExportStep.tsx` → `src/app/actions/publish-arrangement.ts`) is the only durable catalogue-publication seam. The user explicitly selects `melody`, `harmony`, `accompaniment`, and/or `guitar-fingerstyle` layers; publication upserts the selected ABC files and matching `abcNotations` metadata while preserving the song Markdown body.
- `/practice/:slug` reads published catalogue notation only and must never overlay Composer localStorage drafts.
- Decision record: [ADR 0001](../adr/0001-composer-publication-and-practice.md).
