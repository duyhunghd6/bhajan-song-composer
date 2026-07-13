# Optimize Fingerstyle DP Algorithm

> Technical Specification · Implementation Plan · Test Plan

## 1. Problem Statement

The current fingerstyle arranger selects guitar hand shapes **greedily** — one chord at a time, with no awareness of:

1. **Transition cost** between consecutive hand shapes (fret-12 → fret-1 in a 16th note).
2. **Sustain integrity** — changing the hand shape kills notes that are still supposed to ring.
3. **Legato techniques** — hammer-on, pull-off, slide can connect notes without right-hand plucks or can bridge position shifts silently.
4. **Global optimality** — the best shape for measure 3 depends on what shapes were chosen for measures 2 and 4.
5. **Skill-level gating** — beginner arrangements should avoid barres, high frets, and advanced techniques.
6. **Capo optimization** — a global capo position can turn barre-heavy songs into open-chord songs.

## 2. Architectural Approach

### 2.1 Algorithm Choice: Viterbi / Shortest-Path DP

The problem maps to a **Hidden Markov Model** (HMM):

- **Observations** = the sequence of melody notes + chords + durations across the song.
- **Hidden states** = candidate hand shapes (fret positions) at each time step.
- **Transition probability** = inverse of transition cost between consecutive shapes.
- **Emission probability** = how well a shape covers the required melody + bass notes.

We use the **Viterbi algorithm** to find the minimum-cost path through the shape graph.

### 2.2 Scope and Boundaries

**In scope (Phase 1):**
- DP state: hand position, shape, finger locks, ringing strings.
- Cost function: position movement, shape change, sustain violation, guide-finger detection.
- Technique vocabulary: hammer-on, pull-off, slide, vibrato, natural-harmonic.
- Skill-level gating: beginner, intermediate, advanced.
- Capo sweep: evaluate capo 0–7, select minimum-cost.

**Out of scope (future phases):**
- Right-hand advanced techniques (tremolo, rasgueado, tapping).
- Alternate tunings (Drop D, DADGAD).
- AI-generated fills that use DP-selected technique vocabulary.

### 2.3 Integration Point

The DP optimizer plugs into the existing pipeline at **two points**:

1. **`event-matrix.ts` → `routeMidiToStrings()`**: Currently picks the lowest-fret candidate per note independently. The DP replaces this with a globally optimal string/fret assignment.
2. **`ai-sim.ts` → `generateSimulatedFingerstyle()`**: Currently picks voicings greedily. The DP replaces this with a Viterbi-optimal voicing sequence.

The existing `fingerstyle-arranger.ts` public API (`generateFingerstyleArrangement()`) remains unchanged — callers are not affected.

## 3. Data Model

### 3.1 Extended Technique Type

```typescript
// fingerstyle-arranger/dp-types.ts

export type FingerstyleTechnique =
  // Existing
  | "thumb-clock" | "pinch" | "guide-tone" | "syncopation" | "string-slap"
  // Left-hand legato (new)
  | "hammer-on" | "pull-off"
  | "slide-shift" | "slide-guide"
  | "vibrato" | "natural-harmonic"
  // Left-hand fretting (new)
  | "barre" | "partial-barre" | "guide-finger-pivot" | "left-hand-mute"
  // Right-hand articulation (new)
  | "rest-stroke" | "free-stroke" | "palm-mute"
  // Expressive (new)
  | "grace-note" | "bend";
```

### 3.2 DP State

```typescript
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface DPHandState {
  /** Center fret of the left-hand position (0–19). */
  handPosition: number;
  /** Frets held on each string (null = not fretted, "X" = muted). */
  frets: (number | null)[];
  /** Which strings are currently ringing and until what time step. */
  ringingUntil: (number | null)[];  // index 0 = string 6, index 5 = string 1
  /** Barre fret if active, null otherwise. */
  barreFret: number | null;
  /** Consecutive measures of barre for stamina tracking. */
  consecutiveBarreMeasures: number;
}

export interface DPNoteEvent {
  /** Index in the flattened event sequence. */
  index: number;
  /** Melody pitch as MIDI number, or null for bass-only / rest. */
  melodyMidi: number | null;
  /** Bass pitch as MIDI number, or null for melody-only / rest. */
  bassMidi: number | null;
  /** Chord symbol at this point. */
  chord: string;
  /** Duration in time-slice steps (1 step = 1/16th note in 4/4). */
  durationSteps: number;
  /** BPM for computing real-time constraints. */
  bpm: number;
  /** Whether this is a rest (no sound required). */
  isRest: boolean;
}

export interface DPCandidate {
  /** String assignment for melody (1–6), null if rest. */
  melodyString: GuitarStringNumber | null;
  melodyFret: number;
  /** String assignment for bass (1–6), null if rest. */
  bassString: GuitarStringNumber | null;
  bassFret: number;
  /** The technique used to produce the melody note. */
  melodyTechnique: FingerstyleTechnique;
  /** Full fret layout across all 6 strings. */
  shapeFrets: (number | null)[];
  /** Hand center position. */
  handPosition: number;
  /** Whether this candidate uses a barre. */
  usesBarre: boolean;
  /** Cost from the cost function. */
  cost: number;
}

export interface DPResult {
  /** Optimal path of candidates, one per event. */
  path: DPCandidate[];
  /** Total cost of the optimal path. */
  totalCost: number;
  /** Recommended capo position (0 = no capo). */
  capo: number;
  /** Skill level used for gating. */
  skillLevel: SkillLevel;
}
```

