import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Godot's Web export needs the page to be cross-origin isolated
        // (COOP+COEP) to use SharedArrayBuffer, unconditionally -- this
        // applies even with "Threads Support" off in the export preset.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
