import type { ScenarioManifestEntry } from "@/lib/theory/singer-accompaniment-contracts";

/**
 * Fixture Manifest for Singer-Accompaniment QA & E2E Testing
 * Defines the canonical mapping of:
 * Scenario -> Source Snapshot -> Dummy Response -> Expected Deterministic Outcome
 * as specified in docs/qa/e2e-qa-plan-singer-accompaniment.md (§3.1, §3.3).
 */
export const SCENARIO_MANIFEST: ScenarioManifestEntry[] = [
  {
    scenario: "guitar-valid-pack",
    description: "3 valid, distinct Guitar options for 4/4 gap source.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "guitar-valid-pack.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "valid",
      summary:
        "All options parse; at least two diversity dimensions across pack; Apply enabled only after explicit selection.",
      applyAllowed: true,
      publishAllowed: true,
      diversityDimensionsCount: 3,
    },
  },
  {
    scenario: "piano-valid-pack",
    description: "3 valid grand-staff Piano options for 4/4 gap source.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "piano-valid-pack.json",
    targetInstrument: "piano",
    expectedOutcome: {
      status: "valid",
      summary:
        "Hand-aware grand-staff artifact, pedal events and LH/RH independent controls available.",
      applyAllowed: true,
      publishAllowed: true,
      diversityDimensionsCount: 3,
    },
  },
  {
    scenario: "dual-valid-pack",
    description: "Independent Guitar and Piano packs for the same snapshot.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "dual-valid-pack.json",
    targetInstrument: "both",
    expectedOutcome: {
      status: "valid",
      summary:
        "Distinct event artifacts for Guitar and Piano; either branch can be applied and published independently.",
      applyAllowed: true,
      publishAllowed: true,
    },
  },
  {
    scenario: "one-option-invalid",
    description: "One ABC parse/timing failure plus two valid options.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "one-option-invalid.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "validation-failed",
      summary:
        "Failed card displays structured diagnostic; valid sibling cards remain selectable and usable.",
      applyAllowed: true,
      publishAllowed: false,
      expectedDiagnostics: [
        {
          measure: 2,
          rule: "abc-timing-duration",
          severity: "error",
          message: "Measure 2 exceeds 4/4 meter duration.",
        },
      ],
    },
  },
  {
    scenario: "repair-guitar-physics",
    description: "Original invalid at M3/B1 stretch reach; repaired candidate fixes only M3.",
    sourceSnapshotId: "guitar-stretch-fail",
    responseFixture: "repair-guitar-physics.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "valid",
      summary:
        "Source facts and passed measures remain byte-identical; parent lineage preserved; validation succeeds.",
      applyAllowed: true,
      publishAllowed: true,
    },
  },
  {
    scenario: "repair-piano-span",
    description: "Original collision and wide span; repaired candidate with shifted register.",
    sourceSnapshotId: "piano-span-collision-fail",
    responseFixture: "repair-piano-span.json",
    targetInstrument: "piano",
    expectedOutcome: {
      status: "valid",
      summary:
        "Diagnostic resolved or explicitly marked review; revalidation occurs cleanly.",
      applyAllowed: true,
      publishAllowed: true,
    },
  },
  {
    scenario: "soft-exception",
    description: "Sparse/sus/power voicing with explicit rationale.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "soft-exception.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "review",
      summary:
        "Review badge rendered for declared soft exception; not treated as a false hard failure.",
      applyAllowed: true,
      publishAllowed: false,
      expectedDiagnostics: [
        {
          rule: "third-retention",
          severity: "review",
          message:
            "Intentional suspended 4th and open fifth drone for meditative devotional mood",
        },
      ],
    },
  },
  {
    scenario: "malformed-tool-json",
    description: "Invalid JSON or unexpected tool name from LLM provider.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "malformed-tool-json.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "error",
      summary:
        "Controlled error reported; retry policy logged; no draft becomes valid or publishable.",
      applyAllowed: false,
      publishAllowed: false,
    },
  },
  {
    scenario: "provider-timeout",
    description: "Simulated 504 Gateway Timeout from upstream LLM provider.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "provider-timeout.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "timeout",
      summary:
        "Bounded retry attempts; usable existing draft retained; no fake fallback or auto-publish.",
      applyAllowed: false,
      publishAllowed: false,
    },
  },
  {
    scenario: "prompt-injection-text",
    description: "Rationale and ABC comments contain instruction-like prompt injection text.",
    sourceSnapshotId: "four-four-gap-c-major",
    responseFixture: "prompt-injection-text.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "valid",
      summary:
        "Treated strictly as displayed data; escaped/delimited; no altered tool calls or state modifications.",
      applyAllowed: true,
      publishAllowed: true,
    },
  },
  {
    scenario: "exhausted-repair",
    description: "All bounded repair rounds still fail physical validation.",
    sourceSnapshotId: "guitar-stretch-fail",
    responseFixture: "exhausted-repair.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "validation-failed",
      summary:
        "Diagnostics and prior passing options remain; draft is blocked; auto-publish never occurs.",
      applyAllowed: false,
      publishAllowed: false,
      expectedDiagnostics: [
        {
          measure: 3,
          rule: "guitar-physics-stretch",
          severity: "error",
          message: "Repair attempt 3 of 3 still contains unplayable fret stretch at M3/B1.",
        },
      ],
    },
  },
  {
    scenario: "invalid-meter-abc",
    description: "Under-filled and over-filled measures rejected at upstream gate.",
    sourceSnapshotId: "invalid-meter-abc",
    responseFixture: null,
    targetInstrument: "none",
    expectedOutcome: {
      status: "blocked-upstream",
      summary:
        "Upstream meter gate blocks generation, snapshot creation, apply, and publish.",
      applyAllowed: false,
      publishAllowed: false,
      expectedDiagnostics: [
        {
          measure: 1,
          rule: "meter-error",
          severity: "error",
          message: "Measure 1 contains 3 beats in declared 4/4 meter.",
        },
      ],
    },
  },
  {
    scenario: "invalid-abc",
    description: "Malformed ABC syntax error rejected at upstream parser gate.",
    sourceSnapshotId: "invalid-abc",
    responseFixture: null,
    targetInstrument: "none",
    expectedOutcome: {
      status: "blocked-upstream",
      summary:
        "Upstream parser gate blocks navigation; no Step 3 snapshot is possible.",
      applyAllowed: false,
      publishAllowed: false,
      expectedDiagnostics: [
        {
          rule: "syntax-error",
          severity: "error",
          message: "Malformed ABC syntax with invalid meter header.",
        },
      ],
    },
  },
  {
    scenario: "two-step3-snapshots",
    description: "Selecting Snapshot B invalidates downstream drafts based on Snapshot A.",
    sourceSnapshotId: "two-step3-snapshots",
    responseFixture: "guitar-valid-pack.json",
    targetInstrument: "guitar-classic",
    expectedOutcome: {
      status: "stale",
      summary:
        "Switching from Step 3 Snapshot A to B changes fingerprint, marks existing drafts stale, and blocks Apply/Publish.",
      applyAllowed: false,
      publishAllowed: false,
    },
  },
];

export function getScenarioManifestEntry(scenarioName: string): ScenarioManifestEntry | undefined {
  return SCENARIO_MANIFEST.find((entry) => entry.scenario === scenarioName);
}
