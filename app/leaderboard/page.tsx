import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { individualStandings } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ office?: string }>;
}) {
  const user = await requireMemberPage("/leaderboard");
  const params = await searchParams;

  const offices = await db.office.findMany({
    where: { isOperating: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selected =
    params.office && /^\d+$/.test(params.office) ? BigInt(params.office) : undefined;
  const standings = await individualStandings(selected);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Individual leaderboard</h1>
        <Link href="/" className="text-sm underline">
          Back
        </Link>
      </header>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/leaderboard"
          className={selected === undefined ? "font-medium underline" : "underline"}
        >
          Everyone
        </Link>
        {offices.map((office) => (
          <Link
            key={String(office.id)}
            href={`/leaderboard?office=${office.id}`}
            className={selected === office.id ? "font-medium underline" : "underline"}
          >
            {office.name}
          </Link>
        ))}
      </nav>

      {standings.length === 0 ? (
        <p className="text-sm text-neutral-500">No members in scope yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2">#</th>
              <th>Member</th>
              <th>LC</th>
              <th className="text-right">APL</th>
              <th className="text-right">APD</th>
              <th className="text-right">RE</th>
              <th className="text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const isSelf = standing.memberId === user.id;
              return (
                <tr
                  key={String(standing.memberId)}
                  className={`border-t ${isSelf ? "font-medium" : ""}`}
                >
                  <td className="py-2 tabular-nums">{standing.rank}</td>
                  <td>
                    {standing.fullName}
                    {isSelf ? " (you)" : ""}
                  </td>
                  <td className="text-neutral-500">{standing.officeName ?? "-"}</td>
                  <td className="text-right tabular-nums">{standing.aplCount}</td>
                  <td className="text-right tabular-nums">{standing.apdCount}</td>
                  <td className="text-right tabular-nums">{standing.reCount}</td>
                  <td className="text-right tabular-nums">{standing.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="text-sm text-neutral-500">
        Ranked on points, then realizations, then approvals, then applications.
      </p>
    </main>
  );
}
