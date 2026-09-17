import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { DeleteRewardButton, RewardForm, type RewardFormValues } from "./controls";

export const dynamic = "force-dynamic";

const EMPTY: RewardFormValues = {
  label: "",
  description: "",
  thresholdType: "APD_COUNT",
  threshold: "",
  valueAmount: "",
  valueCurrency: "",
  iconKey: "",
  isActive: true,
  sortOrder: "0",
};

export default async function RewardsAdminPage() {
  const user = await requireMemberPage("/admin/rewards");

  if (user.role !== "ADMIN") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-wall px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Not available</h1>
        <p className="text-sm text-ink-secondary">This console is for MCP and MCVP IM.</p>
        <Link href="/" className="mt-2 text-sm font-semibold text-apl-ink">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  const rewards = await db.reward.findMany({ orderBy: [{ sortOrder: "asc" }, { threshold: "asc" }] });

  return (
    <main className="min-h-dvh bg-wall px-6 py-8 sm:px-11">
      <div className="mb-7 flex items-center justify-end gap-4">
        <Link
          href="/"
          className="rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-ink-secondary shadow-e1 transition-colors hover:bg-surface-sunken"
        >
          Back to the dashboard
        </Link>
      </div>

      <Rise className="flex flex-col gap-7 rounded-[28px] bg-surface p-7 shadow-e3 sm:p-12">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-[28px] font-semibold text-ink">Rewards</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              Threshold, label, and an optional value (D-09). No winner cap, no budget ceiling.
              Saving replays grants against every member&rsquo;s current score.
            </p>
          </div>

          <AdminNav active="rewards" />
        </header>

        <section className="flex flex-col gap-5 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
            Existing rewards ({rewards.length})
          </h2>

          {rewards.length === 0 ? (
            <p className="text-[13px] text-ink-secondary">No reward is configured yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {rewards.map((reward) => (
                <li key={reward.id} className="rounded-2xl bg-surface px-5 py-4">
                  <RewardForm
                    submitLabel="Save"
                    values={{
                      id: reward.id,
                      label: reward.label,
                      description: reward.description ?? "",
                      thresholdType: reward.thresholdType,
                      threshold: reward.threshold.toString(),
                      valueAmount: reward.valueAmount?.toString() ?? "",
                      valueCurrency: reward.valueCurrency ?? "",
                      iconKey: reward.iconKey ?? "",
                      isActive: reward.isActive,
                      sortOrder: reward.sortOrder.toString(),
                    }}
                  />
                  <div className="mt-3">
                    <DeleteRewardButton id={reward.id} label={reward.label} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
            Add a reward
          </h2>
          <RewardForm submitLabel="Create" values={EMPTY} />
        </section>
      </Rise>
    </main>
  );
}
