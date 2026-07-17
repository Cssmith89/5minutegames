import GameCard from "@/components/GameCard";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-100">
        5 Minute Games
      </h1>
      <p className="mt-2 text-neutral-400">
        Free browser games, playable in five minutes flat. No installs.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </div>
  );
}
