# Architecture — AIESEC XP

How the product is built. Domain rules live in `Context.md`.

## 1. Principles

1. **GIS is the source of truth.** This system is a read-only projection; it never writes to EXPA.
2. **Event-sourced scoring.** Immutable events in, derived ledger out. A config change is a
   replay of the current scoring period, never a patch.
3. **Configuration over code.** Points, weights, role shares, rewards, periods, scope sides
   and admin matchers live in tables.
4. **Minimal data.** Every stored column and requested GIS field has to earn its place;
   no EP personal data at rest.
5. **One deployment.** One Next.js app, one Postgres, scheduled HTTP calls.

## 2. System context

```
Member browser ──OAuth2──▶ AIESEC Auth (identity only)
      │ session cookie
      ▼
Next.js app (RSC + server actions) ──▶ GIS GraphQL / AIESEC Analytics (service token)
      │                             ──▶ Google Sheets CSV export (sign-up sheet)
      ▼
PostgreSQL (events, config, register, ledger)
      ▲
GitHub Actions ──bearer CRON_SECRET──▶ /api/cron/*
```

GIS is never called from the browser and no token reaches client JavaScript.

## 3. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, TypeScript strict. `proxy.ts` replaces `middleware.ts` |
| Styling | Tailwind CSS 4; tokens in `lib/design/tokens.ts` mirrored into `app/globals.css` |
| Motion | `motion` via `LazyMotion` (`domMax`, strict) |
| 3D | three.js + `@react-three/fiber` + `@react-three/drei`, Draco-compressed glTF |
| Icons | Game Icons via `react-icons/gi`, mapped once in `components/icons` |
| Fonts | Built into `lib/design/faces/` and served by `next/font/local` (no Google fetch at build) |
| Auth | Hand-rolled AIESEC OAuth2 Authorization Code flow, own signed session cookie |
| DB / ORM | PostgreSQL (Supabase) with Prisma 7 and the `pg` adapter |
| GIS client | `graphql-request` + `graphql-codegen` from the committed `gis/schema.graphql` |
| Validation | Zod |
| Scheduling | GitHub Actions calling bearer-authenticated routes |
| Hosting | Vercel, region `bom1` (next to the database) |
| Tests | Vitest |

## 4. Authentication and authorization

### Sign-in

1. `/api/auth/start` sets a `state` cookie and redirects to AIESEC authorize.
2. `/api/auth/callback` validates `state`, exchanges the code, and calls GIS `currentPerson`
   with the user's token, which is then discarded (never stored or put in a cookie).
3. `recordLogin` upserts the `Member` and replaces their `Position` rows.
4. No in-term position → `/unauthorized`. Otherwise `xp_session` is issued and the user is
   sent to a sanitised `returnTo`.

`xp_session` is `base64url(payload).HMAC-SHA256(SESSION_SECRET)` carrying only the person id,
issued-at and expiry (12 h, no refresh), httpOnly, `SameSite=Lax`, `Secure` in production.

### Roles

Recomputed on every request from stored positions (`lib/auth/roles.ts`):

| Role | Derivation |
|---|---|
| `ADMIN` | In-term position matching an `AdminMatcher` (role name or title, exact, case-insensitive) |
| `LEAD` | In-term LCP / LCVP / TL |
| `MEMBER` | Any other in-term position |
| `DENIED` | No in-term position |

`proxy.ts` only checks that a valid session cookie exists. Every page calls
`requireMemberPage`, admin pages render nothing for non-admins, and every admin server action
calls `requireAdminLive`, which re-checks the actor's positions against live GIS.

### Service token

A non-expiring entity-wide GIS token (`GIS_SERVICE_TOKEN`) drives all sync and the analytics
reads. It is a server-only env var, read only by `lib/gis/client.ts` and the analytics module,
never returned to a client, and redacted by `lib/logger.ts`. Because it can read all of the
entity's data:

- There is no generic GIS proxy route; every GIS call is a named, parameter-constrained
  server function from `gis/operations.graphql`.
- Every route and server action does its own authorization.

## 5. Data model

See `prisma/schema.prisma`. In brief:

| Model | Purpose |
|---|---|
| `Office` | GIS office tree (`parentId`, `isMc`, `isOperating`) |
| `Member` | GIS person id, name, photo, scoring office |
| `Position` | A member's GIS positions with start/end dates; replaced wholesale by the roster sync |
| `MemberAvatar` | The character a member picked |
| `EpAssignment` | One row per (EP, member): `fromExpa`, `fromSheet`, `fromAdmin`, `isMain`, `removedAt` |
| `AssignmentSheet` | The active sign-up sheet: spreadsheet id, sign-up tab, manager directory tab |
| `SheetManagerMapping` | An admin's match of a sheet manager name (+ LC + team) to a member |
| `ExchangeEvent` | `applicationId`, `eventType` (APL/APD/RE/APD_BROKEN/RE_BROKEN), date, `epPersonId`, programme, direction, current application status. Unique on (application, type) |
| `ScoreConfig` | Versioned weights: stage points, product/direction weights, role shares, APL reversal, scope sides |
| `DisplayWindow` | A scoring period: start, optional end, `isActive`, the `configVersion` it is scored with |
| `TermSettings` | Singleton term start |
| `Reward` | Threshold on points or a stage count, label, optional value, icon, order |
| `AdminMatcher` | Admin role-name / title patterns (seeded by migration) |
| `ScoreLedgerEntry`, `RewardGrant`, `ScoringAnomaly` | **Derived**; rebuilt by every replay |
| `SyncJob`, `SyncRun`, `SyncWatermark`, `SyncSettings` | Job leases, run log, per-pass watermark, hackathon mode |
| `AuditLog` | Before/after JSON for every admin mutation, import and replay |

