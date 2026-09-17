import type { Metadata } from "next";

import { currentUser } from "@/lib/auth/current-user";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ReduceMotionToggle } from "@/components/motion/reduce-motion-toggle";
import { Header } from "@/components/studio/chrome";
import { typeSystem } from "@/lib/design/fonts";
import { readReduceMotion } from "@/lib/design/motion-preference";

import "./globals.css";

export const metadata: Metadata = {
  title: "AIESEC XP",
  description: "AIESEC in Lebanon | AIESEC XP",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [reduceMotion, user] = await Promise.all([readReduceMotion(), currentUser()]);

  return (
    <html
      lang="en"
      data-type-system={typeSystem.name}
      data-reduce-motion={reduceMotion ? "true" : "false"}
      className={`${typeSystem.className} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface">
        <MotionProvider reduceMotion={reduceMotion}>
          <Header user={user} />
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
          {/* <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5">
            <div className="pointer-events-auto rounded-full bg-surface-raised px-3.5 py-2 shadow-e1">
              <ReduceMotionToggle />
            </div>
            <p className="pointer-events-auto text-[10px] text-ink-faint">
              Icons by game-icons.net, CC BY 3.0
            </p>
          </div> */}
        </MotionProvider>
      </body>
    </html>
  );
}
