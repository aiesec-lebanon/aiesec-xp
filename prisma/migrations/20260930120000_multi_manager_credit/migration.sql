-- D-73..D-77. Several members can be credited with one EP, from EXPA, the
-- sheet or an admin, and share its points by position role.

-- ── Ledger: the stage each entry pays for, and the member's share ───────────
CREATE TYPE "ScoredStage" AS ENUM ('APL', 'APD', 'RE');

ALTER TABLE "ScoreLedgerEntry"
  ADD COLUMN "stage" "ScoredStage",
  ADD COLUMN "share" DECIMAL(7,6) NOT NULL DEFAULT 1;

-- Derived rows, but backfilled rather than dropped so no screen reads zero
-- between this migration and the next replay.
UPDATE "ScoreLedgerEntry" AS l
SET "stage" = (CASE e."eventType"::text
                 WHEN 'APL' THEN 'APL'
                 WHEN 'APD' THEN 'APD'
                 WHEN 'APD_BROKEN' THEN 'APD'
                 ELSE 'RE'
               END)::"ScoredStage"
FROM "ExchangeEvent" AS e
WHERE e."id" = l."exchangeEventId";

ALTER TABLE "ScoreLedgerEntry" ALTER COLUMN "stage" SET NOT NULL;

-- ── Role shares (D-73) ──────────────────────────────────────────────────────
-- Seeded equal for every role O-03 measured, so nothing is invented: until an
-- admin sets shares, everyone on an EP splits it evenly.
ALTER TABLE "ScoreConfig" ADD COLUMN "roleShares" JSONB NOT NULL DEFAULT '{}';

UPDATE "ScoreConfig"
SET "roleShares" = '{"MCP": 12.5, "MCVP": 12.5, "LCP": 12.5, "LCVP": 12.5, "TL": 12.5, "TM": 12.5, "ESTL": 12.5, "ESTM": 12.5}'::jsonb;

-- ── Assignment register: one row per EP and member (D-73) ───────────────────
ALTER TABLE "EpAssignment"
  ADD COLUMN "fromExpa"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fromSheet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fromAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "removedBy" BIGINT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "EpAssignment"
SET "fromSheet" = ("source" = 'SHEET'),
    "fromAdmin" = ("source" = 'ADMIN');

-- Credit is now whoever holds the EP, not whoever held it on the day (D-73
-- supersedes D-36), so an assignment that had already ended no longer counts.
DELETE FROM "EpAssignment" WHERE "effectiveTo" IS NOT NULL;

-- Two effective dates for one EP and member become one row, keeping the
-- earliest and every source either carried.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "epPersonId", "memberId" ORDER BY "createdAt", "id") AS rn,
         BOOL_OR("fromSheet") OVER (PARTITION BY "epPersonId", "memberId") AS any_sheet,
         BOOL_OR("fromAdmin") OVER (PARTITION BY "epPersonId", "memberId") AS any_admin
  FROM "EpAssignment"
)
UPDATE "EpAssignment" AS a
SET "fromSheet" = r.any_sheet, "fromAdmin" = r.any_admin
FROM ranked AS r
WHERE a."id" = r."id" AND r.rn = 1;

DELETE FROM "EpAssignment" AS a
USING (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "epPersonId", "memberId" ORDER BY "createdAt", "id") AS rn
  FROM "EpAssignment"
) AS d
WHERE a."id" = d."id" AND d.rn > 1;

ALTER TABLE "EpAssignment" DROP CONSTRAINT "EpAssignment_epPersonId_effectiveFrom_key";
DROP INDEX IF EXISTS "EpAssignment_epPersonId_effectiveFrom_idx";

ALTER TABLE "EpAssignment"
  DROP COLUMN "effectiveFrom",
  DROP COLUMN "effectiveTo",
  DROP COLUMN "source",
  ALTER COLUMN "updatedAt" DROP DEFAULT;

DROP TYPE "AssignmentSource";

CREATE UNIQUE INDEX "EpAssignment_epPersonId_memberId_key"
  ON "EpAssignment"("epPersonId", "memberId");

-- ── Sheets resolve their own responsible members (D-77) ─────────────────────
-- The sheet's Emails tab maps a responsible member's name to their EXPA id, so
-- the hand-maintained label mapping (O-10) is no longer needed.
ALTER TABLE "AssignmentSheet" ADD COLUMN "managersTabName" TEXT NOT NULL DEFAULT 'Emails';

DROP TABLE "ManagerAlias";

-- ── Sync reads by last action (D-76) ────────────────────────────────────────
-- One pass over applications by updated_at replaces the six per-stage passes;
-- their watermarks are read by nothing any more.
DELETE FROM "SyncWatermark" WHERE "pass" IN ('apl', 'apd', 're', 're_remote', 'apd_broken', 're_broken');
