# Persistent JEV testing notes
<!-- beads-id: br-qa-jev-notes -->

## HARMONY-SCROLL-UX-01 — overflow and gestures review
<!-- beads-id: br-qa-jev-notes-scroll-ux -->

[Attempt 2](iterations/20261005T045228Z-HARMONY-SCROLL-UX-01-attempt-2-iteration-report.md): startup again failed with `no close frame received or sent`, without run ID; no inspect or addressed close possible. Immediate CDP inventory had no Composer tabs; cleanup resolved by absence. BLOCKED by transport. Separate Playwright responsive-score and flat-staff tests pass on the requested URL: six window widths, no initial horizontal overflow, hidden tracks, wheel/Shift+wheel after zoom, Fit and focus. Current implementation observes viewport width and reflows ABCjs; prior fixed-900px source observation is superseded. No MCP PASS claimed.

[Attempt 1](iterations/20261005T040737Z-HARMONY-SCROLL-UX-01-attempt-1-iteration-report.md): read-only start on the requested Orca Harmony URL returned `no close frame received or sent`, without a run ID. No inspect or addressed close possible. Immediate CDP inventory contained no Composer tabs; cleanup resolved by absence. BLOCKED by transport. Source review shows a 900px default canvas, initial zoom 1, overflow auto, existing Shift+wheel support and Fit width inside a menu. Live dimensions and gesture behavior remain unverified. No UI implementation changed during this proposal.

## HARMONY-ALGORITHM-01 — deterministic shared workflow
<!-- beads-id: br-qa-jev-notes-harmony-algorithm -->

[Attempt 1](iterations/20261004T070840Z-HARMONY-ALGORITHM-01-attempt-1-iteration-report.md): browser_ready returned ready true for Profile 4 on port 9222, but browser_start returned -32602, "No session with given id", with no run ID. No steps or independent browser_inspect were possible. BLOCKED by MCP session startup, not application failure. No ID was available for browser_close; immediate read-only CDP inventory showed no Composer tabs, resolving cleanup by absence. Test target is an isolated draft slug jev-e2e-20261004-algorithm-harmony; local workflow generation/selection is authorized there, with no Ganesha or catalogue writes. Current shared steps use a local algorithm, show No AI connection required, hide prompt/LLM controls, rank up to three complete progressions, and require explicit Step 2 selection before Step 3 validation. These are source contracts, not MCP-verified observations. Feed this note verbatim into a rerun after session startup is repaired.

## SCORE-SELECTION-01 — selection gestures
<!-- beads-id: br-qa-jev-notes-score-selection -->

[Attempt 1](iterations/20261004T063045Z-SCORE-SELECTION-01-attempt-1-iteration-report.md): readiness true, but browser_start returned -32602, "No session with given id", without a run ID. No steps or independent inspect were possible; BLOCKED by MCP startup. No ID available for browser_close; immediate read-only CDP inventory showed no Composer tabs, resolving cleanup by absence. Current Harmony contract: click selects; left-drag selects notes/chords; Cmd/Ctrl-drag pans; Option/Alt-drag in Edit changes pitch. Double-click or Enter opens a chord inspector, while right-click opens actions. Older Harmony single-click picker notes are superseded; other routes retain their own behavior. Playwright evidence remains separate.

## MELODY-CHORD-SHAPES-01 — Melody guitar shapes
<!-- beads-id: br-qa-jev-notes-melody-chords -->

[Attempt 1](iterations/20261004T061500Z-MELODY-CHORD-SHAPES-01-attempt-1-iteration-report.md): browser_start on the requested Orca Melody URL failed with error -32602, "No session with given id"; no run ID returned. No steps or independent inspect possible. BLOCKED by MCP startup, not application failure. Cannot address browser_close without an ID; immediate read-only CDP inventory showed no Composer tabs, resolving cleanup by absence. Melody now uses the shared guitar picker; quoted chord symbols in the first voice are required. Shape clicks open the picker; Enter saves, Escape cancels. Deterministic Playwright audio/persistence checks are separate evidence. Feed these notes verbatim into any rerun.

