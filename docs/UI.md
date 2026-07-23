# Bhajan Song Composer — User Interface Specification

This document details the user interface (UI) architecture, layout structure, screen connectivity, and user experience flows for the **Bhajan Song Composer** web application. 

It is designed to satisfy the playback and composition requirements outlined in [PRD.md](file:///Users/steve/duyhunghd6/bhajan-song-composer/docs/PRD.md) and technical stages in [PLAN.md](file:///Users/steve/duyhunghd6/bhajan-song-composer/docs/PLAN.md).

---

## 1. Application Navigation Graph

The application follows a clean, responsive web flow divided into three primary zones: the **Playback Hub**, the **Composer Workstation**, and the **Mockup / PoC Gates** (for isolated testing of agentic AI workflows).

```mermaid
graph TD
    %% Playback Hub Nodes
    Home["Home Page (/)"]
    Catalog["Language Catalog (/[language])"]
    SongDetail["Song Detail Page (/[language]/[slug])"]
    EditList["Catalogue Editor List (/edit)"]

    %% Mockup / PoC Gates Nodes
    MockupHub["Mockups Hub (/mockups)"]
    MockArrangement["Arrangement Pipeline (/mockups/arrangement)"]
    MockFingerstyle["Fingerstyle Engine (/mockups/fingerstyle)"]
    MockPiano["Piano Accompaniment (/mockups/piano)"]
    MockEnsemble["Ensemble Expansion (/mockups/ensemble)"]

    %% Composer Workstation Nodes (The 5 Child-UIs)
    ComposeGeneral["Composer Home (/compose) <br> [Song Metadata & Layers Dashboard]"]
    ComposeMelody["Step 1: Melody Input <br> (/compose/[slug]/melody)"]
    ComposeHarmony["Step 2: Harmonization <br> (/compose/[slug]/harmony)"]
    ComposeAccomp["Step 3: Accompaniment <br> (/compose/[slug]/accompaniment)"]
    ComposeFingerstyle["Step 3.1: Guitar Fingerstyle <br> (/compose/[slug]/guitar-fingerstyle)"]
    ComposeExport["Step 4: Export to Practice <br> (/compose/[slug]/review)"]
    Practice["Practice / Showcase <br> (/practice/[slug])"]

    %% Navigation Paths
    Home -->|Browse Language| Catalog
    Catalog -->|Select Song| SongDetail
    Home -->|Manage Catalog| EditList
    EditList -->|Create New Song| ComposeGeneral
    EditList -->|Edit Song| ComposeGeneral
    SongDetail -->|Edit/Arrange Song| ComposeGeneral
    Home -.->|Access Test Gates| MockupHub

    MockupHub --> MockArrangement & MockFingerstyle & MockPiano & MockEnsemble

    %% Composer Workstation Flow (Step-by-step Subpages)
    ComposeGeneral -->|Save Metadata| ComposeMelody
    ComposeMelody -->|Save Melody| ComposeHarmony
    ComposeHarmony -->|Save Harmony| ComposeAccomp
    ComposeHarmony -.->|Open dedicated Guitar Fingerstyle| ComposeFingerstyle
    ComposeAccomp -.->|Independent accompaniment layer available to export| ComposeExport
    ComposeFingerstyle -.->|Independent Guitar layer available to export| ComposeExport
    ComposeExport -->|Publish selected layers| Practice

    %% Define Styles
    classDef hub fill:#f0f7ff,stroke:#0284c7,stroke-width:2px;
    classDef composer fill:#fff7ed,stroke:#ea580c,stroke-width:2px;
    classDef step fill:#fafaf9,stroke:#78716c,stroke-dasharray: 5 5;
    classDef mockup fill:#fdf4ff,stroke:#c026d3,stroke-width:2px;

    %% Apply Styles
    class Home,Catalog,SongDetail,EditList hub;
    class ComposeGeneral composer;
    class ComposeMelody,ComposeHarmony,ComposeAccomp,ComposeFingerstyle,ComposeExport,Practice step;
    class MockupHub,MockArrangement,MockFingerstyle,MockPiano,MockEnsemble mockup;
```

---

## 2. Page Layout Architectures

### 2.1 Song Playback Page Layout
The playback screen is optimized for double-medium split playback: users can watch video-based reference material or interact with dynamic, MIDI-synthesized sheet music.

```
+----------------------------------------------------------------------------------+
| Navigation: Home / [Language] / [Song Title]                                     |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +-------------------------------------+  +-----------------------------------+  |
|  |           YouTube Player            |  |      Lyrics & Transliteration     |  |
|  |                                     |  |                                   |  |
|  |  [Type: Beat-Karaoke / Performance] |  |  Verse 1...                       |  |
|  |                                     |  |  Chorus...                        |  |
|  +-------------------------------------+  +-----------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |         Universal ABCJS Playback Controller (Reusable Component)           |  |
|  |  [Sheet Selector: Melody / Backing / Piano]                                |  |
|  |  [Controls: Play, Stop, BPM Control, Measure X->Y Select, Loop]            |  |
|  |                                                                            |  |
|  |  ======================== STAFF RENDER AREA =============================  |  |
|  |  [Note Highlighting Cursor synchronizes with MIDI Playback]                |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |                     Visual Instrument Highlight Panel                      |  |
|  |  [Layout Toggles: Guitar Fretboard Mode / Piano Keyboard Mode]             |  |
|  |                                                                            |  |
|  |  [Numbered Note Markers: blue left hand / yellow right hand]              |  |
|  |  [Sustain Pedal Indicator: Up / Down] (For Piano mode)                     |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

### 2.2 Workstation Route-Based Layout

To prevent UI clutter and to empower **Agentic AI Coding**, the Composer Workstation is split into dedicated child-UIs using Next.js subroutes (`/compose/[slug]/[step]`). The dedicated Guitar Fingerstyle route is a sibling downstream of Harmony rather than an accompaniment substep.

A monolithic screen containing all these features would be an anti-pattern. By decoupling the pipeline into distinct routes, each UI is small, state is localized, and AI agents can reason about one workflow at a time. The Workstation uses a compact checkpoint strip for Layers & Navigation so step progress remains visible without consuming the left side of the canvas.

#### 2.2.1 Step 1: Melody Input (`/compose/[slug]/melody`)
Focus: Inputting the foundational Treble Clef ABC notation.

```
+----------------------------------------------------------------------------------+
| COMPACT CHECKPOINTS: [✓] Metadata  [▶] Melody  [ ] Harmony  [ ] Accomp  [ ] Review|
+----------------------------------------------------------------------------------+
| MAIN WORKSPACE CANVAS: STEP 1 - MELODY                                           |
|                                                                                  |
| QHD / very wide viewport:                                                        |
|  +--------------------------------------+  +------------------------------------+ |
|  | ABC Notation Editor (Text Area)      |  | Music Staff Playback              | |
|  | X:1 ... K:C ... C D E F | G A B c | |  | [Play/Stop, BPM, Measure Loop]    | |
|  |                                      |  | ===== bounded STAFF viewport ==== | |
|  |                                      |  | internal scroll if score is tall  | |
|  +--------------------------------------+  +------------------------------------+ |
|                                                                                  |
| Laptop / tablet / narrow viewport:                                               |
|  +----------------------------------------------------------------------------+  |
|  | ABC Notation Editor (top)                                                |  |
|  +----------------------------------------------------------------------------+  |
|  +----------------------------------------------------------------------------+  |
|  | Music Staff Playback (bottom, bounded width/height + internal scroll)    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
| [ Back ]                                                        [ Save & Next ]  |
+----------------------------------------------------------------------------------+
```

#### 2.2.2 Step 2: Harmonization (`/compose/[slug]/harmony`)
Focus: AI Theory Assistant generating chord progressions and refining them with a real-time preview and virtual instruments.

```
+----------------------------------------------------------------------------------+
| COMPACT CHECKPOINTS: [✓] Metadata  [✓] Melody  [▶] Harmony  [ ] Accomp  [ ] Review|
+----------------------------------------------------------------------------------+
| MAIN WORKSPACE CANVAS: STEP 2 - HARMONIZATION                                    |
|                                                                                  |
| STACK 1: AI Analysis & Preview (Two-column grid)                                 |
|  +------------------------------------+  +------------------------------------+  |
|  | AI Analysis Settings               |  | Harmonization Preview              |  |
|  | [Detect Key] [Set Raga]            |  | [Music Staff Playback]             |  |
|  | [✨ Suggest AI Harmonization]      |  |                                    |  |
|  |                                    |  +------------------------------------+  |
|  | Theory Assistant                   |  | Current ABCNotation of the Song    |  |
|  | [Accept Arrangement]               |  | X:1 ... C D E F | G A B c |        |  |
|  +------------------------------------+  +------------------------------------+  |
|                                                                                  |
| STACK 2: Composer Notes & Editing (Two-column grid)                              |
|  +------------------------------------+  +------------------------------------+  |
|  | Composer Layer Note                |  | Chord Track Editor                 |  |
|  | "Pop Progression accepted as the   |  | (Ghosted Melody below)             |  |
|  | harmony layer."                    |  | [ Am ]   [ G ]   [ F ]   [ E7 ]    |  |
|  +------------------------------------+  +------------------------------------+  |
|                                                                                  |
| STACK 3: Virtual Instruments (Full width)                                        |
|  +----------------------------------------------------------------------------+  |
|  | Piano Voicing Keyboard                                                     |  |
|  | [============= KEYS & NOTE HIGHLIGHTING ===============]                     |  |
|  +----------------------------------------------------------------------------+  |
|  | Guitar Fretboard preview                                                   |  |
|  | [============== FRETS & STRING MARKERS ===============]                     |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
| [ Back ]                                                        [ Save & Next ]  |
+----------------------------------------------------------------------------------+
```
*(Note: Ghosted Background Layers allow the user to see the Melody notes faintly behind the active Chord track).*

#### 2.2.3 Step 3: Accompaniment (`/compose/[slug]/accompaniment`)
Focus: combined accompaniment planning from the selected Harmony Step 3 (`voice-leading-validation`) ABC.

```
+----------------------------------------------------------------------------------+
| COMPACT CHECKPOINTS: [✓] Metadata  [✓] Melody  [✓] Harmony  [▶] Accomp  [ ] Review|
+----------------------------------------------------------------------------------+
| MAIN WORKSPACE CANVAS: STEP 3 - ACCOMPANIMENT                                    |
|                                                                                  |
| Ordered stack: [x] Guitar Classic  [x] Indian Harmonium  [x] Djembe             |
| Shared Harmony review: Key & Beats → Chords → Validate Harmony                   |
| Instrument branches: Guitar comping/voicing/ABC · Harmonium · Djembe             |
|                                                                                  |
|  +------------------------------------+  +------------------------------------+  |
|  | AI Accompaniment Workflow          |  | Resulting ABC Staff Preview        |  |
|  | [Generate / review branch options] |  | [Music Staff Playback]             |  |
|  | No Solo/Fingerstyle or TAB output  |  | Guitar Classic standard staff +     |  |
|  |                                    |  | combined support voices             |  |
|  +------------------------------------+  +------------------------------------+  |
+----------------------------------------------------------------------------------+
```

#### 2.2.4 Dedicated Guitar Fingerstyle (`/compose/[slug]/guitar-fingerstyle`)

This independent sibling route compiles the selected `voice-leading-validation` ABC into the meter-aware TimeGrid. It owns skill and fill-density settings, physical validation, generated Guitar ABC, and ASCII-GuitarTab; it never consumes accompaniment output.

#### 2.2.5 Step 4: Export to Practice (`/compose/[slug]/review`)

Export is the durable handoff from Composer drafts to Practice (the only Showcase). It lists source-current Melody, Validated Harmony, Accompaniment, and Guitar Fingerstyle layers. The user selects exactly which layers to publish; unselected notation files and the Markdown Lyrics/Notes body remain unchanged.

```
+-----------------------------------+------------------------------------------+
| EXPORT SELECTOR                   | ARRANGEMENT PREVIEW                      |
| [ ] Melody                        | [ ABCJS playback ]                       |
| [ ] Validated Harmony             | Preview may combine valid draft branches |
| [ ] Accompaniment                 |                                          |
| [ ] Guitar Fingerstyle            |                                          |
| [ Publish selected layers ]       | [ Open Practice after publication ]      |
+-----------------------------------+------------------------------------------+
```

> Ensemble remains a mockup/experimental workflow and has no Composer route in the active product flow.

### 2.3 Reusable Shared Components

#### 2.3.1 Universal ABCJS Playback Controller
To maintain consistency across the Playback Hub, Composer Workstation, and Mockup Gates, the music rendering and playback controls must be abstracted into a single, highly reusable React component (e.g., `<AbcjsPlaybackController />`).

**Features & Capabilities:**
- **Rendering Engine:** Uses `abcjs` to render raw ABC notation into responsive SVG staves.
- **Playback Controls:** 
  - **Start / Stop:** Toggle MIDI synthesis and audio playback.
  - **BPM Control:** Slider or input to speed up or slow down the tempo.
  - **Measurement Selection:** UI inputs to select a specific measure range (from Measure X to Measure Y).
  - **Looping:** Toggle to continuously loop the selected measurement range.
- **Portability:** Any page requiring music display or playback (Song Detail Page, Step 1 Melody Editor, Mockups, etc.) simply imports and mounts this component, passing the ABC string and playback constraints as props.

---

## 3. Core User Experience Flows

### 3.1 Flow 1: Playback & Practice Flow (Learner/Practitioner)
This flow guides a practitioner through finding, listening to, and learning chords or finger placements for a devotional song.

```mermaid
sequenceDiagram
    actor User as Practitioner
    participant Page as Song Detail Page
    participant YT as YouTube Player
    participant Music as Music Sheet Renderer
    participant Inst as Instrument Panel

    User->>Page: Open /[language]/[slug]
    Note over Page: Default Beat-Karaoke video<br/>& Melody ABC render load
    
    User->>YT: Click Play Video
    YT->>User: Play references audio & visual lyrics
    
    User->>Page: Toggle ABC Sheet Selection to "Piano Background"
    Page->>Music: Request Piano ABC source
    Music->>User: Render Grand-Staff (Treble + Bass Clef)
    
    User->>Music: Click MIDI Replay & set Speed to 0.8x
    Music->>User: Synthesize audio, begin Note Highlighting cursor
    
    Note over Inst: Synchronized highlighting triggers
    Music->>Inst: Broadcast active pitch event
    Inst->>User: Highlight Keys (Piano) / Frets (Guitar)
    Inst->>User: Show numbered note markers (blue LH / yellow RH)
    Inst->>User: Update Sustain Pedal Up/Down indicator
```

---

### 3.2 Flow 2: Composition & Upward Construction Flow (Composer)
This flow details how a composer moves chronologically through the arrangement pipeline, passing through the dedicated child-UIs.

```mermaid
sequenceDiagram
    actor User as Composer
    participant MetaPage as /compose (Metadata)
    participant MelodyPage as /compose/[slug]/melody
    participant HarmonyPage as /compose/[slug]/harmony
    participant AccompPage as /compose/[slug]/accompaniment
    participant FingerstylePage as /compose/[slug]/guitar-fingerstyle
    participant DB as Local Storage

    User->>MetaPage: Enter metadata (Title, Key, Time)
    User->>MetaPage: Click "Save & Start Melody"
    MetaPage->>DB: Save metadata draft
    MetaPage-->>User: Navigate to Step 1: /compose/[slug]/melody
    
    Note over MelodyPage: Step 1: Melody
    User->>MelodyPage: Edit Treble Clef ABC
    MelodyPage->>User: Render Live Staff Preview
    User->>MelodyPage: Click "Save & Harmonize"
    MelodyPage->>DB: Save Melody Layer
    MelodyPage-->>User: Navigate to Step 2: /compose/[slug]/harmony
    
    Note over HarmonyPage: Step 2: Harmonization
    HarmonyPage->>HarmonyPage: Analyze melody & generate Chords
    HarmonyPage->>User: Show AI Theory Explanation & Fretboard Diagrams
    User->>HarmonyPage: Adjust Capo & Skill Level
    User->>HarmonyPage: Click "Save & Add Accompaniment"
    HarmonyPage->>DB: Save Harmony Layer
    HarmonyPage-->>User: Navigate to Step 3: /compose/[slug]/accompaniment
    
    Note over AccompPage: Step 3: combined accompaniment only
    User->>AccompPage: Configure Guitar Classic, Harmonium, and Djembe branches
    AccompPage->>User: Preview combined support ABC
    User->>AccompPage: Save accompaniment decisions

    User->>FingerstylePage: Open independent Guitar Fingerstyle route
    Note over FingerstylePage: Compile selected voice-leading-validation ABC into TimeGrid
    FingerstylePage->>User: Review skill/density, physical validation, Guitar ABC, and TAB
    FingerstylePage->>DB: Save dedicated Guitar Fingerstyle artifact
```

---

### 3.3 Flow 3: Dedicated Guitar Fingerstyle Compression & Playability Tuning
This flow highlights the interaction between the downward compression algorithm and physical constraints on `/compose/[slug]/guitar-fingerstyle`. The route independently starts from the selected `voice-leading-validation` ABC; `/compose/[slug]/accompaniment` output is not an input.

```mermaid
sequenceDiagram
    actor User as Guitarist/Composer
    participant UI as Fingerstyle UI
    participant Comp as Compression Algorithm
    participant Fret as Guitar Fretboard Preview

    User->>UI: Select "Melody" track as source
    User->>UI: Select profile "Strict PIMA"
    User->>UI: Click "Generate Fingerstyle"
    
    Comp->>Comp: Route melody to high strings (1-3)
    Comp->>Comp: Route bass notes to low strings (4-6)
    Comp->>Comp: Validate fret-stretch between downbeat melody and bass
    
    alt Stretch exceeds 5 frets (failure)
        Comp->>UI: Return Warning: "Unplayable stretch in measure 4"
        Comp->>UI: Suggest fallback: "Transpose song to Dm (-2 semitones)"
        User->>UI: Click "Apply Transposition Fallback"
        UI->>Comp: Re-run compression in Dm
    end

    Comp->>Fret: Output playability map & numbered marker positions
    Fret->>User: Render fretboard with highlighted fret notes & numbered markers
    User->>UI: Click "Accept as Composer Layer"
```

---

## 4. Layout States and Responsiveness Guidelines

1. **Desktop View (>= 1024px)**:
   - Workstation child-UIs use a compact top checkpoint strip for Layers & Navigation instead of a persistent 20% sidebar, keeping the main canvas readable.
   - The checkpoint strip shows one-line progress for Metadata plus the five composer steps, highlighting complete, current, and pending states.
   - Standard desktop and laptop widths keep the ABC Editor stacked above the Music Staff Playback when horizontal space would make either panel cramped.
2. **Very Wide / QHD View (extra-wide canvas, e.g. >= 1536px)**:
   - Step 1 Melody may split the main canvas into two readable panels: ABC Notation Editor on the left and Music Staff Playback on the right.
   - The Music Staff Playback must use a bounded width and height, with internal scrolling when needed, so abcjs does not stretch the first line too wide to read.
   - ABCJS render options should prefer wrapped staff systems, typically around four measures per line, so the user can read at least the first page or first half-page comfortably.
3. **Tablet View (768px - 1023px)**:
   - Composer content stays as a single-column flow: ABC source on top, Music Staff Playback below.
   - Textareas in the ABC Editor scale down font sizes to `text-xs` for clarity where needed.
4. **Mobile View (< 768px)**:
   - The grid collapses into a single vertical stack.
   - Layers & Navigation remains a compact checkpoint block at the top rather than a sidebar or tall drawer.
   - Input fields and textareas occupy `100%` viewport width.
   - Music staff, Fretboard, and Keyboard SVGs enable horizontal scrolling (`overflow-x-auto`) to keep notation and key grids readable.
