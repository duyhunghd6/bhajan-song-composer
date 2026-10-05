import type {
  ApprovedHarmonySnapshot,
  InvalidSourceFixture,
  TwoStep3Snapshots,
} from "@/lib/theory/singer-accompaniment-contracts";

import fourFourGapCMajorJson from "./four-four-gap-c-major.json";
import sixEightDevotionalAMinorJson from "./six-eight-devotional-a-minor.json";
import splitWindowFourFourJson from "./split-window-four-four.json";
import highMelodyRegisterJson from "./high-melody-register.json";
import noSafeGapJson from "./no-safe-gap.json";
import guitarStretchFailJson from "./guitar-stretch-fail.json";
import pianoSpanCollisionFailJson from "./piano-span-collision-fail.json";
import invalidMeterAbcJson from "./invalid-meter-abc.json";
import invalidAbcJson from "./invalid-abc.json";
import twoStep3SnapshotsJson from "./two-step3-snapshots.json";

export const fourFourGapCMajor = fourFourGapCMajorJson as unknown as ApprovedHarmonySnapshot;
export const sixEightDevotionalAMinor = sixEightDevotionalAMinorJson as unknown as ApprovedHarmonySnapshot;
export const splitWindowFourFour = splitWindowFourFourJson as unknown as ApprovedHarmonySnapshot;
export const highMelodyRegister = highMelodyRegisterJson as unknown as ApprovedHarmonySnapshot;
export const noSafeGap = noSafeGapJson as unknown as ApprovedHarmonySnapshot;
export const guitarStretchFail = guitarStretchFailJson as unknown as ApprovedHarmonySnapshot;
export const pianoSpanCollisionFail = pianoSpanCollisionFailJson as unknown as ApprovedHarmonySnapshot;

export const invalidMeterAbc = invalidMeterAbcJson as unknown as InvalidSourceFixture;
export const invalidAbc = invalidAbcJson as unknown as InvalidSourceFixture;
export const twoStep3Snapshots = twoStep3SnapshotsJson as unknown as TwoStep3Snapshots;

export const CANONICAL_SOURCES = {
  "four-four-gap-c-major": fourFourGapCMajor,
  "six-eight-devotional-a-minor": sixEightDevotionalAMinor,
  "split-window-four-four": splitWindowFourFour,
  "high-melody-register": highMelodyRegister,
  "no-safe-gap": noSafeGap,
  "guitar-stretch-fail": guitarStretchFail,
  "piano-span-collision-fail": pianoSpanCollisionFail,
  "invalid-meter-abc": invalidMeterAbc,
  "invalid-abc": invalidAbc,
  "two-step3-snapshots": twoStep3Snapshots,
} as const;
