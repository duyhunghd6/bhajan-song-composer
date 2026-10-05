# Project Verify Skill

Use this when verifying runtime behavior in the bhajan-song-composer app.

## App launch

- The app runs with `npm run dev` on port `9974`.
- If `npm run dev` fails with `EADDRINUSE`, check `http://localhost:9974`; an existing dev server may already be running and can be used for verification.
- Dynamic compose routes are constrained by `generateStaticParams()` because the project uses static export. Use `/compose/new-bhajan-arrangement/<step>` for a guaranteed generated composer route.

## Browser verification

Use Playwright against the running dev server:

```bash
node - <<'NODE'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto('http://localhost:9974/compose/new-bhajan-arrangement/accompaniment', { waitUntil: 'networkidle' });
  // Drive the visible UI with locators and capture body text/screenshots.
  await browser.close();
})();
NODE
```

## Accompaniment workflow checks

For the human-in-the-loop accompaniment workflow:

1. Open `/compose/new-bhajan-arrangement/accompaniment`.
2. Start the workflow.
3. Confirm the cards match the setup-derived instrument plan: three shared steps first, then only the enabled instrument branches. The Guitar branch must contain `Guitar Profile` and `Guitar Voicing` only.
4. Add a user note and open `Default prompt preview`; confirm the prompt includes default rules, metadata, source ABC, and the user note.
5. Click `Generate / Regenerate Options`; LLM calls can take 60–90s.
6. Select a generated option; confirm the current card shows selected and the next enabled card unlocks.
7. Reload; confirm the stored run and selection persist through localStorage. A version-3 session whose current step was `guitar-fills-validation` must restore on a valid remaining step.

## Known gotchas

- `npm run build` compiles TypeScript but fails page-data collection with `Server Actions are not supported with static export`; this is a project configuration limitation when Server Actions are present.
- `npm run lint` may show a pre-existing warning in `src/app/mockups/arrangement-pipeline/page.tsx` about a missing `useMemo` dependency.
