# E2E and QA Plan — Guitar Classic & Piano Singer Accompaniment
<!-- beads-id: br-qa-singer-accompaniment | satisfies: br-prd01-s2, br-prd01-s31, br-prd01-s45, br-prd01-s57, br-prd01-s58, br-prd01-s62 -->

> **Status:** Test strategy and release gate for the target Guitar Classic/Piano singer-accompaniment slice. It specifies the tests to add; it does not claim that the target Piano Composer branch is shipped.
>
> **Primary behavioural source:** [Singer-accompaniment use cases](../product/use-cases-guitar-piano-singer-accompaniment.md). System boundaries and domain ownership are defined in the [system design](../design/guitar-piano-singer-accompaniment-system-design.md) and [decision model](../guides/singer-accompaniment-decision-model.md).

## 1. Quality objective, scope, and non-goals
<!-- beads-id: br-qa-singer-accompaniment-s01 -->

The release is acceptable only when a musician can start with valid Melody ABC, select one validated Harmony Step 3 result, independently produce either Guitar Classic or Piano accompaniment, inspect a valid result, explicitly publish it, and find exactly that published artifact in Practice. The same must work with both instruments selected. The suite must prove source immutability, singer-first constraints, instrument-specific playability, stale blocking, publication isolation, and durable project recovery.

In scope:

- Composer route flow: Melody → Harmony → approved Step 3 snapshot → accompaniment → review/export → Practice.
- Guitar Classic (`V:GuitarSupport`) and Piano grand staff as peer Layer 2 branches, separately and together.
- Candidate generation, comparison, scoped repair, profile changes, strong-beat voicing overrides, validation, persistence, export and Practice playback controls.
- Deterministic validation of ABC/timing/fingerprint/harmonic alignment/singer yield, Guitar physics, Piano hand rules, and publication eligibility.
- LLM transport and UI error handling using local dummy responses, including malformed and malicious responses.
- Desktop and narrow-layout smoke coverage, keyboard-only operation for core controls, and the visual state needed to understand validation failures.

Out of scope for this gate: model quality evaluation against a live provider, subjective artistic ranking, Guitar Fingerstyle solo, Piano Solo, Ensemble, catalogue migration, audio rendering fidelity across every browser, and network/load penetration testing. Those may be separate suites, but none may be used to bypass the primary flow.

## 2. Test architecture and required seams
<!-- beads-id: br-qa-singer-accompaniment-s02 -->

Agent-driven browser execution uses **jev-ultrafast-mcp** under [the single-testcase execution and reporting protocol](jev-ultrafast-e2e.md). Feed previous testing notes into every goal, independently verify LLM claims, close each tab explicitly, and retain an iteration-report for every attempt. Playwright remains the deterministic regression/CI layer.

The test pyramid has a deliberate boundary: music facts and validators are proven beneath the UI; Playwright proves that the user cannot circumvent their result.

| Layer | Owner / tooling | What it proves | Required execution |
|---|---|---|---|
| Static contract | TypeScript, Zod, documentation checks | Candidate, snapshot, diagnostic, override, project revision and publication schemas remain compatible | Every pull request |
| Unit | Vitest | Parser/normalizer, fingerprinting, timing, each hard rule, stale transitions, serialization | Every pull request |
| Integration | Vitest with action/store adapters | Action → dummy LLM transport → normalize → validator → persisted state; no browser | Every pull request |
| Browser E2E | Playwright | Real user paths, state gates, route transitions, visual controls, storage/reload, export-to-Practice seam | Every pull request for focused smoke; full suite before merge/release |
| Contract/regression | Playwright + versioned fixtures | Known valid/invalid musical artifacts retain their acceptance disposition and UI diagnostics | Nightly and release candidate |
| Exploratory/manual | QA + musician | Musical plausibility, screen-reader narration, real audio/MIDI/device behaviour | Release candidate |

