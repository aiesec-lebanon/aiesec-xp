-- O-14 closed: the character lab can now save. The chosen body and its colours
-- are a member's own setting, so they live beside Member rather than on it --
-- Member is the GIS sync projection and its "lastSyncedAt" is @updatedAt, so
-- writing an avatar there would keep reporting a sync that never happened.
--
-- A NULL colour means the part keeps the colour it was authored with (D-50),
-- which is not the same as any hex a member could pick.

CREATE TABLE "MemberAvatar" (
    "memberId" BIGINT NOT NULL,
    "character" TEXT NOT NULL,
    "skin" TEXT,
    "hair" TEXT,
    "shirt" TEXT,
    "trouser" TEXT,
    "shoe" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAvatar_pkey" PRIMARY KEY ("memberId")
);

ALTER TABLE "MemberAvatar"
    ADD CONSTRAINT "MemberAvatar_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
