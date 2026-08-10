# Instrument Skill Levels — Bhajan Arrangement Reference

> **Purpose:** This document defines **5 proficiency levels** for **12 instruments** commonly used in Bhajan/devotional music. It serves as the authoritative reference when the agent needs to adapt arrangement complexity, technique selection, and physical constraints to a player's skill level.
>
> **Companion to:** [`SKILL.md`](./SKILL.md) (routing), [`THEORY.md`](./THEORY.md) (harmonic theory), [`ARRANGEMENT01-GUITAR.md`](./ARRANGEMENT01-GUITAR.md), [`ARRANGEMENT02-PIANO.md`](./ARRANGEMENT02-PIANO.md), [`ARRANGEMENT03-ESSEMBLE.md`](./ARRANGEMENT03-ESSEMBLE.md)

---

## Naming Convention & Level Mapping

All instruments share a unified 5-level framework, mapped to both Western grading systems and Indian classical terminology:

| Level | English Name | Sanskrit Name | ABRSM Equivalent | Indian Exam (ABGMVM) | Symbol |
| ----- | ------------ | ------------- | ----------------- | --------------------- | ------ |
| **1** | Foundation | **Prarambhik** (प्रारम्भिक) | Initial–Grade 2 | Prarambhik | 🌱 |
| **2** | Elementary | **Praveshika** (प्रवेशिका) | Grade 3–4 | Praveshika Purna | 🌿 |
| **3** | Intermediate | **Madhyama** (मध्यमा) | Grade 5–6 | Madhyama Purna | 🌸 |
| **4** | Advanced | **Visharad** (विशारद) | Grade 7–8 | Visharad | 🌺 |
| **5** | Virtuoso | **Alankar** (अलंकार) | Diploma (ARSM+) | Alankar / Sangeetacharya | 🪷 |

### How Levels Affect Arrangement Generation

When a user specifies a skill level for any instrument, the agent **must constrain** the generated arrangement to that level's technical boundaries:

- **Technique whitelist:** Only use techniques permitted at that level
- **Register constraint:** Restrict to the level's comfortable pitch range
- **Rhythmic density:** Limit subdivision complexity per level
- **Voicing density:** Cap simultaneous notes and chord complexity
- **Physical demands:** Enforce span, speed, and endurance limits

---

## 1. 🎹 Piano

> **Role in Bhajan:** Harmonic foundation, melodic doubling, gap fills, devotional accompaniment.
> **MIDI Program:** 0 (Acoustic Grand Piano)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Hands** | RH only (melody) | RH melody + LH single root | Both hands independent | Full two-hand voicing | Grand staff counterpoint |
| **LH pattern** | — | Whole/half-note roots | Root-fifth alternation | 1-5-8 arpeggiation, Alberti bass | Walking bass, chromatic approach, pedal point |
| **RH voicing** | Single notes | Root position triads | Inversions, guide tones | Drop-2, open voicings, 7ths | Extended/altered chords, clusters |
| **Max simultaneous notes** | 1 (RH) | 3 (RH) + 1 (LH) | 4 (RH) + 2 (LH) | 5 (RH) + 3 (LH) | 10 (full span) |
| **Max hand span** | 5th (7 semitones) | Octave (12 semitones) | 9th (14 semitones) | 10th (16 semitones) | 10th + rolled |
| **Comping profile** | Sustained whole chords | Block chords, half-note changes | Pop/Ballad (1-5-10) | Rock/R&B (syncopated off-beat), Classical/Folk (Alberti) | All profiles + improvised fills |
| **Gap fills** | None | None | Scale-tone fills in long rests | Chromatic fills, contrary motion | Countermelody, call-response |
| **Pedal automation** | None | Pedal down per chord (full sustain) | Down/flush per chord change | Half-pedal on passing chords | Artistic pedal phrasing |
| **Rhythmic subdivision** | Whole, half notes | Quarter notes | Eighth notes | Sixteenth notes, triplets | All subdivisions, polyrhythm |
| **Tempo range** | ♩ = 50–80 | ♩ = 60–100 | ♩ = 70–120 | ♩ = 80–140 | ♩ = 60–180 |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Play the melody line of the Sthayi with one hand; focus on correct notes and steady rhythm |
| 🌿 | Add root bass notes on beat 1 of each measure; simple chord changes following the bhajan's I-IV-V-I pattern |
| 🌸 | Full two-hand devotional accompaniment; flowing arpeggiated bass (Pop/Ballad profile); voice leading between chords |
| 🌺 | Dynamic accompaniment with gap fills during singer's breath; stylistic comping; pedal automation for sustained warmth |
| 🪷 | Independent countermelody during Antara; call-response fills echoing Sthayi motifs; expressive pedal artistry supporting group kirtan |

