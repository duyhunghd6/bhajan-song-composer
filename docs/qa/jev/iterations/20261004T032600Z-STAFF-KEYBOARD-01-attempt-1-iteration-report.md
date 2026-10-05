# Iteration report — STAFF-KEYBOARD-01 — attempt 1
<!-- beads-id: br-qa-jev-staff-keyboard-a01 -->

- UTC date / version: 2026-10-04; current development working tree.
- Testcase / URL: STAFF-KEYBOARD-01; http://bhajan-song-composer-2.orca.localhost:60621/compose/ganesha/harmony.
- Preconditions / side effects: existing draft; playback and focus only. No changes to source, shapes, generation, publication or storage.
- Prior reports: [proxy reachability](20261003T120857Z-GUITAR-PICKER-CANCEL-01-attempt-1-iteration-report.md), [executor failure](20261003T193900Z-GUITAR-SAME-BASS-AUDIO-01-attempt-1-iteration-report.md). Exact notes fed appear in the goal below.
- Exact browser_start goal:

```text
Testcase STAFF-KEYBOARD-01 only. Existing Ganesha Harmony draft, playback and focus only. No editing, shape saves, generation, publication or storage clearing. Prior notes verbatim: "the supplied Orca proxy URL also returned ERR_CONNECTION_REFUSED at start and independent inspect." "browser_step failed with ValueError and empty history; independent inspect showed no picker opened." "Always pass keep_tab false to close." Preconditions: wait for Harmony score and Play control. Steps: focus the score or page background; press Space once; verify Pause appears; press Space again; verify Play appears; focus score, ArrowRight twice then ArrowLeft; verify focus moves between score notes/chords without navigation. Expected route remains /compose/ganesha/harmony, score stays visible, Space toggles playback and arrows move visible focus. Stop on inaccessible page or unsupported keyboard action; do not substitute text entry for key presses. DOM does not prove audible audio or absence of transient reload; record those limitations.
```

- Tool prefix / run ID / budget: mcp__jev_ultrafast__; no run ID returned; 20 actions / 5 minutes.
- Action log: browser_start returned isError true, `Error executing tool browser_start: no close frame received or sent`. No steps executed.
- Executor claim: transport error; no DONE or outcome evidence.
- Independent evidence: browser_inspect could not be addressed without a run ID. Shell HTTP 200 at the supplied URL is separate evidence and does not prove MCP browser reachability. None of the keyboard assertions were observed by MCP.
- Reviewer verdict: BLOCKED by MCP transport failure. No application failure or executing-agent error established.
- Cleanup: no run ID was returned, so browser_close could not be addressed; tab creation/closure is unknown. No further MCP run started. Resolve transport and unknown tab cleanup before another run.
- Independent deterministic checks: Playwright keyboard, loading and guitar picker regression cases pass (six tests), including Space transport, chord Enter activation, dialog isolation, cancellation during sample loading, stable score DOM on loop changes, and one document navigation across keyboard/mixer interactions. Four loading/keyboard tests also pass on the exact supplied Orca URL. These are not MCP results.
- Limitations / next action: MCP execution remains unverified. Tests reproduce score replacement on loop settings before the fix; actual intermittent whole-document reload has not been reproduced. Volume changes alter MIDI directives and may intentionally replace the score. Recheck a fresh MCP run after transport/cleanup recovery.
- Persistent notes updated with startup failure and keyboard ownership rules.
