# AIESEC XP

A gamified performance dashboard for AIESEC in Lebanon. Members sign in with their AIESEC
account and see their points, rank and progress towards admin-defined rewards, scored from
their exchange funnel (APL → APD → RE) in EXPA. Leaderboards rank members and LCs, `/tv` is a
live office screen, and admins configure scoring, periods, rewards and who is credited with
each EP.

- **Domain and rules:** [`Context.md`](Context.md)
- **System design:** [`Architecture.md`](Architecture.md)
- **3D / icon asset pipeline:** [`assets/README.md`](assets/README.md)
- **Third-party credits:** [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 7 + PostgreSQL ·
GraphQL (AIESEC GIS) · three.js / React Three Fiber · Motion · Vitest. Deployed on Vercel;
data refresh is scheduled by GitHub Actions.

## Getting started

Requirements: Node.js 22+, a PostgreSQL database, an AIESEC OAuth application and a GIS
service token.

```bash
npm install                 # also runs prisma generate and copies vendor 3D assets into public/
cp .env.example .env.local  # then fill it in
npx tsx scripts/generate-secrets.mts   # fills SESSION_SECRET and CRON_SECRET
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and sign in with an AIESEC account that holds an active position
in the configured office tree.

### Environment

All variables are documented in [`.env.example`](.env.example):

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Pooled runtime connection, and the direct one migrations use |
| `AIESEC_AUTH_URL`, `AIESEC_CLIENT_ID`, `AIESEC_CLIENT_SECRET`, `AIESEC_REDIRECT_URI` | Member sign-in |
| `GIS_GRAPHQL_URL`, `GIS_SERVICE_TOKEN` | GIS access for sync and analytics (server-only secret) |
| `MC_OFFICE_ID`, `MC_DIRECT_ENTITY_ID` | Root office of the competition; optional analytics id for MC-direct |
| `SESSION_SECRET` | Signs the session cookie (32+ chars) |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` |
| `NEXT_PUBLIC_BASE_URL` | Public base URL |

Never commit `.env.local` or real values; `.env.example` holds placeholders only.

### First data load

With `.env.local` filled in, populate offices, members and events:

```bash
npx tsx --conditions=react-server --env-file=.env.local scripts/sync-offices.mts
npx tsx --conditions=react-server --env-file=.env.local scripts/sync-roster.mts
npx tsx --conditions=react-server --env-file=.env.local scripts/sync.mts
```

After that, admins can run either job from **Admin → Updates**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest suite (`tests/`) |
| `npm run db:migrate` / `db:status` / `db:generate` | Prisma migrations and client |
| `npm run gis:schema` | Re-captures the GIS schema into `gis/schema.graphql` |
| `npm run gis:codegen` | Regenerates `gis/generated.ts` from `gis/operations.graphql` |
| `npm run assets:models` | Compresses `assets/source/*.glb` into `public/models/` |
| `npm run assets:vendor` | Copies the Draco decoder and HDRIs into `public/` (runs on install) |

Scripts in `scripts/` that import server modules run with
`npx tsx --conditions=react-server --env-file=.env.local scripts/<name>.mts`:

- `sync.mts` — runs every sync pass.
- `sync-offices.mts`, `sync-roster.mts` — office tree and roster only.
- `import-preview.mts` — dry run of the sign-up sheet import.
- `score-preview.mts` — runs the scoring engine read-only and prints the result.

## Deployment

1. Deploy to Vercel with the environment variables above (production uses a non-expiring GIS
   service token).
2. Run `npm run db:migrate` against the production database.
3. In the GitHub repository, set the Actions secret `CRON_SECRET` (same value as on Vercel)
   and the Actions variable `APP_URL` (the production URL). The workflows in
   `.github/workflows/` then refresh EP data daily (every 5 minutes in hackathon mode) and
   the member roster monthly.

## Project layout

```
app/            routes (pages, admin, API)
components/     UI: studio (dashboard set, characters), three (3D wrapper), motion, icons
lib/            server logic: auth, sync, scoring, import, analytics, GIS client, design tokens
prisma/         schema and migrations
gis/            GIS schema, operations and generated SDK
scripts/        operational and asset-pipeline scripts
tests/          Vitest suite
public/         served assets (models, character stills)
```
