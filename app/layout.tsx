import type { Metadata } from "next";

import { currentUser } from "@/lib/auth/current-user";
import { memberAvatar } from "@/lib/design/avatar";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ReduceMotionToggle } from "@/components/motion/reduce-motion-toggle";
import { DockSlot } from "@/components/studio/dock-slot";
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
      {/* The app shell: header at the top, dock at the bottom, one scrolling
          area between them. Both fixtures are placed here and nowhere else, so
          they sit in exactly the same spot on every screen and no page can put
          them somewhere of its own.
          h-dvh rather than h-full: on a phone the difference is the height of
          the browser's own address bar, and the dock is what falls off. */}
      <body className="flex h-dvh flex-col overflow-hidden bg-surface">
        <MotionProvider reduceMotion={reduceMotion}>
          <HeaderSlot user={user} characterId={avatar?.character.id} />
          {/* The one scroll container in the product. A page that fits claims
              the space with flex-1 and never scrolls at all; a page that does
              not scrolls here, under a header and above a dock that stay put. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          <DockSlot show={user !== null && user.role !== "DENIED"} />
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
