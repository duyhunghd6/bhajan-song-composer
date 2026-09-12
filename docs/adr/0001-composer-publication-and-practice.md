# ADR 0001: Publish selected Composer layers to Practice
<!-- beads-id: br-adr-0001 | satisfies: br-prd01-s7 -->

## Status
<!-- beads-id: br-adr-0001-s1 -->
Accepted — 2026-07-23

## Context
<!-- beads-id: br-adr-0001-s2 -->

Composer drafts are browser-local, while Practice must be a durable experience. The previous Review screen could save a combined arrangement as the melody file, and Practice rebuilt a score from local Composer state. That made the same Practice URL browser-dependent and could overwrite the source melody.

## Decision
<!-- beads-id: br-adr-0001-s3 | satisfies: br-prd01-s7 -->

- Keep `/compose/:slug/review` as the stable route ID, but present it as **Export**.
- Export exposes valid named layers (`melody`, `harmony`, `accompaniment`, `guitar-fingerstyle`) and requires an explicit user selection.
- Publication upserts selected ABC files and matching `abcNotations` metadata while preserving the song Markdown body.
- `/practice/:slug` is the only Showcase. It reads only published catalogue notation, with client-local practice controls scoped to the published notation content.
- The selected Harmony Step 3 output is the required source for both independent downstream branches; Accompaniment never feeds Guitar Fingerstyle.
- Ensemble remains experimental until it has a complete route, source/freshness contract, export mapping, and end-to-end coverage.

## Consequences
<!-- beads-id: br-adr-0001-s4 -->

The publication seam owns the durable catalogue contract. Composer and Practice no longer need to understand each other’s local persistence implementation. Existing public playback pages are unchanged. Ensemble theory code remains available but must not be represented as a shipped Composer step.
