"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type BookCardBook = {
  id: string;
  title: string;
  pageCount: number | null;
  uploadedAt: string;
  coverDataUrl: string | null;
};

type Mode = "view" | "menu" | "rename" | "delete-confirm";

export default function BookCard({ book }: { book: BookCardBook }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [title, setTitle] = useState(book.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploaded = new Date(book.uploadedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  async function saveRename() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title cannot be empty");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not rename this book");
      return;
    }
    setMode("view");
    router.refresh();
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete this book");
      return;
    }
    router.refresh();
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-700">
      {mode === "view" && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            setMode("menu");
          }}
          aria-label="Book options"
          className="absolute right-2 top-2 z-10 rounded-md border border-neutral-700 bg-neutral-900/90 px-2 py-1 text-neutral-400 opacity-0 transition-opacity hover:text-neutral-200 group-hover:opacity-100"
        >
          ⋯
        </button>
      )}

      {mode === "menu" && (
        <div className="absolute right-2 top-2 z-10 flex flex-col overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 text-sm shadow-lg">
          <button
            type="button"
            onClick={() => {
              setTitle(book.title);
              setError(null);
              setMode("rename");
            }}
            className="px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("delete-confirm");
            }}
            className="px-3 py-1.5 text-left text-red-400 hover:bg-neutral-800"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            className="px-3 py-1.5 text-left text-neutral-500 hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      )}

      <Link
        href={mode === "view" ? `/books/${book.id}/read` : "#"}
        onClick={(event) => {
          if (mode !== "view") event.preventDefault();
        }}
        className="block"
      >
        {book.coverDataUrl ? (
          <div className="aspect-video overflow-hidden bg-neutral-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={book.coverDataUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-10 w-10 text-neutral-600 transition-colors group-hover:text-neutral-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 4v3h3" />
            </svg>
          </div>
        )}
        <div className="p-4">
          {mode !== "rename" && (
            <>
              <h2 className="truncate font-semibold text-neutral-100">{book.title}</h2>
              <p className="mt-1 text-sm text-neutral-400">
                {book.pageCount ? `${book.pageCount} pages` : "PDF"} · {uploaded}
              </p>
            </>
          )}
        </div>
      </Link>

      {mode === "rename" && (
        <div
          className="px-4 pb-4"
          onClick={(event) => event.preventDefault()}
        >
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-accent"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveRename}
              disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              disabled={busy}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "delete-confirm" && (
        <div className="px-4 pb-4">
          <p className="text-sm text-neutral-300">
            Delete this book? This can&apos;t be undone.
          </p>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-md bg-red-900 px-3 py-1.5 text-xs font-medium text-red-100 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              disabled={busy}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
