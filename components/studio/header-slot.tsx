"use client";

import { usePathname } from "next/navigation";

import type { CurrentUser } from "@/lib/auth/current-user";

import { Header } from "./chrome";

// /tv is projected in an office, not used: a profile pill and a sign-out button
// are noise on it, and it draws its own brandmark, so the global header put the
// wordmark on screen twice. It gets its own way home instead.
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