A register row counts while it has a source flag or `isMain` and no `removedAt`. Credit is
whoever holds the EP now; there are no effective dates.

## 6. Sync

Two jobs, both through `runSyncJob(job, trigger)` (`lib/sync/jobs.ts`):

| Job | Steps | Schedule | Route |
|---|---|---|---|
| `events` | applications → managers → sheets → ledger replay | Daily; every 5 min while hackathon mode is on | `POST /api/cron/events` |
| `roster` | office tree → roster | Monthly (1st) | `POST /api/cron/roster` |

- **applications** (`lib/sync/run.ts`, `passes.ts`): reads applications sorted `updated_at`
  desc, 100 per page, until older than the watermark less a 48 h overlap. Each row becomes up
  to five events, upserted on (application, type), with its current status written to every
  one. Breaks already overtaken by their stage are skipped; nothing before the term start is
  written. The watermark advances only when every page succeeds. Rows back to the current
  period's start are also read to collect EP managers.
- **managers**: reads `Person.managers` for everyone updated since the current period opened
  plus, by id, every EP with a scored event; writes `fromExpa` for in-term members.
- **sheets** (`lib/import/*`): fetches the sign-up tab (EP ID, EP Manager, LC Assigned To,
  Function Assigned to) and the directory tab (LC, Team, EP Manager Name, EXPA ID) as CSV.
  Admin mappings override directory entries. A name is matched ignoring case, accents and
  spacing, then narrowed by LC and team; anything still ambiguous credits nobody and is
  reported. Writes `fromSheet`.
- **offices** (`lib/org/office-tree.ts`): walks the tree from `MC_OFFICE_ID` and sets
  operating flags from the alignments list (left unchanged if it cannot be read).
- **roster** (`lib/sync/roster.ts`): reads in-term positions per operating office and
  replaces the whole `Position` table in one transaction; refuses an empty read.

**Scheduling.** `.github/workflows/sync-ep-data.yml` calls the events route every 5 minutes
(`cadence=hackathon`) and daily (`cadence=daily`); `sync-members.yml` calls the roster route
monthly. The app decides whether a tick has work (`lib/sync/cadence.ts`): a manual run always
runs; a run within 2 minutes of the last start is dropped; a hackathon tick runs only while
`SyncSettings.hackathonUntil` is in the future, or to catch up a daily run not attempted for
26 h. A lease on `SyncJob` (6 min, longer than the 300 s function limit) stops a tick and a
button running the same job at once. `/admin/sync` flags a job whose last success is older
than its cadence allows. Cron responses carry statuses and counts only, because Actions logs
are public.

## 7. Scoring

The engine (`lib/scoring/engine.ts`) is pure:

```ts
score({ events, assignments, mains, configAt, window, rewards })
  => { ledger, grants, anomalies }
```

- `configAt(date)` (`weightsAt()` in `lib/scoring/periods.ts`) resolves the config for each
  event's own period, so a break is scored with its stage's weights.
- Shares come from `creditShares()` (`lib/scoring/shares.ts`); the credit register comes from
  `creditRegister()` (`lib/assignments/register.ts`).
- Anomalies: unknown programme weight, break without a credited stage, unattributed EP.

**Where scoring runs**

| Surface | Range | How |
|---|---|---|
| `/leaderboard` | `?from&to` (clamped to term start → today by `lib/leaderboard-range.ts`) | `score()` live per request over every event of each application active in the range |
| `/leaderboard/lcs`, `/tv` LC rows | requested range / active period | `officePoints()` over AIESEC Analytics counts. The range is split into runs of UTC days with the same weights (`weightSegments()`), each fetched and scored separately |
| `/`, `/me`, rewards, `/tv` members | active scoring period | the stored ledger |

**Replay** (`lib/scoring/replay.ts`) rebuilds the ledger, grants and anomalies against the
active period in one transaction and writes an audit row. It runs after every events job,
every assignment change or committed import, and every save of weights, the period or a
reward. Saving the term start does not replay.

## 8. Admin surface

