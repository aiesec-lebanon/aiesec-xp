import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { contactTopicLabel } from "@/lib/privacy/contact";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { RequestControls } from "./controls";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: string }> = {
  RECEIVED: { label: "New", tone: "bg-apl-wash text-apl-ink" },
  IN_PROGRESS: { label: "In progress", tone: "bg-re-wash text-re-ink" },
  COMPLETED: { label: "Done", tone: "bg-apd-wash text-apd-ink" },
  REFUSED: { label: "Refused", tone: "bg-surface-sunken text-ink-secondary" },
};

function isOverdue(dueAt: Date, closedAt: Date | null): boolean {
  return closedAt === null && dueAt.getTime() < Date.now();
}

function day(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function PrivacyAdminPage() {
  const user = await requireMemberPage("/admin/privacy");

  if (user.role !== "ADMIN") {
    return (
      <main className="flex min-h-full shrink-0 flex-col items-center justify-center gap-3 bg-wall px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Not available</h1>
        <p className="text-sm text-ink-secondary">Only the MC&rsquo;s admins can open this page.</p>
        <Link href="/" className="mt-2 text-sm font-semibold text-apl-ink">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  const requests = await db.privacyRequest.findMany({
    orderBy: [{ closedAt: { sort: "desc", nulls: "first" } }, { dueAt: "asc" }],
    take: 200,
  });
  const memberIds = requests.flatMap((request) => (request.memberId ? [request.memberId] : []));
  const members = await db.member.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, fullName: true, hiddenFromBoards: true },
  });
  const byId = new Map(members.map((member) => [String(member.id), member]));

  return (
    <main className="page-end min-h-full shrink-0 bg-wall px-6 pt-8 sm:px-11">
      <Rise className="flex flex-col gap-7 rounded-[28px] bg-surface p-7 shadow-e3 sm:p-12">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-[28px] font-semibold text-ink">Privacy</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              Messages from the privacy notice&rsquo;s contact form. Answer each within one month.
              Confirm who someone is before linking their message to a member or acting on their
              data, and reply before you mark it done: closing a request removes the reply address.
            </p>
          </div>
          <AdminNav active="privacy" />
        </header>

        {requests.length === 0 ? (
          <p className="text-sm text-ink-secondary">No messages yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {requests.map((request) => {
              const member = request.memberId ? byId.get(String(request.memberId)) : undefined;
              const status = STATUS[request.status] ?? STATUS.REFUSED;
              const overdue = isOverdue(request.dueAt, request.closedAt);
              return (
                <li key={request.id} className="rounded-2xl bg-surface-raised p-5 shadow-e1">
                  <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
                    <span className={`rounded-full px-3 py-1 font-semibold ${status.tone}`}>{status.label}</span>
                    <span className="font-semibold text-ink">{contactTopicLabel(request.kind)}</span>
                    <span className="text-ink-muted">
                      from {request.senderName}
                      {member ? ` (member: ${member.fullName})` : request.memberId ? " (member record removed)" : " (not linked to a member)"}
                    </span>
                    {member?.hiddenFromBoards && (
                      <span className="rounded-full bg-surface-sunken px-3 py-1 text-ink-secondary">
                        Off the leaderboards
                      </span>
                    )}
                    <span className={`ml-auto ${overdue ? "font-semibold text-break-ink" : "text-ink-muted"}`}>
                      {request.closedAt
                        ? `Closed ${day(request.closedAt)}`
                        : `Received ${day(request.receivedAt)} · due ${day(request.dueAt)}${overdue ? " · overdue" : ""}`}
                    </span>
                  </div>
                  {request.replyEmail && (
                    <p className="mt-1 text-[13px] text-ink-muted">Reply to {request.replyEmail}</p>
                  )}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink-secondary">
                    {request.message}
                  </p>
                  <RequestControls
                    row={{
                      id: request.id,
                      status: request.status,
                      memberId: member ? String(member.id) : null,
                      memberName: member?.fullName ?? null,
                      hiddenFromBoards: member?.hiddenFromBoards ?? false,
                      replyEmail: request.replyEmail,
                      message: request.message,
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Rise>
    </main>
  );
}
