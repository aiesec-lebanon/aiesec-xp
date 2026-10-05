import type { Metadata } from "next";

import { currentUser } from "@/lib/auth/current-user";
import { memberAvatar } from "@/lib/design/avatar";
import { MotionProvider } from "@/components/motion/motion-provider";
import { SiteFooter } from "@/components/studio/chrome";
import { HeaderSlot } from "@/components/studio/header-slot";
import { ToastProvider } from "@/components/studio/toast";
import { typeSystem } from "@/lib/design/fonts";
import { readReduceMotion } from "@/lib/design/motion-preference";

import "./globals.css";

export const metadata: Metadata = {
  title: "AIESEC XP",
  description: "Your exchange points, rank and rewards in AIESEC in Lebanon.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [reduceMotion, user] = await Promise.all([readReduceMotion(), currentUser()]);
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
          <ToastProvider>
            <HeaderSlot user={user} characterId={avatar?.character.id} />
            {/* Page roots are flex items: `min-h-full shrink-0` to grow with content
                (without shrink-0 they get squeezed), or `min-h-0 flex-1` to scroll inside. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
            <SiteFooter />
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
