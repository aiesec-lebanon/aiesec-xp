"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the server render on an interval.
 *
 * `/tv` says "Live" and is left running on an office screen, but nothing on it
 * polled -- the board was as old as the last page load. `router.refresh()` keeps
 * the component tree mounted, which is what lets the rows move and the numbers
 * roll to their new values instead of the board simply being different.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      // A tab nobody is looking at does not need the database.
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return null;
}