[Attempt 2](iterations/20261004T064100Z-MELODY-CHORD-SHAPES-01-attempt-2-iteration-report.md): requested Orca URL again failed at browser_start with -32602, "No session with given id"; no run ID, inspect or addressed close possible. Immediate read-only CDP inventory contained no Composer tabs, resolving cleanup by absence. BLOCKED by MCP startup. Separate deterministic evidence: nine guitar chord score unit tests and the Melody Playwright picker/audio/persistence test pass. Chord playback uses acoustic guitar nylon program 24; changing voicing leaves source melody ABC unchanged and updates source-bound overrides. Deterministic sample substitution does not establish subjective timbre or the current user draft. Feed this note together with attempt 1 into a rerun.

## SCORE-WORKSPACE-ZOOM-01 — workspace zoom roundtrip
<!-- beads-id: br-qa-jev-notes-workspace-zoom -->

[Attempt 1](iterations/20261004T054957Z-SCORE-WORKSPACE-ZOOM-01-attempt-1-iteration-report.md): browser_ready returned ready true, but browser_start failed with code -32602, "No session with given id", and returned no run ID. No action or independent inspect was possible. BLOCKED by MCP session startup, not an application failure. No run ID was available for browser_close. Immediate read-only CDP target inventory showed no Composer tabs, resolving cleanup by absence. Deterministic Playwright zoom/pan checks are separate evidence. Feed these notes verbatim into any rerun.

## STAFF-KEYBOARD-01 — Harmony keyboard playback
<!-- beads-id: br-qa-jev-notes-staff-keyboard -->

[Attempt 1](iterations/20261004T032600Z-STAFF-KEYBOARD-01-attempt-1-iteration-report.md): browser_start failed with `no close frame received or sent` and returned no run ID. No steps or independent inspect were possible; verdict BLOCKED by tool transport, not application failure. No run ID was available for browser_close; tab creation/cleanup is unknown and must be resolved before another MCP run. Shell HTTP 200 does not establish MCP readiness. Current keyboard contract: Space starts/stops the active score from page background or score items; arrows move focus in the score; Enter activates a note/chord. Inputs, native controls and open dialogs retain their keyboard behavior. Independent Playwright checks pass; actual intermittent full-document reload has not been reproduced. Score replacement caused by changing loop settings was reproduced and fixed; volume MIDI changes may still require rendering. Feed these limitations verbatim into the next goal.

## GUITAR-SAME-BASS-AUDIO-01 — same-bass shape audio
<!-- beads-id: br-qa-jev-notes-same-bass -->

[Attempt 1](iterations/20261003T193900Z-GUITAR-SAME-BASS-AUDIO-01-attempt-1-iteration-report.md): LAN Harmony route and Em diagrams loaded. browser_step failed with ValueError and empty history; independent inspect showed no picker opened. INCONCLUSIVE for MCP, not an application failure. Close confirmed closed true, tab_kept false. Playwright independently compared decoded score audio for open Em and fret-2 Em after saving without reload and passed on both Harmony and Accompaniment. These shapes share E2 bass, so bass-only assertions cannot distinguish them. Do not claim audible differences from DOM notes alone.

History includes a passing dashboard smoke on the LAN URL and older blocked reachability attempts.

Confirmed configuration: jev-ultrafast-mcp uses an LLM decision provider and defaults to keeping tabs. Always pass keep_tab false to close. The app's development port is 9974. Configuration is not proof of browser readiness or test success.

Add entries per testcase: report link, observed route/labels, setup and timing, agent mistakes/recovery, unresolved issues, and applicability to the current version. Preserve useful history; mark superseded observations rather than treating them as current facts.

## JEV-SMOKE-01 — dashboard reachability
<!-- beads-id: br-qa-jev-notes-smoke01 -->

[Attempt 1 report](iterations/20261003T115017Z-JEV-SMOKE-01-attempt-1-iteration-report.md): shell HTTP 200 at localhost:9974 did not imply MCP browser reachability. Start and independent inspect showed ERR_CONNECTION_REFUSED. Cause is unknown; do not label this as an application failure. Before rerunning, establish a browser-reachable app URL; keep the same heading/URL assertions. Feed this discrepancy into the next goal. No LLM action was executed. Explicit browser_close with keep_tab false returned closed true and tab_kept false.

