# ABCJS Tablature Rendering and String Mapping
<!-- beads-id: br-guide-abcjs-tablature -->

This guide is the source of truth for **how ABC reaches abcjs** and for the Guitar TAB string-mapping rules the renderer depends on. It merges the former `CLAUDE.md` sections "Tablature Rendering and String Mapping Rules" and "ABC ownership and ABCJS adaptation" with the rendering notes from the frozen [research document](../research/guitar-tab-and-interlude-research.md).

## 1. ABC ownership and the render boundary
<!-- beads-id: br-guide-abcjs-tablature-s01 -->

- Theory modules own canonical/generated arrangement ABC. `src/components/music-sheet/AbcjsPlaybackController.tsx` is the playback adapter, and `abcjs-playback/render-input.ts` is the final transient path: `caller ABC → ABCJS-only adaptation → abcjs.renderAbc`.
- Do not mutate canonical source, persisted drafts, or export data at a component call site to compensate for abcjs layout/playback behavior. Keep key/meter overrides, hidden voice names, inert-grace sanitization, and Guitar string forcing within the render boundary.
- Callers pass ABC text and render/synth options; the adapter owns abcjs rendering, synth lifecycle, score-to-source selection, cursor events, and visual post-processing (`abcjs-playback/abc-rendering.ts`: tempo parsing, beat indicators, lyrics, tablature staff spacing).

### Responsive score viewport
<!-- beads-id: br-guide-abcjs-responsive-score -->

The shared playback controller embeds scores in `score-workspace/ScoreViewport.tsx` by default across Composer, Practice, catalogue playback, and React test/mockup pages. A caller-provided `renderScore` supplies its own viewport instead, avoiding nested scroll containers. Let the available score column determine the ABCJS staff width so measures reflow when the window or surrounding panels resize. Measure the inner content width after subtracting padding; do not apply a fixed minimum width to the score. Keep one scroll viewport around the SVG; hide its scrollbar tracks while preserving wheel scrolling and Shift + wheel horizontal navigation for deliberately zoomed content. Keep Fit, zoom-in, and zoom-out controls directly available in the playback toolbar, including scores with playback controls disabled. The ABCJS `responsive: "resize"` option remains enabled so the SVG follows its measured container width. The standalone HTML renderer sandbox observes its container width separately.

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

Melody, Harmony and Accompaniment use the same guitar-shape picker and diagram/audio model. In Melody, quoted chord symbols in the first voice provide the chord windows. Choosing a shape updates workspace `voicingOverrides`, bound to the exact melody source fingerprint; it does not rewrite melody ABC or validate a downstream Harmony step. An edited source cannot use an override from a different fingerprint. Identical source snapshots can share choices across previews. A source with no chord symbols has no shapes to show.

ABC distinguishes a chord symbol (`"Em"E`) from simultaneous pitches (`[EGB]`). The symbol alone does not encode strings, frets, fingers or barre position. Do not encode a shape by changing the harmonic name to something like `"Em-7th-position"`: chord parsing and synthesis expect a musical chord symbol. An annotation such as `"^VII"` can label a position for a reader, but does not enforce its playback or TAB.

For an explicit Guitar voice, write the selected shape's actual concert pitches and string decorations. These two Em shapes have different pitches and strings even though the chord name is the same (standard tuning; frets listed low string to high):

```abc
X:1
T:Two Em guitar positions
M:4/4
L:1/4
K:C
V:Guitar clef=treble-8
%%MIDI program 24
% Open Em: 0 2 2 0 0 0
"Em"[!6!E,,!5!B,,!4!E,!3!G,!2!B,!1!E]4 |
% Em at fret 7: X 7 9 9 8 7
"Em"[!5!E,!4!B,!3!E!2!G!1!B]4 |]
```

Use the TAB render options above to display these string assignments. The `!N!` string interpretation is an abcjs integration convention in this app, not a portable chord-diagram format. Fingers and barre metadata remain in the shape model; pitches alone cannot preserve them. The current Copy ABCJS ABC action copies notation, not workspace overrides or injected SVG diagrams. A portable ABC copy therefore does not round-trip picker choices; preserving them requires project metadata or an explicit generated Guitar voice. See the [ABC 2.1 chord-symbol specification](https://abcnotation.com/wiki/abc:standard:v2.1#chord_symbols) and [abcjs TAB documentation](https://docs.abcjs.net/visual/tablature).

`cleanAbcForExport()` in `src/lib/theory/abc-layer-visibility.ts` is a portable-export projection used when exporting or copying ABC to the clipboard: it strips all `!N!` string decorations (which other software shows as fingering numbers) and normalizes `clef=treble-8` to `clef=treble` so third-party viewers render the staff correctly. It is not a canonical rewrite.

## 5. Source link between ABC text and the score
<!-- beads-id: br-guide-abcjs-tablature-s06 -->

- abcjs reports `startChar`/`endChar` against the **rendered** string, while editors select against the caller's ABC. `abcjs-playback/source-map.ts` aligns the two strings so render adaptations (key/meter/name overrides, inert-grace sanitization, string forcing) never shift a highlight; never compare raw abcjs offsets with caller offsets.
- `abcjs-playback/source-selection.ts` indexes engraved elements by caller-ABC range after every render and toggles the preview-only `abcjs-source-selected` class. `abcjs-playback/lyric-alignment.ts` maps a caret in a `w:` line to its note with the ABC 2.1 syllable rules (`-`, `_`, `*`, `|`), because abcjs records no source position per syllable.
- The controller's `sourceSelection` / `onSourceSelect` props carry the link. Clicking a note or chord name selects its source; clicking a guitar diagram opens the shape picker using its full rectangular hit area. Keyboard Enter opens the chord picker when a chord is focused. Audio starts exclusively from the Play control. The Melody editor (`src/components/composer/abc-editor/AbcSourceEditor.tsx`, CodeMirror 6) feeds its selection in and selects the reported range.

## 6. Related
<!-- beads-id: br-guide-abcjs-tablature-s05 -->

- [TimeGrid Conversion Guide § Guitar ABC rules](./timegrid-conversion-guide.md) — how TimeGrid events are projected to forced-string Guitar ABC.
- [Composer Source Flow § Layers Visibility guardrails](./composer-source-flow.md) — visibility, volume, and TAB as preview-only state.
- `ARCHITECTURE.md` § Music sheet / ABCJS playback — module map.