---

## 2. 🪗 Harmonium (Indian Reed Organ)

> **Role in Bhajan:** Primary melodic and harmonic accompaniment; devotional drone base; singer support.
> **MIDI Program:** 20 (Reed Organ)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Playing hand** | RH single notes | RH melody + basic drone | RH + LH drone chords | Full two-hand, chordal | Full with ornaments |
| **Bellows technique** | Steady, constant pump | Rhythmic pumping (sync to beat) | Melodic phrasing with bellows | Dynamic swells for emphasis | Micro-dynamic bellows for raga expression |
| **Finger technique** | Single note Sargam (Sa Re Ga Ma Pa Dha Ni Sa) | Simple Alankar patterns | Kan Swar (grace notes) | Khatka, Murki (fast clusters) | Meend (glide), Taan (rapid runs) |
| **Drone capability** | None (melody only) | Single root drone (Sa) | Root-fifth drone (Sa-Pa) | Chord drone with inversions | Raga-specific drone + harmonic overtone control |
| **Stops/registers** | Single stop (one octave) | Two stops | Multi-stop blending | Full stop palette | Register mixing for timbral variety |
| **Simultaneous notes** | 1 | 2 (melody + drone) | 3–4 | 5–6 | 7+ (full chord voicing) |
| **Rhythmic density** | Whole, half notes | Quarter notes | Eighth notes, simple syncopation | Sixteenth notes, Alankars | Complex Taans, rhythmic improvisation |
| **Performance endurance** | 5 minutes | 10 minutes | 20 minutes | 45 minutes | Full kirtan session (1–2 hours) |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Play the bhajan melody note by note with steady bellows; learn Sargam of common bhajans |
| 🌿 | Add a constant Sa drone under the melody; pump bellows in rhythm with the chant |
| 🌸 | Full devotional accompaniment: melody in RH, sustained Sa-Pa drone in LH; grace notes (Kan Swar) at phrase endings |
| 🌺 | Lead kirtan sessions with dynamic bellows control; chord voicings under melody; ornamental Khatka/Murki between phrases |
| 🪷 | Sacred presence: seamless blend of melody, harmony, and Raga expression; Meend glides connecting phrases; Taan runs during instrumental bridges; unwavering bellows mastery through extended sessions |

---

## 3. 🎸 Guitar (Classical / Acoustic / Fingerstyle)

> **Role in Bhajan:** Harmonic accompaniment (rhythm), melodic doubling, solo fingerstyle arrangement.
> **MIDI Program:** 24 (Nylon String Guitar)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Max fret** | 3 | 5 | 9 | 14 | 19 |
| **Max fret span** | 2 | 3 | 4 | 5 | 5+ (with stretch) |
| **Barre chords** | ❌ | ❌ | ✅ (limited) | ✅ (any shape) | ✅ (partial barre, complex shapes) |
| **Chord vocabulary** | Open major/minor (C, G, Am, Em, D) | +7ths, sus chords | +barre, diminished, augmented | +extended (9, 11, 13), slash chords | Any voicing, jazz chords, altered |
| **RH technique** | Simple down-strum | Down-up strum patterns | PIMA arpeggio, basic fingerpicking | Travis picking, pinch, slap | Full fingerstyle: simultaneous melody + bass + harmony + percussion |
| **Accompaniment mode** | Block chord strum (whole notes) | Rhythmic strum patterns | Arpeggio patterns, broken chords | PIMA devotional arpeggio, pinch | Solo fingerstyle compression |
| **Simultaneous strings** | All (strum) | All (strum) | 3–4 (fingerpick) | 4–6 (complex voicing) | 6 (full polyphonic) |
| **Forbidden techniques** | Hammer-on, pull-off, barre, harmonics, bend, vibrato, palm mute | Barre, harmonics, bend, palm mute | Bend, advanced harmonics | — | — |
| **Rhythmic subdivision** | Whole, half notes | Quarter notes, simple strum | Eighth notes, arpeggio | Sixteenth notes, syncopation | All subdivisions, polyrhythm |
| **Fingerstyle layers** | — | — | Melody OR bass (not both) | Melody + bass | Melody + bass + harmony + fills |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Strum open chords (G, C, D, Em, Am) on beats 1 and 3; simple I-IV-V-I bhajan progressions |
| 🌿 | Down-up strum patterns (D-DU-UDU); add 7th chords for devotional warmth |
| 🌸 | PIMA arpeggio accompaniment; broken chords flowing under the singer; alternating bass on thumb |
| 🌺 | Devotional fingerstyle: melody on top strings while thumb maintains bass pulse; pinch accents on strong beats |
| 🪷 | Full solo fingerstyle arrangement: Sthayi melody + harmonic bass + chord fills + intro/interlude/outro; the guitar becomes a complete ensemble |

