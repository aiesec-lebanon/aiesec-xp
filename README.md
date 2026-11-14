# AIESEC XP

A gamified performance dashboard for AIESEC in Lebanon. It turns exchange
funnel activity from AIESEC's Global Information System (GIS) into points,
ranks and rewards, so every member can see how close they are to their next
reward and how they and their LC compare with everyone else.

- **Personal dashboard.** Points, rank, funnel progress and the nearest reward.
- **Leaderboards.** Member-vs-member and LC-vs-LC, over any date range.
- **Rewards.** Configurable thresholds, each on its own progress road.
- **Characters.** Every member picks a 3D character that appears wherever they do.
- **TV mode.** A fullscreen board for office screens and events.
- **Admin console.** Point values, rewards, scoring windows and EP assignment.

## How it works

GIS is the source of truth. A scheduled sync reads exchange events from the GIS
GraphQL API into Postgres, a scoring engine turns those events into a points
ledger, and the Next.js app renders it. Members sign in with their AIESEC
account. Nothing is ever written back to GIS, and EP personal data stays in
GIS.

The design and its reasoning are in two documents, which take precedence over
anything else in the repository:

- [`Context.md`](Context.md): the domain, glossary, scoring rules and every
  numbered decision (D-xx).
- [`Architecture.md`](Architecture.md): system design, data model, sync
  pipeline, scoring engine, front end and security.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 on PostgreSQL ·
Tailwind CSS · three.js with React Three Fiber · Vitest · Vercel, with GitHub
Actions for scheduled syncs.

## Getting started

You need Node.js 24 or newer, a PostgreSQL database, and an AIESEC OAuth
application with GIS API access for the office you want to score.

```bash
git clone https://github.com/aiesec-lebanon/aiesec-xp.git
cd aiesec-xp
npm install                  # also generates the Prisma client and vendors 3D assets
cp .env.example .env.local   # then fill it in; every variable is described there
npx tsx scripts/generate-secrets.mts   # generates local signing secrets
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

Never commit `.env.local` or any credentials. It's already gitignored.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Run the test suite (Vitest) |
| `npm run typecheck` | Type-check the project |
| `npm run lint` | Lint with ESLint |
| `npm run db:migrate` | Apply database migrations |
| `npm run gis:codegen` | Regenerate GIS GraphQL types |

## About the characters

The 3D characters are licensed third-party models. Their licence doesn't allow
redistributing them, so this repository holds only encrypted copies, and only
the official AIESEC in Lebanon deployment can display them. On your own
instance, every screen falls back to the character still images and works
normally otherwise. To use 3D characters in a fork, bring your own models; see
[`assets/README.md`](assets/README.md) for the pipeline.

## Project layout

```
app/          routes, pages and API route handlers
components/   UI, including the 3D layer (components/three, components/studio)
lib/          scoring, sync, auth, GIS client and design system
prisma/       schema and migrations
scripts/      sync, diagnostics and asset pipeline scripts
tests/        Vitest suites
assets/       3D asset sources and pipeline (see assets/README.md)
```

## Contributing

Issues and pull requests are welcome.

1. Read `Context.md` and `Architecture.md` before changing anything
   non-trivial. If your change alters a decision, update them in the same pull
   request.
2. Keep it green: `npm run typecheck`, `npm run lint` and `npm test`.
3. Don't commit secrets, personal data (EP names, emails, exports) or
   third-party assets you aren't allowed to redistribute.

To report a security issue, contact the maintainers privately instead of
opening a public issue.

## Licence

The code is [MIT](LICENSE), © 2026 AIESEC in Lebanon. The licence doesn't
cover the character models and their renders, the animation clips, third-party
icons and fonts, or the AIESEC name and logo, which are trademarks of AIESEC
International. See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for each source and its
licence.
