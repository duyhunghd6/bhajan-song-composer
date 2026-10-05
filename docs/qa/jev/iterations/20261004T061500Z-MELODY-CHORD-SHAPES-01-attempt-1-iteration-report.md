# Iteration report — MELODY-CHORD-SHAPES-01 — attempt 1
<!-- beads-id: br-qa-jev-melody-chords-a01 -->

- UTC time: 2026-10-04 06:16:07 UTC; current working tree Melody chord-shape integration.
- Testcase / URL: MELODY-CHORD-SHAPES-01; http://bhajan-song-composer-2.orca.localhost:60621/compose/ganesha/melody; shared MCP Chrome profile.
- Preconditions / side effects: existing song, hydrated score with chord symbols. Read-only picker inspection and cancellation only.
- Prior report: [Score workspace zoom](20261004T054957Z-SCORE-WORKSPACE-ZOOM-01-attempt-1-iteration-report.md); relevant startup/cleanup notes included verbatim below.
- Exact browser_start goal:

```text
Testcase MELODY-CHORD-SHAPES-01 only. Prior testing notes verbatim: browser_ready returned ready true, but browser_start failed with code -32602, "No session with given id", and returned no run ID. No action or independent inspect was possible. BLOCKED by MCP session startup, not an application failure. No run ID was available for browser_close. Immediate read-only CDP target inventory showed no Composer tabs, resolving cleanup by absence. Deterministic Playwright zoom/pan checks are separate evidence. Preconditions: existing Ganesha Melody page, hydrated score with quoted chord symbols. Steps: observe melody score and chord diagrams; open the first guitar chord shape picker; inspect available open and barre alternatives; close with Escape without saving. Expected: remain on /compose/ganesha/melody; diagrams displayed; picker shows chord name, string/fret alternatives and Listen controls; closing leaves source unchanged. No source edits, saving shapes, AI generation, downloads, publication or storage changes. Stop if unavailable. One testcase only.
```

- Run ID / prefix / budget: no ID returned; mcp__jev_ultrafast__; one picker open/close.
- Action log: browser_start returned error -32602, "No session with given id". No steps executed.
- Executor claim: none.
- Independent evidence: no browser_inspect could be addressed without a run ID; no MCP assertion verified.
- Reviewer verdict: BLOCKED by MCP session startup, not an application failure.
- Cleanup: no run ID available for browser_close. Immediate read-only CDP target inventory showed no Composer tabs; cleanup resolved by absence. Unrelated tabs left untouched.
- Limitations: MCP did not verify the UI. Deterministic Playwright picker/audio/persistence results are separate evidence.
- Testing notes: added Melody chord-shape entry.
- Separate deterministic evidence: final expanded Playwright run passed 15 of 16 cases, including all three Melody/Harmony/Accompaniment picker cases (audio change, reload persistence, scoped choices, cancellation, tempo/diagram separation), source-selection cases, beat/TAB spacing and Guitar Fingerstyle TAB layout. Melody fixture has only the melody voice and verifies its persisted ABC remains unchanged. Screenshot reviewed after correcting tempo/diagram overlap in the shared diagram renderer.
- Remaining deterministic failures: expanded layout suite expects Harmony score within 100px of navigation but observes 192px; a separate dashboard navigation check expects the absent heading "Accompaniment workflow". These assertions are outside the Melody chord-shape acceptance checks and remain unresolved. No full E2E suite pass is claimed.
- Static/unit evidence: TypeScript, scoped ESLint and docs-check pass. Full unit suite: 582 passed, 2 failed in accompaniment-abc.test.ts (Guitar voice/program expectations), matching the failures documented in the prior report; those production modules were not changed for this task.