---

## 4. 🥁 Djembe

> **Role in Bhajan:** Rhythmic heartbeat; bass sync with accompaniment; devotional groove.
> **MIDI Channel:** 10 (Percussion) — Bass (`E`), Tone (`_E`), Slap (`D`)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Stroke vocabulary** | Bass (Dum) only | Bass + Tone (Go) | Bass + Tone + Slap (Pa) | All strokes + muted | All + flam, roll, ghost notes |
| **Bass sync** | Beat 1 only | Beats 1 and 3 | Sync to Layer 2 bass transients | Complex sync + anticipation | Polyrhythmic bass independence |
| **Pattern complexity** | Half-note pulse | Quarter-note pulse | Standard groove (8th notes) | Syncopated patterns, fills | Improvised solos, cross-rhythms |
| **Fill capability** | None | None | Simple 2-beat fills at phrase endings | 4-beat fills, tihais | Extended solo fills, call-response |
| **Backbeat (beats 2, 4)** | None | Tone on 2 and 4 | Slap on 2 and 4 | Accented slap with ghost tones | Dynamic layered transients |
| **Subdivision** | Half notes | Quarter notes | Eighth notes | Sixteenth notes, triplets | All subdivisions, polyrhythm |
| **Dynamic range** | mp–mf (fixed) | p–f (2 levels) | pp–ff (4 levels) | Full dynamic spectrum | Micro-dynamics, velocity shaping |
| **Groove presets** | Sustained pulse | Bhajan Meditative (Preset A) | Folk Upbeat (Preset B) | Compound 6/8 (Preset C), custom | Any feel, free improvisation |
| **Taal literacy** | — | Keherwa (8 beats) | + Dadra (6 beats) | + Teentaal (16 beats), Jhaptaal (10 beats) | All taals, laggi, tihai |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Gentle bass (Dum) on beat 1; provides a meditative heartbeat without rhythmic complexity |
| 🌿 | Bass on beats 1 and 3, soft Tone on 2 and 4; steady Keherwa feel supporting group chanting |
| 🌸 | Full 3-stroke groove: Bass-Tone-Slap pattern; subdivision weave filling gaps in accompaniment; breath with the singer |
| 🌺 | Dynamic accompaniment: laggi (accelerating patterns) during climactic kirtan moments; tihais at phrase endings; compound meter grooves |
| 🪷 | Lead djembe: improvisational solos during instrumental sections; polyrhythmic interlock with tabla; dynamic storytelling through the drum |

---

## 5. 🪈 Flute (Bansuri / Western Concert Flute)

