# Optimized Fingerstyle Dynamic Programming Algorithm

> Implemented architecture, invariants, cost model, integration contract, and regression coverage

## 1. Status

The fingerstyle optimizer is implemented as a Viterbi/shortest-path dynamic program over playable guitar hand-shape candidates.

The current implementation additionally hardens the production time-slice path against the Ganesha regression where this authoritative melody:

```abc
"Em" E E3- E2 z B,
```

was rendered with unrelated G/B pitches because the optimizer trusted an incorrect submitted tablature position:

```abc
[!2!B!3!G!6!E,] [!2!e] [!3!G] [!2!B]4 [!3!B]
```

The corrected final measure is:

```abc
[!2!e!3!G!6!E,] !2!e !3!G !2!B4 !3!B
```

The optimizer now treats melody pitch and physical playability as invariants. Cost optimization may choose among valid positions, but it may not change the requested concert pitch or collapse independent simultaneous notes.

## 2. Optimization Goals

The DP minimizes physical difficulty across the complete event sequence while preserving musical correctness.

It accounts for:

1. Exact source melody pitch.
2. Simultaneous melody, bass, root, fifth, and fill occupancy.
3. Movement time between consecutive onsets.
4. Sustain continuity on ringing strings.
5. Shape-change effort and guide fingers.
6. Hammer-on, pull-off, and slide opportunities.
7. Open-string preference.
8. Exact grip reuse when a chord recurs.
9. Skill-level fret, span, barre, and technique restrictions.
10. Optional capo-position optimization.
11. Safe rollback when optimization introduces a physical validation failure.

## 3. Architecture

### 3.1 Public and Internal Modules

| Module | Responsibility |
|---|---|
| `fingerstyle-arranger/dp-types.ts` | DP events, candidates, hand state, skill constraints, options, and compatibility logger |
| `fingerstyle-arranger/dp-diagnostics.ts` | Versioned typed event taxonomy, run collector, candidate snapshots, and outcome semantics |
| `fingerstyle-arranger/dp-candidates.ts` | Enumerate pitch-correct, collision-free string/fret candidates and grouped rejection details |
| `fingerstyle-arranger/dp-cost.ts` | Movement, shape, sustain, technique, barre, placement, skill, and recurring-grip cost breakdowns |
| `fingerstyle-arranger/dp-optimizer.ts` | Two-pass Viterbi optimization and exact recurring-chord grip preference |
| `fingerstyle-arranger/dp-capo.ts` | Capo sweep and minimum-cost selection |
| `fingerstyle-arranger/dp-time-slice-extraction.ts` | Authoritative input extraction, exact bindings, fixed occupancy, and input anomaly records |
| `fingerstyle-arranger/dp-time-slice-integration.ts` | Exact writeback, before/after validation, outcome selection, and rollback |
| `fingerstyle-arranger/dp-integration.ts` | Stable re-export and canonical event-matrix integration entrypoint |
| `fingerstyle-arranger/generation-diagnostics.ts` | Combined LLM/DP browser-safe run model and bounded projection |
| `fingerstyle-arranger/diagnostic-plaintext.ts` | Dependency-free ASCII report for human and AI inspection |
| `fingerstyle-arranger/physics-validation.ts` | Detailed and compatibility post-optimization physical validation |
| `fingerstyle-arranger/time-slice.ts` | ABC/time-slice conversion and forced-string ABC rendering |
| `fingerstyle-arranger/toon-utils.ts` | ASCII tablature rendering used by golden regressions |

The existing public fingerstyle entrypoints remain stable. DP behavior is contained in nearby `fingerstyle-arranger/` modules.

### 3.2 Primary Production Seam

The hardened LLM/time-slice integration is:

```ts
applyDPToTimeSliceMeasures(
  measures: TimeSliceMeasure[],
  bpm?: number,
  options?: DPOptions
): {
  measures: TimeSliceMeasure[];
  logs: string[];
  diagnostics: FingerstyleDiagnosticRun;
}
```

Its pipeline is:

