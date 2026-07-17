import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ saves: [] });
  }

  const { data, error } = await supabase
    .from("game_saves")
    .select("slot, data")
    .eq("game_slug", slug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saves: data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const slot = Number(body.slot);
  if (!Number.isInteger(slot) || body.data === undefined) {
    return NextResponse.json({ error: "Invalid save payload" }, { status: 400 });
  }

  const { error } = await supabase.from("game_saves").upsert(
    {
      user_id: user.id,
      game_slug: slug,
      slot,
      data: body.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,game_slug,slot" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
