import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
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
  const title = String(body.title ?? "").trim();
  const originalFilename = String(body.originalFilename ?? "").trim();
  const filePath = String(body.path ?? "").trim();
  const fileSize = Number(body.fileSize);
  const pageCount = body.pageCount === null || body.pageCount === undefined
    ? null
    : Number(body.pageCount);

  if (!title || !originalFilename || !filePath || !Number.isFinite(fileSize)) {
    return NextResponse.json({ error: "Invalid book payload" }, { status: 400 });
  }
  if (filePath !== `${user.id}/${id}.pdf`) {
    return NextResponse.json({ error: "Path does not match book id" }, { status: 400 });
  }

  const rawCoverDataUrl = body.coverDataUrl;
  const coverDataUrl =
    typeof rawCoverDataUrl === "string" &&
    rawCoverDataUrl.startsWith("data:image/") &&
    rawCoverDataUrl.length < 200_000
      ? rawCoverDataUrl
      : null;

  const { error } = await supabase.from("books").insert({
    id,
    user_id: user.id,
    title,
    original_filename: originalFilename,
    file_path: filePath,
    file_size: fileSize,
    page_count: pageCount,
    cover_data_url: coverDataUrl,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
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
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("books")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (bookError || !book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const { error: storageError } = await supabase.storage
    .from("books")
    .remove([book.file_path]);

  const { error: deleteError } = await supabase
    .from("books")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (storageError) {
    return NextResponse.json({ ok: true, warning: storageError.message });
  }

  return NextResponse.json({ ok: true });
}