> **Role in Bhajan:** Melodic highlight, high-register halo, breath-shaped gap fills, devotional ornamentation.
> **MIDI Program:** 73 (Flute)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Register** | Middle octave (C5–C6) | 1.5 octaves (G4–D6) | 2 octaves (C4–C6) | 2.5 octaves (G3–E6) | Full range (C4–C7) |
| **Tone production** | Sustained, steady notes | Controlled long tones with crescendo/decrescendo | Varied articulation (legato, staccato) | Full dynamic palette | Timbral variation, overtone control |
| **Ornaments** | None | Simple grace notes (Kan Swar) | Kan Swar + basic Meend (pitch glide) | Khatka, Murki, full Meend | Taan (rapid runs), complex Gamak |
| **Breath control** | Rest every 2 measures | Rest every 3 measures | Rest every 4 measures | Rest every 6 measures | Circular breathing / 8+ measures |
| **Rhythmic subdivision** | Whole, half notes | Quarter notes | Eighth notes | Sixteenth notes, triplets | All subdivisions, complex patterns |
| **Fill behavior** | None (sustained drone notes) | Simple scale fill (2–3 notes) in long rests | Ascending/descending scale fills | Chromatic fills, motivic echoes | Improvised counter-melodies, call-response |
| **Polyphony** | 1 (monophonic) | 1 | 1 | 1 | 1 (always monophonic) |
| **Yield behavior** | Always in background | Background; enters only in 4+ beat rests | Background; enters in 2+ beat rests | Active during rests; subtle doubling in high register | Free foreground during gaps; expressive obbligato |
| **Tonguing** | None (all legato) | Basic tonguing for note separation | Double tonguing | Triple tonguing | All tonguing + flutter tongue |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Sustain a single high note (Sa or Pa) above the melody; gentle floating halo like a distant bird |
| 🌿 | Simple 3-note fill during singer's breath (e.g., ascending Sa-Re-Ga); soft grace notes decorating phrase endings |
| 🌸 | Melodic echoes of the Sthayi in higher register during gaps; Meend glides connecting phrases for vocal-like expression |
| 🌺 | Active counterpart: fills every melodic gap with tasteful runs; Khatka/Murki ornaments; dynamic swells matching kirtan intensity |
| 🪷 | Sacred flute: improvised melodic responses to the singer; Taan runs in instrumental interludes; Raga-aware phrasing creating a living dialogue between voice and bansuri |

---

## 6. 🎻 Violin

> **Role in Bhajan:** Harmonic bed, sustained pad, counterpoint, melodic doubling, expressive swells.
> **MIDI Program:** 40 (Violin)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Register** | First position (G3–E5) | + Third position | + Fifth position | Full range (G3–E7) | Full range + harmonics |
| **Bowing** | Détaché (separate bows) | + Legato (slurs of 2–4 notes) | + Staccato, martelé | + Spiccato, sautillé, col legno | All bowings + ricochet, flying staccato |
| **Vibrato** | None | None | Basic wrist vibrato | Controlled arm/wrist vibrato (variable speed/width) | Artistic vibrato matching emotional context |
| **Double stops** | None | None | Simple 3rds and 6ths | 3rds, 6ths, octaves, 10ths | Any interval, triple/quadruple stops |
| **Shifting** | None (first position) | Shifts to 3rd position | Smooth shifts through positions | Rapid position changes | All positions fluently |
| **Ornaments** | None | Simple grace notes | Trills, turns | Slides (Meend), Gamak, portamento | Full Indian + Western ornament palette |
| **Rhythmic density** | Whole, half notes | Quarter notes | Eighth notes | Sixteenth notes, triplets | All subdivisions |
| **Yield behavior** | Sustained drone on open strings (G, D) | Long tones on chord roots | Pad voicing (sustained chord tones) | Active counter-melodies during rests | Obbligato, improvised fills, featured solos |
| **Expression (CC 11)** | Fixed mf | Crescendo/decrescendo (p–f) | Dynamic swells on sustained notes | Full dynamic range with phrase shaping | Micro-dynamics, delayed vibrato onset |
| **Polyphony** | 1 | 1 | 2 (double stop) | 2 | 3–4 (chords, brief) |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Sustain open-string drone (Sa/Pa); provide a warm sonic bed beneath the melody without movement |
| 🌿 | Long tones on chord roots, changing with the harmonic progression; gentle bow changes at phrase boundaries |
| 🌸 | Harmonic pad: sustained guide tones (3rds, 7ths) beneath the melody; simple counter-melodies during rests; wrist vibrato for warmth |
| 🌺 | Active accompaniment: expressive swells supporting kirtan dynamics; Meend slides between notes for Indian vocal quality; double-stop harmonies |
| 🪷 | Featured devotional voice: improvised Raga-based counter-melodies; dynamic dialogue with the singer; virtuosic ornaments (Gamak, Taans); emotional arc-shaping for extended kirtan |

---

## 7. 🪘 Tabla