```text
TimeSliceMeasure[]
  → extract authoritative decision events and exact bindings
  → generate pitch-safe candidates
  → Viterbi pass 1
  → establish first selected shape for each chord
  → Viterbi pass 2 with recurring-shape preferences
  → write back only to bound tablature entries
  → validate physical output
  → accept or roll back atomically
```

`applyDPOptimization()` remains available for canonical event-matrix input. The authoritative source-pitch and exact tablature-index hardening described below is specifically implemented at the time-slice seam, where imported or LLM-generated tablature can disagree with the source melody.

## 4. Hard Correctness Invariants

These constraints are enforced before cost comparison. A lower-cost candidate cannot override them.

### 4.1 Authoritative Melody Pitch

For a melody attack, the target MIDI pitch comes from:

```ts
parseScientificPitch(step.melody.pitch)?.midi
```

The current tablature string/fret is only a fallback when no authoritative source pitch exists. This prevents an already-invalid tab assignment from redefining the melody that DP is asked to optimize.

Before writeback, the selected physical position is checked again:

```text
midiForStringFret(candidate.melodyString, candidate.melodyFret)
  == event.melodyMidi
```

The same invariant is applied to the selected bass event.

### 4.2 Exact Source-Event Binding

Every DP event stores an integration binding:

```ts
type Binding = {
  measureIndex: number;
  stepIndex: number;
  melodyTabIndex: number | null;
  bassTabIndex: number | null;
  absoluteOnsetStep: number;
};
```

Writeback updates only those exact tablature indexes.

It must not rewrite every event whose role is `bass`, `root`, or `fifth`. Independent root, fifth, drone, and fill events remain separate musical and physical notes.

### 4.3 Unique Physical String Occupancy

`DPNoteEvent.fixedFrets` represents simultaneous notes that the current DP decision does not own:

```ts
fixedFrets?: (number | null)[];
```

Candidate construction starts from this occupied six-string layout. A melody or bass candidate is rejected when its selected string is already occupied.

This provides two collision checks:

1. Melody and selected bass cannot share a string.
2. Neither selected note can use a string reserved by an independent simultaneous note.

Duplicate concert pitches are still valid when they intentionally occur on different strings.

### 4.4 Candidate Pitch Verification

Every enumerated `(string, fret)` is rechecked with capo awareness:

```text
midiAt(stringIndex, fret, capo) == requestedMidi
```

This check protects candidate generation even if position enumeration changes later.

### 4.5 Safe Writeback and Rollback

Optimization is applied to a deep copy. The original measures remain available for atomic rollback.

Writeback is rejected when:

- the path length does not match the binding count;
- a selected melody position changes the requested MIDI pitch;
- a selected bass position changes the requested MIDI pitch; or
- a measure that was physically valid before DP becomes invalid after DP.

If imported historical input already has an unrelated validation issue, a pitch-safe correction may still be retained. The diagnostic log explicitly reports that the pre-existing issue remains. This avoids discarding a melody correction because of an unrelated legacy fill-density or sustain problem.

## 5. DP Data Model

### 5.1 Event

```ts
export interface DPNoteEvent {
  index: number;
  /** Absolute onset across all measures in quantized grid steps. */
  absoluteOnsetStep?: number;
  /** Simultaneous assignments that this event may not move or collide with. */
  fixedFrets?: (number | null)[];
  melodyMidi: number | null;
  bassMidi: number | null;
  chord: string;
  /** Sounding duration from this event to the next decision point. */
  durationSteps: number;
  /** Time available to move from the preceding event into this event. */
  movementSteps?: number;
  bpm: number;
  isRest: boolean;
}
```

`durationSteps` and `movementSteps` are intentionally separate:

- `durationSteps` controls how long selected strings ring.
- `movementSteps` controls how much time the player has to reach the new shape.

Using the destination note's duration as movement time is incorrect: a long note may still begin immediately after a very short preceding event.

### 5.2 Hand State

```ts
export interface DPHandState {
  handPosition: number;
  frets: (number | null)[];
  ringingUntil: (number | null)[];
  barreFret: number | null;
  consecutiveBarreMeasures: number;
}
```

Array indexes follow physical low-to-high string order:

