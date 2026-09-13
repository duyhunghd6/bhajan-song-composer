# Domain Context

- **Source Melody** — the Composer’s editable ABC root. It is browser-local until a user explicitly publishes the `melody` notation layer.
- **Validated Harmony** — the selected `voice-leading-validation` result from Harmony Step 3. It is the only harmonic source that can feed downstream branches.
- **Accompaniment branch** — the Guitar Classic, Harmonium, and Djembe support workflow derived from Validated Harmony.
- **Singer-accompaniment decision model** — three independent controls over Validated Harmony: beat/subdivision-precise chord windows, meter-compatible comping profile (`điệu đệm`), and a register/voice-leading/playability-aware voicing plan. The canonical contract is `docs/guides/singer-accompaniment-decision-model.md`.
- **Guitar Fingerstyle branch** — the independent, TimeGrid-backed solo guitar artifact derived from Validated Harmony. It never consumes Accompaniment output.
- **Composer draft** — browser-local workspace, melody, Fingerstyle measures, and diagnostics. It is recoverable working state, not public content.
- **Published notation layer** — a selected validated ABC artifact stored as `data/songs/<language>/<slug>.<type>.abc` and declared in song `abcNotations` metadata.
- **Export** — the `/compose/:slug/review` step that lets the user select and publish notation layers without implicitly replacing other layers.
- **Practice (Showcase)** — `/practice/:slug`, the only Showcase experience. It reads published catalogue notation and never overlays a Composer draft.
- **Mockup / POC gate** — standalone pages under `/mockups` that demonstrate an arrangement engine with sample data and a handoff checklist before it may be integrated into the Composer; the piano and ensemble engines currently live only there.
- **Ensemble** — currently experimental theory/mockup work. It is not an active Composer route, persisted product branch, preview contributor, or exportable layer.
- **Fill** — a discretionary Guitar Fingerstyle note placed only inside a legal source-rest window; fills never attack or sustain during a Melody attack or sustain, and their budget is governed by the independent fill-density setting.
- **TimeGrid** — the meter-aware `TimeSliceMeasure[]` document (four steps per notated beat) that is the only editable authority for a Guitar Fingerstyle arrangement; Guitar ABC and ASCII tab are its projections.
- **Universal ID (Beads ID)** — the `br-*` identifier in the single-line HTML comment under every `docs/` heading, used for PRD → PLAN → trace linkage; allocations live in `docs/universal-id-registry.md`.

The directed flow between these terms is specified in [docs/guides/composer-source-flow.md](docs/guides/composer-source-flow.md).
