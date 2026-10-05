# Iteration report — SCORE-SELECTION-01 — attempt 1
<!-- beads-id: br-qa-jev-score-selection-a01 -->

- UTC time / version: 2026-10-04 06:30:45; working tree score selection and Command-pan.
- Testcase / URL: SCORE-SELECTION-01; http://bhajan-song-composer-2.orca.localhost:60621/compose/ganesha/harmony.
- Preconditions / authorized side effects: existing Harmony, Explore; select one note only, no source mutation.
- Prior evidence: [workspace zoom report](20261004T054957Z-SCORE-WORKSPACE-ZOOM-01-attempt-1-iteration-report.md); startup/cleanup notes copied verbatim into goal.
- Exact browser_start goal:

```text
Testcase SCORE-SELECTION-01 only. Prior testing notes verbatim: browser_ready returned ready true, but browser_start failed with code -32602, "No session with given id", and returned no run ID. No action or independent inspect was possible. BLOCKED by MCP session startup, not an application failure. No run ID was available for browser_close. Immediate read-only CDP target inventory showed no Composer tabs, resolving cleanup by absence. Deterministic Playwright zoom/pan checks are separate evidence. Preconditions: hydrated Ganesha Harmony score, Explore mode, no musical edits. Steps: click exactly one note (not a chord); independently inspect Score selection showing 1 notes, 0 chords selected. Expected: route stays Harmony; no picker opens; toolbar explains drag selection and Cmd/Ctrl pan. Selection is view-only; do not Edit, generate, publish, download, clear storage or alter music. Stop after this single selection testcase.
```

- Tool prefix / budget: mcp__jev_ultrafast__; one note selection.
- Action log: browser_ready returned ready true; browser_start returned -32602, "No session with given id", without a run ID. No steps executed.
- Executor claim: none.
- Independent evidence: no run ID to address browser_inspect; no assertion verified.
- Reviewer verdict: BLOCKED by MCP startup, not application failure or agent error.
- Cleanup: browser_close cannot be addressed without an ID; no ID invented. Immediate read-only CDP inventory returned no Composer tabs. Cleanup resolved by absence, unrelated tabs untouched.
- Limitations / next action: deterministic Playwright selection and gesture regressions are separate evidence, not MCP execution.
- Testing notes: added selection testcase entry.
- Separate deterministic validation: 18 Playwright regressions passed across selection, workspace editing, keyboard, guitar picker and mobile. After tightening double-click suppression for completed pan/selection gestures, all 9 affected selection/workspace tests passed again. A seeded selection screenshot was visually reviewed: three note glyphs and one logical chord highlighted with a bounded rectangle at 120% zoom. No MCP PASS is claimed.
- Static/unit validation: TypeScript, scoped ESLint and docs checks passed. Full unit suite: 599 passed, 2 pre-existing accompaniment MIDI-program expectation failures. Updated the preview fixture assertion to preserve the current volume-adjusted Harmony render input.
