import { z } from "zod";

/**
 * Singer-Accompaniment Domain Contracts and Schemas
 * Governs canonical ApprovedHarmonySnapshot fixtures, LLM arrangement candidate packs,
 * and Playwright interception boundaries as specified in:
 * docs/qa/e2e-qa-plan-singer-accompaniment.md (§2, §3, §9.1).
 */

export const METER_FAMILIES = ["3/4", "4/4", "6/8", "12/8"] as const;
export type MeterFamily = (typeof METER_FAMILIES)[number];

export const TARGET_INSTRUMENTS = ["guitar-classic", "piano"] as const;
export type TargetInstrument = (typeof TARGET_INSTRUMENTS)[number];

export const CADENCE_TYPES = ["half", "authentic", "plagal", "deceptive", "phrase-ending"] as const;
export type CadenceType = (typeof CADENCE_TYPES)[number];

export const REGISTER_LEVELS = ["low", "middle", "high"] as const;
export type RegisterLevel = (typeof REGISTER_LEVELS)[number];

export const ChordWindowSchema = z.object({
  measureIndex: z.number().int().positive(),
  startBeat: z.number().positive(),
  endBeat: z.number().positive(),
  startSubdivision: z.number().int().positive().optional(),
  endSubdivision: z.number().int().positive().optional(),
  chord: z.string().min(1),
  root: z.string().optional(),
  quality: z.string().optional(),
});
export type ChordWindow = z.infer<typeof ChordWindowSchema>;

export const PhraseCadenceBoundarySchema = z.object({
  phraseIndex: z.number().int().positive(),
  startMeasure: z.number().int().positive(),
  endMeasure: z.number().int().positive(),
  cadenceMeasure: z.number().int().positive(),
  cadenceBeat: z.number().positive(),
  cadenceType: z.enum(CADENCE_TYPES),
  targetChord: z.string().optional(),
});
export type PhraseCadenceBoundary = z.infer<typeof PhraseCadenceBoundarySchema>;

export const MelodyActivityGapSchema = z.object({
  measureIndex: z.number().int().positive(),
  startBeat: z.number().positive(),
  endBeat: z.number().positive(),
  durationBeats: z.number().positive(),
  safeForFill: z.boolean(),
  resumedBy: z.string().nullable().optional(),
});
export type MelodyActivityGap = z.infer<typeof MelodyActivityGapSchema>;

export const MelodyActivitySchema = z.object({
  continuousLyric: z.boolean(),
  activeOnsetsCount: z.number().int().nonnegative(),
  gaps: z.array(MelodyActivityGapSchema),
});
export type MelodyActivity = z.infer<typeof MelodyActivitySchema>;

export const MelodyRegisterRangeSchema = z.object({
  measureIndex: z.number().int().positive(),
  lowestPitch: z.string(),
  highestPitch: z.string(),
  lowestMidi: z.number().int(),
  highestMidi: z.number().int(),
  register: z.enum(REGISTER_LEVELS),
});
export type MelodyRegisterRange = z.infer<typeof MelodyRegisterRangeSchema>;

export const ApprovedHarmonySnapshotSchema = z.object({
  id: z.string().min(1),
  step3OptionId: z.string().optional(),
  sourceAbc: z.string().min(1),
  sourceFingerprint: z.string().min(1),
  meter: z.string().min(1),
  meterFamily: z.enum(METER_FAMILIES),
  tempo: z.number().positive(),
  key: z.string().min(1),
  scale: z.string().optional(),
  measureCount: z.number().int().positive(),
  chordWindows: z.array(ChordWindowSchema).min(1),
  melodyActivity: MelodyActivitySchema,
  phrases: z.array(PhraseCadenceBoundarySchema).min(1),
  registerMap: z.array(MelodyRegisterRangeSchema).min(1),
});
export type ApprovedHarmonySnapshot = z.infer<typeof ApprovedHarmonySnapshotSchema>;

export const TwoStep3SnapshotsSchema = z.object({
  id: z.string().min(1),
  sourceAbc: z.string().min(1),
  snapshotA: ApprovedHarmonySnapshotSchema,
  snapshotB: ApprovedHarmonySnapshotSchema,
});
export type TwoStep3Snapshots = z.infer<typeof TwoStep3SnapshotsSchema>;

export const InvalidSourceFixtureSchema = z.object({
  id: z.string().min(1),
  sourceAbc: z.string().min(1),
  expectedError: z.enum(["syntax-error", "meter-error"]),
  description: z.string().min(1),
});
export type InvalidSourceFixture = z.infer<typeof InvalidSourceFixtureSchema>;

export const DeclaredSoftRuleTradeOffSchema = z.object({
  rule: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(["review", "allowed", "exception"]).default("review"),
});
export type DeclaredSoftRuleTradeOff = z.infer<typeof DeclaredSoftRuleTradeOffSchema>;

