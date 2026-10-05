"use client";

import { usePathname } from "next/navigation";

import type { CurrentUser } from "@/lib/auth/current-user";

import { Header } from "./chrome";

// /tv draws its own brandmark and chrome.
const BARE = ["/tv"];

export function HeaderSlot({
  user,
  characterId,
}: {
  user: CurrentUser | null;
  characterId?: string;
}) {
  const pathname = usePathname();
  if (BARE.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  return <Header user={user} characterId={characterId} />;
}
