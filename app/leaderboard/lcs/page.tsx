import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { officeStandings } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function LcLeaderboardPage() {
  await requireMemberPage("/leaderboard/lcs");
  const standings = await officeStandings();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">LC leaderboard</h1>
        <Link href="/" className="text-sm underline">
          Back
        </Link>
      </header>

      <table className="w-full text-left text-sm">
        <thead className="text-neutral-500">
          <tr>
            <th className="py-2">#</th>
            <th>Entity</th>
            <th className="text-right">Members</th>
            <th className="text-right">APL</th>
            <th className="text-right">APD</th>
            <th className="text-right">RE</th>
            <th className="text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr key={String(standing.officeId)} className="border-t">
              <td className="py-2 tabular-nums">{standing.rank}</td>
              <td>{standing.officeName}</td>
              <td className="text-right tabular-nums">{standing.memberCount}</td>
              <td className="text-right tabular-nums">{standing.aplCount}</td>
              <td className="text-right tabular-nums">{standing.apdCount}</td>
              <td className="text-right tabular-nums">{standing.reCount}</td>
              <td className="text-right tabular-nums">{standing.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-sm text-neutral-500">
        Each member counts for one entity: the office of their highest-ranked active position.
        Members of the MC are their own entity.
      </p>
      <Link href="/leaderboard" className="text-sm underline">
        Individual leaderboard
      </Link>
    </main>
  );
}
