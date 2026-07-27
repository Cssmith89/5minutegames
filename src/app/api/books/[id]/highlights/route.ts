import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("highlights")
    .select("id, page_number, quote, rects")
    .eq("book_id", id)
    .eq("user_id", user.id)
    .order("page_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    highlights: data.map((row) => ({
      id: row.id,
      pageNumber: row.page_number,
      quote: row.quote,
      rects: row.rects ?? undefined,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const page = Number(body.page);
  const quote = String(body.quote ?? "").trim();
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }
  if (!quote || quote.length > 2000) {
    return NextResponse.json({ error: "Invalid quote" }, { status: 400 });
  }
  const rects =
    Array.isArray(body.rects) &&
    body.rects.every(
      (rect: unknown) =>
        rect !== null &&
        typeof rect === "object" &&
        ["top", "left", "width", "height"].every(
          (key) => typeof (rect as Record<string, unknown>)[key] === "number",
        ),
    )
      ? body.rects
      : null;

  const { data, error } = await supabase
    .from("highlights")
    .insert({ user_id: user.id, book_id: id, page_number: page, quote, rects })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save highlight" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
