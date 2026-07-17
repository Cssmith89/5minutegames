import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-neutral-100">
        Game not found
      </h1>
      <p className="mt-2 text-neutral-400">
        That game doesn&apos;t exist (yet).
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-mono text-sm text-accent hover:underline"
      >
        &larr; Back to all games
      </Link>
    </div>
  );
}
