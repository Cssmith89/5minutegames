import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import type { GameEntry } from "@/lib/games";

function thumbnailExists(thumbnail: string) {
  return fs.existsSync(path.join(process.cwd(), "public", thumbnail));
}

export default function GameCard({ game }: { game: GameEntry }) {
  const isPlayable = game.status === "playable";
  const hasThumbnail = thumbnailExists(game.thumbnail);

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-700"
    >
      <div className="relative aspect-video overflow-hidden bg-neutral-800">
        {hasThumbnail ? (
          <Image
            src={game.thumbnail}
            alt={game.title}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
            <span className="font-mono text-sm text-neutral-600">
              {game.title}
            </span>
          </div>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 font-mono text-xs ${
            isPlayable
              ? "bg-accent/20 text-accent"
              : "bg-neutral-800 text-neutral-400"
          }`}
        >
          {isPlayable ? "PLAYABLE" : "COMING SOON"}
        </span>
      </div>
      <div className="p-4">
        <h2 className="font-semibold text-neutral-100">{game.title}</h2>
        <p className="mt-1 text-sm text-neutral-400">{game.tagline}</p>
      </div>
    </Link>
  );
}