## GUITAR-PICKER-CANCEL-01 — picker controls and cancellation
<!-- beads-id: br-qa-jev-notes-guitar-cancel01 -->

[Attempt 1 report](iterations/20261003T120857Z-GUITAR-PICKER-CANCEL-01-attempt-1-iteration-report.md): the supplied Orca proxy URL also returned ERR_CONNECTION_REFUSED at start and independent inspect. No picker action was possible. This is a browser reachability blocker, not evidence of an application failure. Explicit close returned closed true and tab_kept false. Establish reachability before rerunning; preserve the read-only cancellation constraint. Playwright regression results are separate evidence.

## Reachable host and current dashboard
<!-- beads-id: br-qa-jev-notes-lan -->

[Smoke attempt 2](iterations/20261003T163823Z-JEV-SMOKE-01-attempt-2-iteration-report.md) passed: http://10.0.1.143:9974/compose is reachable from MCP browser. localhost and Orca proxy failures are historical; their root cause remains unknown. Use this LAN base URL while available. Dashboard action currently says Save to Catalogue & Start, which may write catalogue data; do not assume older Save & Start Melody instructions are current. Both expected dashboard headings were independently observed. Close returned closed true, tab_kept false.

## JEV-EXISTING-MELODY-01 — current navigation prerequisite
<!-- beads-id: br-qa-jev-notes-existing-melody -->

[Attempt 1](iterations/20261003T164000Z-JEV-EXISTING-MELODY-01-attempt-1-iteration-report.md) blocked: after hydration, Happy Birthday title/review text loaded, but current dashboard offers Save & Continue, not old Continue arrangement link. Do not substitute save into a read-only navigation goal. Agent clicked Slug unnecessarily without editing it. Wait for Loading workstation to resolve; click only intended controls. Tab close confirmed.

## JEV-MELODY-HARMONY-01 — current Melody labels
<!-- beads-id: br-qa-jev-notes-melody-harmony -->

[Attempt 1](iterations/20261003T164200Z-JEV-MELODY-HARMONY-01-attempt-1-iteration-report.md): old labels are obsolete. Current Melody UI: Shape your melody, Melody editor, ABC source textbox, Continue to harmony → link. Starter ABC in isolated slug jev-e2e-20261003-melody is Em in 4/4. No edits performed. Define current semantic assertions before rerunning; do not mark old-label mismatch as a product bug. Tab close confirmed.

[Melody/Harmony attempt 2](iterations/20261003T164400Z-JEV-MELODY-HARMONY-01-attempt-2-iteration-report.md): browser_step failed with ValueError and empty history; independent inspect stayed on Melody. INCONCLUSIVE, not a proven application failure. Old run closed successfully. Try a fresh run with a simpler single-click instruction and the same semantic route assertion; do not claim click succeeded.

[Melody/Harmony attempt 3](iterations/20261003T164600Z-JEV-MELODY-HARMONY-01-attempt-3-iteration-report.md): simpler single-link instruction also produced ValueError, empty history and unchanged route. Do not repeat navigation indefinitely; MCP execution needs investigation. Verdict remains INCONCLUSIVE. Explicit tab close confirmed. Read-only start/inspect still work.

## JEV-FINGERSTYLE-GATE-01 — validation gate
<!-- beads-id: br-qa-jev-notes-fingerstyle-gate -->

[Attempt 1](iterations/20261003T164800Z-JEV-FINGERSTYLE-GATE-01-attempt-1-iteration-report.md) PASS for visible prerequisite gate: isolated draft shows Harmony validation required and selection instruction on guitar-fingerstyle route. Read-only DONE independently verified; close confirmed. Navigation says Harmony/Accompaniment Complete despite validation gate; this is a separate observation requiring a dedicated testcase. Fingerstyle still uses Step 3.1 label, while Melody UI uses newer labels.

## 2026-10-04 transport recovery
<!-- beads-id: br-qa-jev-notes-recovery-20261004 -->

