# Research Notes: Guitar TAB Rendering & Interludes ("Giang tấu")

This document details the research findings for:
1. Adding Guitar TAB into the sheet music rendering below standard notation using `abcjs`.
2. Constructing interludes ("giang tấu") or melodic fills during pauses between phrases/sections.

---

## 1. Guitar TAB Rendering via `abcjs`

### Mechanism
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
    } // Voice 2 (Layer 2 Guitar Accompaniment) -> rendered as Guitar TAB
  ]
});
```

### Demonstration and Filtering
When rendering the music sheet for accompaniment options:
- **Piano Accompaniment**: Do not specify the `tablature` option, as piano does not use guitar TAB.
- **Guitar Accompaniment**: Pass the `tablature` array where the melody voice gets `{}` (no TAB) and the "Layer 2 Guitar Accompaniment" voice (Voice 2) gets `{ instrument: "guitar", ... }`. This ensures only the guitar track is rendered with a TAB line.

---

## 2. Phrase Interludes ("Giang tấu")

An interlude ("giang tấu") is a melodic or harmonic fill played by an accompaniment instrument during pauses between vocal lines (phrases) or sections.

### Detection of Gaps
In the current composer engine, the melody is analyzed beat-by-beat to locate regions where the voice is silent or holding a long note.
In `src/lib/theory/piano-accompaniment.ts`, the function `detectMelodicGap` already locates:
- **Rest Gaps**: Consecutive rest tokens (`z`) in the melody.
- **Held Note Gaps**: Notes sustained for more than 2 beats.

Gaps are marked as `safe` for filling if their duration is 2 beats or longer.

### Generating Interludes / Fills
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
When calling the AI Accompaniment generator, we can instruct the LLM to output these interludes/fills directly inside the ABC string for the accompaniment voices during measures where the melody contains rests.
This is achieved by updating the AI prompt to request note embellishments (colored notes) and bass walkdowns specifically in the empty spaces.
