# Guitar Fingerstyle Arrangement Guide

This document describes the line-level solo-guitar pipeline used by `/compose/:slug/guitar-fingerstyle`. The design keeps the melody and physical constraints server-owned while leaving two genuinely musical decisions to the LLM:

1. which scored fill windows should be used or skipped;
2. which legal atomic notes, sequence, durations, and right-hand fingers should form each fill.

The LLM does **not** invent timing coordinates, strings, frets, or replacement source grids.

## 1. Authoritative source model

The input is ABC notation with melody, inline chord symbols, lyrics, and optional beat-weight metadata. The time-slice compiler preserves these as server-owned fields:

- `measure` and source `lineIndex`;
- active `chord` at every quantized step;
- metric `weight`: `⬤`, `●`, `*`, or `null`;
- melody `pitch` and `state`: `attack`, `sustain`, or `rest`;
- lyric syllable, melisma marker, or skip marker;
- pickup and repeat/barline metadata;
- key, comping profile, voicing plan, and legacy fill-density context.

A source line is useful structural evidence, but it is not assumed to be a perfect phrase annotation. Phrase-transfer scoring also considers rest length, lyric termination, repeat boundaries, current chord/key, cadence character, and the next line's melody entrance.

### Meter-aware resolution

The grid uses four quantized steps per notated beat. Its length follows the meter numerator:

- 4/4 → 16 steps;
- 3/4 → 12 steps;
- other supported meters use `numerator × 4` steps.

Therefore, the production format is not an always-16-step schema. Pickup padding is excluded from generation and fill analysis.

## 2. Generation policy

Guitar complexity and fill quantity are separate controls.

### Player skill

| Skill | Main effect |
|---|---|
| Beginner (default) | fret ≤ 5, span ≤ 3, no barre, small hand jumps, at most 1 note per fill window |
| Intermediate | fret ≤ 9, span ≤ 4, broader jumps, at most 2 notes per window |
| Advanced | fret ≤ 19, span ≤ 5, at most 3 notes per window |

The canonical limits come from `SKILL_LEVEL_CONSTRAINTS` in `fingerstyle-arranger/dp-types.ts`. The selected skill is passed to foundation validation, DP positioning, fill enumeration, and final physical validation.

### Fill density

The UI exposes `auto`, `few`, `normal`, and `many`.

- `auto`: beginner → few, intermediate → normal, advanced → many;
- `few`: restrained use of the best windows;
- `normal`: moderate phrase support;
- `many`: more windows, still bounded by physical and musical constraints.

Legacy values normalize at the boundary: `none` becomes zero-fill compatibility mode and `all` becomes `many`. Density controls window budgets; it does not relax fret or hand constraints.

Settings are persisted in the per-song Composer workspace. Changing settings does not regenerate existing lines.

## 3. Enforced staged tool workflow

`generateAIFingerstyleLine` remains the public server action. Its implementation is local to `src/app/actions/fingerstyle-line-arranger/` and uses one OpenAI-compatible tool loop with server-owned phase state.

### Stage 1 — Non-fill foundation

The LLM may query compact guitar voicings, then calls `submit_fingerstyle_foundation` with `tablature:v1`.

The foundation must:

- cover every authoritative melody attack exactly once;
- preserve the exact melody pitch;
- contain no `fill` roles;
- use `bass`, `root`, `fifth`, or `harmony` for structural support;
- leave unweighted sustain/rest steps empty for later fill analysis;
- obey sparse PIMA/right-hand and selected-skill constraints.

### Stage 2 — DP positioning and freeze

The server validates the foundation, parses the actual ABC `Q:` tempo, and runs the fingerstyle dynamic-programming optimizer with the selected skill level. The resulting grip path is frozen.

No mutating DP pass runs after opportunity scoring. Otherwise the hand costs shown to the LLM would become stale.

### Stage 3 — Exhaustive fill analysis

The LLM calls `inspect_fill_opportunities` beginning at cursor `0` and follows every `nextCursor` until `end`. The server rejects skipped, repeated, or out-of-order pages.

Analysis visits every active grid step and records a typed eligibility rejection when appropriate, including:

- pickup padding;
- melody attack;
- occupied foundation attack;
- protected melody string;
- occupied string;
- no harmonic pitch;
- fret/span violation;
- excessive incoming or outgoing hand jump;
- register collision;
- unresolved approach-note condition.

Safe windows are formed from contiguous melody rests or protected sustains. Windows split at melody attacks, foundation attacks, chord changes, measure boundaries, pickup padding, and line boundaries.

### Stage 4 — LLM window selection

After every page is inspected, the LLM calls `select_fill_windows` with a use/skip decision and short reason for every scored window. The server validates:

- source and opportunity-set fingerprints;
- unknown, duplicate, or omitted window IDs;
- total density budget;
- per-measure budget;
- zero-fill compatibility mode.

### Stage 5 — LLM fill composition

The LLM calls `validate_composed_fills` with selected atomic candidate IDs plus its chosen duration and right-hand finger.

A candidate is one legal note placement—not a lick. It fixes:

- window, measure, and start step;
- scientific pitch and harmonic role;
- string and fret;
- maximum duration;
- incoming, outgoing, and total hand cost;
- candidate score and conditional requirements.

The LLM still decides the note sequence, rhythmic duration inside each legal capacity, and `i`/`m`/`a` assignment.

The server rejects unknown or duplicate candidates, candidates from skipped windows, duration overflow, per-window note-budget overflow, same-string interval overlap, and scale approaches that do not resolve by step to a nearby chord tone.

### Stage 6 — Server merge and final reference

The server reconstructs the final measures from the frozen foundation and accepted candidate IDs. It adds `durationSteps`, `fillWindowId`, and `fillCandidateId` provenance to accepted fill events.

The final `submit_arranged_line` call must reference the same accepted `fills:v1` payload. The LLM cannot replace the server-owned grid at final submission.

## 4. Opportunity and candidate generation

### Harmonic pool

For each legal start step, the engine derives candidates from:

- active-chord root, third, fifth, seventh, and useful extensions;
- common tones into the next chord;
- key-scale approach tones only on weak/unweighted placements, with an explicit resolution requirement.

Fill-role candidates use inner/treble strings 1–4 with `i`, `m`, or `a`. Bass anchors remain part of the frozen foundation. Duplicate concert pitches on different strings remain distinct because string choice affects fingering and sustain behavior.

### Physical filtering

Hard constraints run before scoring:

- selected-skill fret and span limits;
- protected melody strings during sustain;
- occupied foundation strings;
- melody-register ceiling;
- incoming and outgoing movement allowance;
- duration capacity inside the same safe window.

Each candidate receives a deterministic readable ID such as:

```text
c-m3-s7-B3-str2f0
```

The opportunity-set ID includes the source fingerprint, policy, and frozen foundation signature. A selection from a different DP result is therefore rejected as stale.

## 5. Stable 0–100 opportunity score

Each window exposes the complete breakdown.

| Component | Range | Intent |
|---|---:|---|
| Silence/capacity | 0–25 | favor longer held-note or rest space |
| Phrase/line transfer | 0–20 | favor useful sentence-to-sentence connections |
| Hand continuity | 0–20 | reward low-cost departure and landing |
| Harmonic fit | 0–15 | reward chord tones and common tones |
| Voice leading | 0–10 | reward small motion toward the next melody target |
| Metric fit | 0–10 | prefer offbeats/weak placements over structural arrivals |
| Cadence restraint | penalty | preserve closed tonic endings and some repeat boundaries |
| Crowding | penalty | avoid fills immediately before melody re-entry |
| Repetition | penalty | reserved for repeated-gesture control |

The positive components total 100 before penalties. Hard physical failures never enter scoring.

A line ending can receive a transfer bonus and a tonic-cadence restraint penalty simultaneously. This is intentional: line transitions are valuable, but the system should not automatically decorate every devotional cadence.

## 6. Compact versioned contracts

The model-facing payloads use compact row tables rather than verbose replacement JSON.

### Foundation: `tablature:v1`