Readiness now returns ready true for Profile 4 on port 9222. A read-only CDP target inventory confirms there is no remaining Composer/Harmony tab from STAFF-KEYBOARD-01; the earlier unknown tab cleanup is resolved by absence, without closing unrelated tabs. The service reports idle runs expire after 1800 seconds on the next start. New runs must still use explicit browser_close with keep_tab false and independently verify observations.

## STUDIO-MELODY-LAYOUT-01 — score-first Composer layout
<!-- beads-id: br-qa-jev-notes-studio-layout -->

[Attempt 1](iterations/20261004T045156Z-STUDIO-MELODY-LAYOUT-01-attempt-1-iteration-report.md): readiness succeeded but browser_start again returned `no close frame received or sent`, with no run ID. No inspect or close can be addressed without an ID. BLOCKED by transport, not application failure. No subsequent MCP run started. New layout removes page hero headings; Melody editor tools sit left of playback on desktop and below it on narrow screens. Deterministic Playwright layout checks are separate evidence, not MCP execution.

Post-attempt cleanup check at 04:51:56 UTC: read-only CDP target inventory returned no Composer tabs. Tab cleanup is resolved by absence; no unrelated tabs were touched. Transport remains blocked.

Separate Playwright regression: six studio layout cases pass, including all four requested routes with isolated seeded drafts and both downstream prerequisite states. Desktop and mobile screenshots inspected. No MCP PASS is claimed.

## STUDIO-COMPACT-TOOLBAR-01 — compact actions and notation size
<!-- beads-id: br-qa-jev-notes-compact-toolbar -->

[Attempt 1](iterations/20261004T051035Z-STUDIO-COMPACT-TOOLBAR-01-attempt-1-iteration-report.md): browser_start and browser_inspect now succeed on the LAN Harmony URL. browser_step returned `Model provider returned HTTP 400; no action executed.` Independent inspect confirms score and accessible Download PDF / Copy ABCJS ABC controls and no keyboard instruction strip, but does not expose geometry for same-row/icon-only/70% scale assertions. INCONCLUSIVE for the complete MCP testcase. Close confirmed closed true, tab_kept false. Do not treat the provider failure as a product bug; keep Playwright geometry evidence separate.

Compact-toolbar deterministic checks: seven layout/gate cases, five keyboard/playback cases and two guitar-shape/audio cases pass. Use a TimeGrid fixture containing real tablature when asserting fret numbers; a fresh ungenerated grid has none. At 70% notation size, more chords fit per line: use the actual last chord for line-boundary assertions. Layers & volume is initially expanded; only open it if the slider is hidden.

## COMPOSER-TOKENS-01 — semantic controls
<!-- beads-id: br-qa-jev-notes-composer-tokens -->

[Attempt 1](iterations/20261004T052257Z-COMPOSER-TOKENS-01-attempt-1-iteration-report.md): read-only start and independent inspect succeed on LAN Harmony. Accessible playback/export controls and primary action observed. No LLM step requested because the prior HTTP 400 provider failure has no recovery evidence. Inspect lacks computed styles/geometry; complete MCP design testcase remains INCONCLUSIVE. Close confirmed closed true, tab_kept false. Separate deterministic checks: 16 Playwright cases pass, including 32px desktop icons, 44px coarse-pointer targets, intrinsic CTA width, light/dark colors and focus ring. These results do not establish MCP execution of those assertions.

## HARMONY-AUTO-CHORDS-01 — deterministic strong beats and missing chords
<!-- beads-id: br-qa-jev-notes-auto-chords -->

[Attempt 1](iterations/20261004T062435Z-HARMONY-AUTO-CHORDS-01-attempt-1-iteration-report.md): browser_start returned error -32602, "No session with given id", without a run ID. No step, inspect or addressed browser_close was possible. Immediate read-only CDP inventory showed no Composer tabs, resolving cleanup by absence. BLOCKED by MCP startup, not application failure. Harmony now has Fill missing chords and a Detected strong beats disclosure; the table labels beats in denominator units and includes sounding sustained pitches. Fill stages a source-bound draft; Undo/Redo and reload apply, and Step 3 selection still requires Steps 1–2. Expand the disclosure via its summary (its accessible text includes the subtitle). Existing Ganesha data must remain untouched for this read-only MCP testcase. Deterministic Playwright coverage is separate evidence. Feed these notes verbatim into any rerun.

