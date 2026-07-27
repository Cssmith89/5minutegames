"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { pdfjs } from "react-pdf";
import "@/lib/pdfWorker";
import { createClient } from "@/lib/supabase/client";

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(picked: File | null) {
    if (!picked) return;
    if (picked.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    setError(null);
    setFile(picked);
    setTitle((current) => current || picked.name.replace(/\.pdf$/i, ""));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    pickFile(event.dataTransfer.files[0] ?? null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF file first.");
      return;
    }
    setUploading(true);
    setError(null);

    try {
      let pageCount: number | null = null;
      let coverDataUrl: string | null = null;
      try {
        const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        pageCount = doc.numPages;

        try {
          const page = await doc.getPage(1);
          const scale = 240 / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (context) {
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            coverDataUrl = canvas.toDataURL("image/jpeg", 0.6);
          }
        } catch {
          coverDataUrl = null;
        }
      } catch {
        pageCount = null;
      }

      const sessionRes = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, filename: file.name }),
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(session.error ?? "Could not start upload");
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("books")
        .uploadToSignedUrl(session.path, session.token, file, {
          contentType: "application/pdf",
        });
      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const finalizeRes = await fetch(`/api/books/${session.bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: session.path,
          title,
          originalFilename: file.name,
          fileSize: file.size,
          pageCount,
          coverDataUrl,
        }),
      });
      const finalize = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalize.error ?? "Could not save book");
      }

      router.push("/books");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Upload a book</h1>

      {error && (
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`cursor-pointer rounded-md border border-dashed px-3 py-8 text-center text-sm transition-colors ${
            dragActive
              ? "border-accent bg-neutral-900 text-neutral-100"
              : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
          }`}
        >
          {file ? file.name : "Drag a PDF here, or click to browse"}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
        />

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          required
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent"
        />

        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
