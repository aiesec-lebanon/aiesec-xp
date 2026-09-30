-- D-83. An admin picks one main manager per EP, who takes the full points and
-- counts the stage as one; everyone else takes their role's % of the points and
-- of the count.

ALTER TABLE "EpAssignment" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;

-- A count is now a share of the stage, as the points already were.
ALTER TABLE "ScoreLedgerEntry" ALTER COLUMN "countDelta" TYPE DECIMAL(7,6);

-- Placeholder percentages, lower for more senior roles, until the MC sets its
-- own on Scoring. They no longer total 100: each is a share of the event.
UPDATE "ScoreConfig"
SET "roleShares" = '{"MCP": 10, "MCVP": 15, "LCP": 20, "LCVP": 25, "ESTL": 30, "TL": 30, "ESTM": 40, "TM": 40}'::jsonb
WHERE "isActive";