| Page | What it does |
|---|---|
| `/admin/assignments` | EPs updated since the current period opened (plus EPs who can score), with live EXPA name, status and managers. Filter by product, status, manager (incl. nobody) and source. Add / remove / restore a manager, pick the main, refresh from EXPA. Sign-up sheet panel: preview, import, match manager names to members by hand or by CSV upload |
| `/admin/scoring` | The current period's stage points, product and direction weights and role shares. Saving creates a new config version, points the active period at it and replays |
| `/admin/window` (Dates) | Scoring period (label, start, optional end) — saving starts a new period with the previous weights and replays. Term start. Read-only analytics totals and member count |
| `/admin/rewards` | Create, edit, delete rewards |
| `/admin/sync` (Updates) | Hackathon mode (12 h – 1 week), each job's last run and failed step in plain words, run-now buttons |

Every mutation writes an `AuditLog` row.

## 9. Front end

### Routes

| Route | Purpose |
|---|---|
| `/` | Personal dashboard: character, points this period, rank, gap to the next person, APL/APD/RE chips with their events, pace to the next reward, reward ladder |
| `/welcome` | First-run character picker |
| `/me` | Weekly points, full point trail, character lab, reduce-motion switch |
| `/leaderboard` | Individual ranking with LC filter and date range; podium plus paged table; members on 0 points hidden |
| `/leaderboard/lcs` | LC ranking over a date range, from AIESEC Analytics |
| `/tv` | Fullscreen office screen on the active period, refreshing every 60 s while visible |
| `/admin/*` | See section 8 |

### Layout

- The body is the viewport; the header is fixed and the page scrolls inside one
  `overflow-y-auto` column. A page root is a flex item: `min-h-full shrink-0` to grow with
  its content, or `min-h-0 flex-1` to fit the viewport and scroll an inner region. Scrolling
  pages end on the shared `.page-end` gutter.
- From `lg` up, `/` and the podium fit the viewport: the character is sized from the measured
  stage (`components/studio/hero-stage.tsx`, `podium.tsx`).
- The date picker is the product's own (`components/studio/date-field.tsx`), following the
  ARIA date-picker keyboard pattern and refusing dates before the term start.

### Visual identity (STUDIO)

A warm-paper cyclorama with the member's character standing on it. One large number (points);
everything else is a chip. Depth is shadow, never gradient. Fredoka (display), Figtree (UI),
Baloo 2 (numbers) and Space Mono (labels), declared in `lib/design/fonts.ts`. Stage accents are
the AIESEC brand hues, each with wash / mid / ink tints (`STAGE_TINT`); the ink is the
contrast-safe text colour.

### Characters

Six forms (Milo, Remi, Sami, Juno, Nour, Lina); the first four come in four palettes
(`lib/design/character.ts`). A member picks one at `/welcome` (`MemberAvatar`); anyone who has
not picked gets one by hashing their name. Every surface that shows a member draws their
character. A live canvas is used where one body is shown (dashboard hero, character lab,
LC group, login); everything else uses pre-rendered stills from `public/characters/`.

Bodies share one Mixamo clip library (`public/models/avatar-animations.glb`, plus a social
library). Animation is driven by a `mood` (the idle pool) and a `beat` (a one-shot a surface
triggers, e.g. greet, point, celebrate), resolved to clips in one place. Groups stand in a
circle, wander and hold conversations (`components/studio/group-*.ts`).

### 3D rules

Every scene mounts through `components/three/scene.tsx`, never `<Canvas>` directly:

- Client-only and lazily loaded; three never reaches a server bundle.
- Viewport-gated: a canvas off screen does not boot a WebGL context.
- A DOM `fallback` is required and shown without WebGL2 or on context loss.
- Nothing is fetched from a CDN: the Draco decoder and HDRIs are copied from `node_modules`
  into `public/` on install (`scripts/assets/sync-vendor-assets.mjs`).

### Motion

On for everyone by default. The member's switch (`xp_reduce_motion` cookie, read in the root
layout so the first render is already correct) reaches Motion, the three.js frame loop and a
CSS backstop. The OS `prefers-reduced-motion` setting is not consulted; tests enforce this.

## 10. Security

- All GIS traffic is server-side; no generic proxy route; every action authorizes itself.
- Admin actions re-verify positions against live GIS.
- `/api/cron/*` is the only session-less API surface; it checks `CRON_SECRET` with a
  timing-safe compare. Job leases and the 2-minute gap bound how often even a leaked secret can
  trigger GIS work.
- CSP with a per-request nonce (`lib/security/csp.ts`, applied in `proxy.ts`), so every route
  renders dynamically. Allowances: `'wasm-unsafe-eval'` (Draco WebAssembly), `worker-src blob:`
  (Draco worker), `img-src blob: data:` (glTF textures), `style-src 'unsafe-inline'` (React
  style props). `tests/csp.test.ts` asserts them.
- The logger redacts secret values and secret-looking keys.
- Tests read the schema and GIS operations as text and fail if an EP name, email or phone
  field appears (`tests/no-personal-data.test.ts`).
