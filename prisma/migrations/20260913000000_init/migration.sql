
-- CreateEnum
CREATE TYPE "AssignmentState" AS ENUM ('PENDING', 'LINKED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'IMPORT', 'GIS_FALLBACK');

-- CreateEnum
CREATE TYPE "FunnelEvent" AS ENUM ('APL', 'APD', 'RE', 'APD_BROKEN', 'RE_BROKEN');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "ThresholdType" AS ENUM ('POINTS', 'APL_COUNT', 'APD_COUNT', 'RE_COUNT');

-- CreateEnum
CREATE TYPE "MatcherField" AS ENUM ('ROLE_NAME', 'TITLE');

-- CreateEnum
CREATE TYPE "AnomalyKind" AS ENUM ('UNKNOWN_PROGRAMME_WEIGHT', 'BREAK_WITHOUT_STAGE_EVENT', 'UNATTRIBUTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Office" (
    "id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" BIGINT,
    "isMc" BOOLEAN NOT NULL DEFAULT false,
    "isOperating" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" BIGINT NOT NULL,
    "fullName" TEXT NOT NULL,
    "aiesecEmail" TEXT,
    "profilePhotoUrl" TEXT,
    "homeOfficeId" BIGINT,
    "scoringOfficeId" BIGINT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" BIGINT NOT NULL,
    "memberId" BIGINT NOT NULL,
    "officeId" BIGINT NOT NULL,
    "roleName" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpAssignment" (
    "id" TEXT NOT NULL,
    "epPersonId" BIGINT,
    "epFullName" TEXT NOT NULL,
    "state" "AssignmentState" NOT NULL DEFAULT 'PENDING',
    "memberId" BIGINT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "source" "AssignmentSource" NOT NULL,
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeEvent" (
    "id" TEXT NOT NULL,
    "applicationId" BIGINT NOT NULL,
    "eventType" "FunnelEvent" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "epPersonId" BIGINT NOT NULL,
    "epFullName" TEXT NOT NULL,
    "epHomeLcId" BIGINT,
    "programmeId" INTEGER NOT NULL,
    "direction" "Direction" NOT NULL,
    "personHomeLcId" BIGINT,
    "opportunityHomeLcId" BIGINT,
    "opportunityTitle" TEXT,
    "applicationStatus" TEXT,
    "gisManagerIds" BIGINT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreConfig" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "aplPoints" DECIMAL(10,4) NOT NULL,
    "apdPoints" DECIMAL(10,4) NOT NULL,
    "rePoints" DECIMAL(10,4) NOT NULL,
    "reverseApl" BOOLEAN NOT NULL DEFAULT true,
    "productWeights" JSONB NOT NULL,
    "directionWeights" JSONB NOT NULL,
    "scopeSides" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayWindow" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DisplayWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "thresholdType" "ThresholdType" NOT NULL,
    "threshold" DECIMAL(10,4) NOT NULL,
    "valueAmount" DECIMAL(12,2),
    "valueCurrency" TEXT,
    "iconKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMatcher" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "field" "MatcherField" NOT NULL,

    CONSTRAINT "AdminMatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreLedgerEntry" (
    "id" TEXT NOT NULL,
    "memberId" BIGINT NOT NULL,
    "exchangeEventId" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "points" DECIMAL(12,4) NOT NULL,
    "countDelta" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardGrant" (
    "id" TEXT NOT NULL,
    "memberId" BIGINT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringAnomaly" (
    "id" TEXT NOT NULL,
    "exchangeEventId" TEXT NOT NULL,
    "kind" "AnomalyKind" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "pass" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "eventsSeen" INTEGER NOT NULL DEFAULT 0,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncWatermark" (
    "pass" TEXT NOT NULL,
    "watermark" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncWatermark_pkey" PRIMARY KEY ("pass")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Office_parentId_idx" ON "Office"("parentId");

-- CreateIndex
CREATE INDEX "Office_isOperating_idx" ON "Office"("isOperating");

-- CreateIndex
CREATE INDEX "Member_scoringOfficeId_idx" ON "Member"("scoringOfficeId");

-- CreateIndex
CREATE INDEX "Position_memberId_idx" ON "Position"("memberId");

-- CreateIndex
CREATE INDEX "Position_officeId_status_idx" ON "Position"("officeId", "status");

-- CreateIndex
CREATE INDEX "EpAssignment_epPersonId_effectiveFrom_idx" ON "EpAssignment"("epPersonId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EpAssignment_memberId_idx" ON "EpAssignment"("memberId");

-- CreateIndex
CREATE INDEX "EpAssignment_state_idx" ON "EpAssignment"("state");

-- CreateIndex
CREATE INDEX "ExchangeEvent_epPersonId_occurredAt_idx" ON "ExchangeEvent"("epPersonId", "occurredAt");

-- CreateIndex
CREATE INDEX "ExchangeEvent_eventType_occurredAt_idx" ON "ExchangeEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ExchangeEvent_occurredAt_idx" ON "ExchangeEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeEvent_applicationId_eventType_key" ON "ExchangeEvent"("applicationId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreConfig_version_key" ON "ScoreConfig"("version");

-- CreateIndex
CREATE INDEX "ScoreConfig_isActive_idx" ON "ScoreConfig"("isActive");

-- CreateIndex
CREATE INDEX "DisplayWindow_isActive_idx" ON "DisplayWindow"("isActive");

-- CreateIndex
CREATE INDEX "Reward_isActive_sortOrder_idx" ON "Reward"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMatcher_field_pattern_key" ON "AdminMatcher"("field", "pattern");

-- CreateIndex
CREATE INDEX "ScoreLedgerEntry_memberId_occurredAt_idx" ON "ScoreLedgerEntry"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "ScoreLedgerEntry_exchangeEventId_idx" ON "ScoreLedgerEntry"("exchangeEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreLedgerEntry_memberId_exchangeEventId_key" ON "ScoreLedgerEntry"("memberId", "exchangeEventId");

-- CreateIndex
CREATE INDEX "RewardGrant_rewardId_idx" ON "RewardGrant"("rewardId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardGrant_memberId_rewardId_key" ON "RewardGrant"("memberId", "rewardId");

-- CreateIndex
CREATE INDEX "ScoringAnomaly_kind_idx" ON "ScoringAnomaly"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringAnomaly_exchangeEventId_kind_key" ON "ScoringAnomaly"("exchangeEventId", "kind");

-- CreateIndex
CREATE INDEX "SyncRun_pass_startedAt_idx" ON "SyncRun"("pass", "startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_homeOfficeId_fkey" FOREIGN KEY ("homeOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_scoringOfficeId_fkey" FOREIGN KEY ("scoringOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpAssignment" ADD CONSTRAINT "EpAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLedgerEntry" ADD CONSTRAINT "ScoreLedgerEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLedgerEntry" ADD CONSTRAINT "ScoreLedgerEntry_exchangeEventId_fkey" FOREIGN KEY ("exchangeEventId") REFERENCES "ExchangeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLedgerEntry" ADD CONSTRAINT "ScoreLedgerEntry_configVersion_fkey" FOREIGN KEY ("configVersion") REFERENCES "ScoreConfig"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardGrant" ADD CONSTRAINT "RewardGrant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardGrant" ADD CONSTRAINT "RewardGrant_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringAnomaly" ADD CONSTRAINT "ScoringAnomaly_exchangeEventId_fkey" FOREIGN KEY ("exchangeEventId") REFERENCES "ExchangeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one active display window (D-21) and one active scoring config.
-- Prisma cannot express a partial unique index, so these are added by hand.
CREATE UNIQUE INDEX "DisplayWindow_single_active"
  ON "DisplayWindow" ("isActive") WHERE "isActive";

CREATE UNIQUE INDEX "ScoreConfig_single_active"
  ON "ScoreConfig" ("isActive") WHERE "isActive";
