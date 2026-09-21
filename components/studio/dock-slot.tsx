"use client";

import { usePathname } from "next/navigation";

import { Dock } from "./dock";

// The dock is part of the header, placed once there and nowhere else. It used
// to be rendered per page -- sticky over the content on two of them and a row
// at the bottom on the others -- so it sat somewhere slightly different on
// every screen. At the foot of the page it also read as a floating lozenge over
// the end of the content, which the leaderboards could carry and the quieter
// screens could not.
//
// Where it is not: /welcome is the first-run character picker, whose whole job
// is to be finished before anything else, and the admin console has its own
// navigation and a way back. Anything the header itself hides -- /tv, and every
// screen with no session -- never reaches this.
const BARE = ["/welcome", "/admin"];

export function DockSlot() {
  const pathname = usePathname();

  if (BARE.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return <Dock />;
}
