import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const filename = String(body.filename ?? "").trim();
  if (!title || !filename) {
    return NextResponse.json({ error: "Missing title or filename" }, { status: 400 });
  }

  const bookId = crypto.randomUUID();
  const path = `${user.id}/${bookId}.pdf`;

  const { data, error } = await supabase.storage.from("books").createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookId, path, token: data.token });
}
