-- D-66. Scheduling moves from Vercel Cron to GitHub Actions, with two jobs --
-- EP data and the roster -- that a schedule and an admin's button can both
-- trigger. Additive only: nothing existing is altered, so this can be applied
-- before the code that reads it is deployed.

CREATE TYPE "SyncTrigger" AS ENUM ('HACKATHON', 'SCHEDULE', 'MANUAL');

-- The lease on a job's row is what stops a cron tick and a button running the
-- same job at once. Rows are created on first use.
CREATE TABLE "SyncJob" (
    "name" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastStatus" "SyncStatus",
    "lastTrigger" "SyncTrigger",
    "lastError" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("name")
);

-- One row, by construction, for the same reason as TermSettings.
CREATE TABLE "SyncSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hackathonUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SyncSettings_singleton" CHECK ("id" = 'singleton')
);

-- Hackathon mode starts off.
INSERT INTO "SyncSettings" ("id", "hackathonUntil", "updatedAt")
VALUES ('singleton', NULL, NOW())
ON CONFLICT ("id") DO NOTHING;
