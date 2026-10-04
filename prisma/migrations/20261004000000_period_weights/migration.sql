-- D-85: each scoring period keeps its own weights.

ALTER TABLE "DisplayWindow" ADD COLUMN "configVersion" INTEGER;
ALTER TABLE "DisplayWindow" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Until now one config scored every period, so every existing period takes it.
UPDATE "DisplayWindow"
SET "configVersion" = (SELECT "version" FROM "ScoreConfig" WHERE "isActive" ORDER BY "version" DESC LIMIT 1);

-- The newest saved period wins an overlap, so existing rows need their real save
-- order: the audit entry the window form wrote, or, for a row seeded by
-- migration, the moment the seed config was written. Without this every row
-- would share this migration's timestamp.
UPDATE "DisplayWindow" AS w
SET "createdAt" = COALESCE(
  (SELECT MIN(a."createdAt") FROM "AuditLog" a WHERE a."targetType" = 'DisplayWindow' AND a."targetId" = w."id"),
  (SELECT MIN(c."createdAt") FROM "ScoreConfig" c)
);

ALTER TABLE "DisplayWindow" ALTER COLUMN "configVersion" SET NOT NULL;

CREATE INDEX "DisplayWindow_configVersion_idx" ON "DisplayWindow"("configVersion");

ALTER TABLE "DisplayWindow" ADD CONSTRAINT "DisplayWindow_configVersion_fkey"
  FOREIGN KEY ("configVersion") REFERENCES "ScoreConfig"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
