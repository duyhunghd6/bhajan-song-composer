# Iteration report — STUDIO-MELODY-LAYOUT-01 — attempt 1
<!-- beads-id: br-qa-jev-studio-melody-layout-a01 -->

- UTC report time / app version: 2026-10-04 04:51:56, working tree with shared Composer studio layout.
- Testcase / URL: STUDIO-MELODY-LAYOUT-01; http://10.0.1.143:9974/compose/ganesha/melody.
- Preconditions / authorized effects: read-only layout review; no edits, generation, publication or draft clearing.
- Prior reports: [transport failure](20261004T032600Z-STAFF-KEYBOARD-01-attempt-1-iteration-report.md). Readiness returned true. Read-only CDP target inventory confirmed no orphan Composer tab from the prior failed run before this attempt.
- Exact browser_start goal:

```text
Testcase STUDIO-MELODY-LAYOUT-01 only. Read-only layout inspection of /compose/ganesha/melody. Do not edit ABC, validate with AI, reset, clear drafts, publish, or navigate to another route. Relevant prior notes verbatim: "Shell HTTP 200 does not establish MCP readiness." "Read-only start/inspect still work." "Always pass keep_tab false to close." Recovery: browser_ready now returns true and read-only CDP inventory confirms no orphan Composer tab from the earlier failed run. Preconditions: wait for the ABC score SVG and playback controls to load. Steps: inspect the current page without clicking. Expected: composer step navigation at top; no large Shape your melody hero; main score playback begins directly below navigation; ABC source, Undo, Redo, Validate ABCNotation, Continue to harmony are available in the side panel (below score on narrow screens). Report viewport and observed positions. Do not infer audible playback. Stop after this one layout inspection.
```

- Run ID / prefix / budget: no run ID returned; mcp__jev_ultrafast__; one read-only inspection.
- Action log: browser_start with visible true and keep_tab false returned isError true, “no close frame received or sent”. No browser_step executed.
- Executor claim: transport failure; no DONE.
- Independent evidence: browser_inspect cannot be addressed without a run ID; none of the layout assertions established by MCP.
- Reviewer verdict: BLOCKED by transport. No application failure or executor interpretation error established.
- Cleanup: browser_close cannot be addressed without a run ID. Do not invent an ID. No subsequent MCP run started; a subsequent read-only CDP inventory at 04:51:56 UTC returned no Composer targets, resolving tab cleanup by absence.
- Limitations / next action: deterministic Playwright checks are separate evidence. Recheck transport before another MCP attempt.
- Persistent notes: new layout entry records the startup failure and cleanup limitation.

- Separate deterministic validation: `e2e/composer-studio-layout.spec.ts` passed all six cases. Four seeded page cases check desktop score/nav placement, tool positions, tablet/mobile overflow and score-first stacking; two cases verify missing Harmony keeps the source preview visible and generation gated. Desktop/mobile screenshots were inspected. Light and dark layouts were checked across two executions. POST actions were blocked in isolated browser contexts; no generation or publication was invoked. These results do not change the MCP verdict.
