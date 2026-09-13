# Singer-Accompaniment Decision Model
<!-- beads-id: br-guide-singer-accompaniment-decision-model | satisfies: br-prd01-s62 -->

> **Scope:** the shared decision model for Guitar Classic and Piano accompaniment behind a singer. It governs target implementation; it does not claim that the Piano Composer branch is already shipped.
> **Source relationship:** this guide refines the selected Harmony Step 3 source contract. It does not change the Guitar Fingerstyle TimeGrid route.

## 1. Decision model and vocabulary
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s01 | satisfies: br-prd01-s62 -->

Singer accompaniment is three independent musical decisions made against one immutable source snapshot:

1. **Harmony timeline** — which chord is active at every beat or subdivision (`chord window`).
2. **Comping profile** — the rhythmic and textural realization of that harmony; it is not the vocal melody.
3. **Voicing plan** — the playable register, inversion, and physical shape used for each chord window or phrase segment.

The decisions are independent controls: an arranger may retain a comping profile while changing voicings, or retain voicings while changing density/profile. They are not independent of source facts. The harmony timeline constrains both; meter, tempo, form, singer activity, melody register, player skill, and instrument physics constrain one or both decisions.

`Melody` always means the sung/lead line. `Groove`, `comping profile`, `pattern`, and Vietnamese `điệu đệm` mean the accompaniment rhythm/texture. A user-facing UI must not label a comping-profile selector as “giai điệu”.

## 2. Locked source facts and decision order
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s02 | satisfies: br-prd01-s62 -->

The server derives an `ApprovedHarmonySnapshot` before an arrangement candidate is considered:

```text
meter, tempo, key/scale, phrase/cadence boundaries,
measure timeline, chord windows, melody activity/gaps,
melody-register map by beat and phrase, player constraints
```

`chord windows` are mandatory: a progression written as `Em → Am → Em → D → Am → Em` is insufficient until every change has a measure, beat, and subdivision boundary. A split bar creates multiple windows, and a new window must rearticulate its harmonic context unless a retained common tone is explicitly valid.

The normal human workflow is:

1. Confirm meter, tempo, chord windows, phrase endings, and melody activity/register facts.
2. Filter to comping profiles compatible with the meter family; compare 3–4 options in that family and select a baseline profile per section.
3. Choose a voicing plan per phrase/section with the selected profile as context; preserve a hand/register area until a musical reason justifies a change.
4. Realize events, then review singer-yield, harmonic clarity, voice leading, physical playability, and audible continuity.

This execution order does not make profile and voicing one combined decision. A refinement can replace either one without silently replacing the other.

## 3. Meter-aware comping profile selection
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s03 | satisfies: br-prd01-s62 -->

Profile eligibility is a deterministic filter, not an aesthetic guess by an LLM. The profile catalog must declare supported meter families, supported subdivisions, tempo band, skill requirements, and instrument realization rules. An LLM may rank or explain only candidates that survive this filter.

| Meter family | Valid starting families | Exclude by default |
|---|---|---|
| 3/4 | Valse, Boston, triple arpeggio | 4/4 slow-rock, surf, straight blues |
| 4/4 | Slow surf, ballad arpeggio, blues shuffle, folk strum, devotional PIMA/pinch | Valse |
| 6/8 or 12/8 | Compound ballad arpeggio, compound devotional flow, 6/8 slow ballad | straight 3/4 Valse and straight 4/4 surf |

Names are not sufficient: a product profile must encode its meter. “Slow Rock” is normally a straight 4/4 label; a compound candidate must be labelled `slow-ballad-6-8` (or equivalent), rather than treating every slow style as interchangeable. Tempo, genre, section energy, lyric delivery, and singer activity further rank valid profiles. Melody register primarily controls voicing and density, and only indirectly affects groove.

The current shipped Guitar Classic profiles are devotional PIMA, devotional pinch, and Bhajan strum. They need explicit meter-family metadata before the application can expose non-4/4 selection safely. The Piano profiles need the same metadata before promotion to a Composer branch.

## 4. Register-aware voicing plan
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s04 | satisfies: br-prd01-s62 -->

The system derives melody register/activity per beat and summarizes it per phrase (`low`, `middle`, `high`, plus active/rest/sustain). It must use pitch overlap and contour, not merely a coarse “high/low” label, when validating a candidate.

For Guitar Classic:

- When the melody occupies strings 1–2 / a high vocal register, prefer a low-to-middle voicing and treble attacks that leave the lead contour clear; an open Am shape is a common option.
- When the melody is low enough and the phrase needs lift, a higher Am shape such as the fifth-position Em-form barre may be a candidate, only if it remains playable and does not mask the melody or lyric onset.
- Retain the same fretboard region across adjacent windows where possible. Em → Am → Em should preserve common E and minimize other movement; change position at a phrase/section boundary, a planned color lift, or a register conflict—not randomly every bar.
- A playable voicing must retain the chord third when the chord quality requires it; omit/demote the fifth before the third. A deliberately suspended, power-chord, or sparse-color exception is a declared soft-rule exception, never an accidental omission.
- Candidate selection accounts for fret span, barre/finger count, capo, hand movement, and the configured player level.

For Piano:

- LH owns foundation (normally C2–C3) and respects the Low Interval Limit; RH places quality tones and comping below or clearly separated from the melody.
- Retain common tones and choose inversions with minimum useful movement. A change of register is normally section-level rather than arbitrary per bar.
- Thirds and sevenths define quality in RH; when thinning is necessary, remove duplicated root/fifth before removing guide tones, unless the selected idiom deliberately calls for a sparse/sus sonority.
- Hand span, collision, pedal bleed, and the player’s hand limit are hard constraints.