The project currently has Playwright under `e2e/` and a single Chromium project in `playwright.config.ts`; existing mockup tests prove POC rendering, not the production Composer flow. Add target-flow specs in the same directory and keep browser tests serial unless test-project storage is namespaced. Keep pure fixture tests close to their theory/action modules.

Every browser test must control these seams:

1. **Persistence:** begin with an isolated project ID and clear only that test namespace, never shared catalogue state.
2. **LLM boundary:** intercept the application action/API at its public request boundary and return a fixture selected by scenario name; no real API key and no provider request are permitted.
3. **Clock and IDs:** inject a fixed clock/seed or assert stable semantic values rather than generated IDs/timestamps.
4. **Playback:** assert rendered notation, semantic playback state and emitted cursor/highlight events; do not depend on speakers, WebAudio timing, or screenshots alone.
5. **Publication store:** use a per-test temporary/file-backed catalogue adapter or in-memory server store, then assert Practice through a fresh browser context.

## 3. Test data and deterministic LLM dummy contract
<!-- beads-id: br-qa-singer-accompaniment-s03 -->

### 3.1 Canonical musical fixtures

Fixtures must be small enough to diagnose by eye, versioned as JSON/ABC beside test code, and named by intent rather than implementation. The fixture catalogue must include the following source classes.

| Fixture | Musical property | Primary use |
|---|---|---|
| `four-four-gap-c-major` | 4/4, two phrases, a rest/long hold safe for one fill, chord change on strong beat | happy-path Guitar/Piano, fill and pedal |
| `six-eight-devotional-a-minor` | 6/8 meter family and phrase cadence | eligible-profile filter and meter regression |
| `split-window-four-four` | chord change at a defined subdivision within a measure | exact chord-window alignment/re-articulation |
| `high-melody-register` | melody occupies the normal RH/Guitar high register | singer-yield/register conflict |
| `no-safe-gap` | continuous lyric onsets | rejects/removes fills without changing melody |
| `guitar-stretch-fail` | otherwise valid timeline requiring an impossible fret reach/barre | Guitar hard failure + repair |
| `piano-span-collision-fail` | LH/RH overlap and a span wider than major tenth | rolled/shift/thin review or block |
| `invalid-meter-abc` | parseable-looking but under/over-filled measure | upstream gate |
| `invalid-abc` | syntax error | parser gate |
| `two-step3-snapshots` | two valid Harmony Step 3 choices with different fingerprints | selection invalidates downstream |

For each valid source, store an `ApprovedHarmonySnapshot` fixture that contains source ABC, source fingerprint, meter family, tempo, measures, exact chord-window start/end subdivisions, phrase/cadence boundaries, melody activity/gaps, and register map. Tests must never manufacture a smaller ad-hoc snapshot, because omission is itself a contract failure.

### 3.2 Dummy LLM response format

Use the same wire envelope used by the production action/transport, not a UI-only fake. A fixture response represents a provider tool-call result and is parsed by the actual production schema before it reaches the normalizer. The dummy must return no authority fields such as `valid`, `sourceFingerprint`, publication state, or mutable source facts.

```json
{
  "id": "fixture-guitar-pack-v1",
  "choices": [{
    "message": {
      "tool_calls": [{
        "id": "call_fixture_01",
        "type": "function",
        "function": {
          "name": "submit_arrangement_candidates",
          "arguments": "{...schema-valid candidate pack...}"
        }
      ]
    }
  }]
}
```

The candidate-pack payload must contain 3–5 options. Every option includes a stable `optionId`, target instrument, rationale, diversity label, measure-level decision map, complete ABC, event hints, declared soft-rule trade-offs, parent/repair lineage where applicable, and no user-provided prose rendered as executable instructions. Fixtures should make the diversity test observable: for example Guitar options differ in arpeggio/strum, bass strategy and density; Piano options differ in LH foundation, RH inversion/register, comping rhythm and pedal/fill plan.

### 3.3 Fixture scenarios and expected result

