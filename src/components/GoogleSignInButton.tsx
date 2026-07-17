"use client";

import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton() {
  async function handleClick() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-800"
    >
      Continue with Google
    </button>
  );
}
