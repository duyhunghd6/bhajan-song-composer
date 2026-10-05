# Project agent instructions

Read [CLAUDE.md](CLAUDE.md) for shared project constraints, validation commands and domain contracts. Its Claude-specific model selection applies to Claude Code.

## E2E with jev-ultrafast-mcp

Use **jev-ultrafast-mcp** for agent-driven E2E; follow [the full protocol](docs/qa/jev-ultrafast-e2e.md).

- One testcase only per MCP run/goal. Every call must concern that same testcase; multiple steps are allowed. Close it before starting the next testcase.
- Before starting, read [testing notes](docs/qa/jev/testing-notes.md) and prior reports under [iterations](docs/qa/jev/iterations). Feed the relevant notes verbatim into the goal with concrete preconditions, steps and expected results.
- Verify observations independently with `browser_inspect`; the executing LLM can choose a wrong element, misunderstand the case or declare success incorrectly. Classify agent error separately from confirmed application failure.
- After every attempt, always send `browser_close({run_id, keep_tab: false})`, even on failure/timeout/abort. Check its response; record and resolve cleanup failures before another run.
- Save a unique iteration-report using [the template](docs/qa/jev/iteration-report-template.md), then update persistent notes. Reruns use new run IDs and reports and include lessons from the previous attempt.
- Preserve Playwright for deterministic CI/regression checks. Do not claim MCP execution from Playwright results.
