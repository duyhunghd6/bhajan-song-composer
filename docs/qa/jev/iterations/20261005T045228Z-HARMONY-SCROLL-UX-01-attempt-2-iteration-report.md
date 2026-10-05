# Iteration report — HARMONY-SCROLL-UX-01 — attempt 2
<!-- beads-id: br-qa-jev-scroll-ux-a02 -->

- UTC time: 2026-10-05T04:52:28.899Z; current working tree.
- URL: http://bhajan-song-composer.orca.localhost:64790/compose/ganesha/harmony
- Preconditions / effects: existing Ganesha; view-only zoom, scrolling and resize, no music or catalogue writes.
- Prior report: [Attempt 1](20261005T040737Z-HARMONY-SCROLL-UX-01-attempt-1-iteration-report.md); applicable note fed verbatim.
- Exact browser_start goal:

```text
HARMONY-SCROLL-UX-01 attempt 2. One testcase: responsive Harmony score navigation. Open supplied Ganesha route; wait for notes. Verify fitted score without horizontal overflow or visible scrollbar tracks. Resize window narrower then wider if supported; verify it remains fitted. Click Zoom in twice; wheel scroll vertically and Shift+wheel horizontally; Fit restores width. Do not edit music, publish, reset storage or catalogue. Stop after this testcase. Prior note verbatim: [Attempt 1](iterations/20261005T040737Z-HARMONY-SCROLL-UX-01-attempt-1-iteration-report.md): read-only start on the requested Orca Harmony URL returned `no close frame received or sent`, without a run ID. No inspect or addressed close possible. Immediate CDP inventory contained no Composer tabs; cleanup resolved by absence. BLOCKED by transport. Source review shows a 900px default canvas, initial zoom 1, overflow auto, existing Shift+wheel support and Fit width inside a menu. Live dimensions and gesture behavior remain unverified. No UI implementation changed during this proposal. Current attempt follows implementation; do not reuse prior source observations as current evidence.
```

- Run ID / prefix / budget: no run ID; mcp__jev_ultrafast__; one testcase.
- Actions: browser_start failed with "no close frame received or sent"; no steps executed.
- Executor claim: none.
- Independent MCP assertions: browser_inspect unavailable without a run ID. No MCP assertion verified.
- Reviewer verdict: BLOCKED by transport, not application failure.
- Cleanup: browser_close cannot be addressed without a run ID. Immediate read-only CDP inventory at localhost:9222/json/list found no Composer tabs, resolving cleanup by absence.
- Separate deterministic evidence: responsive-score and flat-staff Playwright tests passed on the requested URL. Six widths 390–1600px, score/document horizontal containment, preserved notes, hidden scrollbar tracks, wheel/Shift+wheel, Fit and focus tested. Desktop/mobile screenshots inspected. TypeScript passed. These results do not establish MCP success.
- Limitations: full unit run reports two existing accompaniment MIDI program expectation failures (24 versus 25); responsive minimum-width expectation updated and affected component tests pass.
- Notes updated: attempt 2 transport limitation and deterministic evidence recorded.
- Additional TAB check: attempting to toggle TAB on melody-only Ganesha correctly found the control disabled; this test setup error is not a product failure. Removed that unsupported step from the responsive testcase. Existing guitar-fingerstyle studio-layout regression with generated TAB fixture passes; screenshot inspected. Component tests pass after updating the Harmony minimum-width expectation.