> **Role in Bhajan:** Primary rhythmic accompaniment in North Indian devotional music; taal framework; rhythmic embellishment.
> **MIDI Channel:** 10 (Percussion) — Dayan strokes mapped to treble conga, Bayan strokes mapped to bass drums.

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Bol vocabulary** | Dha, Dhin, Na, Tin (4 bols) | + Ka, Ge, Ti, Tun (8 bols) | + Tete, Dhere, complex composites | Full bol vocabulary | All + Gharana-specific bols |
| **Taal repertoire** | Keherwa (8 beats) | + Dadra (6 beats) | + Teentaal (16 beats), Rupak (7 beats) | + Jhaptaal (10), Ektaal (12), Ada Chautaal | All taals including rare/asymmetric |
| **Theka (basic pattern)** | Simple, steady at slow tempo | Clear theka at moderate tempo | Theka with variations | Theka + prakar (embellished variations) | Artistic theka interpretation |
| **Speed (Laya)** | Vilambit (slow) only | Vilambit + Madhya (medium) | + Drut (fast) | Double-speed (Dugun), Quadruple (Chaugun) | All laykari + free tempo |
| **Compositions** | None | Basic Kayda (theme) | Kayda + Rela, simple Tukra | + Paran, Chakradar | All forms + improvised |
| **Tihai** | None | None | Simple 3-repeat cadence | Complex tihai at phrase endings | Chakradar tihai, cross-taal tihai |
| **Accompaniment skill** | Following a steady beat | Maintaining basic theka under singing | Responsive sangat (accompaniment) | Dynamic sangat with fills/tihais | Conversational accompaniment, spontaneous interplay |
| **Dynamic control** | Fixed volume | p–f (basic) | Full dynamic range | Micro-dynamics per bol | Velocity shaping, timbral nuance |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Steady Keherwa theka at slow tempo: `Dha Ge Na Ti Na Ka Dhi Na`; heartbeat pulse for group chanting |
| 🌿 | Clear theka in Keherwa or Dadra; follows the singer's tempo; gentle emphasis on Sam (beat 1) |
| 🌸 | Tasteful variations within the theka; subtle fills at phrase endings; responsive to the kirtan's energy without overpowering |
| 🌺 | Dynamic sangat: laggi patterns building energy; tihais landing precisely on Sam; tempo acceleration (from Vilambit to Drut) during climactic moments |
| 🪷 | Masterful accompaniment: conversational interplay with the singer; complex laykari variations; Gharana-specific artistry; seamless transitions between taals during extended kirtan |

---

## 8. 🪕 Tanpura (Tambura)

> **Role in Bhajan:** Continuous harmonic drone; tonal reference; meditative foundation.
> **MIDI Program:** Simulated via sustained synth pad or dedicated Tanpura sample.

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Tuning accuracy** | Electronic tuner required | Tuner + ear verification | Ear tuning with reference | Ear tuning without reference | Perfect pitch tuning with Jeeva optimization |
| **String pattern** | Irregular plucking | Steady cyclic plucking (4-string cycle) | Consistent tempo, even attack | Seamless "cloud of sound" | Invisible, organic drone merging with room |
| **Jeeva thread adjustment** | None (factory setting) | Basic thread awareness | Adjust for clean overtones | Optimize buzz/resonance per Raga | Artistic Jeeva tuning for mood (Rasa) shaping |
| **Tuning variants** | Pa-Sa-Sa-Sa only | + Ma tuning for Ragas omitting Pa | + Ni tuning | Context-aware tuning selection | Real-time micro-tuning adjustments |
| **Dynamic control** | Fixed volume | Subtle volume consistency | Attack shaping for blend | Dynamic plucking matching ensemble | Micro-dynamics supporting Raga mood shifts |
| **Endurance** | 5 minutes | 15 minutes | 30 minutes | 1 hour | Full concert (2+ hours) |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Maintain a basic drone: pluck the 4 strings in steady succession; use electronic tuner to stay in pitch |
| 🌿 | Steady, rhythmic drone supporting the singer's Sa; smooth transitions between plucks without gaps |
| 🌸 | Seamless "cloud" of sound: the drone becomes continuous and ambient; slight dynamic matching with the bhajan's energy |
| 🌺 | Context-aware tuning: adjust for specific Raga/bhajan requirements; optimize Jeeva for warm overtones; sustain through extended sessions |
| 🪷 | Sacred presence: the tanpura becomes an invisible harmonic canvas; micro-tuning for emotional resonance; the drone breathes with the devotional mood of the space |

---

## 9. 🪘 Dholak

