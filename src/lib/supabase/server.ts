import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Component / Server Action / Route Handler client, scoped to the
// caller's session. Respects RLS -- game_saves rows are only readable/
// writable by their owning user (auth.uid() = user_id), so this client is
// sufficient for all save read/write routes without needing a service-role
// client to bypass RLS.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component with no request context to mutate;
            // middleware.ts refreshes the session cookie on every request instead.
          }
        },
      },
    },
  );
}
