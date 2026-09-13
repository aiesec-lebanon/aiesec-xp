import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { personalProgress } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const PROGRAMMES: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

const STAGES: Record<string, string> = {
  APL: "Application",
  APD: "Approved",
  RE: "Realized",
  APD_BROKEN: "Approval broken",
  RE_BROKEN: "Realization broken",
};

function unit(thresholdType: string): string {
  switch (thresholdType) {
    case "POINTS":
      return "points";
    case "APL_COUNT":
      return "applications";
    case "APD_COUNT":
      return "approvals";
    case "RE_COUNT":
      return "realizations";
    default:
      return "";
  }
}

export default async function HomePage() {
  const user = await requireMemberPage("/");
  const progress = await personalProgress(user.id);
  const standing = progress.standing;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{user.fullName}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {standing?.officeName ?? "No office"} &middot; {user.role}
          </p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-wrap gap-8">
        <div>
          <p className="text-3xl font-semibold tabular-nums">{standing?.points ?? 0}</p>
          <p className="text-sm text-neutral-500">points</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums">
            {standing ? `${standing.rank}` : "-"}
            <span className="text-base font-normal text-neutral-500">
              {standing ? ` of ${progress.totalMembers}` : ""}
            </span>
          </p>
          <p className="text-sm text-neutral-500">rank</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums">{standing?.aplCount ?? 0}</p>
          <p className="text-sm text-neutral-500">applications</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums">{standing?.apdCount ?? 0}</p>
          <p className="text-sm text-neutral-500">approvals</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums">{standing?.reCount ?? 0}</p>
          <p className="text-sm text-neutral-500">realizations</p>
        </div>
      </section>

      {progress.nextUp ? (
        <p className="text-sm">
          {Math.round((progress.nextUp.points - (standing?.points ?? 0)) * 10_000) / 10_000} points
          behind {progress.nextUp.fullName} at rank {progress.nextUp.rank}.
        </p>
      ) : standing?.rank === 1 ? (
        <p className="text-sm">You are first.</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Rewards</h2>
        {progress.rewards.length === 0 ? (
          <p className="text-sm text-neutral-500">No rewards are configured yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {progress.rewards.map((reward) => {
              const remaining = Math.max(0, reward.threshold - reward.current);
              return (
                <li key={reward.id} className="border-t pt-3">
                  <p className="font-medium">
                    {reward.label} {reward.earned ? "- earned" : ""}
                  </p>
                  {reward.description ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {reward.description}
                    </p>
                  ) : null}
                  <p className="text-sm">
                    {reward.current} of {reward.threshold} {unit(reward.thresholdType)}
                    {reward.earned
                      ? ""
                      : ` - ${remaining} more ${unit(reward.thresholdType)} to go`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Your events
        </h2>
        {progress.trail.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing scored yet. Points appear once an EP assigned to you reaches a funnel stage
            inside the current window.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-1">Stage</th>
                <th>Product</th>
                <th>When</th>
                <th className="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {progress.trail.map((entry, index) => (
                <tr key={index} className="border-t">
                  <td className="py-1">{STAGES[entry.eventType] ?? entry.eventType}</td>
                  <td>{PROGRAMMES[entry.programmeId] ?? entry.programmeId}</td>
                  <td>{entry.occurredAt.toISOString().slice(0, 10)}</td>
                  <td className="text-right tabular-nums">{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <nav className="flex gap-4 text-sm">
        <Link href="/leaderboard" className="underline">
          Individual leaderboard
        </Link>
        <Link href="/leaderboard/lcs" className="underline">
          LC leaderboard
        </Link>
        {user.role === "ADMIN" ? (
          <Link href="/admin/assignments" className="underline">
            Assignments
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