> **Role in Bhajan:** Folk rhythmic accompaniment; energetic devotional pulse; bhajan/kirtan heartbeat.
> **MIDI Channel:** 10 (Percussion) — mapped to hand drum samples.

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Stroke vocabulary** | Dha, Na (2 basic strokes) | + Dhin, Tin, Ka (5 strokes) | Full stroke palette + thapki | All strokes + muted, rim shots | Full + rolls, flams, intricate finger work |
| **Hand coordination** | Dominant hand only | Both hands, simple alternation | Independent hand patterns | Complex interlocking patterns | Full independence, polyrhythmic |
| **Taal repertoire** | Keherwa (8 beats) | + Dadra (6 beats) | + Bhajani Taal, Rupak | + Teentaal, Jhaptaal | All taals, folk variations |
| **Pattern complexity** | Half-note pulse | Quarter-note theka | Eighth-note grooves with fills | Syncopated patterns, rolls | Improvised solos, tihai |
| **Fill capability** | None | None | Simple 2-beat fills | 4-beat fills at phrase endings | Extended fills, call-response |
| **Tempo range** | ♩ = 60–80 | ♩ = 70–100 | ♩ = 80–120 | ♩ = 90–160 | ♩ = 60–200 |
| **Dynamic range** | mp–mf | p–f | pp–ff | Full spectrum | Micro-dynamics |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Simple pulse: Dha on beat 1, Na on beat 3; gentle heartbeat for satsang chanting |
| 🌿 | Basic Keherwa or Dadra theka; steady tempo support for group bhajan singing |
| 🌸 | Energetic folk groove: full stroke palette creating a vibrant Bhajani Taal; fills at phrase endings; dynamic sensitivity to the singer |
| 🌺 | Drive the kirtan: syncopated patterns building excitement; rolls and fills punctuating climactic moments; tempo acceleration support |
| 🪷 | Masterful folk accompaniment: improvised variations weaving through the bhajan; complex tihais; seamless transitions; dynamic leadership in group kirtan |

---

## 10. 🎸 Bass Guitar (Electric / Acoustic)

> **Role in Bhajan:** Low-frequency foundation; root movement; harmonic anchor for larger ensembles.
> **MIDI Program:** 33 (Fingered Bass) / 34 (Picked Bass)

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Fret range** | Open position (0–3) | 0–5 | 0–9 | 0–12 | Full fretboard |
| **Technique** | Plucking root notes | Alternating index-middle | Slap/pop basics | Slap/pop, harmonics, muting | Tapping, chording, full vocabulary |
| **Note choices** | Root only | Root + fifth | Root + fifth + octave | Walking bass, approach tones | Melodic bass, improvised lines |
| **Rhythmic density** | Whole notes | Half notes | Quarter notes, basic patterns | Eighth notes, syncopation | All subdivisions, polyrhythm |
| **Chord support** | Single notes | Power intervals (root-fifth) | Root-fifth-octave patterns | Chord tones on strong beats | Full harmonic support |
| **LIL awareness** | None (play roots only) | Avoid 3rds below E2 | Full LIL enforcement | — (internalized) | — |
| **Sync behavior** | Beat 1 only | Beats 1 and 3 | Sync with djembe/tabla bass | Interlock with drum pattern | Independent groove creation |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Whole-note root on beat 1; simple anchor for the chord progression |
| 🌿 | Root on beat 1, fifth on beat 3; simple two-note support pattern |
| 🌸 | Quarter-note bass line: root-fifth-octave-fifth pattern; walking motion at chord changes |
| 🌺 | Melodic bass: approach tones connecting chord roots; syncopated patterns adding groove; interlock with tabla/djembe |
| 🪷 | Featured bass: improvised melodic lines during interludes; slap-pop accents at climactic moments; dynamic foundation driving the entire ensemble |

---

## 11. 🪕 Sitar

> **Role in Bhajan:** Melodic lead or counter-melody; Raga expression; devotional ornamentation; string resonance.
> **MIDI Program:** 104 (Sitar) or close substitute.

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Fret range** | Lower 5 frets (main string) | 7 frets | Full main string range | + chikari strings | Full: main + chikari + sympathetic |
| **Meend (pitch bend)** | None | Simple 1-note pull | Smooth multi-fret Meend | Complex, expressive Meend | Meend as primary expression tool |
| **Ornaments** | None | Kan (grace notes) | + Krintan (pull-off ornament) | + Zamzama, Gamak | Full ornament vocabulary |
| **Rhythmic technique** | Downstroke only (Da) | Da + Ra (down-up) | Jhala (rapid repeated strokes) | Complex rhythmic patterns | Full laykari, Jod-Jhala |
| **Raga knowledge** | Pentatonic melodies | Simple Ragas (Bhairavi, Yaman) | Standard Raga repertoire | Advanced Ragas, combinations | Complete Raga mastery |
| **Alap/Jod/Jhala/Gat** | Simple melody only | Alap (slow exposition) | + Jod (rhythmic pulse) | + Jhala (fast climax) | Full Raga exposition (Alap-Jod-Jhala-Gat) |
| **Sympathetic strings** | Not used | Tuned but passive | Awareness of resonance | Active sympathetic use | Sympathetic strings as compositional tool |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Play the bhajan melody on the main string using simple fret positions; no ornaments |
| 🌿 | Melody with basic Kan Swar (grace notes) at phrase endings; simple Da-Ra picking pattern |
| 🌸 | Devotional Meend connecting phrases; chikari strokes providing rhythmic pulse; Raga-aware phrasing |
| 🌺 | Expressive devotional playing: deep Meend glides, Gamak vibrato, Jhala during instrumental sections; the sitar sings the bhajan |
| 🪷 | Complete Raga exposition: Alap opening setting the devotional mood; Jod building momentum; Jhala at climactic kirtan moments; masterful interplay with tabla and singer |

