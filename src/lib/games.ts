export interface GameEntry {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  controls: string[];
  thumbnail: string;
  buildPath: string;
  status: "playable" | "coming-soon";
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
    buildPath: "/games/dungeon-crawler/build",
    status: "coming-soon",
  },
];

export function getGame(slug: string): GameEntry | undefined {
  return games.find((game) => game.slug === slug);
}
