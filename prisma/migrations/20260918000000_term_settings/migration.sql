-- D-58. The collection floor stops being the active display window's start and
-- becomes the term start, so the leaderboards can be read over any historic
-- range without the window that happens to be active deciding what survives.
--
-- Under D-43 the two were the same date, which meant moving the display window
-- forward silently stopped collecting -- and eventually orphaned -- everything
-- behind it. They are separate concerns: the window is what the reward race is
-- measured in, the term is what this system holds at all.
--
-- One row, by construction. A settings table that can hold two rows is a
-- settings table that will, and the second one is never the one being read.

CREATE TABLE "TermSettings" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TermSettings_singleton" CHECK ("id" = 'singleton')
);

-- 2026-08-01 is the current term start. Anything earlier predates the
-- assignment register, so a score built from it could not be attributed to the
-- right member -- which is why the floor is a floor and not just a default.
INSERT INTO "TermSettings" ("id", "startsAt", "updatedAt")
VALUES ('singleton', '2026-08-01T00:00:00Z', NOW())
ON CONFLICT ("id") DO NOTHING;
