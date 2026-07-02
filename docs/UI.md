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
    ComposeEnsemble["Step 4: Ensemble Expansion <br> (/compose/[slug]/ensemble)"]
    ComposeReview["Step 5: Review & Export <br> (/compose/[slug]/review)"]

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
    ComposeAccomp -->|Save Accompaniment| ComposeEnsemble
    ComposeEnsemble -->|Save Ensemble| ComposeReview
    ComposeReview -->|Export Markdown/PR| EditList

    %% Define Styles
    classDef hub fill:#f0f7ff,stroke:#0284c7,stroke-width:2px;
    classDef composer fill:#fff7ed,stroke:#ea580c,stroke-width:2px;
    classDef step fill:#fafaf9,stroke:#78716c,stroke-dasharray: 5 5;
    classDef mockup fill:#fdf4ff,stroke:#c026d3,stroke-width:2px;

    %% Apply Styles
    class Home,Catalog,SongDetail,EditList hub;
    class ComposeGeneral composer;
    class ComposeMelody,ComposeHarmony,ComposeAccomp,ComposeEnsemble,ComposeReview step;
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
|  |                      ABCJS Music Sheet Render Panel                        |  |
|  |  [Sheet Selector: Melody / Backing / Piano]                                |  |
|  |  [Controls: Play, Pause, Tempo-Scale, Loop-Range]                           |  |
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

### 2.2 Workstation Route-Based Layout (The 5 Child-UIs)

To prevent UI clutter and to empower **Agentic AI Coding**, the Composer Workstation is **strictly split into 5 smaller, dedicated child-UIs** using Next.js subroutes (`/compose/[slug]/[step]`). 

A monolithic screen containing all these features would be an anti-pattern. By decoupling the pipeline into distinct routes, each UI is small, state is localized, and AI agents can reason about one workflow at a time. The 20% width Sidebar remains consistent across all routes, showing step progress and layer status.

#### 2.2.1 Step 1: Melody Input (`/compose/[slug]/melody`)
Focus: Inputting the foundational Treble Clef ABC notation.

```
+-----------------------+----------------------------------------------------------+
|  SIDEBAR (20%)        |  MAIN WORKSPACE CANVAS: STEP 1 - MELODY (80%)            |
|                       |                                                          |
|  [✓] Metadata         |  +----------------------------------------------------+  |
|  [▶] 1. Melody        |  | ABC Notation Editor (Text Area)                    |  |
|  [ ] 2. Harmony       |  | X:1 ... K:C ... C D E F | G A B c |                |  |
|  [ ] 3. Accompaniment |  +----------------------------------------------------+  |
|  [ ] 4. Ensemble      |  +----------------------------------------------------+  |
|  [ ] 5. Review        |  | Live ABCJS Render Preview                          |  |
|                       |  | ===================== STAFF ====================== |  |
|  [Track States]       |  +----------------------------------------------------+  |
|                       |  [ Back ]                            [ Save & Next ]     |
+-----------------------+----------------------------------------------------------+
```

#### 2.2.2 Step 2: Harmonization (`/compose/[slug]/harmony`)
Focus: AI Theory Assistant generating chord progressions.

```
+-----------------------+----------------------------------------------------------+
|  SIDEBAR (20%)        |  MAIN WORKSPACE CANVAS: STEP 2 - HARMONIZATION (80%)     |
|                       |                                                          |
|  [✓] 1. Melody        |  +----------------------------------------------------+  |
|  [▶] 2. Harmony       |  | AI Analysis Settings: [Detect Key] [Set Raga]      |  |
|  [ ] 3. Accompaniment |  | [ Generate Chord Progression ]                     |  |
|                       |  +----------------------------------------------------+  |
|  [Track States]       |  +----------------------------------------------------+  |
|  Melody (Background)  |  | AI Theory Explanation Box                          |  |
|                       |  | "Using the natural minor scale, the iv-VII..."     |  |
|                       |  +----------------------------------------------------+  |
|                       |  +----------------------------------------------------+  |
|                       |  | Chord Track Editor (Ghosted Melody below)          |  |
|                       |  | [ Am ]   [ G ]   [ F ]   [ E7 ]                    |  |
|                       |  +----------------------------------------------------+  |
|                       |  [ Back ]                            [ Save & Next ]     |
+-----------------------+----------------------------------------------------------+
```
*(Note: Ghosted Background Layers allow the user to see the Melody notes faintly behind the active Chord track).*

#### 2.2.3 Step 3: Accompaniment (`/compose/[slug]/accompaniment`)
Focus: Generating Piano Accompaniment or Guitar Fingerstyle from the Harmonized Melody.

