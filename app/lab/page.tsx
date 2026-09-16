import { notFound } from "next/navigation";

import { LabSurface } from "./lab-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lab | AIESEC XP" };

// A development-only surface that renders one of everything the visual stack can
// do, so a regression in the 3D, motion, chart or icon layers shows up here
// rather than in a member's dashboard. It is not a route in Architecture.md 9 and
// never reaches production: this 404s, and proxy.ts only makes /lab public in
// development.
export default function LabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <LabSurface />;
}