## 4. Cost Function Specification

### 4.1 Position Movement Cost

```
C_position(from, to, availableTime) =
  let distance = |to.handPosition - from.handPosition|
  if distance == 0: return 0
  
  let canSlide = any string has a note that connects from → to
  if canSlide:
    return 0.3 * distance / max(availableTime, 0.1)
  else:
    let jumpTime = 0.05 + distance * 0.02  // seconds
    if jumpTime > availableTime: return Infinity
    return 1.5 + distance * 0.4
```

### 4.2 Shape Change Cost

```
C_shape(from, to) =
  if from.shapeFrets == to.shapeFrets: return 0
  
  let guideFinger = find common (string, fret) pair between shapes
  if guideFinger exists: return 0.3
  
  let slideGuideFinger = find common string with different fret
  if slideGuideFinger exists: return 0.5
  
  return 1.5  // full shape change
```

### 4.3 Sustain Violation Cost

```
C_sustain(from, to, currentStep) =
  let cost = 0
  for each string s where from.ringingUntil[s] > currentStep:
    if to.shapeFrets[s] != from.shapeFrets[s]:
      cost += 3.0  // releasing a still-ringing note
  return cost
```

### 4.4 Technique Cost

```
C_technique(technique, candidate) =
  match technique:
    "hammer-on":     0.1   // almost free
    "pull-off":      0.15
    "slide-shift":   0.3 * fretDistance / availableTime
    "slide-guide":   0.2
    "vibrato":       0.0   // modifier, no transition
    "natural-harmonic": 0.2
    "barre":         2.0 + 0.3 * consecutiveBarreMeasures
    "guide-finger-pivot": 0.0  // already counted in shape change
    "free-stroke":   0.0   // baseline
    "rest-stroke":   0.0 + (adjacentStringRinging ? 2.0 : 0)
    "bend":          0.5
    "grace-note":    0.1
    default:         0.0
```

### 4.5 Skill-Level Multiplier

```
C_skill(candidate, level) =
  match level:
    "beginner":
      if candidate.handPosition > 5:  cost *= 3
      if candidate.usesBarre:          cost *= 5
      if technique in ["bend","hammer-on","pull-off"]: cost = Infinity
    "intermediate":
      if candidate.handPosition > 9:  cost *= 2
      if technique in ["bend"]:        cost = Infinity
    "advanced":
      // no restrictions
```

### 4.6 Total Transition Cost

```
C_total(from, to, event, skillLevel) =
  C_position(from, to, event.availableTime)
  + C_shape(from, to)
  + C_sustain(from, to, event.index)
  + C_technique(to.melodyTechnique, to)
  + C_skill(to, skillLevel)
```

## 5. Implementation Plan

### Phase 1: Foundation Types (dp-types.ts)
**File:** `src/lib/theory/fingerstyle-arranger/dp-types.ts` [NEW]

- Define `FingerstyleTechnique` extended union type.
- Define `SkillLevel`, `DPHandState`, `DPNoteEvent`, `DPCandidate`, `DPResult`.
- Export `STANDARD_TUNING_MIDI` constant (re-export from guitar-playability).
- Define `SKILL_LEVEL_CONSTRAINTS` configuration object.

### Phase 2: Candidate Generator (dp-candidates.ts)
**File:** `src/lib/theory/fingerstyle-arranger/dp-candidates.ts` [NEW]

- `generateCandidates(event: DPNoteEvent, skillLevel: SkillLevel): DPCandidate[]`
  - For a given note event, enumerate all feasible (string, fret) assignments for melody and bass.
  - Filter by skill-level max fret, barre allowance.
  - For each assignment, compute the full shape layout.
  - Prune candidates that violate `MAX_FRET_SPAN` within a single shape.
  - Return the pruned candidate list (typically 5–20 candidates per event).

### Phase 3: Cost Function (dp-cost.ts)
**File:** `src/lib/theory/fingerstyle-arranger/dp-cost.ts` [NEW]

