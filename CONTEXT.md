# Domain Context

- **Source Melody** — the Composer’s editable ABC root. It is browser-local until a user explicitly publishes the `melody` notation layer.
- **Validated Harmony** — the selected `voice-leading-validation` result from Harmony Step 3. It is the only harmonic source that can feed downstream branches.
- **Accompaniment branch** — the Guitar Classic, Harmonium, and Djembe support workflow derived from Validated Harmony.
- **Guitar Fingerstyle branch** — the independent, TimeGrid-backed solo guitar artifact derived from Validated Harmony. It never consumes Accompaniment output.
- **Composer draft** — browser-local workspace, melody, Fingerstyle measures, and diagnostics. It is recoverable working state, not public content.
- **Published notation layer** — a selected validated ABC artifact stored as `data/songs/<language>/<slug>.<type>.abc` and declared in song `abcNotations` metadata.
- **Export** — the `/compose/:slug/review` step that lets the user select and publish notation layers without implicitly replacing other layers.
- **Practice (Showcase)** — `/practice/:slug`, the only Showcase experience. It reads published catalogue notation and never overlays a Composer draft.
- **Ensemble** — currently experimental theory/mockup work. It is not an active Composer route, persisted product branch, preview contributor, or exportable layer.