```text
index:   0  1  2  3  4  5
string:  6  5  4  3  2  1
```

### 5.3 Candidate

```ts
export interface DPCandidate {
  melodyString: GuitarStringNumber | null;
  melodyFret: number;
  bassString: GuitarStringNumber | null;
  bassFret: number;
  melodyTechnique: FingerstyleTechnique;
  shapeFrets: (number | null)[];
  handPosition: number;
  usesBarre: boolean;
}
```

The complete effective six-string shape includes fixed simultaneous notes. It is therefore suitable for physical span checks, sustain comparison, collision prevention, and recurring-grip identity.

## 6. Candidate Generation

For each event, `generateCandidates()` performs the following steps:

1. Enumerate all playable positions for the requested melody MIDI.
2. Enumerate all playable positions for the requested bass MIDI.
3. Reject positions outside the skill level's maximum fret.
4. Verify each position reproduces the requested MIDI with the active capo.
5. Reject melody/bass same-string collisions.
6. Seed the shape from `fixedFrets`.
7. Reject collisions with fixed simultaneous notes.
8. Add the selected melody and bass positions.
9. Reject shapes exceeding the skill-level fret span.
10. Detect barre usage and apply skill gating.
11. Sort deterministically, retaining open-string alternatives first.
12. Keep at most 20 candidates per event.

Candidate-pruning order is:

```text
fewest pressed selected notes
  → lowest hand position
  → deterministic melody string number
  → deterministic bass string number
```

This ordering prevents open-string choices from being accidentally removed before Viterbi evaluates them.

## 7. Cost Model

The transition objective is:

```text
C_transition = (
    C_position
  + C_shape
  + C_sustain
  + C_technique
  + C_barre
  + C_placement
) × M_skill
```

During the second Viterbi pass, recurring-chord preference is added separately:

```text
C_total = C_transition + C_recurring_shape
```

### 7.1 Position Movement

Movement uses the incoming onset interval:

```text
availableTime = movementSteps × (60 / bpm / 4)
distance      = |to.handPosition - from.handPosition|
jumpTime      = 0.05 + distance × 0.02
```

The cost is:

```text
if distance == 0:
  0
else if jumpTime > availableTime:
  50 + distance × 10 + (jumpTime - availableTime) × 200
else if distance / beatsAvailable > maxHandJumpPerBeat:
  10 + distance × 2 + excess² × 3
else:
  1.5 + distance × 0.4
```

Movement difficulty uses steep finite penalties rather than `Infinity`. A hard infinite transition can poison every downstream Viterbi cell and make backtracking arbitrary. Truly forbidden candidates are filtered by candidate generation or skill constraints instead.

### 7.2 Shape Change

```text
identical six-string shape:       0.0
guide finger at same string/fret: 0.3
same-string slide guide:          0.5
full shape change:                1.5
```

### 7.3 Sustain

For each string that should still be ringing:

```text
if previousFret[string] != nextFret[string]:
  cost += 3.0
```

The comparison uses `absoluteOnsetStep`, while ringing end time is stored as:

```text
ringingUntil = absoluteOnsetStep + durationSteps
```

This keeps onset, duration, and sustain in the same coordinate system across measure boundaries.

### 7.4 Technique

The transition detector can select:

- `hammer-on` for an upward move on the same melody string;
- `pull-off` for a downward move on the same melody string;
- `slide-shift` when a fretted string provides a slide guide;
- `free-stroke` otherwise.

Representative costs are:

```text
hammer-on:       0.10
pull-off:        0.15
slide-guide:     0.20
slide-shift:     0.30 × distance / availableTime
free-stroke:     0.00
natural-harmonic 0.20
palm-mute:       0.50
bend:            0.50
grace-note:      0.10
```

The detected technique is written into the resolved candidate stored in the trellis, so the backtracked result carries the selected technique.

### 7.5 Open-String Placement

Open strings are explicitly easier than equivalent fretted positions:

```text
fretted selected melody: +0.4
fretted selected bass:   +0.4
open selected note:       0.0
```

This is a preference, not an absolute rule. Movement, sustain, recurring shape, and playability costs may select a fretted equivalent when it produces a better global path.

