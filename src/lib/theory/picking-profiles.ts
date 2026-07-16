import type { GuitarStringNumber } from "./fingerstyle-compressor";

export type PickingFinger = "p" | "i" | "m" | "a";
export type FingerstylePickingProfileId = "strict-pima" | "folk-travis";
export type FingerstylePhysicalTechnique =
  // Original techniques
  | "thumb-clock" | "pinch" | "guide-tone" | "syncopation" | "string-slap"
  // Left-hand legato  | "hammer-on" | "pull-off" | "slide-shift" | "slide-guide"
  | "vibrato" | "natural-harmonic"
  // Left-hand fretting  | "barre" | "partial-barre" | "guide-finger-pivot" | "left-hand-mute"
  // Right-hand articulation  | "rest-stroke" | "free-stroke" | "palm-mute"
  // Expressive / ornamental  | "grace-note" | "bend";

export interface FingerstylePickingProfile {
  id: FingerstylePickingProfileId;
  posture: "floating" | "anchored";
}

const BASS_STRINGS: GuitarStringNumber[] = [6, 5, 4];

export function pickingProfileFor(profileId: FingerstylePickingProfileId): FingerstylePickingProfile {
  return profileId === "folk-travis"
    ? { id: "folk-travis", posture: "anchored" }
    : { id: "strict-pima", posture: "floating" };
}

export function strictPimaFingerForString(string: GuitarStringNumber): PickingFinger {
  if (BASS_STRINGS.includes(string)) return "p";
  if (string === 3) return "i";
  if (string === 2) return "m";
  return "a";
}
