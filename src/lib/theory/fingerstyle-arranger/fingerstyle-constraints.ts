export type FingerstyleTechnique =
  | "thumb-clock"
  | "pinch"
  | "guide-tone"
  | "syncopation"
  | "string-slap"
  | "hammer-on"
  | "pull-off"
  | "slide-shift"
  | "slide-guide"
  | "vibrato"
  | "natural-harmonic"
  | "barre"
  | "partial-barre"
  | "guide-finger-pivot"
  | "left-hand-mute"
  | "rest-stroke"
  | "free-stroke"
  | "palm-mute"
  | "grace-note"
  | "bend";

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface SkillLevelConstraints {
  maxFret: number;
  maxFretSpan: number;
  allowBarre: boolean;
  maxBarreMeasures: number;
  maxHandJumpPerBeat: number;
  forbiddenTechniques: FingerstyleTechnique[];
}

export const SKILL_LEVEL_CONSTRAINTS: Record<SkillLevel, SkillLevelConstraints> = {
  beginner: {
    maxFret: 5,
    maxFretSpan: 3,
    allowBarre: false,
    maxBarreMeasures: 0,
    maxHandJumpPerBeat: 2,
    forbiddenTechniques: [
      "hammer-on", "pull-off", "bend", "vibrato", "barre", "partial-barre",
      "palm-mute", "rest-stroke", "natural-harmonic",
    ],
  },
  intermediate: {
    maxFret: 9,
    maxFretSpan: 4,
    allowBarre: true,
    maxBarreMeasures: 4,
    maxHandJumpPerBeat: 5,
    forbiddenTechniques: ["bend"],
  },
  advanced: {
    maxFret: 19,
    maxFretSpan: 5,
    allowBarre: true,
    maxBarreMeasures: Infinity,
    maxHandJumpPerBeat: 12,
    forbiddenTechniques: [],
  },
};