- `transitionCost(from: DPHandState, to: DPCandidate, event: DPNoteEvent, skillLevel: SkillLevel): number`
  - Implements the full cost function from Section 4.
- `detectGuideFinger(fromShape: (number|null)[], toShape: (number|null)[]): boolean`
- `detectSlideOpportunity(fromState: DPHandState, toCandidate: DPCandidate, event: DPNoteEvent): FingerstyleTechnique | null`
- `detectHammerPullOpportunity(fromState: DPHandState, toCandidate: DPCandidate): FingerstyleTechnique | null`

### Phase 4: Viterbi Optimizer (dp-optimizer.ts)
**File:** `src/lib/theory/fingerstyle-arranger/dp-optimizer.ts` [NEW]

- `optimizeFingerstylePath(events: DPNoteEvent[], skillLevel: SkillLevel, capo?: number): DPResult`
  - Build the trellis: for each event, generate candidates.
  - Forward pass: compute cumulative minimum cost for each candidate.
  - Backtrack: extract the minimum-cost path.
  - Return `DPResult` with path, totalCost, capo, skillLevel.

### Phase 5: Capo Optimizer (dp-capo.ts)
**File:** `src/lib/theory/fingerstyle-arranger/dp-capo.ts` [NEW]

- `optimizeWithCapo(events: DPNoteEvent[], skillLevel: SkillLevel, maxCapo?: number): DPResult`
  - For each capo position 0..maxCapo (default 7):
    - Transpose all MIDI pitches down by capo semitones.
    - Run `optimizeFingerstylePath()`.
    - Record total cost.
  - Return the result with minimum total cost.

### Phase 6: Integration (dp-integration.ts)
**File:** `src/lib/theory/fingerstyle-arranger/dp-integration.ts` [NEW]

- `applyDPOptimization(matrix: FingerstyleEventMatrix, options: DPOptions): FingerstyleEventMatrix`
  - Extract `DPNoteEvent[]` from the event matrix.
  - Run `optimizeWithCapo()`.
  - Apply the optimal path back onto the event matrix (update string/fret assignments, techniques).
  - Return the updated matrix.
- Wire into `buildFingerstyleEventMatrix()` in `event-matrix.ts` as an optional post-processing step.

### Phase 7: Update picking-profiles.ts
**File:** `src/lib/theory/picking-profiles.ts` [MODIFY]

- Expand `FingerstylePhysicalTechnique` union to include new techniques.
- Keep backward compatibility — old technique values remain valid.

## 6. File Summary

| File | Status | LoC (est.) | Purpose |
|------|--------|------------|---------|
| `fingerstyle-arranger/dp-types.ts` | NEW | ~100 | All DP type definitions |
| `fingerstyle-arranger/dp-candidates.ts` | NEW | ~120 | Candidate generation per event |
| `fingerstyle-arranger/dp-cost.ts` | NEW | ~150 | Full transition cost function |
| `fingerstyle-arranger/dp-optimizer.ts` | NEW | ~130 | Viterbi forward pass + backtrack |
| `fingerstyle-arranger/dp-capo.ts` | NEW | ~50 | Capo sweep wrapper |
| `fingerstyle-arranger/dp-integration.ts` | NEW | ~80 | Wire DP into existing pipeline |
| `picking-profiles.ts` | MODIFY | ~5 lines | Expand technique union |
| `event-matrix.ts` | MODIFY | ~10 lines | Optional DP post-processing call |

## 7. Test Plan

### 7.1 Unit Tests: dp-types

**File:** `__tests__/dp-types.test.ts` [NEW]

| Test | Assertion |
|------|-----------|
| `SKILL_LEVEL_CONSTRAINTS` has all 3 levels | Keys = beginner, intermediate, advanced |
| Beginner constraints cap maxFret to 5 | `constraints.beginner.maxFret === 5` |
| Advanced allows all techniques | `constraints.advanced.forbiddenTechniques.length === 0` |

### 7.2 Unit Tests: dp-candidates

**File:** `__tests__/dp-candidates.test.ts` [NEW]

| Test | Assertion |
|------|-----------|
| Generates candidates for E4 melody + E2 bass | At least 1 candidate with string 1 fret 0 (melody) and string 6 fret 0 (bass) |
| All candidates have fret span ≤ 3 | Every candidate passes `maxFret - minFret <= 3` |
| Beginner candidates never exceed fret 5 | All candidate frets ≤ 5 |
| Intermediate candidates never exceed fret 9 | All candidate frets ≤ 9 |
| Returns empty array for impossible note | E.g., MIDI 120 has no guitar candidate |

### 7.3 Unit Tests: dp-cost

**File:** `__tests__/dp-cost.test.ts` [NEW]