```text
tablature:v1
{measure,step,string,fret,finger,role}
3,1,6,0,p,root
3,1,1,0,a,melody
3,9,4,0,p,fifth
```

Omitted steps have no attack. `harmony` is available for structural inner pinch tones; `fill` is forbidden in the foundation.

### Opportunity page: `fill-opportunities:v1`

```text
fill-opportunities:v1
set,fos-abc123
source,source-fingerprint
policy,beginner,auto,few,skill-level
budget,1,2,1,1
counts,16,144,2,18
page,0,end,18,0
rows: [kind,...]
W,w-m3-s6-8,3,1,6,8,3,Em,Em,rest,78,...
C,c-m3-s6-B3-str2f0,w-m3-s6-8,3,6,B3,59,fifth,2,0,m,3,0,0,0,92,
```

Pages carry explicit cursor metadata. Legal rows are never silently truncated.

### Selection: `fill-selection:v1`

```text
fill-selection:v1
set,fos-abc123
source,source-fingerprint
decisions: [D,window,use|skip,reason]
D,w-m3-s2-4,skip,held melody should remain exposed
D,w-m3-s6-8,use,long phrase transfer with stable open grip
```

### Composition: `fills:v1`

```text
fills:v1
set,fos-abc123
source,source-fingerprint
notes: [N,candidate,durationSteps,finger]
N,c-m3-s6-B3-str2f0,1,m
N,c-m3-s7-D4-str2f3,2,m
```

All codecs validate exact versions and headers, byte/row limits, bindings, row shape, enum values, and integer durations.

## 7. Duration, ties, and ABC tablature

`TimeSliceGridStep.tablature` supports:

- `durationSteps`;
- `fillWindowId`;
- `fillCandidateId`;
- structural `harmony` role.

`time-slice-abc-renderer.ts` renders sounding intervals rather than treating every row as an isolated simultaneous attack.

- Melody duration comes from authoritative melody `attack`/`sustain` states.
- Fill duration comes from the accepted `durationSteps`.
- Existing persisted non-melody events without `durationSteps` retain the historical attack-to-next-attack rendering; the new staged foundation writes explicit one-step structural durations so scoring and playback agree.
- When a fill enters during a held melody, the renderer splits the interval and ties the continuing melody rather than shortening or retriggering it.
- Every tied segment preserves the `!N!` guitar string decoration.
- Identical pitches on different strings are not deduplicated.
- Concert-pitch ABC and key-signature-aware natural signs are preserved for `clef=treble-8`.

Final physical validation also checks sounding same-string collisions and durations that extend outside a measure.

## 8. Diagnostics and UI

One run ID covers:

- LLM requests and tool calls;
- foundation acceptance/rejection;
- DP extraction, candidates, costs, path, writeback, and rollback;
- fill placement evaluation and rejection counts;
- opportunity pagination;
- LLM selection;
- composition validation/repair;
- final server merge and physical validation.

Diagnostics are bounded for UI/prompt safety and persisted as append-only, redacted JSONL:

```text
.fingerstyle-diagnostics/<song>/line-<N>/<date>-<runId>.jsonl
```

Sensitive keys such as API keys, authorization, cookies, passwords, secrets, and tokens are redacted.

Each line card shows a compact run summary with:

- effective skill and density;
- source BPM;
- evaluated placement count;
- eligible and selected window counts;
- composed fill-note count;
- final validation status.

Only one line can generate at a time on the route. Other line buttons and settings controls are disabled until the active run finishes.

## 9. Source fixtures and validation

Use:

- `Hari Bol` for ordinary 4/4 and cross-line phrase-transfer checks;
- `Ganesha` for pickup, tie, rest, repeat, DP, ABC, and ASCII-GuitarTab regressions.

`data/songs/marathi/jago-kundalini-ma.melody.abc` is currently header-only. The route remains stable, but there are no melody notes, lyrics, or chord events to arrange end to end until song content is authored.

Primary regression commands:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Known repository-wide caveats remain documented in `CLAUDE.md`: song-library validation fails for the header-only Jago Kundalini Ma fixture, lint may report vendored `public/abcjs-basic-min.js`, and static export can conflict with Server Actions during build.