---

## 12. 🎤 Voice (Vocal)

> **Role in Bhajan:** Primary melody carrier; lyric delivery; devotional expression; call-and-response leader.
> **MIDI Program:** N/A (reference for melody and arrangement constraints).

### Constraints by Level

| Aspect | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------ | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Range** | 1 octave (comfortable Saptak) | 1.5 octaves | 2 octaves (Mandra to Tar Saptak) | 2.5 octaves | 3+ octaves |
| **Pitch accuracy** | Approximate | On-pitch with reference (tanpura/harmonium) | Accurate without constant reference | Micro-tonal awareness | Perfect intonation, Shruti-level precision |
| **Ornaments** | None (plain melody) | Simple Kan Swar (grace notes) | Meend (glides), basic Murki | Khatka, complex Murki, Gamak | Taan, Sargam patterns, Bol-taan |
| **Breath control** | Phrase every 2 measures | Phrase every 3 measures | Phrase every 4 measures | Extended phrases (6+ measures) | Artistic breath management, no audible breaks |
| **Rhythm (Laya)** | Steady, fixed tempo | Slight variation awareness | Rhythmic accuracy within taal | Laykari (rhythmic play within taal) | Complex laykari, cross-rhythmic phrasing |
| **Call-response** | Simple repeat | Echo with slight variation | Melodic variation in response | Improvised responses within Raga | Free improvisation with full Raga exploration |
| **Expression** | Monotone dynamics | p–f range | Full dynamic range with phrase shaping | Emotional arc across entire bhajan | Rasa (emotional essence) mastery; listeners moved |
| **Raga knowledge** | — | Awareness of key/scale | Basic Raga identification | Raga adherence in improvisation | Raga creation, modulation, exploration |

### Bhajan Application

| Level | Devotional Context |
| ----- | ------------------ |
| 🌱 | Sing the Sthayi melody clearly and in tune; focus on correct lyrics and steady rhythm |
| 🌿 | Add simple ornaments at phrase endings; vary volume between verse and chorus; basic call-response with group |
| 🌸 | Expressive devotional singing: Meend connecting notes, dynamic phrasing matching the bhajan's emotional arc; lead group kirtan confidently |
| 🌺 | Masterful kirtan leader: improvised variations of the Sthayi/Antara; Taan runs between phrases; build and release emotional intensity across the session |
| 🪷 | Sacred vocal presence: Raga-based improvisation creating a transcendent experience; seamless flow between structured bhajan and free devotional expression; the voice becomes a vehicle for divine connection |

---

## Cross-Instrument Ensemble Level Matrix

When generating ensemble arrangements, all instruments should ideally be at compatible levels. This matrix shows recommended ensemble combinations:

| Ensemble Size | 🌱 Foundation | 🌿 Elementary | 🌸 Intermediate | 🌺 Advanced | 🪷 Virtuoso |
| ------------- | ------------- | ------------- | --------------- | ----------- | ----------- |
| **Solo** | Voice + Tanpura | Voice + Harmonium | Any instrument solo | Sitar/Voice + Tabla | Full Raga presentation |
| **Duo** | Voice + Harmonium | Voice + Guitar | Voice + Piano/Harmonium + Tabla | Voice + Sitar + Tabla | Any combination |
| **Small Ensemble** | Voice + Harmonium + Tanpura | + Dholak | + Flute or Violin | + Guitar + Djembe | Full chamber ensemble |
| **Full Ensemble** | — | Voice + Harmonium + Dholak + Tanpura | + Flute + Violin + Guitar | All instruments | Orchestral bhajan arrangement |

