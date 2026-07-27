import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { signOut } from "@/app/login/actions";

export default async function Header() {
  const user = isSupabaseConfigured()
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  return (
    <header className="border-b border-neutral-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-mono text-lg font-semibold tracking-tight text-neutral-100"
        >
          5<span className="text-accent">MinuteGames</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-neutral-400">
          <Link href="/" className="transition-colors hover:text-neutral-100">
            All Games
          </Link>
          <Link href="/books" className="transition-colors hover:text-neutral-100">
            Books
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/account" className="transition-colors hover:text-neutral-100">
                {user.email}
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="transition-colors hover:text-neutral-100"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="transition-colors hover:text-neutral-100">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
