export interface EndlessResult {
  score: number;
  waveReached: number;
}

export type Phase =
  | { step: "intro" }
  | { step: "endless" }
  | { step: "endless-result"; result: EndlessResult };