### Level Compatibility Rule

> **⚠️ IMPORTANT:** When arranging for ensemble, the **rhythmic instruments** (Tabla, Djembe, Dholak) should be at the **same level or one level below** the melodic instruments to avoid rhythmic complexity overwhelming melodic expression. The **drone instrument** (Tanpura) can be at any level without conflict.

---

## Algorithmic Generation Rules

When using these skill levels in the arrangement engine:

### Rule 1: Technique Gating

```
IF instrument.skillLevel < technique.requiredLevel THEN
  DO NOT generate that technique
  SUBSTITUTE with the highest available technique at the current level
```

### Rule 2: Density Scaling

| Level | Max notes per beat (melodic) | Max simultaneous (harmonic) | Max subdivision |
| ----- | ---------------------------- | --------------------------- | --------------- |
| 🌱 | 1 | 1–3 | Half notes |
| 🌿 | 1 | 2–4 | Quarter notes |
| 🌸 | 2 | 3–5 | Eighth notes |
| 🌺 | 4 | 4–6 | Sixteenth notes |
| 🪷 | 8 | 6–10 | Any |

### Rule 3: Register Enforcement

```
Each instrument MUST stay within its level-specific register constraint.
IF generated note falls outside the level's range THEN
  Transpose to nearest octave within range
  OR substitute with a rest if no valid transposition exists
```

### Rule 4: Physical Validation Escalation

| Level | Validation strictness |
| ----- | --------------------- |
| 🌱 | Maximum strictness — reject anything beyond basic comfort zone |
| 🌿 | High strictness — small stretches allowed, no complex shapes |
| 🌸 | Standard — normal physical constraints for competent players |
| 🌺 | Relaxed — advanced players can handle challenging passages |
| 🪷 | Minimal — only reject physically impossible configurations |

### Rule 5: Bhajan Structure Awareness

All arrangements must respect the Bhajan form:

```
Sthayi (Main Refrain) → Antara (Verse) → [Sanchari (Development)] → Abhog (Conclusion → Sthayi)
```

- **Foundation–Elementary levels:** Stay close to the original melody; minimal variation
- **Intermediate:** Add tasteful ornaments at phrase boundaries
- **Advanced–Virtuoso:** Improvise within Raga framework; create variations that enhance devotion

---

## Quick Reference: Common Bhajan Keys and Instrument Tuning

| Key | Western | Indian (Sargam) | Harmonium Setup | Guitar Capo | Tanpura Tuning |
| --- | ------- | --------------- | --------------- | ----------- | -------------- |
| C | C Major | Sa = C | Standard, white keys | No capo | Pa-Sa-Sa-Sa (G-C-C-C) |
| D | D Major | Sa = D | 2 sharps (F#, C#) | Capo 2 | A-D-D-D |
| E | E Major | Sa = E | 4 sharps | Open (standard tuning) | B-E-E-E |
| G | G Major | Sa = G | 1 sharp (F#) | Capo 3 | D-G-G-G |
| A | A Major | Sa = A | 3 sharps | Capo 5 / Open | E-A-A-A |
| Am | A Minor | Sa = A (Natural Minor) | White keys from A | No capo | E-A-A-A |
| Em | E Minor | Sa = E (Natural Minor) | 1 sharp | Open position | B-E-E-E |

---

## Validation Checklist for Level-Aware Arrangements

Before outputting any arrangement with a specified skill level:

| Check | Rule |
| ----- | ---- |
| ✅ **Technique whitelist** | Only techniques permitted at the specified level are used |
| ✅ **Register constraint** | All notes fall within the level's comfortable range |
| ✅ **Rhythmic density** | Subdivisions do not exceed the level's maximum |
| ✅ **Voicing density** | Simultaneous notes do not exceed the level's capacity |
| ✅ **Physical demands** | Spans, speeds, and endurance are within the level's limits |
| ✅ **Ensemble compatibility** | All instruments' levels are compatible (see Cross-Instrument Matrix) |
| ✅ **Bhajan structure** | Arrangement respects Sthayi/Antara/Sanchari/Abhog form |
| ✅ **Beat count** | All voices match the time signature |
| ✅ **Yield logic** | Supporting instruments yield to the primary melody at their level's rules |
| ✅ **Devotional appropriateness** | Complexity serves devotion, not showmanship |