## HARMONY-SIDEBAR-LAYERS-01 — sidebar ownership and overlays
<!-- beads-id: br-qa-jev-notes-sidebar-layers -->

[Attempt 1](iterations/20261004T063300Z-HARMONY-SIDEBAR-LAYERS-01-attempt-1-iteration-report.md): browser_start failed -32602, "No session with given id", without a run ID. No inspect/close could be addressed. Immediate CDP inventory found no Composer tabs, resolving cleanup by absence. BLOCKED by session startup. Left Score tools now contains only Layers & volume, with independent Strong Beats and Missing Chord switches. Right Harmony assistant owns Detected strong beats, Fill missing chords, source ABC and navigation/reset controls. Switches affect score annotations only; analysis/actions remain available when off. Separate Playwright regression passes; no MCP PASS claimed.

## ACCOMPANIMENT-BEAT-REFERENCE-01 — black-dot reference and automatic layers
<!-- beads-id: br-qa-jev-notes-beat-reference -->

[Attempt 1](iterations/20261004T070000Z-ACCOMPANIMENT-BEAT-REFERENCE-01-attempt-1-iteration-report.md): browser_start failed -32602, "No session with given id", with no run ID for inspect/close. Read-only CDP inventory returned no Composer tabs; cleanup resolved by absence. BLOCKED by MCP session startup, not application failure. Reference established from source code only: Accompaniment emits beat-lyric rows, and the shared renderer styles black dots by Strong/Medium/Soft. Current Harmony supersedes earlier button/marker notes: Strong Beats and Missing Chord automatically process via checkboxes; no fill/analyze buttons. Missing Chord adds actual chord symbols/audio; unchecking reverts optional additions. TimeGrid JSON exposes derived measures with grid weight data; source and canonical Guitar grid remain separate. Do not expect the removed Detected strong beats disclosure or Missing chord text markers.

## HARMONY-FLAT-STAFF-01 — single playback frame
<!-- beads-id: br-qa-jev-notes-flat-staff -->

