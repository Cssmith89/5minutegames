import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import BookCard from "@/components/BookCard";

export default async function BooksPage() {
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

  const { data: books } = await supabase
    .from("books")
    .select("id, title, page_count, uploaded_at, cover_data_url")
    .order("uploaded_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Books</h1>
          <p className="mt-2 text-neutral-400">Your personal PDF library.</p>
        </div>
        <Link
          href="/books/upload"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90"
        >
          Upload a book
        </Link>
      </div>

      {books && books.length > 0 ? (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={{
                id: book.id,
                title: book.title,
                pageCount: book.page_count,
                uploadedAt: book.uploaded_at,
                coverDataUrl: book.cover_data_url,
              }}
            />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-neutral-500">
          No books yet.{" "}
          <Link href="/books/upload" className="text-accent hover:underline">
            Upload your first PDF
          </Link>
          .
        </p>
      )}
    </div>
  );
}