| Scenario | Dummy result | Expected deterministic outcome |
|---|---|---|
| `guitar-valid-pack` | 3 valid, distinct Guitar options | all parse; at least two diversity dimensions across the pack; Apply enabled only after a choice |
| `piano-valid-pack` | 3 valid grand-staff options | hand-aware artifact, pedal events and LH/RH controls available |
| `dual-valid-pack` | independent Guitar and Piano packs for same snapshot | distinct event artifacts; either can be applied/published alone |
| `one-option-invalid` | one ABC parse/timing failure plus two valid options | failed card shows structured diagnostic; valid cards remain usable |
| `repair-guitar-physics` | original invalid at M3/B1; repair changes only M3 | source facts and passed measures byte/semantic-equivalent; lineage preserved |
| `repair-piano-span` | original collision/span issue; repaired rolled/shifted candidate | diagnostic resolved or explicitly marked review; revalidation occurs |
| `soft-exception` | sparse/sus/power voicing with rationale | review badge, not a false hard-rule pass/fail |
| `malformed-tool-json` | invalid JSON or wrong tool name | controlled error, retry policy visible/logged, no draft becomes valid |
| `provider-timeout` | timeout/retryable 5xx then failure | bounded retry; usable existing options retained; no publish fallback |
| `prompt-injection-text` | rationale/ABC comment/diagnostic contains instruction-like text | treated as displayed data, escaped/delimited; no altered tool/state action |
| `exhausted-repair` | all bounded repairs invalid | diagnostics and prior passing options remain; auto-publish never occurs |

Put fixtures under a planned `e2e/fixtures/singer-accompaniment/` tree (or an equivalent shared test-fixture directory) and validate them in a dedicated Vitest schema test. Maintain one human-readable fixture manifest mapping scenario → source snapshot → dummy response sequence → expected diagnostics. A fixture update requires reviewer approval from both QA and the theory/domain owner.

### 3.4 Interception rules

In Playwright, register an exact route handler before navigation, assert request method/body/schema version/instrument/source fingerprint, and fulfill the chosen recorded JSON with realistic headers. Fail the test for any unmatched request to the LLM host/path. A scenario that expects retries supplies an ordered response queue and asserts the number of requests. Do not intercept a broad `**/*` pattern that could hide unexpected backend calls.

At the integration layer, inject a `FakeLlmClient` implementing the same transport interface rather than mocking internal validators. This permits assertions that the repair request contains only diagnostic/requested measures and that source facts and passed measures are retained.

## 4. Entry, exit, environments, and quality gates
<!-- beads-id: br-qa-singer-accompaniment-s04 -->

### Entry criteria

- Candidate, validation, persistence and publication contracts are typed and have stable semantic selectors/accessible names for all controls asserted below.
- A server/test adapter exists for project revisions and publication catalogue; browser-local storage is not the only state under test.
- All canonical source snapshots and dummy responses pass schema validation.
- Seed data has no collision with the user catalogue and cleanup is automatic.
- The POC may remain a separate gate, but target Composer E2E begins only once its real routes and actions exist.

### Exit criteria

- All P0/P1 automated cases pass in Chromium on a clean CI worker; P0 runs without retry. A retry may aid diagnostics but cannot turn a flaky P0 green.
- Zero critical/high open defects in source locking, hard validation, publish eligibility, or Practice isolation.
- 100% of UC-01–UC-07 acceptance statements have at least one named automated test; each negative business rule has a blocking assertion.
- Every dummy fixture scenario listed above is exercised at integration level; happy, invalid, repair, stale and publish cases are exercised in E2E.
- Full suite has no unhandled page errors, console errors (allowlist only for known browser audio limitations), failed requests, or unmatched LLM calls.
- Manual musician acceptance confirms notation intelligibility and that the selected artifact—not merely a passing UI badge—can be heard/read in Practice.

### CI lanes

