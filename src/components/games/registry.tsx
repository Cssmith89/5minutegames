"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// Native games rely on browser APIs (localStorage, performance timing) for
// their daily-seeded/streak logic, so they're client-only (ssr: false) —
// there's no meaningful server-rendered state for them to hydrate against.
const nativeGameComponents: Record<string, ComponentType<{ slug: string }>> = {
  "reflex-test": dynamic(() => import("./reflex-test/ReflexTest"), {
    ssr: false,
  }),
};

// The registry lookup has to happen inside a Client Component: passing a
// plain object of dynamic() component references across the Server/Client
// boundary and indexing into it server-side does not resolve correctly.
export function NativeGameRenderer({ slug }: { slug: string }) {
  const Component = nativeGameComponents[slug];
  if (!Component) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900">
        <span className="font-mono text-sm text-neutral-500">
          Coming soon
        </span>
      </div>
    );
  }
  return <Component slug={slug} />;
}