## 5. Hard constraints, soft musical rules, and validation
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s05 | satisfies: br-prd01-s62 -->

Hard constraints are verified by code: source fingerprint/currentness, ABC parseability, meter and total duration, chord-window alignment, preserved melody, singer-yield at active attacks and re-entry, Guitar one-player physics, and Piano hand/range/collision/pedal validity.

Soft rules produce a rationale and a review warning rather than an automatic rejection: profile suitability, density, expected register separation, section-level position continuity, guide-tone preference, optional bass motion, and stylistic fill vocabulary. A theoretical prohibition on parallel fifths/octaves applies to the harmony/independent-voice analysis where relevant; it must not falsely reject ordinary homophonic strums merely because doubled chord tones move in parallel.

Every diagnostic identifies `instrument`, `measure`, `beat/subdivision`, `rule`, `severity`, source fact, and a recovery action. A repair must preserve all locked facts and already-passing measures unless the user explicitly asks to revise a wider musical section.

## 6. Bounded LLM API contract
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s06 | satisfies: br-prd01-s62 -->

The LLM is an arranger and comparator, not the authority for source facts or instrument physics. The API boundary is deliberately small:

| Stage | Deterministic owner | LLM responsibility | Required output |
|---|---|---|---|
| Source analysis | ABC parser/analyzer | None | immutable snapshot facts |
| Profile shortlist | meter/profile catalog | Rank and explain valid candidates | 3–4 profile/section proposals and trade-offs |
| Voicing shortlist | voicing inventory + playability filter | Choose/rank `voicingId`s by phrase | voicing plan, register/density rationale |
| Realization | event/ABC renderer | Optional bounded variation request | no authority to alter source timeline |
| Validation/repair | validators | Repair only flagged scope | decision delta for named measures/beats |

Use structured input containing the snapshot, valid profile IDs, playable voicing IDs, player constraints, and a user brief. Prefer structured output such as `profileId`, `sectionRange`, `voicingId`, `density`, `fillPolicy`, rationale, and declared trade-offs. Do not ask the model to invent fret coordinates, hand spans, chord timing, or a complete unconstrained artifact when a deterministic renderer can derive it.

The service validates every result after normalization. A model never sets `valid`, changes a fingerprint, mutates the selected harmony, or publishes. Candidate diversity must differ on at least two musical axes—e.g. rhythm/texture and register/voicing or density/cadence treatment—not just an option title.

## 7. Delivery and test gates
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s07 | satisfies: br-prd01-s62 -->

Implementation is complete only when tests prove: meter filtering rejects incompatible profiles; every chord-window change is realized on time; a register conflict chooses/reports a different voicing or density; third-retention/thinning policy is observable; section-level voicing continuity is preserved unless explained; Guitar and Piano validate their own physical constraints; and scoped LLM repair cannot modify locked source facts or unflagged accepted measures.

Piano remains a target branch until its Composer route, source/freshness integration, output publication, and test gates are completed. This guide is therefore an implementation contract for both instruments and a current behavioral contract for the shipped Guitar branch where its required catalog/data is available.

## 8. Beat-level voicing override and project persistence
<!-- beads-id: br-guide-singer-accompaniment-decision-model-s08 | satisfies: br-prd01-s62, br-prd01-s57 -->

A click on a strong beat opens a **Chord/Voicing Inspector**, not a chord-progression editor. Its default target is the active `chordWindow`; it exposes the locked chord identity and current realization before offering alternatives. The user may deliberately widen the target to phrase/section, but the system must never infer that widening from a single click.

The candidate identity is instrument-specific:

| Instrument | Candidate must expose | Example for `Am` |
|---|---|---|
| Guitar Classic | `voicingId`, spelled pitches, shape/position, strings/frets, barre/finger cost, bass note, capo, register and transition cost | open A-minor; fifth-position E-form barre; a playable inversion |
| Piano | `voicingId`, spelled pitches by LH/RH, inversion, octave/register, spacing/hand span, bass treatment and transition cost | LH A2–E3 + RH C4–E4–A4; same RH an octave higher; close/drop voicing with a different inversion |

Candidate filtering occurs before display: preserve chord quality, satisfy melody/register/singer-yield and hard physical rules. Rank by voice-leading and current hand region, but retain a clearly labelled high-position candidate when it is valid, so the arranger can intentionally create lift. Selecting a candidate creates an immutable `VoicingOverride { instrument, windowRange, baseChordIdentity, voicingId, sourceRevisionId, validation }`; it does not mutate the harmony timeline or comping profile. Preview must audition the current and proposed realization in musical context, including the transitions at both edges of the range.

`Change comping profile` is a separate section-level decision. It re-realizes rhythm/texture while preserving chord windows; it may invalidate an override only after validation, and must retain it with an explicit review reason. Accent, density and a single fill are local realization edits, not disguised profile changes.

The Composer Project is a durable revisioned aggregate, not a browser-state snapshot. Persist each step's structured input, raw response, normalized candidate(s), diagnostics, selected decision and derived artifact by reference; attach source revision/fingerprint and lineage. Autosave writes durable revisions (with a local offline outbox), while an explicit checkpoint names a recoverable version. Published catalogue artifacts remain a separate, immutable projection. Tests must prove that a re-opened project retains an unselected option and its diagnostics, a beat override survives reload, changing upstream source marks rather than deletes dependent data, and an offline change reconciles without overwriting a newer revision.
