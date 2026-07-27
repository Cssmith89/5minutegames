import { pdfjs } from "react-pdf";

// Shared by the upload page (page-count parsing) and the reader
// (rendering) -- both need the worker configured before touching pdfjs.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