| Lane | Trigger | Contents | Gate |
|---|---|---|---|
| `lint-contract` | every PR | lint, typecheck if configured, fixture schema and unit/integration tests | blocking |
| `e2e-smoke` | every PR touching Composer/theory/actions | P0 happy path, parser gate, stale block, publish isolation, one LLM failure | blocking |
| `e2e-full` | merge queue/nightly | all P0/P1 matrix, narrow viewport, reload/offline recovery, accessibility scan | blocking for release |
| `regression-fixtures` | nightly/release candidate | all recorded packs and validator disposition snapshots | blocking for release |
| `manual-rc` | release candidate | exploratory script in §8 | explicit sign-off |

## 5. End-to-end scenario catalogue
<!-- beads-id: br-qa-singer-accompaniment-s05 -->

All cases assert both a visible result and a durable/domain result through supported test seams. `M#` and `B#` in expected diagnostics refer to the source fixture's measure and beat, not a visual pixel location.

| ID / priority | Preconditions and action | Assertions |
|---|---|---|
| E2E-01 P0 Guitar-only happy path | Load `four-four-gap-c-major`; select valid Step 3; choose Guitar only; generate `guitar-valid-pack`; compare two options; apply one; export it; open Practice in fresh context | Snapshot fingerprint is shown; 3 distinct option cards render; selected `V:GuitarSupport` is valid/current; source Melody/harmony are unchanged; only Guitar appears in catalogue/Practice; staff and guitar projection load; no Piano dependency/control is required. |
| E2E-02 P0 Piano-only happy path | Same source, Piano only, `piano-valid-pack`; apply and publish | Grand staff contains distinct RH/LH; pedal metadata and hand-aware keyboard controls exist; LH/RH/combined Practice selection reads the published Piano artifact; Guitar is absent. |
| E2E-03 P0 Dual independent branches | Select both; generate `dual-valid-pack`; apply Guitar A and Piano C; publish only Piano, then publish Guitar | Shared snapshot fingerprint/timeline is identical; event/ABC/report IDs are distinct by instrument; publishing Piano does not publish Guitar; later Guitar export leaves Piano unchanged. |
| E2E-04 P0 invalid melody gate | Enter `invalid-abc`, then `invalid-meter-abc`; attempt Harmony/accompaniment navigation | Parser/meter error identifies source location; no Step 3 snapshot, generation request, Apply or Publish is possible. |
| E2E-05 P0 exact source selection | In `two-step3-snapshots`, select A, create valid draft, select B | A fingerprint is stored in lineage; selecting B marks both instruments stale, blocks Apply/Publish and does not reuse A events; UI links back to the required regeneration step. |
| E2E-06 P0 melody invalidation | Apply one or both valid drafts; edit a pitch/duration in Melody; save/reload | Harmony and dependent drafts become stale with old/new source detail and creation time; draft remains inspectable; Practice still shows only the previously published artifact, never the new draft. |
| E2E-07 P1 branch-local invalidation | Create both drafts; change Guitar profile/voicing; repeat for Piano | Only the edited branch becomes stale/re-renders; the sibling keeps current fingerprint/state/artifact; no cross-instrument events are copied. |
| E2E-08 P0 chord-window and meter | Use `split-window-four-four` and `six-eight-devotional-a-minor`; generate valid packs | Every displayed/normalized onset aligns with required window; change is re-articulated at the split; incompatible comping profiles are filtered before LLM ranking; valid 6/8 choices preserve all beats. |
| E2E-09 P0 singer-yield | Use `high-melody-register` and `no-safe-gap`; generate candidates with deliberate collisions/fills | Hard overlap/fill diagnostics identify measure/beat; unsafe fill is removed or candidate blocked while melody bytes/facts do not change; valid sparse option remains selectable. |
| E2E-10 P0 Guitar physics repair | Generate `repair-guitar-physics`; request repair | Original shows string/fret/stretch/barre/finger diagnostic at M3/B1 and cannot Apply; repair request is scoped; only flagged range changes; fresh full validation passes; parent option ID/lineage is visible/persisted. |
| E2E-11 P0 Piano physics repair | Generate `repair-piano-span` | Report identifies LH/RH, span/collision and chosen rolled/shift/thin remedy; grand staff/event/highlights reflect remedy; only a passing/current or intentionally review-marked outcome can continue according to policy. |
| E2E-12 P1 soft-rule exception | Use `soft-exception`; inspect and try export | Rationale and declared exception are visible; it is review, not silently rewritten; a hard-rule violation cannot be relabelled as soft; publication policy is explicit. |
| E2E-13 P0 malformed/untrusted LLM | Run `malformed-tool-json` and `prompt-injection-text` | Clear recoverable error/log; no parser crash or script execution; no valid/current state, altered snapshot or publication; ordinary existing valid options remain available. |
| E2E-14 P0 timeout and exhaustion | Run `provider-timeout`, then `exhausted-repair` | Retry count/deadline stays bounded; error names the failed option/run; no invented fallback or auto-publish; valid sibling options remain selectable. |
| E2E-15 P1 comparison/refinement | Generate candidates; select B; feedback “keep mood B, thin last two measures”; preview A/B and submit | Prompt carries selected option/feedback and bounded scope; only requested final measures mutate; source/pass measures retained; new candidate is separately versioned; original remains comparable. |
| E2E-16 P0 beat voicing override | Click a strong beat; preview two same-identity candidates; apply default window; repeat phrase scope | Candidate list exposes shape/register/hand detail rather than bare chord names; base chord identity/timeline/profile do not change; edge-transition diagnostic is shown if needed; `VoicingOverride` has correct instrument/window/revision and validation. |
| E2E-17 P1 profile change versus local accent | Change section profile, hear A/B, then add local density/fill override | Profile never changes a chord; preview scope is section/whole song, not accidental one beat; compatible overrides survive, incompatible ones become review/stale with reason and are not deleted/replaced. |
| E2E-18 P0 explicit export eligibility | At review mix not-started, generated, failed, valid, stale, and applied layers; toggle export checkboxes | Only current validated/applied selected layer is exportable; disabled state supplies reason/link; confirmation lists exact layer type and ABC; no implicit selection. |
| E2E-19 P0 Practice isolation | Keep unpublished local draft A, publish B, open Practice in new browser context; change local A | Practice fetches catalogue B only, has no dependency on localStorage/open Composer tab, and remains B after A changes; tempo/loop are scoped to B. |
| E2E-20 P1 project autosave/checkpoint/restore | Generate/apply both, wait for debounced autosave, reload; create named checkpoint, edit, restore checkpoint | Brief, raw/normalized run refs, diagnostics, choices, overrides and state survive; restored revision is explicit; published artifact stays separate. |
| E2E-21 P1 offline and concurrency | Queue edits offline then reconnect; use two contexts from same base revision | UI reports Offline changes/Saving/Saved correctly; outbox flushes; stale base creates recoverable branches/decision merge instead of last-write-wins; no history pruning hides conflict. |
| E2E-22 P1 responsive/accessibility | Execute E2E-01/02 at 1280px and keyboard-only; inspect validation controls | Content stacks without obscuring action/diagnostic; focus order reaches compare/apply/export; labels announce status, scope and error location; controls have accessible names. |

