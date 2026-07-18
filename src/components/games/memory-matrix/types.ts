export interface LevelResult {
  score: number;
  levelReached: number;
}

export type Phase =
  | { step: "intro" }
  | { step: "playing" }
  | { step: "result"; result: LevelResult };
