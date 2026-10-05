# Iteration report — STUDIO-COMPACT-TOOLBAR-01 — attempt 1
<!-- beads-id: br-qa-jev-compact-toolbar-a01 -->

- UTC report time / version: 2026-10-04 05:10:35, working tree with compact toolbar and 70% Composer notation size.
- Testcase / URL: STUDIO-COMPACT-TOOLBAR-01; http://10.0.1.143:9974/compose/ganesha/harmony.
- Preconditions and side effects: read-only review of existing Harmony; no source changes, generation, downloads, publication or storage clearing.
- Prior report: [layout transport failure](20261004T045156Z-STUDIO-MELODY-LAYOUT-01-attempt-1-iteration-report.md); cleanup previously resolved by target absence. Readiness returned true before this run.
- Exact browser_start goal:

```text
Testcase STUDIO-COMPACT-TOOLBAR-01 only, read-only Harmony toolbar and notation review. URL /compose/ganesha/harmony. Prior notes verbatim: "readiness succeeded but browser_start again returned `no close frame received or sent`, with no run ID." "Tab cleanup is resolved by absence; no unrelated tabs were touched." "Always pass keep_tab false to close." Preconditions: wait for score SVG and playback toolbar; desktop viewport. Steps: inspect without editing or clicking. Expected: no visible keyboard instruction strip; Download PDF and Copy ABCJS ABC are icon-only accessible buttons in the same top toolbar as playback and KEY/SIG/BPM; no separate export action row; score uses 70% notation scale and right assistant is wider. Do not infer exact scale from DOM text alone; report observed layout and limitations. Do not generate, publish, change controls, save, clear storage, navigate, or download. Stop after this single testcase.
```

- Run ID / prefix / budget: ae2cac46dc6d463ebc069c8d32e0fc21; mcp__jev_ultrafast__; one read-only testcase, at most 20 actions / 5 minutes.
- Action log: browser_start succeeded and returned the Harmony page. browser_step request compact-readonly-01 returned “Model provider returned HTTP 400; no action executed.” No decision or history. Stopped immediately and called browser_inspect.
- Executor claim: provider error; no DONE, no action executed.
- Independent evidence: browser_inspect confirmed the Harmony route, Ganesha score content, Play, Download PDF and Copy ABCJS ABC accessible controls, KEY/SIG/BPM metadata, and Harmony assistant. The old Space instruction strip is absent from observed page text. Inspect does not provide geometry or screenshot evidence for the exact 70% size, icon-only appearance or same-row placement.
- Reviewer verdict: INCONCLUSIVE for the complete MCP layout testcase. Provider failure is not an application failure or wrong-element agent error. Geometry and notation-size assertions require separate deterministic measurements.
- Cleanup: browser_close with run_id ae2cac46dc6d463ebc069c8d32e0fc21 and keep_tab false returned closed true and tab_kept false.
- Limitations / next action: deterministic Playwright checks are recorded separately. Do not repeat provider-failing steps without recovery.
- Persistent notes updated with successful transport, provider HTTP 400 and confirmed cleanup.

- Separate deterministic evidence: seven Composer layout/gate cases and five keyboard/playback cases pass after compact-toolbar tuning. SVG screen transforms measure approximately 0.7; icon buttons share the playback row; desktop sidebars exceed 600px at a 1600px viewport. Two guitar-shape selection/audio regression cases also pass. Fingerstyle TAB with persisted melody-only fret events was visually inspected at 70%. An initial empty TimeGrid fixture had no fret numbers, so the TAB test now seeds valid tablature. Keyboard line-boundary tests now locate the last rendered chord rather than assuming two chords per line. These are Playwright results and do not upgrade the MCP verdict.
