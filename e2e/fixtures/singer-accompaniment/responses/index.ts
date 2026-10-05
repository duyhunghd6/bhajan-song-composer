import type {
  DualCandidatePackWireResponse,
  LlmWireResponse,
  ProviderErrorResponse,
} from "@/lib/theory/singer-accompaniment-contracts";

import guitarValidPackJson from "./guitar-valid-pack.json";
import pianoValidPackJson from "./piano-valid-pack.json";
import dualValidPackJson from "./dual-valid-pack.json";
import oneOptionInvalidJson from "./one-option-invalid.json";
import repairGuitarPhysicsJson from "./repair-guitar-physics.json";
import repairPianoSpanJson from "./repair-piano-span.json";
import softExceptionJson from "./soft-exception.json";
import malformedToolJsonJson from "./malformed-tool-json.json";
import providerTimeoutJson from "./provider-timeout.json";
import promptInjectionTextJson from "./prompt-injection-text.json";
import exhaustedRepairJson from "./exhausted-repair.json";

export const guitarValidPack = guitarValidPackJson as unknown as LlmWireResponse;
export const pianoValidPack = pianoValidPackJson as unknown as LlmWireResponse;
export const dualValidPack = dualValidPackJson as unknown as DualCandidatePackWireResponse;
export const oneOptionInvalid = oneOptionInvalidJson as unknown as LlmWireResponse;
export const repairGuitarPhysics = repairGuitarPhysicsJson as unknown as LlmWireResponse;
export const repairPianoSpan = repairPianoSpanJson as unknown as LlmWireResponse;
export const softException = softExceptionJson as unknown as LlmWireResponse;
export const malformedToolJson = malformedToolJsonJson as unknown as LlmWireResponse;
export const providerTimeout = providerTimeoutJson as unknown as ProviderErrorResponse;
export const promptInjectionText = promptInjectionTextJson as unknown as LlmWireResponse;
export const exhaustedRepair = exhaustedRepairJson as unknown as LlmWireResponse;

export const DUMMY_RESPONSES = {
  "guitar-valid-pack": guitarValidPack,
  "piano-valid-pack": pianoValidPack,
  "dual-valid-pack": dualValidPack,
  "one-option-invalid": oneOptionInvalid,
  "repair-guitar-physics": repairGuitarPhysics,
  "repair-piano-span": repairPianoSpan,
  "soft-exception": softException,
  "malformed-tool-json": malformedToolJson,
  "provider-timeout": providerTimeout,
  "prompt-injection-text": promptInjectionText,
  "exhausted-repair": exhaustedRepair,
} as const;
