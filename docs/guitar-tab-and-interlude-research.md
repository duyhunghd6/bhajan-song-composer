# Research Notes: Guitar TAB Rendering & Interludes ("Giang tấu")
<!-- beads-id: br-research-guitar-tab-interlude -->

This document records research findings for:
1. Rendering dedicated Guitar Fingerstyle TAB below standard notation using `abcjs`.
2. Constructing interludes ("giang tấu") or melodic fills during pauses between phrases/sections.

> **Production boundary:** `/compose/:slug/guitar-fingerstyle` exclusively owns solo TimeGrid edits, physical Fingerstyle artifacts, generated **Fingerstyle** Guitar ABC, and TAB. `/compose/:slug/accompaniment` may deterministically materialize the selected Guitar Classic voicing as a standard-notation `V:GuitarSupport` support layer, but does not generate Guitar TAB. For the current workflow contract, see [Guitar Fingerstyle Arrangement Guide](./guitar-fingerstyle-arrangement-guide.md) and [TimeGrid Conversion Guide](./timegrid-conversion-guide.md).

---

## 1. Guitar TAB Rendering via `abcjs`
<!-- beads-id: br-research-guitar-tab-interlude-s01 -->

### Mechanism
<!-- beads-id: br-research-guitar-tab-interlude-s02 -->
`abcjs` supports rendering tablature (TAB) below standard staff notation. This is configured entirely through the visual rendering parameters passed to `ABCJS.renderAbc(canvas, abcString, options)`.

The `tablature` parameter expects an array of configurations, matching the voices defined in the ABC notation by index order:
```javascript
ABCJS.renderAbc("paper-canvas", abcString, {
  responsive: "resize",
  add_classes: true,
  tablature: [
    {}, // Voice 1 (Melody) -> standard notation only (no TAB)
    {
      instrument: "guitar",
      label: "Guitar (%T)", // %T dynamically prints the tuning (e.g., standard EADGBe)
      tuning: ["E,", "A,", "D", "G", "B", "e"], // Low to high
      capo: 0,
      hideTabSymbol: false
    } // Dedicated physical V:Guitar fingerstyle voice -> rendered as Guitar TAB
  ]
});
```

### Demonstration and Filtering
<!-- beads-id: br-research-guitar-tab-interlude-s03 -->
When rendering a dedicated Guitar Fingerstyle result:
- **Combined Accompaniment**: Do not create a Guitar TAB voice on `/compose/:slug/accompaniment`.
- **Dedicated Guitar Fingerstyle**: Pass the `tablature` array where the melody voice gets `{}` (no TAB) and the generated physical `V:Guitar` fingerstyle voice gets `{ instrument: "guitar", ... }`. This ensures TAB represents one validated guitarist, not an accompaniment-page layer.

---

## 2. Phrase Interludes ("Giang tấu")
<!-- beads-id: br-research-guitar-tab-interlude-s04 -->

An interlude ("giang tấu") is a melodic or harmonic fill played by an accompaniment instrument during pauses between vocal lines (phrases) or sections.

### Detection of Gaps
<!-- beads-id: br-research-guitar-tab-interlude-s05 -->
The dedicated Guitar Fingerstyle engine analyzes the selected Harmony Step 3 source beat-by-beat and permits discretionary fills only in legal source-rest/phrase-gap windows.

- **Rest gaps**: consecutive rest tokens (`z`) in the melody may be scored as fill windows.
- **Held melody**: attacks and sustains remain protected; generated discretionary fills and harmony must not attack or remain sounding across them.

The server validates physical candidates, density budgets, and phrase boundaries before rendering any Guitar ABC/TAB artifact.

### Generating Interludes / Fills
<!-- beads-id: br-research-guitar-tab-interlude-s06 -->
When a gap is detected:
1. **Piano Interlude**:
   - Instead of static chords, we can insert a **Passing Fill** or **Arpeggio Run**.
   - An Alberti Bass pattern or walking bass lines (moving by step or chord tones) can be inserted in the left hand.
   - The right hand can play a complementary melodic line (counter-melody) using notes from the active key scale.
2. **Guitar Interlude**:
   - A Travis picking groove can play a syncopated bass line.
   - Insert walking bass runs (e.g., C → C/B → Am → C/G) to link chord progressions smoothly.
   - Play a short hammer-on or pull-off embellishment on the high strings.

### AI Generation of Interludes
<!-- beads-id: br-research-guitar-tab-interlude-s07 -->
The dedicated Guitar Fingerstyle workflow does not ask an accompaniment generator to write raw ABC fills. Its LLM selects and composes only server-scored, legal TimeGrid candidates through bounded staged contracts; the server merges and validates physical events, then deterministically renders Guitar ABC and TAB. Interludes and fills therefore remain restricted to legal source-rest/phrase-gap windows.