## 6. Integration, unit, and contract matrix
<!-- beads-id: br-qa-singer-accompaniment-s06 -->

The following tests make failures inexpensive to localize. They are prerequisites to the browser scenarios, not substitutes for them.

| Area | Mandatory automated checks |
|---|---|
| ABC and time | reject malformed ABC and incomplete measures; preserve melody/meter/measures; normalize duration exactly; verify every accompaniment event inside correct chord window; re-articulate split windows. |
| Snapshot/provenance | only selected Step 3 creates snapshot; canonical fingerprint changes for meaningful source change; artifacts retain source fingerprint/revision; snapshot is immutable from branch/action code. |
| Candidate schema | 3–5 options, unique IDs, target-specific voice structure, complete ABC, decision map coverage, rationale/diversity fields; forbid authoritative fields and unexpected tool names. |
| Diversity | pack differs on at least two declared/derived dimensions; duplicate ABC or label-only variants fail before UI. |
| Singer-first | active melody collision/register mask and unsafe fills are hard failures; intentional soft exception does not downgrade a hard failure; no validator mutates melody to resolve conflict. |
| Guitar | one-player/string exclusivity, pitch-string mapping, fret/stretch/barre/finger limits, range, bass onset rule and output `V:GuitarSupport`; Guitar events cannot satisfy Piano checks. |
| Piano | C2–C3/LIL, guide tones/RH register below melody, common-tone/shortest path as applicable, hand span/rolled encoding, LH/RH collision, fill gap/re-entry and pedal coherence; output requires grand staff and hand metadata. |
| Repair | request includes diagnostic measure/beat/rule and selected scope only; parent lineage preserved; pass region/source facts unchanged; entire artifact revalidated after repair; maximum rounds enforced. |
| State machine | allowed `not-started → configuring → generated → valid → applied`; failed never aliases valid; all upstream/branch-local invalidation transitions; review/current/stale eligibility. |
| Override/profile | precedence is snapshot → profile → plan → narrowest override → local fill; override retains harmonic identity; profile preserves timeline; edge continuity reported. |
| Persistence | append-only revision parent/ref integrity; autosave/checkpoint/recover; raw response stores only allowed bounded/redacted form; local cache/outbox may be deleted without destroying project history. |
| Publication | accepts current + valid only; idempotent upsert correct layer/metadata without Markdown-body loss; rejects stale/fail/wrong fingerprint; Practice query has no Composer draft dependency. |
| LLM transport/security | phase-only tools, payload/schema limits, retry/deadline/call count, unexpected network failure, malformed response, tool mismatch, escaped untrusted strings, no raw transcript persistence. |

