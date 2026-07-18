export interface GameEntry {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  controls: string[];
  thumbnail: string;
  status: "playable" | "coming-soon";
  /** "iframe" games load a static build via GamePlayer; "component" games render a native React component from the game registry. */
  kind: "iframe" | "component";
  /** Required when kind is "iframe". */
  buildPath?: string;
}

export const games: GameEntry[] = [
  {
    slug: "dungeon-crawler",
    title: "Dungeon Crawler",
    tagline: "Descend, fight, loot, repeat.",
    description:
      "A procedurally-generated dungeon crawler with turn-based combat, a growing loot system, and a skill tree to build out your run. Fight your way through waves of enemies, gear up, and see how deep you can go.",
    controls: [
      "WASD / Arrow keys — move",
      "Mouse — select targets and menu options",
      "Esc — pause / open menu",
    ],
    thumbnail: "/games/dungeon-crawler/thumbnail.png",
    kind: "iframe",
    buildPath: "/games/dungeon-crawler/build",
    status: "playable",
  },
  {
    slug: "reflex-test",
    title: "Reflex Test",
    tagline: "Endless aim trainer — how many waves can you clear?",
    description:
      "Hit targets in numeric order as waves ramp up forever — more targets first, then faster. You start with 3 lives (up to 5): missing one costs a life at the end of that wave, but clean streaks earn lives back. See how far you can go.",
    controls: [
      "Mouse / touch — click or tap targets in order",
    ],
    thumbnail: "/games/reflex-test/thumbnail.png",
    kind: "component",
    status: "playable",
  },
  {
    slug: "speed-match",
    title: "Quick Match",
    tagline: "Does it match the last one? Answer fast — it only gets faster.",
    description:
      "A symbol appears every couple seconds — say whether it matches the one shown right before it. Every correct streak shrinks the time you get to answer. You start with 3 lives; a wrong or missed answer costs one.",
    controls: ["Mouse / touch — tap Match or No Match"],
    thumbnail: "/games/speed-match/thumbnail.png",
    kind: "component",
    status: "playable",
  },
  {
    slug: "color-match",
    title: "Ink Trap",
    tagline: "Does the ink match the word? Answer before the clock runs out.",
    description:
      "A color word appears printed in its own ink color — say whether the ink matches what the word says. The shrinking time bar is the real challenge here. You start with 3 lives; a wrong or missed answer costs one.",
    controls: ["Mouse / touch — tap Match or No Match"],
    thumbnail: "/games/color-match/thumbnail.png",
    kind: "component",
    status: "playable",
  },
  {
    slug: "memory-matrix",
    title: "Grid Recall",
    tagline: "Memorize the lit tiles, then click them back from memory.",
    description:
      "A grid flashes a handful of lit tiles, then clears — click the same tiles back from memory. Clearing a level grows the grid or the number of tiles to remember. One wrong click ends the run.",
    controls: ["Mouse / touch — click the tiles you remember"],
    thumbnail: "/games/memory-matrix/thumbnail.png",
    kind: "component",
    status: "playable",
  },
  {
    slug: "raindrops",
    title: "Number Rain",
    tagline: "Solve the falling equations before they hit the ground.",
    description:
      "Equations fall from the top of the screen — pick the correct answer from 4 choices before the oldest one lands. Fall speed climbs with your score, and operations get harder in tiers: addition, then subtraction, then multiplication.",
    controls: ["Mouse / touch — click the correct answer"],
    thumbnail: "/games/raindrops/thumbnail.png",
    kind: "component",
    status: "playable",
  },
];

export function getGame(slug: string): GameEntry | undefined {
  return games.find((game) => game.slug === slug);
}
