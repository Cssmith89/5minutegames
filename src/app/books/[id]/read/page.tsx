import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import PdfReader from "@/components/reader/PdfReaderClient";

export default async function ReadBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: book } = await supabase
    .from("books")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!book) {
    redirect("/books");
  }

  const { data: progress } = await supabase
    .from("reading_progress")
    .select("current_page")
    .eq("book_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: bookmarkRows } = await supabase
    .from("bookmarks")
    .select("page_number")
    .eq("book_id", id)
    .eq("user_id", user.id)
    .order("page_number");

  const { data: highlightRows } = await supabase
    .from("highlights")
    .select("id, page_number, quote, rects")
    .eq("book_id", id)
    .eq("user_id", user.id)
    .order("page_number");

  return (
    <PdfReader
      bookId={book.id}
      title={book.title}
      startPage={progress?.current_page ?? 1}
      initialBookmarkedPages={(bookmarkRows ?? []).map((row) => row.page_number)}
      initialHighlights={(highlightRows ?? []).map((row) => ({
        id: row.id,
        pageNumber: row.page_number,
        quote: row.quote,
        rects: row.rects ?? undefined,
      }))}
    />
  );
}
