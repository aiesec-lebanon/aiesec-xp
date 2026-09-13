-- Initial configuration. Every value here is data the admin can change in the
-- product; none of it is referenced as a constant anywhere in the code.
--
-- actorId 0 is the system actor, used for rows that predate any real login.
-- All inserts are idempotent so re-running a deploy cannot duplicate them.

-- Scoring config (D-04, D-05, D-27, D-41).
INSERT INTO "ScoreConfig" (
  "id", "version", "aplPoints", "apdPoints", "rePoints", "reverseApl",
  "productWeights", "directionWeights", "scopeSides", "isActive", "createdBy", "createdAt"
) VALUES (
  'cfg_seed_v1', 1, 1.0000, 5.0000, 10.0000, true,
  '{"7": 1, "8": 1, "9": 1}'::jsonb,
  '{"OUTGOING": 1, "INCOMING": 1}'::jsonb,
  '["PERSON"]'::jsonb,
  true, 0, NOW()
) ON CONFLICT ("version") DO NOTHING;

-- Display window (D-07). Start date is a placeholder for the MC to set; an
-- open-ended window counts everything from that date onward (D-20).
INSERT INTO "DisplayWindow" ("id", "label", "startsAt", "endsAt", "isActive")
VALUES (
  'win_seed_current', 'Current term', '2026-07-01T00:00:00Z', NULL, true
) ON CONFLICT ("id") DO NOTHING;

-- Admin matchers (D-14, O-03), measured against office 182 at the spike.
-- role.name = MCVP is deliberately absent: it also matches MXP and MKT.
INSERT INTO "AdminMatcher" ("id", "pattern", "field") VALUES
  ('mch_seed_mcp',       'MCP',      'ROLE_NAME'),
  ('mch_seed_mcvp_im',   'MCVP IM',  'TITLE'),
  ('mch_seed_mcm_im',    'MCM IM',   'TITLE')
ON CONFLICT ("field", "pattern") DO NOTHING;

-- Example reward (D-09). Threshold and value are for the MC to set; the reward
-- exists so the progress UI has something to render on day one.
INSERT INTO "Reward" (
  "id", "label", "description", "thresholdType", "threshold",
  "valueAmount", "valueCurrency", "iconKey", "isActive", "sortOrder"
) VALUES (
  'rwd_seed_mexa',
  'MEXA LDS delegate fee',
  'Delegate fee funded by the MC at the approval count below.',
  'APD_COUNT', 5.0000,
  NULL, NULL, 'trophy', true, 0
) ON CONFLICT ("id") DO NOTHING;
