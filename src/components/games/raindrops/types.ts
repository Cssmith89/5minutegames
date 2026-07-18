export interface EndlessResult {
  score: number;
}

export interface DropSpec {
  id: number;
  text: string;
  answer: number;
  /** Frozen at spawn, like answer/fallMs/leftPct, so it can't drift while falling. */
  choices: number[];
  fallMs: number;
  leftPct: number;
  status: "falling" | "correct" | "missed";
}

export type Phase =
  | { step: "intro" }
  | { step: "endless" }
  | { step: "endless-result"; result: EndlessResult };
