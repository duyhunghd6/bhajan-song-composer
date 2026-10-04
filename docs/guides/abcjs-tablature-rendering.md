# ABCJS Tablature Rendering and String Mapping
<!-- beads-id: br-guide-abcjs-tablature -->

This guide is the source of truth for **how ABC reaches abcjs** and for the Guitar TAB string-mapping rules the renderer depends on. It merges the former `CLAUDE.md` sections "Tablature Rendering and String Mapping Rules" and "ABC ownership and ABCJS adaptation" with the rendering notes from the frozen [research document](../research/guitar-tab-and-interlude-research.md).

## 1. ABC ownership and the render boundary
<!-- beads-id: br-guide-abcjs-tablature-s01 -->

- Theory modules own canonical/generated arrangement ABC. `src/components/music-sheet/AbcjsPlaybackController.tsx` is the playback adapter, and `abcjs-playback/render-input.ts` is the final transient path: `caller ABC → ABCJS-only adaptation → abcjs.renderAbc`.
- Do not mutate canonical source, persisted drafts, or export data at a component call site to compensate for abcjs layout/playback behavior. Keep key/meter overrides, hidden voice names, inert-grace sanitization, and Guitar string forcing within the render boundary.
- Callers pass ABC text and render/synth options; the adapter owns abcjs rendering, synth lifecycle, score-to-source selection, cursor events, and visual post-processing (`abcjs-playback/abc-rendering.ts`: tempo parsing, beat indicators, lyrics, tablature staff spacing).

## 2. Enabling a TAB staff
<!-- beads-id: br-guide-abcjs-tablature-s02 -->

abcjs renders tablature below a staff through the `tablature` render option, an array aligned to voice index order:

```javascript
ABCJS.renderAbc("paper-canvas", abcString, {
  responsive: "resize",
  add_classes: true,
  tablature: [
    {}, // Voice 1 (Melody) -> standard notation only
    {
      instrument: "guitar",
      label: "Guitar (%T)",           // %T prints the tuning
      tuning: ["E,", "A,", "D", "G", "B", "e"], // low to high
      capo: 0,
      hideTabSymbol: false
    } // physical V:Guitar voice -> rendered as Guitar TAB
  ]
});
```

- `TAB` is a **render-only** option computed by `src/components/composer/workspace/arrangement-preview-model.ts` for a visible TAB-capable Guitar voice. It is not an ABC text layer or an independent audio authority.
- The dedicated Guitar Fingerstyle route owns Fingerstyle TAB. The accompaniment branch's `V:GuitarSupport` voice may render an optional TAB staff from its validated physical strings, but that render feature never feeds Fingerstyle.

## 3. String forcing rules
<!-- beads-id: br-guide-abcjs-tablature-s03 -->

abcjs assigns strings by a lowest-fret heuristic unless told otherwise. Guitar TAB in this app must be explicit:

- **String forcing:** prepend each note with the `!N!` decoration (`!1!b`, `!6!B`) to assign string `N` (1–6). `getStringDecoration()` in abcjs then bypasses its auto-assignment.
- **Render-time forcing:** to catch raw LLM outputs or custom ABC without decorations, the playback entrypoint applies `ensureGuitarStringForcing()` (`src/lib/theory/guitar-string-forcing.ts`) at render time, preserving chord symbols (e.g. `"Em"`) and respecting non-Guitar voice isolation.
- **Duplicate pitches:** because string forcing bypasses auto-assignment, the same concert pitch may sound on several strings simultaneously (e.g. D3 on string 4 and string 5). Do **not** deduplicate identical ABC pitches in tablature chords.
- **Octave convention:** always output concert-pitch ABC tokens for `clef=treble-8`. abcjs applies `clefTranspose = -12` internally before computing the fret against its un-transposed `stringPitches`; shifting octaves up manually breaks fret computation.
- **Key-signature awareness:** on input (ABC→MIDI), bare notes inherit implied accidentals (bare `F` in `K:Em` is F#, MIDI 66). On output (pitch→ABC), if a physical note is natural but the key signature sharps/flats that letter, emit an explicit natural (`!1!=f`) so abcjs does not render it as fret 2; omit the accidental when the pitch matches the key signature default.

## 4. Export portability
<!-- beads-id: br-guide-abcjs-tablature-s04 -->

`cleanAbcForExport()` in `src/lib/theory/abc-layer-visibility.ts` is a portable-export projection used when exporting or copying ABC to the clipboard: it strips all `!N!` string decorations (which other software shows as fingering numbers) and normalizes `clef=treble-8` to `clef=treble` so third-party viewers render the staff correctly. It is not a canonical rewrite.

## 5. Source link between ABC text and the score
<!-- beads-id: br-guide-abcjs-tablature-s06 -->

- abcjs reports `startChar`/`endChar` against the **rendered** string, while editors select against the caller's ABC. `abcjs-playback/source-map.ts` aligns the two strings so render adaptations (key/meter/name overrides, inert-grace sanitization, string forcing) never shift a highlight; never compare raw abcjs offsets with caller offsets.
- `abcjs-playback/source-selection.ts` indexes engraved elements by caller-ABC range after every render and toggles the preview-only `abcjs-source-selected` class. `abcjs-playback/lyric-alignment.ts` maps a caret in a `w:` line to its note with the ABC 2.1 syllable rules (`-`, `_`, `*`, `|`), because abcjs records no source position per syllable.
- The controller's `sourceSelection` / `onSourceSelect` props carry the link. Clicking a score element, or pressing Enter on it, only selects; audio starts exclusively from the Play control. The Melody editor (`src/components/composer/abc-editor/AbcSourceEditor.tsx`, CodeMirror 6) feeds its selection in and selects the reported range.

## 6. Related
<!-- beads-id: br-guide-abcjs-tablature-s05 -->

- [TimeGrid Conversion Guide § Guitar ABC rules](./timegrid-conversion-guide.md) — how TimeGrid events are projected to forced-string Guitar ABC.
- [Composer Source Flow § Layers Visibility guardrails](./composer-source-flow.md) — visibility, volume, and TAB as preview-only state.
- `ARCHITECTURE.md` § Music sheet / ABCJS playback — module map.
