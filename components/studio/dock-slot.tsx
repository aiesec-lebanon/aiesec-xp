"use client";

import { usePathname } from "next/navigation";

import { Dock } from "./dock";

// The dock is a fixture of the app shell, placed once in the root layout, the
// way the header is. It used to be rendered per page -- sticky over the content
// on two of them and a row at the bottom on the others -- so it sat somewhere
// slightly different on every screen and, on one, over the thing being read.
//
// Where it is not: /tv is projected in an office and navigates nowhere;
// /welcome is the first-run character picker, whose whole job is to be finished
// before anything else; the admin console and the signed-out screens have no
// use for member navigation.
const BARE = ["/tv", "/welcome", "/login", "/unauthorized", "/admin"];

export function DockSlot({ show }: { show: boolean }) {
  const pathname = usePathname();

  if (!show) return null;
  if (BARE.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return (
    <div className="flex shrink-0 justify-center px-6 pb-5 pt-1.5">
      <Dock />
    </div>
  );
}
