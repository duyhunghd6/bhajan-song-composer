# Iteration report — HARMONY-REFRESH-01 — attempt 1
<!-- beads-id: br-qa-jev-refresh-a01 -->

- Testcase: idle Harmony stability, existing Ganesha draft, read-only; LAN URL http://10.0.1.143:9974/compose/ganesha/harmony.
- Prior notes: transport failure in HARMONY-FLAT-STAFF-01, fed verbatim below.
- Exact browser_start goal:

```text
HARMONY-REFRESH-01: Read-only observation of periodic refresh on Harmony. Preconditions: existing Ganesha draft must remain untouched. Prior notes verbatim: browser_start returned `no close frame received or sent`, without a run ID. No inspect or addressed close possible. BLOCKED by transport, not application failure. Steps: observe page initially and after waiting, identify any periodic reload or score reset. Expected: route remains Harmony, score remains stable while idle. Do not edit, clear storage, publish, or navigate elsewhere.
```

- Tool prefix: mcp__jev_ultrafast__; startup returned `no close frame received or sent`. No run ID, actions, executor claim or inspect possible.
- Reviewer verdict: BLOCKED by MCP transport; no MCP PASS claimed.
- Cleanup: browser_close cannot be addressed without a run ID. Independent read-only CDP target inventory found only profile picker and extension service worker, no Composer tabs; cleanup resolved by absence.
- Separate deterministic browser probe reproduced a reload and repeated HMR WebSocket handshake failures. Origin-bearing curl upgrade failed; origin-free upgrade succeeded. Installed Next.js dev origin guard rejects the LAN host absent allowedDevOrigins. Score DOM stayed stable while idle, excluding a score resize loop in the observed window.
- Fix: allow the requested LAN host in next.config.ts. Follow-up deterministic browser evidence is reported in the task response.
