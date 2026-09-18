import { redirect } from "next/navigation";

import { requireMemberPage } from "@/lib/auth/guards";
import { memberAvatar } from "@/lib/design/avatar";

import { ChooseCharacter } from "./choose-character";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireMemberPage("/welcome");
  const avatar = await memberAvatar(user.id, user.fullName);

  // Nothing to do here once a member has picked; the dashboard is the point.
  if (avatar.chosen) redirect("/");

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Welcome to AIESEC XP
        </p>
        <h1 className="font-display text-3xl font-semibold text-ink">Pick your character</h1>
        <p className="max-w-[34ch] text-sm text-ink-secondary">
          They stand in for you on the leaderboards, and their face becomes your profile picture.
        </p>
      </div>

      <ChooseCharacter name={user.fullName} initialCharacter={avatar.character.id} />
    </main>
  );
}
