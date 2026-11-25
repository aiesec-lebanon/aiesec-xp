-- Privacy hardening: unused profile fields dropped, board exclusions and the
-- /tv name consent recorded, sessions revocable, refused sign-ins kept without
-- a profile, and privacy requests stored in the app.

ALTER TABLE "Member" DROP COLUMN "aiesecEmail";
ALTER TABLE "Member" DROP COLUMN "profilePhotoUrl";

ALTER TABLE "Member"
  ADD COLUMN "statisticsOptOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hiddenFromBoards" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tvNameConsent"    BOOLEAN,
  ADD COLUMN "tvConsentAt"      TIMESTAMP(3),
  ADD COLUMN "sessionVersion"   INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RefusedSignIn" (
  "id"        TEXT NOT NULL,
  "personRef" TEXT NOT NULL,
  "reason"    TEXT NOT NULL,
  "at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefusedSignIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefusedSignIn_at_idx" ON "RefusedSignIn"("at");

CREATE TABLE "PrivacyRequest" (
  "id"         TEXT NOT NULL,
  "memberId"   BIGINT,
  "kind"       TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'RECEIVED',
  "senderName" TEXT NOT NULL,
  "replyEmail" TEXT,
  "message"    TEXT NOT NULL,
  "ipHash"     TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt"      TIMESTAMP(3) NOT NULL,
  "closedAt"   TIMESTAMP(3),

  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyRequest_status_dueAt_idx" ON "PrivacyRequest"("status", "dueAt");
CREATE INDEX "PrivacyRequest_ipHash_receivedAt_idx" ON "PrivacyRequest"("ipHash", "receivedAt");
CREATE INDEX "PrivacyRequest_memberId_idx" ON "PrivacyRequest"("memberId");

CREATE TABLE "ErasureTombstone" (
  "personRef" TEXT NOT NULL,
  "erasedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ErasureTombstone_pkey" PRIMARY KEY ("personRef")
);
