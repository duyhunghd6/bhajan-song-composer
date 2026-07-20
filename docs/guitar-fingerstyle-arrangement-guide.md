# Guitar Fingerstyle Arrangement Guide

This document describes the line-level solo-guitar pipeline used only by `/compose/:slug/guitar-fingerstyle`. Its input is the selected Harmony Step 3 (`voice-leading-validation`) ABC. It is an independent sibling of `/compose/:slug/accompaniment`: accompaniment output, setup style, branch options, and completion state never become inputs to this TimeGrid workflow.

The canonical arrangement document is an event-based, meter-aware `TimeSliceMeasure[]` TimeGrid: it retains source-derived melody/context facts and stores independent physical guitar attacks in each `grid[].tablature[]` array. Guitar ABC notation and ASCII-GuitarTab are deterministic generated artifacts, not raw-text editing targets.

The design keeps locked melody facts and physical constraints server-owned while leaving two genuinely musical decisions to the LLM:

1. which scored fill windows should be used or skipped;
2. which legal atomic notes, sequence, durations, and right-hand fingers should form each fill.

The LLM does **not** replace locked source fields or invent unvalidated timing coordinates, strings, or frets. It may propose accompaniment events only through the staged, server-validated workflow.

## 1. Canonical TimeGrid and locked source facts

Source ABC provides melody, inline chord symbols, lyrics, optional beat-weight metadata, meter, key, and barline context. The time-slice compiler pins those facts into the canonical TimeGrid, where they are not editable as part of a fingerstyle arrangement edit:

- `measure` and source `lineIndex`;
- active `chord` at every quantized step;
- metric `weight`: `⬤`, `●`, `*`, or `null`;
- melody `pitch` and `state`: `attack`, `sustain`, or `rest`;
- lyric syllable, melisma marker, or skip marker;
- pickup and repeat/barline metadata;
- key, comping profile, voicing plan, and optional imported fill-density compatibility metadata.

The editable arrangement layer is the independent `tablature` attack-event array on each grid step. Its events carry physical string/fret coordinates, right-hand finger, role, and optional explicit `durationSteps`; they can be `bass`, `root`, `fifth`, `harmony`, or `fill`, alongside physically realized locked `melody` attacks. An edit must never alter the source melody pitch, attack timing, grid structure, or contextual fields.

A source line is useful structural evidence, but it is not assumed to be a perfect phrase annotation. Phrase-transfer scoring also considers rest length, lyric termination, repeat boundaries, current chord/key, cadence character, and the next line's melody entrance.

### Canonical data flow

```text
source ABC → compile locked source facts into TimeGrid
           → add or revise validated tablature events
           → persist versioned TimeGrid with source fingerprint
           → deterministically render Guitar ABC and ASCII-GuitarTab
```

The working representation has three distinct layers: the in-memory canonical `{ version: 1, source, measures }` document; the emitted `timegrid-document:v3` import/copy/download JSON; and the separate `{ version: 1, sourceFingerprint, measures }` local-restore envelope. Only the TimeGrid is editable authority. The Composer Guitar Fingerstyle page exposes v3 copy, download, paste import, and file import; imports must match the currently selected `voice-leading-validation` raw source ABC, then overlay only validated physical tab events on freshly compiled source facts. The v3 document preserves the immutable raw source ABC plus literal melody states and physical tab events; local restore overlays only compatible tab/visual-tab data on freshly compiled source facts and rejects malformed or physically invalid browser drafts.

See [TimeGrid Conversion Guide](./timegrid-conversion-guide.md) for the exact v3 wire shape, persisted envelope, representation-level edit operations, validation sequence, and serialization rules.

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

The canonical limits come from `SKILL_LEVEL_CONSTRAINTS` in `fingerstyle-arranger/fingerstyle-constraints.ts`. The selected skill is passed to deterministic TimeGrid foundation placement, fill enumeration, and final physical validation.

### Fill density

The Guitar Fingerstyle page is the authoritative owner of fill density; it is no longer supplied by an accompaniment workflow step. The UI exposes `auto`, `few`, `normal`, and `many`.

- `auto`: beginner → few, intermediate → normal, advanced → many;
- `few`: restrained use of the best source-rest/phrase-gap windows;
- `normal`: moderate phrase support using more legal rest windows;
- `many`: more legal rest windows, still bounded by physical and musical constraints.

All discretionary fills are restricted to actual source-rest/phrase-gap windows. Melody attacks and held Melody spans remain protected in every density mode. Legacy values normalize at the boundary: `none` becomes zero-fill compatibility mode and `all` becomes `many`. Density controls window budgets; it does not relax fret or hand constraints.

Settings are persisted in the per-song Composer workspace. Changing settings does not regenerate existing lines.

## 3. Enforced staged tool workflow

`generateAIFingerstyleLine` remains the public server action. Its implementation is local to `src/app/actions/fingerstyle-line-arranger/` and uses one OpenAI-compatible tool loop with server-owned phase state.

### Stage 1 — Fill-position reservations

The LLM first inspects every source-only fill reservation slot and explicitly selects or skips each musical location. A reservation contains measure/step, melody state, chord, metric context, and rationale only; it is not a physical note and contains no pitch, string, fret, duration, or finger.

### Stage 2 — Bass positions and annotated source ABC

