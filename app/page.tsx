import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/auth/guards";

// Placeholder for the personal dashboard (step 6). It exists now to prove the
// authorization chain end to end: cookie, stored positions, operating offices,
// resolved role.
export default async function HomePage() {
  const user = await requireMemberPage("/");

  const offices = await db.office.findMany({
    where: { id: { in: user.inScopePositions.map((position) => position.officeId) } },
    select: { id: true, name: true },
  });

  const officeName = (id: bigint) =>
    offices.find((office) => office.id === id)?.name ?? `Office ${id}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{user.fullName}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Signed in as {user.role}
          </p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Positions</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {user.inScopePositions.map((position) => (
            <li key={`${position.officeId}-${position.title}`}>
              {position.roleName ?? "Member"}
              {position.title ? `, ${position.title}` : ""} at {officeName(position.officeId)}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-neutral-500">
        Leaderboard and progress arrive in step 6.
      </p>
    </main>
  );
}