Property-based tests are recommended for time grids, fingerprint changes, generated event duration totals, and validator non-mutation: generate legal chord-window partitions and assert that any accepted output conserves meter and leaves locked source facts exactly unchanged.

## 7. Observability, evidence, and defect triage
<!-- beads-id: br-qa-singer-accompaniment-s07 -->

Each generated run and every E2E failure must be diagnosable without seeing a real provider transcript. Store/display a bounded trace containing project/revision ID, snapshot ID/fingerprint, selected Step 3 ID, branch/instrument, fixture/scenario ID in test, profile/override IDs, candidate and parent IDs, generator version, validation report, artifact ID, publish attempt/result, and an error correlation ID. Redact secrets and bound raw outputs according to ADR 0003.

Browser CI artifacts for every failure: Playwright trace, screenshot, video when enabled, console/network log, persisted project/publication JSON (redacted), request assertion record, candidate response fixture name, and validation report. For pass evidence on release candidates, retain the test report plus a screenshot of review and Practice per instrument, rather than retaining all user-like musical data indefinitely.

Severity is based on user harm:

| Severity | Examples | Release handling |
|---|---|---|
| P0 / blocker | invalid/stale layer publishes; Practice reads draft; source melody mutates; hard physics/singer-yield violation marked valid; real LLM request from CI | stop release, hotfix and add regression first |
| P1 / critical | valid branch cannot complete; wrong instrument artifact/hand staff; lost project revision; repair changes unflagged measures | no release without approved waiver and owner/date |
| P2 / major | incorrect diagnostic location, profile filter leak caught before Apply, inaccessible non-critical preview | fix in release train or formally schedule |
| P3 / minor | copy, spacing, non-blocking visual highlight discrepancy | backlog with screenshot/evidence |

Triage records must include fixture/scenario, source fingerprint, expected/actual state transition, artifact IDs, diagnostic rule/location, replay steps, trace link, browser/build/version and whether the issue is reproducible with a dummy response. Never resolve a model-output issue merely by changing a fixture; first decide whether the validator, schema, product rule, or fixture expectation is wrong.

## 8. Manual release-candidate script
<!-- beads-id: br-qa-singer-accompaniment-s08 -->

