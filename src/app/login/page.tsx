import Link from "next/link";
import { signIn } from "./actions";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Log in</h1>
      {error && (
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      <form action={signIn} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90"
        >
          Log in
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <div className="h-px flex-1 bg-neutral-800" />
        or
        <div className="h-px flex-1 bg-neutral-800" />
      </div>

      <GoogleSignInButton />

      <p className="text-sm text-neutral-500">
        No account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
