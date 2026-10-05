# Iteration report — HARMONY-FLAT-STAFF-01 — attempt 1
<!-- beads-id: br-qa-jev-flat-staff-a01 -->

- UTC date / revision: 2026-10-05; working tree Harmony layout.
- URL: http://bhajan-song-composer.orca.localhost:64790/compose/ganesha/harmony
- Preconditions / authorized effects: hydrated Ganesha; read-only layout review, no draft or catalogue edits.
- Prior report: [Sidebar attempt 1](20261004T063300Z-HARMONY-SIDEBAR-LAYERS-01-attempt-1-iteration-report.md); notes included verbatim in goal.
- Exact browser_start goal:

```text
HARMONY-FLAT-STAFF-01 single read-only layout testcase. Inspect Harmony score playback nested frames, toolbar and score. Do not edit, save, publish or change drafts. Expected after fix: one score workspace frame, no nested rounded player frame or inner score scroll container; playback and zoom controls retained. Relevant prior note verbatim: [Attempt 1](iterations/20261004T063300Z-HARMONY-SIDEBAR-LAYERS-01-attempt-1-iteration-report.md): browser_start failed -32602, "No session with given id", without a run ID. No inspect/close could be addressed. Immediate CDP inventory found no Composer tabs, resolving cleanup by absence. BLOCKED by session startup. Left Score tools now contains only Layers & volume, with independent Strong Beats and Missing Chord switches. Right Harmony assistant owns Detected strong beats, Fill missing chords, source ABC and navigation/reset controls. Switches affect score annotations only; analysis/actions remain available when off. Separate Playwright regression passes; no MCP PASS claimed.
```

- Run ID / prefix: no run ID returned; mcp__jev_ultrafast__.
- Action log: browser_start returned `Error executing tool browser_start: no close frame received or sent`. No actions executed.
- Executor claim: none.
- Independent MCP evidence: browser_inspect unavailable without a run ID; no assertions verified.
- Reviewer verdict: BLOCKED by transport, not application failure.
- Cleanup: no run ID for addressed browser_close; no ID invented. Immediate read-only CDP inventory at localhost:9222/json/list contained no Composer tabs. Cleanup resolved by absence; unrelated tabs untouched.
- Separate deterministic evidence: Playwright flat-staff testcase passes on the requested URL. Border/scroll assertions, retained controls, focus frame restoration and mobile page width verified. Desktop/mobile screenshots inspected. First deterministic attempt failed because Escape was sent with focus outside the score; explicitly focusing the viewport resolved the test action. These are not MCP results.
- Validation: TypeScript passes; two playback component tests pass. Full unit suite has two unrelated accompaniment MIDI program expectation failures (24 versus 25). Scoped lint has zero errors and two existing warnings.
- Notes: shared player owns the Harmony frame; embedded ScoreViewport removes its border/inset outside focus mode, and the inner sheet no longer scrolls.
