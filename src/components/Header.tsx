import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-neutral-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-mono text-lg font-semibold tracking-tight text-neutral-100"
        >
          5<span className="text-accent">MinuteGames</span>
        </Link>
        <nav className="text-sm text-neutral-400">
          <Link href="/" className="transition-colors hover:text-neutral-100">
            All Games
          </Link>
        </nav>
      </div>
    </header>
  );
}