| Test | Assertion |
|------|-----------|
| Same position → zero position cost | `positionCost(pos5, pos5) === 0` |
| Guide finger detected → low shape cost | Cost ≤ 0.5 |
| No guide finger → high shape cost | Cost ≥ 1.0 |
| Sustain violation → penalty | Cost includes +3.0 for each violated string |
| Slide opportunity detected for same-string move | Returns `"slide-shift"` |
| Hammer-on detected for upward same-string | Returns `"hammer-on"` |
| Pull-off detected for downward same-string | Returns `"pull-off"` |
| Beginner + barre → very high cost | Cost ≥ 10.0 (5× multiplier) |
| Impossible jump (12 frets in 16th note at 120bpm) → Infinity | `cost === Infinity` |

### 7.4 Unit Tests: dp-optimizer

**File:** `__tests__/dp-optimizer.test.ts` [NEW]

| Test | Assertion |
|------|-----------|
| Single event → returns the lowest-cost candidate | Path length = 1, cost = candidate cost |
| Two events same chord → prefers staying in position | `path[0].handPosition === path[1].handPosition` |
| Em → D transition prefers guide finger | Total cost < cost of full shape change |
| 4-measure Em song at beginner → all open position | All frets ≤ 5, no barres |
| Path never contains Infinity cost | Every transition is physically feasible |
| Backtrack produces exactly N candidates for N events | `result.path.length === events.length` |

### 7.5 Unit Tests: dp-capo

**File:** `__tests__/dp-capo.test.ts` [NEW]

| Test | Assertion |
|------|-----------|
| Song in Bb → capo 1 produces lower cost than capo 0 | `result.capo === 1` and `result.totalCost < noCapoResult.totalCost` |
| Song in Em → capo 0 is optimal | `result.capo === 0` |
| Capo transposes MIDI correctly | Capo 2 → all MIDI values shifted down by 2 |

### 7.6 Integration Tests: dp-integration

**File:** `__tests__/dp-integration.test.ts` [NEW]

| Test | Assertion |
|------|-----------|
| `applyDPOptimization` preserves melody pitches | Output MIDI matches input MIDI |
| `applyDPOptimization` produces valid guitar tab | `validateGuitarTab()` returns valid |
| Existing `generateFingerstyleArrangement` still passes | All existing tests in `fingerstyle-arranger.test.ts` green |
| DP-optimized output has lower or equal total movement than greedy | Sum of fret distances ≤ greedy sum |

### 7.7 Regression Safety

All existing tests in `fingerstyle-arranger.test.ts` (14 tests) must continue passing. The DP optimizer is additive — it is called as an optional post-processing step. When disabled (default for now), the output is identical to the current greedy algorithm.

## 8. Verification Commands

```bash
# Run only the new DP tests
npx vitest run src/lib/theory/__tests__/dp-

# Run all fingerstyle tests (existing + new)
npx vitest run src/lib/theory/__tests__/fingerstyle-arranger.test.ts src/lib/theory/__tests__/dp-

# Full regression check
npm test
npx tsc --noEmit
```

## 9. Post-Implementation Discoveries & Bug Fixes

During integration testing with real song data (e.g., Ganesha song M1-M5), several critical issues were identified and resolved in the DP algorithm:

### 9.1 Infinity Trellis Poisoning
**Issue:** The position movement cost function originally used hard `Infinity` walls for jumps that exceeded the physical time limit or skill-gated per-beat limit. A single impossible transition (like a 6-fret jump in 1 beat) would poison the entire Viterbi trellis downstream, resulting in arbitrary path selection.
**Fix:** Replaced `return Infinity` with steep but finite graduated penalties (e.g., `10 + distance*2 + excess^2*3`). This ensures the Viterbi trellis always has finite costs, allowing the optimizer to find the "least painful" path through challenging position jumps.

### 9.2 Fill-Only Step Duration Corruption
**Issue:** Fill-only steps (without melody or bass) were being extracted as phantom "rest" DP events. This halved the duration perceived by the preceding melody event, breaking the cost calculations.
**Fix:** Added a `hasMelodyOrBass` guard during extraction. Only steps containing melody, bass, root, or fifth roles are treated as DP events. Fills are invisible to the DP optimizer.

### 9.3 Technique Detection Writeback
**Issue:** `detectBestTechnique()` correctly identified legato moves (hammer-on, pull-off), but every candidate in the output path remained "free-stroke".
**Fix:** The optimizer now clones the candidate as a `resolvedCandidate` and writes the correct technique before inserting it into the trellis.

### 9.4 Independent LLM Optimization Convergence
**Discovery:** The LLM independently chose to pre-position the hand to string 2 / fret 5 (instead of open string 1) right before a large position jump, which is the exact optimal move computed by the DP Viterbi algorithm. This confirms that the DP cost model perfectly aligns with expert guitar instincts.
