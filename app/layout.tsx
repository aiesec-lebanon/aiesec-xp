import type { Metadata } from "next";

import { currentUser } from "@/lib/auth/current-user";
import { memberAvatar } from "@/lib/design/avatar";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ReduceMotionToggle } from "@/components/motion/reduce-motion-toggle";
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
      <body className="flex min-h-full flex-col bg-surface">
        <MotionProvider reduceMotion={reduceMotion}>
          <HeaderSlot user={user} characterId={avatar?.character.id} />
          {/* min-h-0, not min-h-full: a wrapper that demands a full viewport of
              its own under a header that is already on screen makes every page
              exactly the header's height too tall to fit. A page that wants the
              rest of the screen and no scrollbar now claims it with flex-1. */}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
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