export const RepairScopeSchema = z.object({
  measures: z.array(z.number().int().positive()),
  flaggedRule: z.string().min(1),
  diagnosticMessage: z.string().optional(),
});
export type RepairScope = z.infer<typeof RepairScopeSchema>;

/**
 * ArrangementCandidateOption: Represents one arrangement proposal from the LLM.
 * Must NOT contain authoritative state fields (valid, sourceFingerprint, published).
 */
export const ArrangementCandidateOptionSchema = z
  .object({
    optionId: z.string().min(1),
    targetInstrument: z.enum(TARGET_INSTRUMENTS),
    label: z.string().min(1),
    rationale: z.string().min(1),
    diversityLabel: z.string().min(1),
    decisionMap: z.array(z.record(z.string(), z.unknown())).min(1),
    abc: z.string().min(1),
    eventHints: z.record(z.string(), z.unknown()).optional(),
    declaredSoftRuleTradeOffs: z.array(DeclaredSoftRuleTradeOffSchema).optional(),
    parentOptionId: z.string().optional(),
    repairScope: RepairScopeSchema.optional(),
    repairAttempts: z.number().int().nonnegative().optional(),
  })
  .passthrough()
  .refine(
    (opt) =>
      !("valid" in opt) &&
      !("sourceFingerprint" in opt) &&
      !("publicationState" in opt) &&
      !("published" in opt) &&
      !("publishEligibility" in opt),
    {
      message:
        "Arrangement candidate must not return authority fields (valid, sourceFingerprint, publicationState, published, publishEligibility).",
    }
  );
export type ArrangementCandidateOption = z.infer<typeof ArrangementCandidateOptionSchema>;

export const ArrangementCandidatePackSchema = z.object({
  packId: z.string().min(1),
  targetInstrument: z.enum(TARGET_INSTRUMENTS),
  candidateCount: z.number().int().positive(),
  options: z.array(ArrangementCandidateOptionSchema).min(1).max(5),
});
export type ArrangementCandidatePack = z.infer<typeof ArrangementCandidatePackSchema>;

export const LlmToolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string().min(1),
  }),
});
export type LlmToolCall = z.infer<typeof LlmToolCallSchema>;

export const LlmWireChoiceSchema = z.object({
  index: z.number().optional(),
  message: z.object({
    role: z.string().optional(),
    content: z.string().nullable().optional(),
    tool_calls: z.array(LlmToolCallSchema).min(1),
  }),
  finish_reason: z.string().optional(),
});
export type LlmWireChoice = z.infer<typeof LlmWireChoiceSchema>;

export const LlmWireResponseSchema = z.object({
  id: z.string().min(1),
  object: z.string().optional(),
  created: z.number().optional(),
  model: z.string().optional(),
  choices: z.array(LlmWireChoiceSchema).min(1),
});
export type LlmWireResponse = z.infer<typeof LlmWireResponseSchema>;

export const DualCandidatePackWireResponseSchema = z.object({
  guitar: LlmWireResponseSchema,
  piano: LlmWireResponseSchema,
});
export type DualCandidatePackWireResponse = z.infer<typeof DualCandidatePackWireResponseSchema>;

export const ProviderErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    status: z.number().int(),
    retryable: z.boolean().optional(),
  }),
});
export type ProviderErrorResponse = z.infer<typeof ProviderErrorResponseSchema>;

export const ScenarioExpectedDiagnosticSchema = z.object({
  measure: z.number().int().optional(),
  beat: z.number().optional(),
  rule: z.string().optional(),
  severity: z.enum(["error", "warning", "review", "info"]).optional(),
  message: z.string().optional(),
});
export type ScenarioExpectedDiagnostic = z.infer<typeof ScenarioExpectedDiagnosticSchema>;

export const ScenarioOutcomeStatusSchema = z.enum([
  "valid",
  "validation-failed",
  "error",
  "review",
  "stale",
  "timeout",
  "blocked-upstream",
]);
export type ScenarioOutcomeStatus = z.infer<typeof ScenarioOutcomeStatusSchema>;

export const ScenarioManifestEntrySchema = z.object({
  scenario: z.string().min(1),
  description: z.string().min(1),
  sourceSnapshotId: z.string().min(1),
  responseFixture: z.string().nullable(),
  targetInstrument: z.enum([...TARGET_INSTRUMENTS, "both", "none"]),
  expectedOutcome: z.object({
    status: ScenarioOutcomeStatusSchema,
    summary: z.string().min(1),
    applyAllowed: z.boolean(),
    publishAllowed: z.boolean(),
    expectedDiagnostics: z.array(ScenarioExpectedDiagnosticSchema).optional(),
    diversityDimensionsCount: z.number().int().optional(),
  }),
});
export type ScenarioManifestEntry = z.infer<typeof ScenarioManifestEntrySchema>;
