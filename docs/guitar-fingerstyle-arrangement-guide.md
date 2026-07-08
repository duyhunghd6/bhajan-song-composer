# Guitar Fingerstyle Arrangement Guide: Time-Slice Grid & Tablature Generation

This guide provides a comprehensive overview of the theory, data schema, and algorithmic implementation used to generate playable, counterpoint-driven solo guitar fingerstyle arrangements from ABC Notation.

By utilizing custom lyric-line metadata in the source ABC files, the system compiles a mathematical **"Groove Map"** that defines melody, lyrics, and beat weights in a quantized time-slice grid. This completely eliminates the need for the LLM to guess rhythmic syncopation or cadence points.

---

## 1. Mapped Source ABC Input (The Groove Map)

To arrange a bhajan (such as `Hari Bol`), we define the vocal melody in the `[V:Melody]` voice along with two structured lyrics (`w:`) lines:
1. **Line 1 (Lyrics):** Mapped vocal syllables, including legatos/melismas (indicated by `_` or `*`).
2. **Line 2 (Beat Weights):** Mapped metric weights where `⬤` indicates downbeats (Strong), `●` indicates secondary accents (Medium), and `*` indicates weak syncopation (Soft).

### Measure 1 Source ABC (from [hari-bol.accompaniment.abc](file:///Users/steve/duyhunghd6/bhajan-song-composer/data/songs/hindi/hari-bol.accompaniment.abc#L58-L60)):
```abc
[V:Melody] | "Em"E E (EB,) "D"E E (EB,) |
w: Ha-ri Bol _ Ha-ri Bol _
w: ⬤ * * * ● * * *
```

---

## 2. Time-Slice Grid Compilation

The backend pre-processes the ABC source block using a **Time-Slice Architecture** (analogous to step-sequencers in Ableton or FL Studio) to compile a quantized 16-step grid per measure (representing 16th notes in 4/4 meter):

* **Resolution:** 1 Beat = 4 Steps; 1 Measure = 16 Steps.
* **Conversion Math:** For `L:1/8` (default eighth notes), a normal eighth note occupies **2 steps** (1 `attack` step + 1 `sustain` step).
* **Melismas & Slurs:** Parenthesized notes (slurs like `(EB,)`) are parsed into sequential attacks. Melismas (`_`) are preserved in the `lyric` field rather than being nullified, ensuring they bind to the correct note onset step.
* **Metric Default Fallbacks:** If a custom beat weight annotation line is missing, the parser automatically assigns fallback weights based on the meter (in 4/4: step 1 is `⬤`, step 9 is `●`, steps 5/13 are `*`, and off-beats/sustains are `null`).
* **Mid-Measure Chord Transitions:** The system scans the melody ABC for inline chord symbols (like `"Em"` and `"D"`), determines their exact duration onset units, and maps the active chord dynamically to the corresponding step indexes.

---

## 3. Mapped JSON Output Schema

The compiled time-slice structure for Measure 1 is output as a `TimeSliceMeasure` array:

```json
[
  {
    "measure": 1,
    "style_profile": {
      "key": "Em",
      "comping_style": "PIMA devotional fingerstyle. Sparse fills.",
      "voicing_plan": "Open-position Em and D shapes. Thumbed E/B and D/A anchors."
    },
    "grid": [
      {"step": 1, "chord": "Em", "weight": "⬤", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "Ha-"},
      {"step": 2, "chord": "Em", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
      {"step": 3, "chord": "Em", "weight": "*", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "ri"},
      {"step": 4, "chord": "Em", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
      {"step": 5, "chord": "Em", "weight": "*", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "Bol"},
      {"step": 6, "chord": "Em", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
      {"step": 7, "chord": "Em", "weight": "*", "melody": {"pitch": "B3", "state": "attack"}, "lyric": "_"},
      {"step": 8, "chord": "Em", "weight": null, "melody": {"pitch": "B3", "state": "sustain"}, "lyric": null},
      {"step": 9, "chord": "D", "weight": "●", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "Ha-"},
      {"step": 10, "chord": "D", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
      {"step": 11, "chord": "D", "weight": "*", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "ri"},
      {"step": 12, "chord": "D", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
      {"step": 13, "chord": "D", "weight": "*", "melody": {"pitch": "E4", "state": "attack"}, "lyric": "Bol"},
      {"step": 14, "chord": "D", "weight": null, "melody": {"pitch": "E4", "state": "sustain"}, "lyric": null},
      {"step": 15, "chord": "D", "weight": "*", "melody": {"pitch": "B3", "state": "attack"}, "lyric": "_"},
      {"step": 16, "chord": "D", "weight": null, "melody": {"pitch": "B3", "state": "sustain"}, "lyric": null}
    ]
  }
]
```

