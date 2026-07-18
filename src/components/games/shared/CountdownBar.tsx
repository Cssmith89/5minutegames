"use client";

import { useEffect, useState } from "react";

// A width-animated bar that IS the timer — no setInterval ticking a
// percentage, just a CSS transition from 100% to 0% over durationMs. Mounts
// at full width with no transition, then (after one rAF frame — same
// one-shot trick reflex-test uses to trigger its target-movement
// transitions) flips to 0% with the transition enabled, so the browser
// compositor drives the animation instead of React re-rendering every
// frame. Callers should pass a fresh `key` per round so this remounts
// cleanly, and pair it with their own setTimeout(durationMs) for the actual
// judging deadline — this component is purely visual, not authoritative.
export default function CountdownBar({ durationMs }: { durationMs: number }) {
  // Starts collapsed=false (the initial state) and flips true after one rAF
  // frame. Callers pass a fresh `key` per round so this remounts — and
  // re-initializes to false — rather than relying on this effect to reset
  // state on a durationMs change.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div
        className="h-full rounded-full bg-accent"
        style={{
          width: collapsed ? "0%" : "100%",
          transition: collapsed ? `width ${durationMs}ms linear` : "none",
        }}
      />
    </div>
  );
}
