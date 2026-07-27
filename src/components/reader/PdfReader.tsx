"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Document, Page } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "@/lib/pdfWorker";
import "react-pdf/dist/Page/TextLayer.css";

type TocEntry = { title: string; pageNumber: number; level: number };
type SearchResult = { pageNumber: number; count: number };
type HighlightRect = { top: number; left: number; width: number; height: number };
type Highlight = { id: string; pageNumber: number; quote: string; rects?: HighlightRect[] };
type SelectionInfo = { text: string; top: number; left: number; rects: HighlightRect[] };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveOutline(pdf: PDFDocumentProxy): Promise<TocEntry[]> {
  const outline = await pdf.getOutline();
  if (!outline) return [];

  const entries: TocEntry[] = [];

  async function walk(items: typeof outline, level: number) {
    for (const item of items) {
      try {
        const dest =
          typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
        if (dest && dest[0]) {
          const pageIndex = await pdf.getPageIndex(dest[0]);
          entries.push({ title: item.title, pageNumber: pageIndex + 1, level });
        }
      } catch {
        // Skip entries pdf.js can't resolve rather than failing the whole TOC.
      }
      if (item.items?.length) {
        await walk(item.items, level + 1);
      }
    }
  }

  await walk(outline, 0);
  return entries;
}

const DRAG_THRESHOLD = 80;
const TAP_THRESHOLD = 10;
const EDGE_TAP_ZONE = 0.28;
const CHROME_HIDE_DELAY = 2500;
const WHEEL_THRESHOLD = 24;
const WHEEL_COOLDOWN_MS = 450;

