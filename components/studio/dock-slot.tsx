"use client";

import { usePathname } from "next/navigation";

import { Dock } from "./dock";

const BARE = ["/welcome", "/admin"];

export function DockSlot() {
  const pathname = usePathname();

  if (BARE.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return <Dock />;
}
