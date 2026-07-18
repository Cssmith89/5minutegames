export interface EndlessResult {
  score: number;
  bestStreak: number;
}

export type Phase =
  | { step: "intro" }
  | { step: "endless" }
  | { step: "endless-result"; result: EndlessResult };