The server exposes legal weighted bass-anchor slots after excluding pickup padding and selected fill reservations. The LLM explicitly selects or skips each slot. The diagnostic log then emits a read-only source-ABC projection with below-note labels such as `"_Bass M3:S1"`; raw source ABC remains byte-identical and annotations are never canonical input.

### Stage 3 — Chord-derived bass pitch selection

For each selected bass position the server enumerates ranked root/fifth low-register candidates with legal physical string/fret options. The LLM chooses candidate IDs only. It cannot invent a pitch, role, string, or fret.

### Stage 4 — Deterministic TimeGrid materialization and freeze

The server rebuilds from pristine source facts, realizes exact melody attacks and selected bass candidates, assigns/repairs physical positions under the selected skill constraints, writes explicit structural durations, validates physics, and freezes the canonical non-fill TimeGrid.

### Stage 5 — Post-bass fill analysis and composition

The LLM calls `inspect_fill_opportunities` beginning at cursor `0` and follows every `nextCursor` until `end`. The server rejects skipped, repeated, or out-of-order pages.

Analysis visits every active grid step and records a typed eligibility rejection when appropriate, including:

- pickup padding;
- melody attack;
- protected Melody sustain in every density policy;
- occupied foundation attack;
- protected melody string;
- occupied string;
- no harmonic pitch;
- fret/span violation;
- excessive incoming or outgoing hand jump;
- register collision;
- unresolved approach-note condition.

Safe windows are formed only from contiguous Melody rests in every density mode. `normal` and `many` increase selection budgets among those legal windows; they never create sustain windows. Windows split at melody attacks, foundation attacks, chord changes, measure boundaries, pickup padding, and line boundaries.

### Stage 5a — Reservation reconciliation

After every post-bass page is inspected, the server reconciles each earlier selected fill reservation against a physical scored window. A reservation must still have legal candidates at its original measure/step; it is never silently moved. If bass materialization invalidates it, the LLM receives a repair result and must revise bass or reservation choices. The server validates source and opportunity-set fingerprints, reservation bindings, density/per-measure budgets, and zero-fill compatibility mode before it exposes late candidate composition.

### Stage 5b — LLM physical fill composition

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

### Stage 6 — Server merge, ASCII-GuitarTab, and Guitar ABC/ABCJS

The server reconstructs the final canonical TimeGrid measures from the frozen foundation and accepted candidate IDs. It adds `durationSteps`, `fillWindowId`, and `fillCandidateId` provenance to accepted fill events.

The final `submit_arranged_line` call must reference the same accepted `fills:v1` payload. The LLM cannot replace locked source fields or submit a replacement grid at final submission. After accepted merge the server first renders and validates ASCII-GuitarTab, then generates forced-string `[V:Guitar]` ABC notation, and the Composer sends that generated ABC to the ABCJS music-staff/playback canvas.

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

The opportunity-set ID includes the source fingerprint, policy, and frozen TimeGrid foundation signature. A selection from a different foundation is rejected as stale.

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

## 7. Duration, ties, and generated tablature

The accepted TimeGrid is the source for both Guitar ABC notation and ASCII-GuitarTab. Neither generated text format is a canonical editing surface; changes are made to validated `TimeSliceGridStep.tablature` events and then rendered again. The detailed conversion contract is in the [TimeGrid Conversion Guide](./timegrid-conversion-guide.md).

`TimeSliceGridStep.tablature` supports:

- `durationSteps`;
- `fillWindowId`;
- `fillCandidateId`;
- structural `harmony` role.

`time-slice-abc-renderer.ts` renders sounding intervals rather than treating every row as an isolated simultaneous attack.

- Melody duration comes from authoritative melody `attack`/`sustain` states.
- Fill duration comes from the accepted `durationSteps`.
- Existing persisted non-melody events without `durationSteps` retain the historical attack-to-next-attack rendering; the new staged foundation writes explicit one-step structural durations so scoring and playback agree.
- Imported or legacy physical events that enter during a held melody serialize honestly by splitting the interval and tying the continuing melody; server-generated discretionary fills are rejected before this case can arise.
- Every tied segment preserves the `!N!` guitar string decoration, including validated explicit ties across an adjacent barline.
- Identical pitches on different strings are not deduplicated.
- Concert-pitch ABC and key-signature-aware natural signs are preserved for `clef=treble-8`.

Final physical validation also checks sounding same-string collisions and durations that extend outside a measure.

## 8. Diagnostics and UI

One run ID covers:

- LLM requests and tool calls;
- foundation acceptance/rejection;
- deterministic TimeGrid foundation placement and validation;
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

Only one line can generate at a time on the route. Other line buttons, skill/density settings, and TimeGrid import controls are disabled until the active run finishes. A response is accepted only when its source fingerprint and route revision still match the active canonical TimeGrid; source/import changes discard stale results.

## 9. Source fixtures and validation

Use:

- `Hari Bol` for ordinary 4/4 and cross-line phrase-transfer checks;
- `Ganesha` for pickup, tie, rest, repeat, TimeGrid, ABC, and ASCII-GuitarTab regressions.

`data/songs/marathi/jago-kundalini-ma.melody.abc` is currently header-only. The route remains stable, but there are no melody notes, lyrics, or chord events to arrange end to end until song content is authored.

Primary regression commands:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Known repository-wide caveats remain documented in `CLAUDE.md`: song-library validation fails for the header-only Jago Kundalini Ma fixture, lint may report vendored `public/abcjs-basic-min.js`, and static export can conflict with Server Actions during build.
