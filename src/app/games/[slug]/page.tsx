import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GamePlayer from "@/components/GamePlayer";
import { NativeGameRenderer } from "@/components/games/registry";
import { games, getGame } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

export function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return {};
  return {
    title: game.title,
    description: game.tagline,
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const isPlayable = game.status === "playable";
  const loggedIn = isSupabaseConfigured()
    ? !!(await (await createClient()).auth.getUser()).data.user
    : false;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-100">
        {game.title}
      </h1>
      <p className="mt-1 text-neutral-400">{game.tagline}</p>

      <div className="mt-8">
        {!isPlayable ? (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900">
            <span className="font-mono text-sm text-neutral-500">
              Coming soon
            </span>
          </div>
        ) : game.kind === "iframe" ? (
          <GamePlayer
            title={game.title}
            slug={game.slug}
            buildPath={game.buildPath!}
            loggedIn={loggedIn}
          />
        ) : (
          <NativeGameRenderer slug={game.slug} />
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <h2 className="font-semibold text-neutral-100">About</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {game.description}
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-neutral-100">Controls</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-400">
            {game.controls.map((control) => (
              <li key={control}>{control}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
