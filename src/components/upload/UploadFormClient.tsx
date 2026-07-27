"use client";

import dynamic from "next/dynamic";

// `ssr: false` is only allowed inside a Client Component -- this thin
// wrapper is what lets the server-component page.tsx stay a server
// component while still browser-only loading pdfjs-dist.
export default dynamic(() => import("./UploadForm"), { ssr: false });