export default function PdfReader({
  bookId,
  title,
  startPage,
  initialBookmarkedPages,
  initialHighlights,
}: {
  bookId: string;
  title: string;
  startPage: number;
  initialBookmarkedPages: number[];
  initialHighlights: Highlight[];
}) {
  const router = useRouter();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(startPage);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("book-reader-theme");
    return stored === "light" ? "light" : "dark";
  });
  const [pageWidth, setPageWidth] = useState(600);
  const [panelTop, setPanelTop] = useState(64);
  const [pageAspect, setPageAspect] = useState(1.4); // height / width, refined once the doc loads
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [readingMode, setReadingMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [bookmarkedPages, setBookmarkedPages] = useState<Set<number>>(
    () => new Set(initialBookmarkedPages),
  );
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [savingHighlight, setSavingHighlight] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const topChromeRef = useRef<HTMLDivElement>(null);
  const bottomChromeRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelCooldown = useRef(false);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pageTextCache = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    window.localStorage.setItem("book-reader-theme", theme);
  }, [theme]);

  useEffect(() => {
    function updateWidth() {
      // Chrome bars are `position: fixed` overlays, so they don't reserve
      // layout space on their own -- reserve it manually so the page renders
      // between them instead of full-bleed behind them.
      const topChrome = (topChromeRef.current?.offsetHeight ?? 56) + 16;
      const bottomChrome = (bottomChromeRef.current?.offsetHeight ?? 56) + 16;
      const widthLimit = Math.min(window.innerWidth - 64, 800);
      const heightLimit = (window.innerHeight - topChrome - bottomChrome) / pageAspect;
      setPageWidth(Math.max(Math.min(widthLimit, heightLimit), 200));
      // The top bar wraps onto a second line on narrow phones/tablets, so its
      // height isn't fixed -- measure it instead of assuming a single row.
      setPanelTop((topChromeRef.current?.offsetHeight ?? 56) + 8);
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [pageAspect]);

  useEffect(() => {
    fetch(`/api/books/${bookId}/file`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setFileUrl(data.url);
        else setLoadError(data.error ?? "Could not load this book");
      })
      .catch(() => setLoadError("Could not load this book"));
  }, [bookId]);

  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: currentPage }),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [bookId, currentPage]);

  // Toolbars stay visible while there's been recent activity or the TOC/Search
  // panel is open, and fade out after CHROME_HIDE_DELAY of inactivity.
  const resetChromeTimer = useCallback(() => {
    setChromeVisible(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    if (!showToc && !showSearch && !showSaved) {
      hideTimeout.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_DELAY);
    }
  }, [showToc, showSearch, showSaved]);

  useEffect(() => {
    if (!showToc && !showSearch && !showSaved) {
      hideTimeout.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_DELAY);
    }
    window.addEventListener("mousemove", resetChromeTimer);
    window.addEventListener("keydown", resetChromeTimer);
    window.addEventListener("touchstart", resetChromeTimer);
    return () => {
      window.removeEventListener("mousemove", resetChromeTimer);
      window.removeEventListener("keydown", resetChromeTimer);
      window.removeEventListener("touchstart", resetChromeTimer);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [resetChromeTimer, showToc, showSearch, showSaved]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      shellRef.current?.requestFullscreen?.();
    }
  }

  function goToPage(page: number) {
    if (!numPages) return;
    setCurrentPage(Math.min(Math.max(page, 1), numPages));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        return;
      }
      if (event.key === "ArrowLeft") {
        goToPage(currentPage - 1);
      } else if (event.key === "ArrowRight") {
        goToPage(currentPage + 1);
      } else if (event.key === "Escape") {
        if (readingMode) {
          setReadingMode(false);
          return;
        }
        if (showSearch || showToc || showSaved) {
          setShowSearch(false);
          setShowToc(false);
          setShowSaved(false);
          return;
        }
        if (document.fullscreenElement) return;
        router.push("/books");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages, showToc, showSearch, showSaved, readingMode, router]);

  function enterReadingMode() {
    setShowToc(false);
    setShowSearch(false);
    setShowSaved(false);
    setSelectionInfo(null);
    setReadingMode(true);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) < WHEEL_THRESHOLD || Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        return;
      }
      // Registered as a native (non-passive) listener because React's synthetic
      // wheel handler is passive by default, which silently ignores preventDefault.
      event.preventDefault();
      if (wheelCooldown.current) return;
      wheelCooldown.current = true;
      setTimeout(() => {
        wheelCooldown.current = false;
      }, WHEEL_COOLDOWN_MS);
      goToPage(currentPage + (event.deltaY > 0 ? 1 : -1));
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [currentPage, numPages]);

  const onDocumentLoad = useCallback((pdf: PDFDocumentProxy) => {
    pdfRef.current = pdf;
    setNumPages(pdf.numPages);
    resolveOutline(pdf).then(setToc);
    pdf.getPage(1).then((page) => {
      const viewport = page.getViewport({ scale: 1 });
      if (viewport.width > 0) setPageAspect(viewport.height / viewport.width);
    });
  }, []);

  async function runSearch(query: string) {
    const pdf = pdfRef.current;
    const trimmed = query.trim();
    if (!pdf || !trimmed) {
      setSearchResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setSearched(true);
    const pattern = new RegExp(escapeRegExp(trimmed), "gi");
    const results: SearchResult[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      let text = pageTextCache.current.get(pageNumber);
      if (text === undefined) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        pageTextCache.current.set(pageNumber, text);
      }
      const count = text.match(pattern)?.length ?? 0;
      if (count > 0) {
        results.push({ pageNumber, count });
      }
    }

    setSearchResults(results);
    setCurrentResultIndex(0);
    setSearching(false);
    if (results.length > 0) {
      goToPage(results[0].pageNumber);
    }
  }

  function goToResult(index: number) {
    if (searchResults.length === 0) return;
    const wrapped = ((index % searchResults.length) + searchResults.length) % searchResults.length;
    setCurrentResultIndex(wrapped);
    goToPage(searchResults[wrapped].pageNumber);
  }

  async function addBookmark(page: number) {
    setBookmarkedPages((prev) => new Set(prev).add(page));
    try {
      await fetch(`/api/books/${bookId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page }),
      });
    } catch {
      // Best-effort; local state already reflects the toggle for this session.
    }
  }

  async function removeBookmark(page: number) {
    setBookmarkedPages((prev) => {
      const next = new Set(prev);
      next.delete(page);
      return next;
    });
    try {
      await fetch(`/api/books/${bookId}/bookmarks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page }),
      });
    } catch {
      // Best-effort; local state already reflects the toggle for this session.
    }
  }

  function toggleBookmark() {
    if (bookmarkedPages.has(currentPage)) removeBookmark(currentPage);
    else addBookmark(currentPage);
  }

  function hasActiveSelection() {
    const selection = window.getSelection();
    return !!selection && !selection.isCollapsed && selection.toString().trim().length > 0;
  }

  async function saveHighlight() {
    if (!selectionInfo) return;
    const quote = selectionInfo.text.trim();
    if (!quote) {
      setSelectionInfo(null);
      return;
    }
    const rects = selectionInfo.rects;
    setSavingHighlight(true);
    try {
      const res = await fetch(`/api/books/${bookId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: currentPage, quote, rects }),
      });
      const data = await res.json();
      if (data.id) {
        setHighlights((prev) => [
          ...prev,
          { id: data.id, pageNumber: currentPage, quote, rects },
        ]);
      }
    } catch {
      // Best-effort; nothing is saved on failure.
    }
    window.getSelection()?.removeAllRanges();
    setSelectionInfo(null);
    setSavingHighlight(false);
  }

  async function removeHighlight(highlightId: string) {
    setHighlights((prev) => prev.filter((highlight) => highlight.id !== highlightId));
    try {
      await fetch(`/api/books/${bookId}/highlights/${highlightId}`, { method: "DELETE" });
    } catch {
      // Best-effort; local state already reflects the removal for this session.
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    setSelectionInfo(null);
    dragStartX.current = event.clientX;
    setDragging(true);
    resetChromeTimer();
    // Pointer capture keeps drag/tap tracking on this container even when the
    // finger is over a PDF.js text-layer span underneath -- without it, touch
    // drags on tablets intermittently get swallowed by text selection instead
    // of turning the page.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragStartX.current === null) return;
    if (hasActiveSelection()) return;
    setDragX(event.clientX - dragStartX.current);
  }

  function cancelDrag() {
    dragStartX.current = null;
    setDragging(false);
    setDragX(0);
  }

  function endDrag(event: React.PointerEvent) {
    if (dragStartX.current === null) return;
    if (hasActiveSelection()) {
      const selection = window.getSelection()!;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const wrapperEl = pageWrapperRef.current;
      const wrapperRect = wrapperEl?.getBoundingClientRect();
      const rects =
        wrapperRect && wrapperRect.width > 0 && wrapperRect.height > 0
          ? Array.from(range.getClientRects())
              .filter((r) => r.width > 0 && r.height > 0)
              .map((r) => ({
                top: (r.top - wrapperRect.top) / wrapperRect.height,
                left: (r.left - wrapperRect.left) / wrapperRect.width,
                width: r.width / wrapperRect.width,
                height: r.height / wrapperRect.height,
              }))
          : [];
      setSelectionInfo({
        text: selection.toString(),
        top: rect.top,
        left: rect.left + rect.width / 2,
        rects,
      });
      dragStartX.current = null;
      setDragging(false);
      setDragX(0);
      return;
    }
    if (dragX <= -DRAG_THRESHOLD) {
      goToPage(currentPage + 1);
    } else if (dragX >= DRAG_THRESHOLD) {
      goToPage(currentPage - 1);
    } else if (
      Math.abs(dragX) < TAP_THRESHOLD &&
      (event.pointerType === "touch" || event.pointerType === "pen")
    ) {
      // A tap (not a drag) on a touch/pen device: left/right edges turn the
      // page like a typical e-reader, the middle band toggles the toolbars.
      const container = containerRef.current;
      const containerRect = container?.getBoundingClientRect();
      if (containerRect && containerRect.width > 0) {
        const relativeX = (event.clientX - containerRect.left) / containerRect.width;
        if (relativeX <= EDGE_TAP_ZONE) {
          goToPage(currentPage - 1);
        } else if (relativeX >= 1 - EDGE_TAP_ZONE) {
          goToPage(currentPage + 1);
        } else {
          setChromeVisible((visible) => !visible);
          if (hideTimeout.current) clearTimeout(hideTimeout.current);
        }
      }
    }
    dragStartX.current = null;
    setDragging(false);
    setDragX(0);
  }

  const chromeClass = `fixed inset-x-0 z-50 bg-neutral-900/90 backdrop-blur-sm transition-opacity duration-300 ${
    chromeVisible && !readingMode ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
  const currentPageHighlights = highlights.filter(
    (highlight) => highlight.pageNumber === currentPage,
  );
  const positionedHighlights = currentPageHighlights.filter(
    (highlight) => highlight.rects && highlight.rects.length > 0,
  );
  const unpositionedHighlights = currentPageHighlights.filter(
    (highlight) => !highlight.rects || highlight.rects.length === 0,
  );

  function exportHighlights() {
    if (highlights.length === 0) return;
    const sorted = [...highlights].sort((a, b) => a.pageNumber - b.pageNumber);
    const lines = [`# ${title} — Highlights`, ""];
    for (const highlight of sorted) {
      lines.push(`## Page ${highlight.pageNumber}`, "", `> ${highlight.quote.replace(/\n/g, "\n> ")}`, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-highlights.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div ref={shellRef} className="fixed inset-0 flex flex-col bg-neutral-950 text-neutral-100">
      <div ref={topChromeRef} className={`${chromeClass} top-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6`}>
        <div className="min-w-0">
          <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← Books
          </Link>
          <h1 className="truncate text-lg font-semibold text-neutral-100">{title}</h1>
        </div>
        <div className="flex flex-wrap shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setShowToc((v) => !v);
              setShowSearch(false);
              setShowSaved(false);
            }}
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            Contents
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSearch((v) => !v);
              setShowToc(false);
              setShowSaved(false);
            }}
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSaved((v) => !v);
              setShowToc(false);
              setShowSearch(false);
            }}
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            Saved
          </button>
          <button
            type="button"
            onClick={toggleBookmark}
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            {bookmarkedPages.has(currentPage) ? "★ Bookmarked" : "☆ Bookmark"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            onClick={enterReadingMode}
            title="Hide all UI — press Esc to bring it back"
            className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
          >
            Reading mode
          </button>
        </div>
      </div>

      {showToc && !readingMode && (
        <div style={{ top: panelTop }} className="fixed inset-x-0 z-50 mx-auto w-full max-w-md px-6">
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 shadow-lg">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-neutral-400">
                Go to page
                <input
                  type="number"
                  min={1}
                  max={numPages ?? undefined}
                  defaultValue={currentPage}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      goToPage(Number((event.target as HTMLInputElement).value));
                    }
                  }}
                  className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100 outline-none focus:border-accent"
                />
                {numPages ? <span>of {numPages}</span> : null}
              </label>
              {toc.length > 0 && (
                <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
                  {toc.map((entry, index) => (
                    <li key={index} style={{ paddingLeft: entry.level * 12 }}>
                      <button
                        type="button"
                        onClick={() => {
                          goToPage(entry.pageNumber);
                          setShowToc(false);
                        }}
                        className="truncate text-left text-neutral-300 hover:text-accent"
                      >
                        {entry.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {showSearch && !readingMode && (
        <div style={{ top: panelTop }} className="fixed inset-x-0 z-50 mx-auto w-full max-w-md px-6">
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 shadow-lg">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch(searchQuery);
                  }}
                  placeholder="Search this book…"
                  autoFocus
                  className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => runSearch(searchQuery)}
                  className="touch-manipulation rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-600"
                >
                  Search
                </button>
              </div>

              {searching && <p className="text-sm text-neutral-500">Searching…</p>}
              {!searching && searched && searchResults.length === 0 && (
                <p className="text-sm text-neutral-500">No matches</p>
              )}

              {!searching && searchResults.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm text-neutral-400">
                    <button
                      type="button"
                      onClick={() => goToResult(currentResultIndex - 1)}
                      className="rounded-md border border-neutral-700 px-2 py-1 hover:border-neutral-600"
                    >
                      Prev
                    </button>
                    <span>
                      Match {currentResultIndex + 1} of {searchResults.length} page
                      {searchResults.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToResult(currentResultIndex + 1)}
                      className="rounded-md border border-neutral-700 px-2 py-1 hover:border-neutral-600"
                    >
                      Next
                    </button>
                  </div>
                  <ul className="mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
                    {searchResults.map((result, index) => (
                      <li key={result.pageNumber}>
                        <button
                          type="button"
                          onClick={() => goToResult(index)}
                          className={`w-full truncate rounded px-1 py-0.5 text-left hover:text-accent ${
                            index === currentResultIndex ? "text-accent" : "text-neutral-300"
                          }`}
                        >
                          Page {result.pageNumber} — {result.count} match
                          {result.count === 1 ? "" : "es"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaved && !readingMode && (
        <div style={{ top: panelTop }} className="fixed inset-x-0 z-50 mx-auto w-full max-w-md px-6">
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 shadow-lg">
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Bookmarks
                </p>
                {bookmarkedPages.size === 0 ? (
                  <p className="text-sm text-neutral-500">No bookmarked pages</p>
                ) : (
                  <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-sm">
                    {[...bookmarkedPages]
                      .sort((a, b) => a - b)
                      .map((page) => (
                        <li key={page} className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              goToPage(page);
                              setShowSaved(false);
                            }}
                            className="truncate text-left text-neutral-300 hover:text-accent"
                          >
                            Page {page}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBookmark(page)}
                            aria-label={`Remove bookmark on page ${page}`}
                            className="shrink-0 text-neutral-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Highlights
                  </p>
                  {highlights.length > 0 && (
                    <button
                      type="button"
                      onClick={exportHighlights}
                      className="text-xs text-neutral-500 hover:text-accent"
                    >
                      Export
                    </button>
                  )}
                </div>
                {highlights.length === 0 ? (
                  <p className="text-sm text-neutral-500">No saved highlights</p>
                ) : (
                  <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto text-sm">
                    {[...highlights]
                      .sort((a, b) => a.pageNumber - b.pageNumber)
                      .map((highlight) => (
                        <li key={highlight.id} className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              goToPage(highlight.pageNumber);
                              setShowSaved(false);
                            }}
                            className="min-w-0 flex-1 text-left text-neutral-300 hover:text-accent"
                          >
                            <span className="block text-xs text-neutral-500">
                              Page {highlight.pageNumber}
                            </span>
                            <span className="line-clamp-2">{highlight.quote}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHighlight(highlight.id)}
                            aria-label="Remove highlight"
                            className="shrink-0 text-neutral-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <p className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">
          {loadError}
        </p>
      )}

      <div
        ref={containerRef}
        className="relative flex flex-1 select-none items-center justify-center overflow-y-auto overflow-x-hidden touch-manipulation"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        {!readingMode && (
          <>
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className={`fixed left-2 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/70 text-2xl text-neutral-200 backdrop-blur-sm transition-opacity duration-300 hover:border-neutral-600 disabled:opacity-0 sm:h-11 sm:w-11 ${
                chromeVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!numPages || currentPage >= numPages}
              aria-label="Next page"
              className={`fixed right-2 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/70 text-2xl text-neutral-200 backdrop-blur-sm transition-opacity duration-300 hover:border-neutral-600 disabled:opacity-0 sm:h-11 sm:w-11 ${
                chromeVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              ›
            </button>
          </>
        )}
        {fileUrl && (
          <Document file={fileUrl} onLoadSuccess={onDocumentLoad} loading="Loading…">
            <div
              ref={pageWrapperRef}
              style={{
                position: "relative",
                transform: `translateX(${dragX}px)`,
                transition: dragging ? "none" : "transform 200ms ease",
                filter: theme === "dark" ? "invert(1) hue-rotate(180deg)" : undefined,
              }}
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                customTextRenderer={
                  searchQuery.trim()
                    ? ({ str }) =>
                        str.replace(
                          new RegExp(escapeRegExp(searchQuery.trim()), "gi"),
                          (match) => `<mark class="reader-search-mark">${match}</mark>`
                        )
                    : unpositionedHighlights.length > 0
                    ? ({ str }) =>
                        unpositionedHighlights.reduce(
                          (acc, highlight) =>
                            acc.replace(
                              new RegExp(escapeRegExp(highlight.quote), "gi"),
                              (match) => `<mark class="reader-highlight-mark">${match}</mark>`
                            ),
                          str
                        )
                    : undefined
                }
              />
              {!searchQuery.trim() &&
                positionedHighlights.flatMap((highlight) =>
                  (highlight.rects ?? []).map((rect, index) => (
                    <mark
                      key={`${highlight.id}-${index}`}
                      className="reader-highlight-mark pointer-events-none absolute"
                      style={{
                        top: `${rect.top * 100}%`,
                        left: `${rect.left * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                      }}
                    />
                  )),
                )}
            </div>
          </Document>
        )}
      </div>

      {selectionInfo && !readingMode && (
        <button
          type="button"
          onClick={saveHighlight}
          disabled={savingHighlight}
          style={{ top: selectionInfo.top - 40, left: selectionInfo.left }}
          className="fixed z-[60] -translate-x-1/2 rounded-md border border-accent bg-neutral-900 px-3 py-1.5 text-sm text-accent shadow-lg disabled:opacity-60"
        >
          {savingHighlight ? "Saving…" : "+ Highlight"}
        </button>
      )}

      <div ref={bottomChromeRef} className={`${chromeClass} bottom-0 flex items-center justify-between px-4 py-3 sm:px-6`}>
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="touch-manipulation rounded-md border border-neutral-700 px-4 py-2.5 text-sm text-neutral-200 hover:border-neutral-600 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm text-neutral-500">
          Page {currentPage}
          {numPages ? ` of ${numPages}` : ""}
        </span>
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={!numPages || currentPage >= numPages}
          className="touch-manipulation rounded-md border border-neutral-700 px-4 py-2.5 text-sm text-neutral-200 hover:border-neutral-600 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