```
+-----------------------+----------------------------------------------------------+
|  SIDEBAR (20%)        |  MAIN WORKSPACE CANVAS: STEP 3 - ACCOMPANIMENT (80%)     |
|                       |                                                          |
|  [✓] 2. Harmony       |  +----------------------------------------------------+  |
|  [▶] 3. Accompaniment |  | Engine Toggle: (o) Piano Accomp. ( ) Fingerstyle   |  |
|  [ ] 4. Ensemble      |  | Profile: [Pop/Ballad] [Rock/R&B] [Classical/Folk]  |  |
|                       |  | [ Generate Accompaniment Matrix ]                  |  |
|                       |  +----------------------------------------------------+  |
|  [Track States]       |  +----------------------------------------------------+  |
|  Melody (Background)  |  | Playability Validation Report                      |  |
|  Harmony (Background) |  | ⚠️ "Max span exceeded in m.4. Converted to arpeggio"|  |
|                       |  +----------------------------------------------------+  |
|                       |  +----------------------------------------------------+  |
|                       |  | Resulting ABC Staff Preview (Bass & Treble Clefs)  |  |
|                       |  +----------------------------------------------------+  |
|                       |  [ Back ]                            [ Save & Next ]     |
+-----------------------+----------------------------------------------------------+
```

#### 2.2.4 Step 4: Ensemble Expansion (`/compose/[slug]/ensemble`)
Focus: Layering Flute, Violin, and Djembe on top of the accompaniment.

```
+-----------------------+----------------------------------------------------------+
|  SIDEBAR (20%)        |  MAIN WORKSPACE CANVAS: STEP 4 - ENSEMBLE (80%)          |
|                       |                                                          |
|  [✓] 3. Accompaniment |  +----------------------------------------------------+  |
|  [▶] 4. Ensemble      |  | Enable Layers: [x] Djembe  [x] Flute  [ ] Violin   |  |
|  [ ] 5. Review        |  | [ Generate Ensemble Support ]                      |  |
|                       |  +----------------------------------------------------+  |
|  [Track States]       |  +----------------------------------------------------+  |
|  (All Background)     |  | Conflict Resolution Hierarchy Log                  |  |
|                       |  | "Flute yielded in m.8 due to active melody..."     |  |
|                       |  +----------------------------------------------------+  |
|                       |  +----------------------------------------------------+  |
|                       |  | Multi-track ABCJS Render (Full Score View)         |  |
|                       |  +----------------------------------------------------+  |
|                       |  [ Back ]                            [ Save & Next ]     |
+-----------------------+----------------------------------------------------------+
```

#### 2.2.5 Step 5: Review & Export (`/compose/[slug]/review`)
Focus: Reviewing the final multi-layer arrangement and exporting to markdown for a Pull Request.

```
+-----------------------+----------------------------------------------------------+
|  SIDEBAR (20%)        |  MAIN WORKSPACE CANVAS: STEP 5 - REVIEW & EXPORT (80%)   |
|                       |                                                          |
|  [✓] 4. Ensemble      |  +----------------------------------------------------+  |
|  [▶] 5. Review        |  | Playback Simulation: Test Full Audio & Sync        |  |
|                       |  | [ Play All Layers ]                                |  |
|                       |  +----------------------------------------------------+  |
|                       |  +----------------------------------------------------+  |
|  [Track States]       |  | Raw Markdown Output File Preview                   |  |
|  All Layers Active    |  | ---                                                |  |
|                       |  | title: "..."                                       |  |
|                       |  | abcNotations: [...]                                |  |
|                       |  | ---                                                |  |
|                       |  | ## Lyrics ...                                      |  |
|                       |  +----------------------------------------------------+  |
|                       |  [ Back ]      [ Copy Markdown ]   [ Submit as PR ]      |
+-----------------------+----------------------------------------------------------+
```

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
    
    Note over AccompPage: Step 3: Accompaniment / Fingerstyle
    User->>AccompPage: Select "Fingerstyle Generator"
    AccompPage->>User: Show playability report (max span)
    User->>AccompPage: Click "Save & Next"
    AccompPage->>DB: Save Guitar Layer
    AccompPage-->>User: Navigate to Step 4: /compose/[slug]/ensemble (etc.)
```

---

### 3.3 Flow 3: Fingerstyle Compression & Playability Tuning
This flow highlights the interaction between the downward compression algorithm and the user setting physical constraints, specifically on the `/compose/[slug]/accompaniment` or `/mockups/fingerstyle` page.

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
   - Grid layout is strictly `20% / 80%` column split for the Workstation child-UIs.
   - The Layer Stack Preview displays horizontally below the two columns.
2. **Tablet View (768px - 1023px)**:
   - Grid changes to `30% / 70%` column split to prevent the sidebar from being too compressed.
   - Textareas in the ABC Editor scale down font sizes to `text-xs` for clarity.
3. **Mobile View (< 768px)**:
   - The grid collapses into a single vertical stack.
   - The Sidebar transforms into a slide-over/drawer or a collapsible accordion block at the top of the screen labeled "Layers & Navigation".
   - Input fields and textareas occupy `100%` viewport width.
   - Fretboard and Keyboard SVGs enable horizontal scrolling (`overflow-x-auto`) to keep key grids readable.
