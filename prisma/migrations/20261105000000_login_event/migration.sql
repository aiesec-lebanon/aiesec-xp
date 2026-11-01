-- One row per successful sign-in, so "last login" and login counts are
-- answerable. Member."lastSyncedAt" cannot: the roster sync writes it as well.

CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "memberId" BIGINT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginEvent_memberId_at_idx" ON "LoginEvent"("memberId", "at");
CREATE INDEX "LoginEvent_at_idx" ON "LoginEvent"("at");

ALTER TABLE "LoginEvent"
    ADD CONSTRAINT "LoginEvent_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
