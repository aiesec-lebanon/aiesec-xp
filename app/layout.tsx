import type { Metadata } from "next";

import { currentUser } from "@/lib/auth/current-user";
import { memberAvatar } from "@/lib/design/avatar";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ReduceMotionToggle } from "@/components/motion/reduce-motion-toggle";
import { SiteFooter } from "@/components/studio/chrome";
import { HeaderSlot } from "@/components/studio/header-slot";
import { typeSystem } from "@/lib/design/fonts";
import { readReduceMotion } from "@/lib/design/motion-preference";

import "./globals.css";

export const metadata: Metadata = {
  title: "AIESEC XP",
  description: "AIESEC in Lebanon | AIESEC XP",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [reduceMotion, user] = await Promise.all([readReduceMotion(), currentUser()]);
  // The profile pill shows the member's own character, so it is resolved here
  // rather than per page -- the header renders on every screen.
  const avatar =
    user && user.role !== "DENIED" ? await memberAvatar(user.id, user.fullName) : null;

  return (
    <html
      lang="en"
      data-type-system={typeSystem.name}
      data-reduce-motion={reduceMotion ? "true" : "false"}
      className={`${typeSystem.className} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-surface">
        <MotionProvider reduceMotion={reduceMotion}>
          <HeaderSlot user={user} characterId={avatar?.character.id} />
          {/* The one scroll container in the product: the shell is exactly the
              viewport and the page moves inside it. It is a flex column, so a
              page root is a flex item and picks one of two contracts.

              Grows with its content: `min-h-full shrink-0`. Without `shrink-0`
              the item is squeezed back to `min-h-full` -- one viewport -- while
              its content spills out of the box, which strands the page's own
              padding-bottom at the fold and lands the last card flush against
              the bottom edge.

              Fits the viewport and scrolls its own inner region: `min-h-0
              flex-1`, as /leaderboard and the dashboard's stage do. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          <SiteFooter />
          {/* <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5">
            <div className="pointer-events-auto rounded-full bg-surface-raised px-3.5 py-2 shadow-e1">
              <ReduceMotionToggle />
            </div>
          </div> */}
        </MotionProvider>
      </body>
    </html>
  );
}
