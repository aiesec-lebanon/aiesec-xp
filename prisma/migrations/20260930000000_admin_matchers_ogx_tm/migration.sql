INSERT INTO "AdminMatcher" ("id", "pattern", "field") VALUES
  ('mch_seed_mcvp_ogx', 'MCVP oGX', 'TITLE'),
  ('mch_seed_mcvp_tm',  'MCVP TM',  'TITLE')
ON CONFLICT ("field", "pattern") DO NOTHING;