[Attempt 1](iterations/20261005T040000Z-HARMONY-FLAT-STAFF-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent`, without a run ID. No inspect or addressed close possible. Immediate read-only CDP inventory showed no Composer tabs; cleanup resolved by absence. BLOCKED by transport, not application failure. Separate Playwright checks pass for one Harmony player frame, borderless embedded score workspace, one scroll viewport, retained controls, focus frame restoration and mobile page width. Focus the Scrollable score before Escape when exiting focus mode. Screenshots inspected; no MCP PASS claimed.

## HARMONY-REFRESH-01 — idle stability
<!-- beads-id: br-qa-jev-notes-refresh -->

[Attempt 1](iterations/20261005T082013Z-HARMONY-REFRESH-01-attempt-1-iteration-report.md): startup returned `no close frame received or sent` without a run ID; inspect/addressed close unavailable. CDP inventory showed no Composer tabs, resolving cleanup by absence. MCP BLOCKED, no PASS. Separate deterministic probe reproduced HMR WebSocket failures on LAN origin and a reload. Allow the LAN hostname in Next.js allowedDevOrigins; origin-free curl alone misses this bug. Observe navigation and WebSocket failures independently when rerunning; do not edit the existing Ganesha draft.

## ACCOMPANIMENT-STEEL-CHORD-01 — guitar playback timbre
<!-- beads-id: br-qa-jev-notes-steel-chord -->

[Attempt 1](iterations/20261005T102833Z-ACCOMPANIMENT-STEEL-CHORD-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent`, without a run ID. No inspect or addressed close possible. CDP inventory found no Composer tabs, resolving cleanup by absence. BLOCKED by transport, not application failure. Steel-string soundfont selection requires independent audio-event or sample-request evidence; DOM playback state alone cannot establish timbre. Shared staff playback now uses program 25 for Guitar/legacy nylon voices and default chord/bass synthesis; picker and A/B auditions also use 25. Preserve the existing Ganesha draft. Separate deterministic Playwright uses isolated drafts and synthetic WAV samples; it does not establish subjective sound quality or MCP execution.

## HARMONY-STRUMMING-01 — accompaniment style
<!-- beads-id: br-qa-jev-notes-strumming -->

[Attempt 1](iterations/20261005T111903Z-HARMONY-STRUMMING-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent`, without a run ID. No inspect or addressed close possible. Read-only CDP inventory showed no Composer tabs, resolving cleanup by absence. BLOCKED by transport, not application failure. Harmony now offers 4. Accompaniment Style after validated Step 3; seven styles are listed with incompatible meters disabled. Choosing a compatible style exposes seven radio results and a Strumming mixer layer. Select a radio result, use the score Play button to audition, then Save accompaniment; Cancel preview returns to the saved selection. Preserve existing Ganesha data in the read-only MCP testcase. Deterministic Playwright checks are separate evidence, not MCP execution.


## HARMONY-CHOICE-SPACING-01 — option padding and advancement
<!-- beads-id: br-qa-jev-notes-choice-spacing -->

[Attempt 1](iterations/20261005T151759Z-HARMONY-CHOICE-SPACING-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent` without a run ID; inspect/addressed close unavailable. Read-only CDP inventory found no Composer tabs, resolving cleanup by absence. BLOCKED by transport, no MCP PASS. Choice cards now use 12px vertical and 14px horizontal padding with 8px paragraph spacing. Choosing a Harmony option collapses that step and opens the immediate next step even when revisiting completed steps; Step 3 opens Accompaniment Style. Preserve existing Ganesha data for read-only MCP inspection; use isolated drafts for interactive regression coverage.

## HARMONY-STRUMMING-TECHNIQUES-01 — directional and muted strokes
<!-- beads-id: br-qa-jev-notes-strumming-techniques -->

[Attempt 1](iterations/20261005T153356Z-HARMONY-STRUMMING-TECHNIQUES-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent`, without a run ID; inspect/addressed close unavailable. Read-only CDP inventory showed no Composer tab, resolving cleanup by absence. BLOCKED by transport; no MCP PASS. Step 4 retains the user's two radio columns and accordion. Its legend now explains Down/Up, PM, X, Slap, Choke and Rest. Do not infer audible sweeps or silence from DOM: deterministic tests separately inspect realized audio and synthesized buffers. The shared Ganesha draft must remain unchanged in the read-only MCP case.

## HARMONY-TECHNIQUE-OPTIONS-01 — playable techniques
<!-- beads-id: br-qa-jev-notes-technique-options -->

[Attempt 1](iterations/20261005T161000Z-HARMONY-TECHNIQUE-OPTIONS-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent` without a run ID. Inspect/addressed close unavailable; read-only CDP found zero Composer tabs, resolving cleanup by absence. BLOCKED by transport. Step 4 contains five checkboxes under “Techniques you can play”: Bass picking, Palm mute, Dead strum, String slap, Choke. They require a selected style. Preserve shared Ganesha data; use isolated drafts for toggling, saving, reload and cancellation. These settings affect all seven generated results and saved canonical ABC/TimeGrid; DOM alone cannot prove acoustic output.

## HARMONY-STRUMMING-ARROWS-01 — readable stroke symbols
<!-- beads-id: br-qa-jev-notes-strumming-arrows -->

[Attempt 1](iterations/20261005T235900Z-HARMONY-STRUMMING-ARROWS-01-attempt-1-iteration-report.md): MCP startup blocked by transport, no run ID; inspect/close cannot be addressed. CDP found zero Composer tabs. Rendered Strumming now uses ↓ Down, ↑ Up, X Slap and Dead for dead strum; this supersedes older legend notes. Canonical ABC still uses standard bow decorations and Slap/X annotations; the render adapter translates them and audio reads the translated marks. Verify visible SVG text, since the old global annotation-hiding rule concealed all technique labels. Isolated Playwright passed after scoping that rule; preserve the shared draft in read-only MCP checks.

## STAFF-SPEED-01 — playback speed and slow trace
<!-- beads-id: br-qa-jev-notes-staff-speed -->

[Attempt 1](iterations/20261006T000250Z-STAFF-SPEED-01-attempt-1-iteration-report.md): browser_start returned `no close frame received or sent`, without a run ID. Inspect/addressed close unavailable; CDP inventory found no Composer tabs, resolving cleanup by absence. BLOCKED by transport. Open the Score zoom toolbar menu or right-click blank score space for Playback speed options 0.1x, 0.5x, 1x, 1.25x, 1.5x, 2x, 3x. Selection stops playback; press Play again. At 0.1x console logs final scheduled note events, direction/order and instrument. DOM alone cannot prove audio order. A separate Playwright regression caught ABCJS engraving sorting upstroke pitches: retaining written pitch order now preserves the correct sweep. Preserve shared Ganesha source and workflow.

## HARMONY-STRUMMING-CHORD-CUES-01 — silent chord cues
<!-- beads-id: br-qa-jev-notes-strumming-chord-cues -->

[Attempt 1](iterations/20261006-HARMONY-STRUMMING-CHORD-CUES-01-attempt-1-iteration-report.md): MCP startup failed with no run ID; inspect/addressed close unavailable. CDP showed zero Composer tabs. BLOCKED by transport. With current Strumming, turning ChordProgression off retains visible chord symbols and diagrams while written Strumming owns playback. Without Strumming, the previous visibility behavior remains. Isolated Playwright checks visible cues, unchanged TimeGrid and silence during Strumming rest windows; this is separate evidence. Preserve shared settings for read-only MCP inspection.

## HARMONY-CHORD-LAYERS-01 — separate display and sound
<!-- beads-id: br-qa-jev-notes-chord-layers -->

[Attempt 1](iterations/20261006-HARMONY-CHORD-LAYERS-01-attempt-1-iteration-report.md): MCP transport blocked startup, no run ID; inspect/close unavailable. CDP found zero Composer tabs. Supersedes silent-chord-cues behavior: Chord Progression now controls only visual chord names/diagrams without a volume slider; Chord Accompaniment independently controls chord sound and volume. Default audio off with Strumming, on otherwise; explicit choices persist. Isolated Playwright measured synthesized buffers with four-second synthetic samples to verify sustained chord audio during a Strumming rest when enabled, and silence when disabled. Preserve shared draft/settings in read-only MCP runs.

## HARMONY-PICKUP-02 — opening pickup harmony
<!-- beads-id: br-qa-jev-notes-pickup02 -->

[Attempt 1](iterations/20261006T010649Z-HARMONY-PICKUP-02-attempt-1-iteration-report.md): browser_start failed with “no close frame received or sent”, no run ID; inspect/addressed close unavailable. CDP showed zero Composer tabs. BLOCKED by transport. Step 2 previously generated pickup chords independently of Missing Chord; Step 3 required them. Both now permit chordless opening pickups. Harmony projection compares with matching melody to omit legacy generated pickup chords while preserving explicit source/lyric chords and manual drafts. Saved selections/provenance remain intact. Verify score and ABC after hydration; deterministic tests remain separate evidence.

## HARMONY-AUTOMATIC-01 — automatic harmony choices
<!-- beads-id: br-qa-jev-notes-harmony-automatic -->

[Attempt 1](iterations/20261006T010853Z-HARMONY-AUTOMATIC-01-attempt-1-iteration-report.md): browser_start failed with “no close frame received or sent”, no run ID; inspect/addressed close unavailable. Read-only CDP inventory found no Composer tabs, resolving cleanup by absence. BLOCKED by transport. Supersedes earlier manual Generate and separate validation-step instructions: Step 1 calculates automatically after hydration; choosing emphasis immediately calculates Step 2. Selecting a progression automatically validates the internal source result. Visible Step 3 is Accompaniment Style. Use isolated drafts for choices/reload/reselection; do not reset shared Ganesha data. Deterministic Playwright remains separate evidence.