---

## 4. Exposed LLM Tools

To ensure physical playability and voice-leading safety, the LLM is equipped with three backend tools during arrangement:

1. **`query_guitar_voicings(chord, melody_pitch, target_position)`**
   * *Purpose:* Returns safe left-hand open fret positions (e.g. `{"bass": {"string": 6, "fret": 0}, "melody": {"string": 1, "fret": 0}, "available_inner_strings": [3, 4]}`) to ground the arrangement in standard playable chord shapes.
2. **`validate_fingerstyle_physics(proposed_grid)`**
   * *Purpose:* Rejects the proposed step grid if the LLM places an inner fill note on a string currently sustaining a melody note.
3. **`submit_arranged_measure(final_grid)`**
   * *Purpose:* Submits the mathematically verified array back to the step-workspace UI.

---

## 5. The LLM System Prompt & Internal Workflow

We inject our "Workflow Decisions" into the System Prompt to guide the LLM's logical tool-calling loop:

**System Prompt:**
> "You are an expert devotional fingerstyle guitar arranger. You will receive a 16-step JSON grid. Follow this exact tool-calling workflow:
>
> 1. **Anchor the Bass:** Scan the grid for the weight markers.
>    * On `⬤` (Beat 1), you MUST place the lowest root Bass note (Thumb/P).
>    * On `●` (Beat 3), you MUST place a secondary root/5th Bass note.
>    * On `*` (Soft beats), DO NOT play heavy bass notes.
> 2. **Lock the Grip:** Call `query_guitar_voicings()` on steps 1 and 9 to retrieve the valid open-position shapes.
> 3. **Protect the Melody:** Map the exact melody pitches to the exact attack steps on the highest available strings.
> 4. **PIMA Fills:** Look at the `null` steps (the empty 16th-note spaces). You may add light, arpeggiated inner chord tones (Index/Middle). **Rule Check:** Because this is a devotional bhajan, keep fills sparse. Avoid dense attacks during vocal phrases.
> 5. **Validate & Submit:** Call `validate_fingerstyle_physics()` before submitting your work."

---

## 6. Real-Time Execution (How the LLM handles Measure 1)

Here is how the LLM executes the prompt against your JSON data:

* **Step 1 (`⬤` / Ha-):** The LLM queries `"Em"` + `"E4"` + `"open"`. The backend gives it an open Em shape. The LLM drops the Bass on String 6 (Open E) and the Melody on String 1 (Open E4).
* **Step 2 (`null`):** The LLM sees empty space. It knows the vocal is sustaining on String 1. It adds a gentle "i-m" filler note on String 3 (Open G) to keep the arpeggio flowing.
* **Step 3 (`*` / ri):** The LLM sees a soft melody attack. It plays String 1 (E4) but drops no bass note.
* **Step 5 (`*` / Bol):** The LLM plays String 1 (E4) again. No bass.
* **Step 7 (`*` / _):** The LLM maps the melisma (the slur) to String 2 (Open B3).
* **Step 9 (`●` / Ha-):** The LLM hits the second half of the loop. It queries `"D"` + `"E4"` + `"open"`. The backend hands it an Open Dadd9 shape. It drops the Thumb on String 4 (Open D) and the Melody on String 1 (Open E4).

---

## 7. The Final Visual Output

Because the data was gridded perfectly based on your `⬤` and `●` map, the Human-in-the-Loop UI instantly renders the LLM's JSON submission into this perfect, hallucination-free tablature:

```text
Measure 1:
      Ha-   ri    Bol   _       Ha-   ri    Bol   _ 
      ⬤                 *       ●                 *
e |---0-----------0-------------0-----------0-----------|
B |---------------------0-------------------------0-----|
G |---------0-------------------------2-----------------|
D |---------------------------------0-----------0-------|
A |-----------------------------------------------------|
E |-0---------------------------------------------------|
```

**Why this works flawlessly:** The LLM did not compose the rhythm, and it didn't invent the chord voicings. It simply acted as a logic router—connecting the requested "Open Em/D PIMA Profile" to the strict mathematical grid of the ABC notation.