QA and a musician execute this script on a fresh profile using the deterministic fixtures, then one approved non-sensitive staging generation if such provider testing is separately authorized.

1. Complete Guitar-only, Piano-only and dual paths; listen to the singer melody against accompaniment and verify the accompaniment yields at lyric onsets and returns after gaps.
2. At a chord boundary, compare two Guitar shapes and two Piano inversions. Confirm the UI explains the physical/register trade-off and that a same-identity override does not change the chord progression.
3. Inspect a Guitar failure and a Piano failure. Confirm a non-engineer can identify the measure/beat and suggested recovery; confirm repair does not alter the displayed melody or passed measures.
4. Publish one layer only, close Composer, use a new browser/device context for Practice, and verify the right staff, instrument visualization, tempo/loop and Piano hand/pedal controls.
5. Change Melody and Harmony selection afterward. Confirm stale state is unmistakable, export is blocked, prior published Practice material is stable, and drafts remain inspectable.
6. Exercise keyboard navigation, zoom at 200%, narrow desktop/tablet width, and a screen reader pass over candidate status, diagnostics, Apply and Publish controls.

Record explicit sign-off from QA, domain/theory owner, product owner and accessibility reviewer. Aesthetic preferences can create follow-up work but cannot waive a P0 invariant.

## 9. Delivery sequence and ownership
<!-- beads-id: br-qa-singer-accompaniment-s09 -->

1. **Test infrastructure owner:** introduce fixture schemas, fake transport, deterministic clock/store adapters, route interception helper and test-data cleanup. Prove no external LLM traffic with a failing unmatched-request test.
2. **Theory/domain owner:** supply canonical snapshots, accepted/rejected artifacts and expected diagnostics; implement unit/property tests for every hard validator.
3. **Composer owner:** add semantic selectors and supported inspection seams for state, artifact metadata and persistence; implement E2E-01 through E2E-08 before expanding UI polish.
4. **Piano/Guitar owners:** complete E2E-09 through E2E-17 alongside their branch implementation, never marking a target path done on POC-only coverage.
5. **Publication/Practice owner:** complete E2E-18 through E2E-21 using a fresh context and durable store.
6. **QA owner:** maintain traceability, run exploratory release script, review flaky tests, and ensure new rule/diagnostic changes update fixtures and this plan in the same change.

Definition of done for any story that adds an LLM-assisted musical decision: a schema-validated dummy response exists for valid, invalid and repair/error paths; transport/validator tests prove the decision is bounded; at least one Playwright test proves UI gating; source/provenance and publication impact are tested; and CI evidence is linked in the pull request.

## 10. Requirements-to-test traceability
<!-- beads-id: br-qa-singer-accompaniment-s10 -->

| Use case / requirement area | Primary E2E evidence | Supporting lower-level evidence |
|---|---|---|
| UC-01 approved shared Harmony snapshot | E2E-01, 04, 05, 08 | parser/time, snapshot/fingerprint contracts |
| UC-02 Guitar Classic singer support | E2E-01, 07–10, 16–17 | Guitar physics, singer-yield, `V:GuitarSupport` contracts |
| UC-03 Piano two-hand accompaniment | E2E-02, 07–11, 16–17 | LIL/span/collision/pedal/grand-staff contracts |
| UC-04 review, explicit publish, Practice | E2E-01–03, 18–19 | publication upsert and catalogue isolation contracts |
| UC-05 stale source and recovery | E2E-05–07, 20–21 | state machine, project revision and concurrency contracts |
| UC-06 timeline/profile/voicing distinction | E2E-08, 15, 17 | window/meter, diversity, profile/override precedence contracts |
| UC-07 beat override and durable project | E2E-16, 20–21 | override lineage/edge validation, append-only persistence contracts |
| LLM candidate/repair governance | E2E-10–15 | schema/diversity/repair/transport-security contracts |

This traceability table is the release checklist: deleting or materially changing a use-case invariant requires changing the named test(s), fixture expectation and domain contract together.
