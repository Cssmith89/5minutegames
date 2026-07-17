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
];

export function getGame(slug: string): GameEntry | undefined {
  return games.find((game) => game.slug === slug);
}
