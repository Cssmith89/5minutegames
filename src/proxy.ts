import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Excludes /games/** too -- those are large static build assets (.wasm,
  // .pck, .js) served straight out of public/, not worth a session-refresh
  // round trip on every request.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|games/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
