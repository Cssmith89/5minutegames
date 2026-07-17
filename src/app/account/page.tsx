import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { signOut } from "@/app/login/actions";

export default async function AccountPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Account</h1>
      <p className="text-neutral-400">{user.email}</p>
      <p className="text-sm text-neutral-500">
        Your save progress in each game on this site syncs to this account
        automatically while you&apos;re logged in.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-900"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
