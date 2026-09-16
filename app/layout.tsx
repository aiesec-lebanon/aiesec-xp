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
      <body className="min-h-full flex flex-col">
        <MotionProvider reduceMotion={reduceMotion}>
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
          <footer className="mt-auto flex justify-end px-6 py-4">
            <ReduceMotionToggle />
          </footer>
        </MotionProvider>
      </body>
    </html>
  );
}
