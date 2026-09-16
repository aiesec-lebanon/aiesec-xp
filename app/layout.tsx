import type { Metadata } from "next";

import { MotionProvider } from "@/components/motion/motion-provider";
import { ReduceMotionToggle } from "@/components/motion/reduce-motion-toggle";
import { typeSystem } from "@/lib/design/fonts";
import { readReduceMotion } from "@/lib/design/motion-preference";

import "./globals.css";

export const metadata: Metadata = {
  title: "AIESEC XP",
  description: "AIESEC in Lebanon | AIESEC XP",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const reduceMotion = await readReduceMotion();

  return (
    <html
      lang="en"
      data-type-system={typeSystem.name}
      data-reduce-motion={reduceMotion ? "true" : "false"}
      className={`${typeSystem.className} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface">
        <MotionProvider reduceMotion={reduceMotion}>
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
          {/*
            D-46 asks for this control on every page, including before sign-in,
            so it lives in the root layout rather than on a settings screen. It
            is pinned to the corner opposite the dock: /me states the same switch
            at full size in the designed row, and both read one cookie, so a
            member who finds either finds the setting.
          */}
          <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5">
            <div className="pointer-events-auto rounded-full bg-surface-raised px-3.5 py-2 shadow-e1">
              <ReduceMotionToggle />
            </div>
            {/*
              Game Icons ships under CC BY 3.0, which requires the credit to be
              reachable from the product rather than only from ATTRIBUTIONS.md.
              Now that the stage icons render on member-facing screens and not
              just /lab, this line is the thing that satisfies it.
            */}
            <p className="pointer-events-auto text-[10px] text-ink-faint">
              Icons by game-icons.net, CC BY 3.0
            </p>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
