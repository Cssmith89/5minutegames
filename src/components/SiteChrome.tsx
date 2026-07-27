"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const IMMERSIVE_ROUTE = /^\/books\/[^/]+\/read$/;

export default function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname && IMMERSIVE_ROUTE.test(pathname)) {
    return <>{children}</>;
  }
  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
