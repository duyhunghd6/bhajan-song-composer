# Iteration report — COMPOSER-TOKENS-01 — attempt 1
<!-- beads-id: br-qa-jev-composer-tokens-a01 -->

- UTC time / version: 2026-10-04 05:22:57; working tree with semantic tokens and shared Composer controls.
- Testcase / URL: COMPOSER-TOKENS-01; http://10.0.1.143:9974/compose/ganesha/harmony.
- Preconditions and side effects: existing Harmony read-only; no source edits, generation, downloads or publication.
- Prior report: [compact toolbar attempt](20261004T051035Z-STUDIO-COMPACT-TOOLBAR-01-attempt-1-iteration-report.md); applicable notes copied verbatim into the goal.
- Exact browser_start goal:

```text
Testcase COMPOSER-TOKENS-01 only: read-only Harmony button design review. Prior notes verbatim: browser_step returned `Model provider returned HTTP 400; no action executed.` Independent inspect confirms score and accessible Download PDF / Copy ABCJS ABC controls and no keyboard instruction strip, but does not expose geometry for same-row/icon-only/70% scale assertions. INCONCLUSIVE for the complete MCP testcase. Close confirmed closed true, tab_kept false. Do not treat the provider failure as a product bug; keep Playwright geometry evidence separate. Preconditions: LAN URL /compose/ganesha/harmony loaded, no edits. Steps: inspect only, wait for hydration and score. Expected: accessible Play, Download PDF and Copy ABCJS ABC buttons on compact toolbar; action controls use consistent 32/36px desktop heights, intrinsic action widths and selected workflow cards. Report geometry limitations instead of assuming sizes from text. No clicking, generation, publication, downloads, source changes, storage clearing or navigation. Stop after this single review.
```

- Run ID / prefix / budget: 13dee618bee34a71bce46ee1a18e1312; mcp__jev_ultrafast__; one read-only start/inspect review.
- Action log: readiness true; start succeeded; independent browser_inspect succeeded; browser_close succeeded. No browser_step requested because the prior provider HTTP 400 has no recovery evidence and this testcase permits observation only.
- Executor claim: none; no LLM step or DONE.
- Independent evidence: inspect confirmed Harmony route, Ganesha score, accessible Play / Download PDF / Copy ABCJS ABC buttons, Harmony assistant and Start shaping harmony action. Geometry, computed colors and target sizes are unavailable from the returned observation.
- Reviewer verdict: INCONCLUSIVE for the full design testcase. Observed semantics pass; exact geometry/color assertions need independent deterministic evidence. No application failure or agent wrong-element action observed.
- Cleanup: browser_close({run_id: "13dee618bee34a71bce46ee1a18e1312", keep_tab: false}) returned closed true, tab_kept false.
- Limitations / next action: do not infer pixel sizes from accessibility text or repeatedly invoke the known failing provider without recovery. Keep Playwright results separate.
- Persistent notes updated below the prior compact-toolbar entry.
- Separate deterministic evidence: 16 Playwright cases passed, covering five stage layouts, two source gates, light/dark 44px touch targets and intrinsic CTA width, keyboard playback and guitar shape/audio. Desktop icon targets measure 32px; mobile focus outline measures 2px. Screenshots reviewed. Initial dev compilation failed with stale CSS output and a Tailwind scan escaping the repository through skill symlinks; restricting Tailwind source scanning to src and rebuilding the generated dev cache restored compilation. No musical data changed.