### 7.6 Skill Constraints

| Level | Max fret | Max span | Barre | Max jump/beat | Forbidden techniques |
|---|---:|---:|---|---:|---|
| Beginner | 5 | 3 | No | 2 | hammer-on, pull-off, bend, vibrato, barre, partial-barre, palm-mute, rest-stroke, natural-harmonic |
| Intermediate | 9 | 4 | Yes | 5 | bend |
| Advanced | 19 | 5 | Yes | 12 | none |

## 8. Exact Recurring-Chord Shape Preference

### 8.1 Requirement

When the same normalized chord returns in a song, the optimizer should prefer the exact established grip—not merely the same hand-position number.

A grip key encodes all six physical strings:

```ts
shapeFrets.map(fret => fret ?? "x").join(":")
```

Example:

```text
0:x:x:4:x:0
```

Chord symbols are normalized by trimming, removing internal whitespace, and lowercasing.

### 8.2 Why Chord History Is Not Stored in Each Trellis Cell

Putting a mutable chord-to-shape history map inside every DP state would make state identity path-dependent. Two cells with the same current hand shape could have different future costs because their hidden histories differ, breaking the normal Viterbi optimal-substructure assumption and greatly expanding the state space.

The implementation instead uses two deterministic passes.

### 8.3 Two-Pass Viterbi

**Pass 1 — establish grips**

1. Run normal Viterbi optimization.
2. Walk the selected path in song order.
3. Record the first selected exact shape for each normalized chord.

**Pass 2 — optimize with fixed preferences**

1. Rerun Viterbi with the fixed chord-to-shape map.
2. If the preferred exact shape is feasible at the current event, add a finite mismatch cost to every other shape.
3. If the preferred shape is not feasible for the current melody, bass, or fixed notes, add no mismatch cost.

Current mismatch cost:

```text
C_recurring_shape = 200
```

The cost is deliberately strong but finite. It stabilizes recurring grips while still allowing another shape when pitch or physical constraints require it.

## 9. Absolute Timing Extraction

For time-slice measures:

```text
measureOffset[m]     = sum(grid.length for all preceding measures)
absoluteOnsetStep    = measureOffset[m] + stepIndex
durationSteps        = nextAbsoluteOnset - absoluteOnsetStep
movementSteps        = absoluteOnsetStep - previousAbsoluteOnset
```

All values are clamped to at least one grid step where necessary.

Fill-only steps are not independent DP decision events. They remain present as fixed simultaneous occupancy when they share a selected onset, but they do not shorten the preceding melody event by creating phantom rest decisions.

## 10. Capo Optimization

When `autoCapo` is enabled, `optimizeWithCapo()` evaluates capo positions from 0 through `maxCapo` (default 7):

1. Transpose target MIDI values down by the capo amount relative to open-string tuning.
2. Run the complete two-pass DP optimizer.
3. Record total path cost.
4. Select the minimum-cost capo.
5. Rerun the winning capo with the main diagnostic logger.

The result preserves the selected physical capo number in `DPResult.capo`.

## 11. Ganesha Regression

The regression fixture contains the complete supplied ABC and ASCII tablature.

The original final-measure B-string line was:

```text
B|-------------------------------------------------|-0-----5-----------0-----------------------------|
```

At the first Em attack, string 2 fret 0 is B3, but the authoritative source melody is E4. The corrected line is:

```text
B|-------------------------------------------------|-5-----5-----------0-----------------------------|
```

String 2 fret 5 is E4. The repeated E uses the same physical position, while the independent Em root and fifth remain intact on their own strings.

The integration golden asserts the exact corrected ABC:

```abc
[!2!e!3!G!6!E,] !2!e !3!G !2!B4 !3!B
```

The `!N!` decorations are required at render time to force ABCJS to use the selected physical strings.

## 12. Regression Coverage

### 12.1 DP Unit and Behavioral Tests

`src/lib/theory/__tests__/dp-fingerstyle-optimizer.test.ts` covers:

- standard-tuning and string-index conversion;
- skill constraints;
- pitch-range filtering;
- melody/bass collision rejection;
- fixed simultaneous-string occupancy;
- fret-span and barre constraints;
- open-string placement preference;
- finite penalties for rushed movement;
- guide-finger and slide detection;
- hammer-on and pull-off detection;
- absolute-onset sustain timing;
- incoming movement interval versus destination duration;
- exact `Em → Am → Em` shape reuse;
- fallback when the established recurring shape is infeasible;
- finite complete paths, rest events, and backtracking length;
- capo optimization; and
- diagnostic logging.

### 12.2 Production-Seam Golden Tests

`src/lib/theory/fingerstyle-arranger/__tests__/dp-integration.test.ts` covers:

1. A minimal wrong-tab regression where source E4 was submitted as string 3 fret 0 (G3).
2. Preservation of independent root and fifth events.
3. Unique simultaneous physical strings.
4. The complete supplied Ganesha ABC fixture.
5. The complete reported ASCII fixture.
6. Melody MIDI equality for every source attack after DP.
7. Exact forced-string ABC for the corrected final measure.
8. Exact complete corrected ASCII tablature.

`diagnostic-plaintext.test.ts` exercises the dependency-free report against a real DP run and asserts the LLM timeline, complete input/configuration sections, candidate funnels, both Viterbi passes, ASCII trellis, selected cost components, and writeback/validation sections. `fingerstyle-diagnostic-persistence.test.ts` covers source mismatch rejection, per-line eviction, safe plaintext retention, removal of LLM payload previews, and quota-failure isolation. `fingerstyle-line-arranger.test.ts` verifies the shared LLM/DP run, plaintext compatibility log, and append-only `run-input → events → run-complete` persistence order.

## 13. Complexity and Determinism

Let:

- `N` = number of DP decision events;
- `K` = candidates retained per event, capped at 20;
- `C` = number of capo positions when capo sweep is enabled.

One Viterbi pass is:

```text
Time:   O(N × K²)
Memory: O(N × K)
```

Recurring-shape optimization uses two passes:

```text
Time: O(2 × N × K²) = O(N × K²)
```

Capo sweep is:

```text
Time: O(C × N × K²)
```

Candidate sorting and tie-breaking are deterministic, and recurring-shape preferences are fixed before the second pass. Identical input and options therefore produce identical output.

## 14. Diagnostics

### 14.1 Typed decision records

Every DP run emits a versioned `FingerstyleDiagnosticRun`. Its discriminated event union records:

- effective configuration and whether each value was supplied, defaulted, derived, constant, or unused;
- exact measure/step/tablature-index bindings, authoritative and submitted pitches, fixed-string occupancy, onset, duration, and movement time;
- input anomalies such as unparseable melody pitches, missing movable tabs, invalid physical positions, and duplicate fixed-string occupancy;
- candidate position counts, Cartesian combinations, every grouped hard-filter rejection reason, pre-cap feasible count, deterministic sort keys, retained candidates, and cap pruning;
- both `establish-grips` and `apply-grip-preferences` Viterbi passes;
- every predecessor/candidate transition in the server record, including movement, shape, sustain, technique, barre, placement, skill, and recurring-grip cost components;
- trellis dimensions, selected predecessor ties, established recurring shapes, backtracking, and pass totals;
- explicit `fallback-noop` events when a non-rest musical event has no feasible candidate;
- capo trials and the selected capo;
- exact writeback assignments and pitch-invariant results;
- before/after validation issue classes, fixed-entry preservation, rollback conditions, and terminal run summary.

The terminal outcome distinguishes:

- `accepted`;
- `accepted-with-unresolved-events`;
- `no-effective-dp-change`;
- `rolled-back`; and
- `failed`.

A fallback no-op preserves the predecessor hand state and leaves the original tablature unresolved. It is never presented as an inserted rest.

### 14.2 Combined LLM and DP run

`generateAIFingerstyleLine()` creates one run ID before the LLM tool loop. LLM request, response, tool-call, tool-result, final-validation, and failure records are placed in the same chronological run as the projected DP records. Complete redacted records are written as append-only JSONL under:

```text
.fingerstyle-diagnostics/<song-slug>/line-<N>/<date>-<run-id>.jsonl
```

This directory is Git-ignored and is never exposed under `public/`. Credential-like keys are recursively redacted. The browser receives a bounded projection rather than full prompts, full ABC, previous-line TOON, exhaustive rejected-candidate matrices, or full LLM tool payloads.

Recent browser summaries are source-fingerprint bound and retained in local storage at no more than five runs per line and twenty runs per song. LLM payload previews are removed before persistence, plaintext is bounded, and stale runs are rejected after the source changes.

### 14.3 Plaintext visualization

`diagnostic-plaintext.ts` renders the combined run without a chart or visualization dependency. The report is appended directly to **LLM + DP Diagnostic Logs**, making the same representation copyable and readable by both a person and an AI. It contains:

```text
FINGERSTYLE LLM + DP DIAGNOSTIC VISUALIZATION (PLAINTEXT)
LLM TOOL-LOOP TIMELINE
DP INPUTS AND EFFECTIVE CONDITIONS
PROCESSING PHASES
DP DECISION INPUTS
CANDIDATE FUNNELS
VITERBI TRELLIS (* = selected path, ! = unresolved fallback)
SELECTED PATH AND COST BREAKDOWN
WRITEBACK AND VALIDATION
```

The trellis is an ASCII cost table. Each row is a musical decision event, each column is a retained candidate, cumulative costs are shown per cell, `*` marks the final backtracked path, and `!` marks unresolved fallback events. The selected-path section expands every cost component so that the final number is reproducible from the log.

The existing `logs: string[]` remains available as a compatibility/copy view. Typed diagnostics are additive and do not enter stable musical artifact contracts such as `FingerstyleArrangement` or `FingerstyleOutputContract`.

## 15. Verification

Primary commands:

```bash
# DP unit and production-seam regressions
npx vitest run \
  src/lib/theory/__tests__/dp-fingerstyle-optimizer.test.ts \
  src/lib/theory/fingerstyle-arranger/__tests__/dp-integration.test.ts

# Related fingerstyle regressions
npx vitest run \
  src/lib/theory/__tests__/dp-fingerstyle-optimizer.test.ts \
  src/lib/theory/fingerstyle-arranger/__tests__/dp-integration.test.ts \
  src/lib/theory/fingerstyle-arranger/__tests__/dp-m3-m4-transition.test.ts \
  src/lib/theory/fingerstyle-arranger/__tests__/time-slice.test.ts \
  src/lib/theory/__tests__/fingerstyle-arranger.test.ts

# Project validation
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Verification performed for the diagnostic visualization:

- Focused server-action, DP, integration, plaintext-renderer, persistence, and line-card tests: 61 passed.
- TypeScript: passed.
- ESLint on the changed diagnostic/action/UI/test files: passed with no issues.
- Production build: passed.
- `git diff --check`: passed.

The full test suite currently has one unrelated checked-in song-library validation failure (`src/lib/songs/__tests__/validation.test.ts`). Full-project lint still reports the known vendored `public/abcjs-basic-min.js` issues.

## 16. Future Optimization Opportunities

The current candidate cap keeps the trellis small, but candidate pruning is local. If future arrangements require denser six-string voicings, consider a diversity-preserving beam that retains candidates across open position, low position, high position, and exact recurring shapes.

Other future improvements:

1. Represent more than one independently movable support note in a DP event instead of fixing all non-selected notes.
2. Include right-hand finger transitions and repeated-finger speed limits in the state.
3. Track sustain per musical note, not only per physical string.
4. Add chord-equivalence normalization for aliases such as `Em`, `Emin`, and `E-` when musically appropriate.
5. Learn configurable cost weights from accepted user arrangements while preserving hard pitch and collision invariants.
6. Extend optimization to alternate tunings such as Drop D and DADGAD.
7. Use an admissible lower bound or beam search if candidate density grows beyond the current `K ≤ 20` design.

Any future cost-model change must retain the golden Ganesha ABC/ASCII regression and the hard source-pitch, exact-binding, and unique-string invariants.
