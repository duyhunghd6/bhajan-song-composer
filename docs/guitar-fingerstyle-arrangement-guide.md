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
> You are an expert devotional fingerstyle guitar arranger. You will receive a 16-step JSON grid. Follow this exact tool-calling workflow sequentially:
> 
> **1. Lock the Grip & Voicings (Tool Call First):**
> * Scan the grid. On Step 1, Step 9, AND on any step where the `chord` symbol changes, you MUST call `query_guitar_voicings(chord, melody_pitch)`.
> * **Constraint Check:** You are strictly forbidden from inventing fretted notes. You must exclusively use the strings and frets provided by the tool's returned grip. The tool already automatically accounts for the 4-finger fretting limit and 5-fret stretch limit.
> 
> **2. Right-Hand Foundation (Strums vs Pinches):**
> * **Strumming on Downbeats:** Scan the grid for the strong downbeat weight marker `⬤` (Beat 1). You MUST establish a rich harmonic foundation using a full 5-string or 6-string **Strum** across all active strings from the grip.
>   * *Strum Notation Rule:* To notate a strum, assign the Thumb (`p`) to ALL the bass and inner strings being strummed, leaving the fingers for the melody.
>   * *Example of a full 6-string Em strum:* Str 6 (`p`), Str 5 (`p`), Str 4 (`p`), Str 3 (`p`), Str 2 (`p`), Str 1 (`a` - Melody).
> * **Standard PIMA Pinches (Max 4 strings):** On secondary strong beats `●` (Beat 3) or non-downbeat chord changes, play a lighter 4-note **Pinch**. The Thumb (`p`) plays exactly 1 Bass String. The fingers (`i, m, a`) play up to 3 Treble/Inner Strings.
>   * *Example of a 4-note C pinch (X32010):* Play Str 5 (`p`), Str 3 (`i`), Str 2 (`m`), Str 1 (`a`).
>   * *Example of a 4-note D pinch (XX0232):* Play Str 4 (`p`), Str 3 (`i`), Str 2 (`m`), Str 1 (`a`).
> 
> **3. Protect the Melody & Double-Stops:**
> * The sung melody is absolute priority. Map the exact melody pitches to the exact `attack` steps on the highest available strings.
> * On secondary strong beats `●` (Beat 3), do not play a heavy 4-note pinch. Play a simpler **double-stop** (1 Bass note + the Melody note, or Bass + 1 inner tone) to keep the rhythm balanced and flowing.
> * **Simultaneous String Collision:** If a chord voicing requires fretting an inner string, but the melody note is also mapped to that exact same string, the melody note wins. Drop the chord tone from your pinch.
> 
> **4. PIMA Fills & The Sustain Rule (Inner Arpeggios):**
> * Look at the `null` steps (the empty 16th-note spaces). You may add light, arpeggiated inner chord tones to keep the rhythm flowing. Keep fills sparse and subservient to the vocal melody.
> * **Sustain Protection Rule (CRITICAL):** If the vocal melody is marked as `"state": "sustain"` on a specific string across multiple steps, you are **physically forbidden** from plucking a fill note on that exact same string. Doing so will prematurely cut off the singer's note.
> 
> **5. Validate & Submit:**
> * Call `validate_fingerstyle_physics()` to verify your right-hand finger budget, string alignments, and sustain rules.
> * Once validated, submit your final work using `submit_arranged_measure()`.

---

## 6. Real-Time Execution (How the LLM handles Measure 1)

Here is how the LLM executes the prompt against your JSON data:

* **Step 1 (`⬤` / Ha-):** The LLM queries `"Em"` + `"E4"` + `"open"`. The backend gives it an open Em shape. The LLM drops the Bass on String 6 (Open E), adds inner chord tones on String 4 (fret 2 - E) and String 3 (fret 0 - G), and places the Melody on String 1 (Open E4). This forms a rich, simultaneous 4-note block chord (pinch).
* **Step 2 (`null`):** The LLM sees empty space. It knows the vocal is sustaining on String 1. It adds a gentle "i-m" filler note on String 3 (Open G) to keep the arpeggio flowing.
* **Step 3 (`*` / ri):** The LLM sees a soft melody attack. It plays String 1 (E4) but drops no bass/chord notes.
* **Step 5 (`*` / Bol):** The LLM plays String 1 (E4) again. No bass/chord notes.
* **Step 7 (`*` / _):** The LLM maps the melisma (the slur) to String 2 (Open B3).
* **Step 9 (`●` / Ha-):** The LLM hits the second half of the loop (medium weight). It queries `"D"` + `"E4"` + `"open"`. The backend hands it an Open Dadd9 shape. It drops the Thumb on String 4 (Open D) and the Melody on String 1 (Open E4) as a double-stop.

---

## 7. The Final Visual Output

Because the data was gridded perfectly based on your `⬤` and `●` map, the Human-in-the-Loop UI instantly renders the LLM's JSON submission into this perfect, hallucination-free tablature:

```text
Measure 1:
      Ha-   ri    Bol   _       Ha-   ri    Bol   _ 
      ⬤                 *       ●                 *
e |---0-----------0-------------0-----------0-----------|
B |---------------------0-------------------------0-----|
G |---0-----0-------------------------2-----------------|
D |---2-----------------------------0-----------0-------|
A |-----------------------------------------------------|
E |---0-------------------------------------------------|
```

**Why this works flawlessly:** The LLM did not compose the rhythm, and it didn't invent the chord voicings. It simply acted as a logic router—connecting the requested "Open Em/D PIMA Profile" (with a downbeat block chord/pinch) to the strict mathematical grid of the ABC notation.