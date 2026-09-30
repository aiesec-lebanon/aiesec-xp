# Architecture.md — AIESEC in Lebanon | AIESEC XP

Companion: `Context.md` (domain, glossary, decisions D-01…D-79; open items O-09, O-13)

---

## 1. Principles

1. **GIS is the source of truth for exchange events; this system is a read-only
   projection.** No writes to EXPA.
2. **The dashboard mirrors EP-to-member assignment; it only corrects it.** The
   MC assigns EP managers in EXPA and responsible members in a Google Sheet,
   and this product mirrors both; an admin can add a member to an EP or remove
   one, and a removal outlasts every sync (D-73, D-74, D-77). See `Context.md`
   sections 4 and 5.
2a. **Scope discipline.** This is a rewards and ranking product. It does not
   assign EPs and does not display EP data beyond the admin console; EXPA and a
   Google Sheet already do those. Every stored column and every requested GIS
   field has to earn its place against that scope.
3. **Event-sourced scoring.** Immutable events in, derived score out. A config
   change is a replay, not a patch — this is what makes D-15 cheap. The events
   record what happened, not who it happened to: EP personal data stays in EXPA
   and is read at display time (D-42).
4. **Configuration over code.** Point values, per-product multipliers, rewards,
   thresholds, display window, scope sides and admin role matchers all live
   in tables.
5. **KISS / YAGNI.** One Next.js deployment, one Postgres, one scheduler.

---

## 2. System context

```
┌──────────────┐   OAuth2 (Authorization Code) ┌──────────────────┐
│   Member     │──────────────────────────────▶│  AIESEC Auth     │
│  (browser)   │◀───── identity only ──────────│                  │
└──────┬───────┘                               └──────────────────┘
       │ session cookie (httpOnly)
       ▼
┌──────────────────────────────────────────────┐
│        Dashboard (Next.js, server-first)     │
│  UI (RSC + client islands)                   │   ┌──────────────────────┐
│  Route handlers / server actions / SSE       │──▶│  GIS GraphQL         │
└───────────────────────┬──────────────────────┘   │  gis-api.aiesec.org  │
                        ▼                          └──────────────────────┘
                ┌─────────────────┐                          ▲
                │   PostgreSQL    │◀──── Sync worker ────────┘
                │  events, config │   (cron, entity-wide
                │  ledger, assign │    service token)
                └─────────────────┘
```

GIS is never called from the browser. No token of any kind reaches client
JavaScript.

---

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router, TypeScript strict | Server components keep the token and full ledger server-side; one artifact for handover. Note Next 16 renames `middleware.ts` to `proxy.ts` |
| UI | Tailwind + shadcn/ui | Accessible primitives, nothing bespoke to maintain in 7 days |
| Motion | Motion (published as `motion`, formerly `framer-motion`) | Spring progress, FLIP rank transitions. Loaded through `LazyMotion` in `strict` mode, so the runtime stays out of the initial bundle and the saving cannot be undone by reaching for `motion.*` |
| 3D | three.js + `@react-three/fiber` + `@react-three/drei`, physics by `@react-three/rapier` (D-47) | The game surface the product is named for. Every scene mounts through `components/three/scene.tsx`, which is client-only, viewport-gated and falls back to DOM when there is no GPU |
| 3D assets | Poly Haven / Kenney (CC0) and Blender, compressed by glTF-Transform with Draco | All free-forever, all self-hosted. `npm run assets:models` is the pipeline; `assets/README.md` is the workflow |
| Charts | Recharts | Trend and pace views, on the validated ordinal ramp in `components/charts/chart-theme.ts` |
| Icons | Game Icons (CC BY 3.0) via `react-icons/gi` | 4000+ tree-shaken SVG components, no sprite sheet and no emoji. Domain concepts are mapped once in `components/icons` so a stage has one picture everywhere. Credited in `ATTRIBUTIONS.md`, not in the UI (D-49) |
| Typography | Google Fonts (OFL), built into `lib/design/faces/` by `scripts/assets/build-faces.py` and served by `next/font/local` (D-67) | One type system, declared in `lib/design/fonts.ts` (D-48). The build never fetches fonts, because `next/font/google` fails on some of Google's responses |
| Auth | AIESEC OAuth2 directly, following the `auth-template` project (D-38) | AIESEC auth is not OIDC-discoverable and GIS wants the raw token as `Authorization` with no `Bearer` prefix. A hand-rolled Authorization Code flow is less machinery than bending Auth.js around both. Identity only |
| DB | PostgreSQL (Neon or Supabase) | Relational, transactional, cheap |
| ORM | Prisma | Typed access, versioned migrations |
| GIS client | graphql-request + graphql-codegen | Types generated from the schema, captured by introspection at the spike |
| Scheduling | GitHub Actions `schedule` (D-66) | No always-on worker needed: the workflows only call bearer-authenticated routes and the work runs on Vercel. Vercel Cron on Hobby runs at most once a day; GitHub's floor is five minutes and it is free for a public repository |
| Realtime | Server-Sent Events | One-way push is all the leaderboard needs |
| Validation | Zod | One schema for form, server action and DB write |
| Tests | Vitest (scoring, attribution, matching) + Playwright (auth, admin, leaderboard) | Scoring and identity matching must never be wrong |

---

## 4. Authentication and authorization

### 4.1 Login

1. Redirect to the AIESEC authorize endpoint, Authorization Code, with `state`
   generated and validated server-side.
2. Server-side code exchange at the token endpoint.
3. Call GIS `currentPerson` **with the user's own token** to establish identity.
4. Resolve positions. No active position inside the 182 subtree means `DENIED`
   (D-31).
5. Upsert `Member` and `Position`, issue our own signed session cookie.

The user's token is used only for that identity call and is then discarded. It is
never stored, never placed in a cookie, and never used for data sync.

This is the one place the build deliberately departs from `auth-template`, which
keeps the AIESEC access token and refresh token in cookies and renews them. This
product has no per-user GIS traffic after login, so holding those tokens would be
storing a credential it never spends. The session cookie carries our own identity
instead; there is no refresh route.

Because AIESEC auth is the GIS identity, every member who can log in has a
`person_id` by construction. Login cannot fail for a missing person record — only
for a missing in-scope position.

### 4.2 Roles

| Role | Derivation | Capability |
|---|---|---|
| `ADMIN` | Active position matching a configured `AdminMatcher` — seeded `ROLE_NAME: MCP`, `TITLE: MCVP IM`, `TITLE: MCM IM`, `TITLE: MCVP oGX`, `TITLE: MCVP TM` (D-14, O-03, D-50). `role.name = MCVP` is deliberately not a matcher: it also matches MXP and MKT | Everything: config, assignments anywhere, overrides, sync control |
| `LEAD` | Active LCP / LCVP / TL position | Assign EPs within own LC, view all |
| `MEMBER` | Any other active position in scope (D-02) | Own progress, leaderboards |
| `DENIED` | Authenticated but holding no active position inside the office 182 subtree | No access (D-16, D-31) |

Scope is office 182 plus descendants, resolved from GIS into an `Office` table
with a parent pointer. Access derives from live GIS positions, so next term's
officers inherit it automatically (D-23) and terminated officers lose it. A
position counts only while it is `active`, in an operating office, and had not
ended before the term start (D-71): EXPA often leaves a departed officer's
position `active`, so status alone would keep them in. The same rule decides
who can be credited with an EP and who appears on a leaderboard.

### 4.3 Sync identity — entity-wide service token (D-13)

A non-expiring access token issued from AIESEC dev applications, with entity-wide
read access, drives all data sync.

Handling rules, all mandatory:

- Stored as a single environment variable in the deployment platform's secret
  store. **Never** in the database, never in the repo, never in `.env.example`
  beyond a placeholder.
- Read only inside the server-side GIS client module. No other module imports it.
- Never returned from any route handler, server action, or server component
  payload. A lint rule and a unit test assert it cannot appear in serialised output.
- Never written to application logs, including error logs. The GIS client redacts
  the `Authorization` header before logging any request.
- Rotating is a single env var change and redeploy. Custody and handover of the
  token are handled by the MCVP IM outside this system and are deliberately not
  described in the code or its docs (O-07 closed).

### 4.4 Authorization implication of an entity-wide token

This matters more than it looks. When sync ran on per-user tokens, GIS itself
provided a second layer of defence: a member's token simply could not read
another LC's data. With an entity-wide token, **that layer is gone**. Two rules
follow and are non-negotiable:

1. **No generic GIS proxy route.** The application must never expose an endpoint
   that forwards arbitrary GraphQL to GIS. Every GIS call is a named,
   parameter-constrained server function.
2. **Every route and server action applies its own authorization.** Scope
   filtering by LC, role checks on admin actions, and ownership checks on
   assignment mutations are enforced in application code, not inherited from GIS
   permissions. Playwright tests cover a `MEMBER` attempting each admin and
   cross-LC action.

---

## 5. Data model

Prisma-flavoured, indicative.

```prisma
// ── Org and members ──────────────────────────────────────────────────
model Office {
  id          BigInt  @id        // 182 and descendants
  name        String
  parentId    BigInt?
  isMc        Boolean @default(false)
  isOperating Boolean @default(false)  // D-39, seeded from the alignments list
}

model Member {
  id              BigInt  @id     // GIS person id, always present at login
  fullName        String
  aiesecEmail     String?
  profilePhotoUrl String?
  homeOfficeId    BigInt?
  scoringOfficeId BigInt?                   // D-32, highest-ranked active position
  firstSeenAt     DateTime
  lastSyncedAt    DateTime
}

model Position {
  id        BigInt   @id
  memberId  BigInt
  officeId  BigInt
  roleName  String?
  title     String?
  status    String
  startDate DateTime?
  endDate   DateTime?
}

// ── EP assignment: who is credited with an EP (D-73) ─────────────────
model EpAssignment {
  id         String    @id @default(cuid())
  epPersonId BigInt
  memberId   BigInt
  fromExpa   Boolean   // mirrors Person.managers (D-74)
  fromSheet  Boolean   // mirrors the MC sign-up sheet's EP manager (D-80)
  fromAdmin  Boolean   // added on the console; nothing automatic clears it
  removedAt  DateTime? // an admin removal, which outranks every source
  removedBy  BigInt?
  createdBy  BigInt
  createdAt  DateTime
  updatedAt  DateTime
  @@unique([epPersonId, memberId])
}

model AssignmentSheet {                          // D-80: the MC sign-up sheet, one active row
  id              String @id
  label           String
  spreadsheetId   String @unique
  tabName         String                         // "MasterSheet": EP ID, EP Manager, LC Assigned To, Function Assigned to
  managersTabName String @default("Sheet7")      // LC, Team, EP Manager Name -> EXPA ID
  isActive        Boolean
  lastImportAt    DateTime?
}

model SheetManagerMapping {                      // D-80: a sheet name matched on the console
  id        String @id
  nameKey   String                               // normalised; unique with lcKey and teamKey
  lcKey     String
  teamKey   String
  name      String                               // as the sheet spells it
  lc        String
  team      String
  memberId  BigInt
  createdBy BigInt
  @@unique([nameKey, lcKey, teamKey])
}
```

A row counts while any source flag is set and it has not been removed. Each
automatic source rewrites only its own flag, and only for the EPs it could
read, so an unreadable sheet or a failed GIS page takes nobody's credit away.
A removal is kept as a row, not a delete, so the next sync cannot recreate it.
There is no effective date: credit is whoever holds the EP now.

```prisma
// ── Raw exchange events from GIS ─────────────────────────────────────
enum FunnelEvent { APL APD RE APD_BROKEN RE_BROKEN }
enum ScoredStage { APL APD RE }
enum Direction   { OUTGOING INCOMING }

model ExchangeEvent {
  id                  String      @id @default(cuid())
  applicationId       BigInt
  eventType           FunnelEvent
  occurredAt          DateTime
  epPersonId          BigInt                  // the join to EpAssignment, and the
                                              // only EP datum held (D-42)
  programmeId         Int                     // 7 | 8 | 9
  direction           Direction
  applicationStatus   String?                 // current, on every event (D-41, D-76)
  fetchedAt           DateTime
  @@unique([applicationId, eventType])        // idempotency key
}

// ── Configuration, versioned, admin-editable ─────────────────────────
model ScoreConfig {
  id               String  @id @default(cuid())
  version          Int     @unique
  aplPoints        Decimal
  apdPoints        Decimal
  rePoints         Decimal
  reverseApl       Boolean @default(true)     // D-35, D-41: APL counts are net
  productWeights   Json                        // { "7": 1, "8": 1, "9": 1 }
  directionWeights Json                        // { "OUTGOING": 1, "INCOMING": 1 }
  scopeSides       Json                        // ["PERSON"] today, ["PERSON","OPPORTUNITY"] for incoming (D-27)
  roleShares       Json                        // { "TM": 40, "TL": 30, ... } = 100, per role (D-73)
  isActive         Boolean
  createdBy        BigInt
  createdAt        DateTime
}

model DisplayWindow {                          // D-07, D-20
  id       String   @id @default(cuid())
  label    String
  startsAt DateTime
  endsAt   DateTime?
  isActive Boolean                              // exactly one true, partial unique index (D-21)
}

model TermSettings {                            // D-58. One row, check constraint
  id        String   @id @default("singleton")  // on the id rather than a convention
  startsAt  DateTime                            // collection floor + leaderboard default
  updatedAt DateTime @updatedAt
}

model Reward {                                 // D-09
  id            String  @id @default(cuid())
  label         String
  description   String?
  thresholdType String                          // POINTS | APL_COUNT | APD_COUNT | RE_COUNT
  threshold     Decimal
  valueAmount   Decimal?
  valueCurrency String?
  iconKey       String?
  isActive      Boolean
  sortOrder     Int
}

model AdminMatcher {                            // D-14, O-03
  id      String @id @default(cuid())
  pattern String                                // "MCP", "MCVP IM"
  field   String                                // ROLE_NAME | TITLE
}

// ── Derived, fully recomputable ──────────────────────────────────────
model ScoreLedgerEntry {
  id              String   @id @default(cuid())
  memberId        BigInt
  exchangeEventId String
  stage           ScoredStage                   // the event's stage, or the one a break takes back
  configVersion   Int
  points          Decimal                       // negative on break
  share           Decimal                       // this member's part of the EP (D-73)
  countDelta      Int
  occurredAt      DateTime
  @@unique([memberId, exchangeEventId])
  @@index([memberId, occurredAt])
}

model RewardGrant {                             // derived; a replay that no longer
  id        String   @id @default(cuid())       // supports a grant deletes it (D-34)
  memberId  BigInt
  rewardId  String
  earnedAt  DateTime
  @@unique([memberId, rewardId])
}

// ── Operations ───────────────────────────────────────────────────────
model SyncRun {
  id         String   @id @default(cuid())
  pass       String
  startedAt  DateTime
  finishedAt DateTime?
  eventsSeen Int
  status     String
  error      String?
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    BigInt
  action     String    // CONFIG_UPDATE, ASSIGNMENT_SET, MATCH_CONFIRM, IMPORT, REPLAY, EXPORT
  targetType String
  targetId   String
  beforeJson Json?
  afterJson  Json?
  createdAt  DateTime
}
```

`ScoreLedgerEntry` and `RewardGrant` are **derived**. They can be dropped and
rebuilt from `ExchangeEvent` + `EpAssignment` + `ScoreConfig` at any time. That is
what makes D-15 safe.

---

## 6. Sync pipeline

Runs on the service token on the schedule below (D-66), scoped to the 182
subtree and `programmes: [7, 8, 9]`, and floored at `TermSettings.startsAt`: the system
fetches only what it scores (D-43, amended by D-58). The floor was the active
display window's start, which meant moving the window forward stopped collecting
everything behind it — and a leaderboard read over a historic range would have
found nothing there. Scope is applied on the person side today; the
opportunity side is the same code path selected by `ScoreConfig.scopeSides`, so
incoming exchange is a configuration change (D-27). Results from both sides
converge on the same idempotency key, so an application that is Lebanese on both
sides is stored once, as `OUTGOING` (D-25).

The EP data job runs three passes (D-76, `lib/sync/run.ts`), then rebuilds the
ledger:

| Pass | Reads | Writes |
|---|---|---|
| `applications` | `allOpportunityApplication` sorted `updated_at` desc, until older than the watermark less 48h, floored at the term start | Every stage date an application carries as its own event -- `APL`, `APD`, `RE`, `APD_BROKEN`, `RE_BROKEN` -- plus its current status on every one of its events |
| `managers` | `people` sorted `updated_at` desc back to the current window's start, and by id every EP with a scored event | The register's `fromExpa` flags: each EP's `Person.managers` who are members this term (D-74) |
| `sheets` | The MC sign-up sheet's MasterSheet and Sheet7 tabs, plus `SheetManagerMapping` | The register's `fromSheet` flags for every EP whose manager resolves, or that the sheet lists with no manager (D-80) |

One application row carries every stage date, so one pass replaces a pass per
date filter, and a withdrawal, rejection or break moves the row's `updated_at`,
so there is no separate status refresh re-reading everything the ledger holds.
GIS documents no `updated_at` filter but sorts on it; the read stops at the
first row older than it needs. The `applications` read continues back to the
current window's start without writing events there, only to collect
`person.managers` for everyone the console lists. Pages are 100 rows, which measured about 2s
against a 15s client timeout.

Events upsert on `(applicationId, eventType)`, so reruns are idempotent, and a
break the stage has since overtaken is not ingested (D-28). A 48-hour overlap
behind the watermark absorbs back-dated records, and the watermark advances only
on a fully successful pass. Nothing dated before the term start is written
(D-58). Each source pass reconciles only the EPs it actually read, so a failed
page or an unreadable sheet takes nobody's credit away, and none of them undoes
an admin's removal.

**Roster and office tree refresh**, monthly (D-66).

Every pass writes a `SyncRun` row. Repeated failures raise an alert and the
UI shows a staleness banner with the last successful sync time.

### Scheduling (D-66)

Two jobs, on GitHub Actions rather than Vercel Cron, whose Hobby plan runs a
cron at most once a day and refuses to deploy a more frequent one:

| Job | Passes | Schedule | Route |
|---|---|---|---|
| EP data (`events`) | `applications`, `managers`, `sheets`, then the ledger rebuild | Daily; every 5 minutes while hackathon mode is on | `/api/cron/events` |
| Members (`roster`) | Office tree, roster | Monthly, on the 1st | `/api/cron/roster` |

The workflows (`.github/workflows/sync-ep-data.yml`, `sync-members.yml`) only
call the routes, carrying `CRON_SECRET` as a bearer token; the work runs on
Vercel. The five-minute tick carries no policy of its own: `lib/sync/cadence.ts`
decides whether it has work, so hackathon mode is a switch on `/admin/sync`
rather than an edit to a workflow. Hackathon mode is stored as an end time
(`SyncSettings.hackathonUntil`), so it lapses back to daily by itself.

Every trigger, scheduled or an admin's button, goes through `runSyncJob()`
(`lib/sync/jobs.ts`), which first takes a lease on the job's `SyncJob` row, so a
tick and a button never run one job at once. The lease outlives the 300s any run
is allowed, so a run the platform killed cannot wedge the job. A button always
runs; a scheduled tick within two minutes of the previous start is a duplicate
and is dropped. Outside hackathon mode the tick also catches up a daily run that
nobody has attempted for 26 hours, because GitHub documents that scheduled runs
can be dropped under load. It is keyed on the attempt rather than the success, so
a job that keeps failing is retried daily, not every five minutes.

The LC board has nothing to schedule: it reads AIESEC's analytics live on every
render (D-56).

GitHub pauses scheduled workflows in a public repository after 60 days without
a commit, and nothing in the product would otherwise announce it, so
`/admin/sync` flags a job whose last success is older than its cadence allows.

---

## 7. Scoring engine

Pure and deterministic:

```ts
score(
  events: ExchangeEvent[],
  assignments: EpAssignment[],
  config: ScoreConfig,
  window: DisplayWindow,
  rewards: Reward[]
) => { ledger: ScoreLedgerEntry[]; grants: RewardGrant[]; anomalies: Anomaly[] }
```

`rewards` is an input because grants cannot be derived without thresholds.
`anomalies` carries events the engine could not score confidently — an unknown
programme weight (D-30), a break with no matching stage event — so nothing is
dropped silently.

### Attribution

Attribution is per EP, so APL, APD and RE for one EP credit the same members by
construction. The engine is handed the credits that count
(`creditedAssignments()`, `lib/assignments/register.ts`): register rows not
removed, named by a live source, held by a member this term (D-71), each with
the role that member shares under -- their most senior in-term position, ranked
as D-32 ranks them. An EP nobody is credited with is recorded, scored to nobody,
and surfaced as `UNATTRIBUTED`.

### What scores (D-75)

An APL, APD or RE scores in the range its own date falls in, and each is
evaluated on its own (D-08): an application from before the range does not come
back when its approval lands inside it, and a status past realization --
finished, completed -- is not a stage. The engine groups an application's
events only to apply its breaks and its status.

An application withdrawn or rejected never earns its APL, whenever that
happened (D-41). This is evaluated against
`applicationStatus`, the current observed state, rather than as a dated
reversal, because GIS dates neither transition. One consequence is deliberate
and worth stating: an application rejected after the display window closes
removes its point from that window retrospectively. That is consistent with a
system whose ledger is rebuilt rather than patched (D-15), and it is what
"final APL count" means.

### Points and shares

```
points = basePoints(stage)
       × productWeight(programmeId)
       × directionWeight(direction)
       × share(member)
```

`share` splits an EP's points between everyone credited with it (D-73,
`lib/scoring/shares.ts`). Alone on an EP, a member's share is 1. Otherwise each
role present takes its `ScoreConfig.roleShares` percentage, rescaled over the
roles actually on the EP so the EP always pays out in full, and members holding
one role split its part evenly; a role without a share takes nothing beside one
that has one, and when nobody present has a share they split evenly. Counts are
not shared: everyone on the EP is counted for the stage.

A programme with no entry in `productWeights` scores zero and is returned as an
anomaly, never scored at an assumed weight of 1 (D-30). Remote and physical
realization share one weight; where both dates exist the earlier wins (D-29).

### The scored range is the caller's, not always the window (D-58)

`score()` takes its window as an argument, so "which range" is a question each
surface answers for itself:

| Surface | Range |
|---|---|
| `/leaderboard`, `/leaderboard/lcs` | `?from=&to=`, defaulting to the term start through today |
| `/tv` | The active `DisplayWindow`. It is the live screen for exchange hackathons and takes no range of its own |
| `/`, `/me`, rewards | The active `DisplayWindow`, because `RewardGrant` is derived against it (D-34) |
| `ScoreLedgerEntry` (the replay) | The active `DisplayWindow` |

That last row is why the individual board cannot read the ledger for a historic
range: the replay bakes the window in, so the ledger only ever holds rows inside
it. `individualStandings(range)` therefore runs this engine on the request that
renders the board, over every event of each application with activity in the
range -- the rest of an application's events are what tell a re-approval from a
break (D-28). It is the same shape as the office path below,
and it keeps every rule in this section correct by construction instead of
re-deriving break netting and APL reversal in a query. `lib/scoring/config.ts`
maps the stored row for both callers, so the two cannot drift.

`lib/leaderboard-range.ts` resolves the query string, clamping to
`[TermSettings.startsAt, today]` and echoing every bound back, so a clamped
request is visible in the date inputs rather than silently applied.

### Office-level scoring is a separate, unstored path (D-56)

Everything above scores an *individual* member, because attribution (this
section, and section 5) exists to answer "who earned this." An LC's own total
doesn't need that answer, so `/leaderboard/lcs` and `/tv` don't sum the ledger
at all: `officePoints()` (`lib/scoring/engine.ts`) applies the same
`basePoints(eventType) × productWeight(programmeId) × directionWeight(direction)`
formula directly to AIESEC's own per-office, per-programme funnel counts, read
live from the AIESEC Analytics API (`fetchEntityFunnelBreakdown`,
`lib/analytics/aiesec-analytics.ts`) on every request. Nothing is persisted:
the request that renders the board is the request that scores it.

This intentionally does **not** replicate every ledger rule. AIESEC's
analytics counts are cumulative "ever reached this stage" totals, not
netted, and there is no consequence of a withdrawn/rejected application for
this path to filter (D-41 has no analytics equivalent) or of a break event to
subtract (D-10, D-26, D-28 don't apply here either) — an LC's `APD`/`RE` here
is AIESEC's own raw `approved`/`realized` total for that office, not net of a
later break. An office's own total therefore will not always equal the sum of
its members' individual points, and that divergence is accepted rather than
reconciled: the two boards answer different questions ("what does AIESEC's
own analytics say this office did" vs. "what did this specific person do"),
each authoritative for its own question.

Individual scoring (`individualStandings`, `personalProgress`, rewards) is
entirely unaffected and keeps reading the ledger as above.

#### Which offices are ranked (D-57)

`MC_OFFICE_ID` (182) is only the query root the analytics call is scoped to —
its own total is always identical to the sum of the ranked offices below it,
so it is never itself a ranked row (`isMc: false` excludes it) and it
correctly never appears as its own key in the API's per-office breakdown.

The ranked entities are the operating LCs plus MC-direct's own committee,
which is a *separate* GIS id from `MC_OFFICE_ID` on the analytics side (for
AIESEC in Lebanon, entity `1735`, "MC Lebanon" — a normal office row
`syncOfficeTree` already discovers and stores, `isMc: false` like an LC).
Confirmed live: a real MCP/MCVP's own **position** is still recorded under
`MC_OFFICE_ID` in GIS (D-32 holds for the roster side); only the *analytics*
side buckets MC-direct's applications under the sibling id instead. So that
one row is displayed under `MC_OFFICE_ID`'s id — joining with
`individualStandings()`'s `scoringOfficeId` grouping, which the leading-office
member group on `/leaderboard/lcs` depends on — while its funnel counts still
come from its own analytics key, configured as the optional
`MC_DIRECT_ENTITY_ID` env var. Left unset, that row simply reads zero funnel
activity rather than crashing.

Breaks emit negated points and `countDelta = -1` (D-10), shared the way the
stage was, under two constraints that keep a visible score defensible:

- A break scores only if the event it reverses is **also inside the window**
  (D-26). A break of pre-window work reduces nothing, because nothing was
  credited.
- A break is ignored if the stage date it reverses is **later** than the break
  date (D-28), so approve, break, re-approve nets out as approved. Sync skips
  such a break at ingest; the engine also ignores one ingested before the
  re-approval.

Ranking ties break on RE count, then APD, then APL, then the earliest timestamp
at which the current score was reached (D-33).

### Replay

Any change to `ScoreConfig`, `EpAssignment` or `Reward` triggers a full rebuild
of the ledger and re-evaluation of grants. At Lebanon's volume a full rebuild is
the simplest correct option. Replays are audited.

---

## 8. Admin surface (`/admin`)

- **Scoring** (`/admin/scoring`) — the manager shares: a percentage per
  position role, totalling 100, for splitting an EP's points between everyone
  credited with it (D-73). Saving creates a new `ScoreConfig` version and
  replays. APL/APD/RE points, product and direction multipliers, the APL
  reversal toggle and scope sides are shown for reference and stay seeded
  configuration for now.
- **Display window** — the range the reward race is measured in. Saving replays.
- **Term start** — the floor under everything (D-58): sync collects nothing
  earlier and the leaderboards open on it. Saving does not replay, because the
  ledger is still derived against the window above.
- **Rewards** — create, edit, activate.
- **Assignments** — every EP updated since the current window opened, by
  their own record or any application, latest first (D-76), each with EXPA's status (D-78) and one Managers column:
  everyone credited, with their portrait (D-79), share and sources (EXPA, sheet,
  admin), a searchable picker to add a member and a control to remove or
  restore one (D-73). Managers EXPA names who are not members this term are
  shown, not credited. Above the table, the MC sign-up sheet: what it lists and
  matched, anything in it to correct, a preview and a run-now button, and every
  EP manager name it uses with who that name matches -- an admin picks the
  member for a name that matches nobody or several people (D-80). The import
  itself also runs after every sync. The table's Refresh runs the EP data job
  there and then (D-66).
- **Offices** — which offices are operating (D-39), seeded from the alignments
  list and editable without a deploy.
- **Unattributed queue** — events with no assignment; on the console, the
  "Nobody credited" manager filter.
- **Updates** (`/admin/sync`) — hackathon mode, and for each job its schedule, last
  success, last run, which step failed in plain words, and a button that runs it
  now (D-66, D-82). The technical error stays in `SyncJob.lastError` and the logs.
- **Admin matchers** — role-name and title patterns.

Every mutation writes an `AuditLog` row with before/after JSON.

---

## 9. Front end

### Routes

| Route | Purpose |
|---|---|
| `/` | Personal dashboard |
| `/leaderboard` | Individual ranking, filterable by LC and MC and by date range (D-58). Both filters sit above the podium |
| `/leaderboard/lcs` | LC ranking, MC-direct as its own entity (D-11), over the same date range. Points and counts read live from AIESEC's own analytics API, not the ledger (D-56) |
| `/me` | Full event history and point trail |
| `/tv` | Fullscreen display mode for office screens. Stays on the active display window; no range picker (D-58) |
| `/admin/*` | Configuration |

### Interactions

- **Funnel progress ring.** Three nested arcs — APL, APD, RE — filling toward the
  next reward threshold. Segment count comes from the active reward, never
  hardcoded.
- **Next reward card.** Distance to the next threshold in that reward's own unit,
  with its label and icon.
- **Pace meter.** Events per week needed to reach the next threshold before the
  display window closes, against current pace. This converts a distant date into
  a this-week number and is the highest-leverage element for behaviour change.
- **Live leaderboard.** SSE-pushed. FLIP transitions on rank change so movement is
  legible. Contextual nudge: "1 approval behind the next rank."
- **Date range control.** Two fields and an Apply, above the podium with the
  office chips, writing `?from=&to=` (D-58). The calendar is this product's own
  (`components/studio/date-field.tsx`), not `<input type="date">`: that control's
  popup is browser chrome, rendered by the platform in the platform's own blue,
  and no stylesheet reaches it — next to a warm-paper cyclorama it reads as a
  different application. Ours also refuses dates before the term start rather
  than only rejecting them on submit. Keyboard behaviour follows the ARIA
  date-picker pattern: one tab stop into the grid, arrows to move, Escape to
  leave, because 42 tabbable days would be operable and unusable.
- **One shell, one scroll container (D-64).** The body is the viewport; the
  header is fixed chrome above a single `overflow-y-auto` column, and the page
  moves inside it. That column is a flex container, so a page root is a flex
  item and declares one of two contracts: `min-h-full shrink-0` to grow with its
  content, or `min-h-0 flex-1` to fit the viewport and scroll an inner region.
  Without `shrink-0` the first kind is squeezed back to one viewport while its
  content overflows the box, which strands the page's own padding at the fold.
  Every scrolling screen ends on the same `.page-end` gutter.
- **The dashboard fits the viewport (D-65).** From `lg` up `/` is pinned to the
  shell and the hero is drawn at whatever height the stage has left, capped at
  the 440px it was composed at; below `lg` the three columns stack and the page
  scrolls. `components/studio/hero-stage.tsx` does the measuring, on the same
  terms as the podium below.
- **The podium fits the viewport.** Its bodies are sized in pixels, since a
  canvas needs pixels, and at the design sizes the block runs past the fold on a
  laptop — the winner was on screen with their name behind the floating dock. The
  bodies and shadows scale to the height actually left below the filters; the
  name cards do not, because they carry the part that has to stay readable.
- **Milestone moment.** Full-screen celebration on a new scored event, plus a
  server-rendered share card.
- **Audit drawer.** Any score expands into the events behind it: stage, date,
  product and points. It names no EP and no opportunity — those are looked up in
  EXPA, not here (D-44).
- **Break transparency.** A score reduction is explained inline. Unexplained drops
  destroy trust in the mechanism.

### Visual identity — STUDIO (D-24, D-48)

AIESEC brand colours and typography, arranged into a product identity distinct
from EXPA. The surface is **warm paper**, not the dark competitive field the
first pass carried: every screen is an infinite-white cyclorama with a horizon
line, and the member's character stands on it at full height as the primary data
ink. A member is a body on a set, not a row of numerals.

The rules the direction is held to:

- **One number is large.** Points, set behind the body as a ghost numeral and
  again at reading size beside it. Everything else is a chip that opens when
  asked — which is also where the audit drawer lives.
- **Depth is shadow, never gradient.** Three elevation steps, `--elevation-1..3`,
  plus a radial contact shadow under every body so it is planted rather than
  floating.
- **Nothing animates except the idle breath and what you touch.** The idle loop
  is CSS keyframes, because a dozen bodies breathe at once and a dozen animation
  controllers would not be worth it; entrance, hover, count-up and the character
  lab are Motion, loaded after first paint through `LazyMotion` in strict mode.
- **Four typefaces, one job each.** Fredoka display, Figtree UI, Baloo 2 for
  every score and rank, Space Mono for labels. Declared once in
  `lib/design/fonts.ts` (D-48).

Tokens live in `lib/design/tokens.ts` and are mirrored into `app/globals.css`; a
test fails if the two drift, because three.js and Recharts read the TypeScript
values while everything else reads the custom properties. The four stage accents
are the raw AIESEC brand hues, unaltered; each also carries a wash, a mid tone
and an ink in `STAGE_TINT`, and it is the ink that clears WCAG AA as text.

**Charts are the one place the stage accents are not used.** APL < APD < RE is an
ordinal scale — swapping two stages would change the meaning — so chart series
take a one-hue ramp stepped from AIESEC blue, in which the reader sees the funnel
order in the colour. The ramp is validated, not eyeballed; re-run the validator
before changing a step. There is one ramp because there is one surface.

### The 3D layer (D-47)

**Where the models go.** Every character on every screen is rendered by
`components/studio/character.tsx`, which today returns a flat render and reserves
the height and contact shadow the posed glTF will need. That is the only seam:
nothing else names an image file, so swapping in a `<Scene>` there changes no
layout and no caller. Which body a member gets is a hash of their name
(`lib/design/character.ts`), not a stored column, so the same person keeps the
same body everywhere without a migration; when the costume variants clear O-12
the hash becomes a variant index instead.

A scene is mounted through `components/three/scene.tsx` and never by rendering
`<Canvas>` directly. That wrapper is where four rules are enforced rather than
remembered:

- **Client-only and lazily loaded.** three, drei and the scene graph never reach
  the server bundle, and a route that shows no scene downloads none of them.
- **Viewport-gated.** A canvas below the fold does not boot a WebGL context.
- **A DOM equivalent is required, not optional.** `Scene` takes a `fallback`,
  shown when there is no GPU or the context is lost, and exposed to assistive
  technology otherwise. A `<canvas>` is invisible to a screen reader and
  unreachable by keyboard, so the data is always in the DOM as well.
- **Nothing is fetched from a CDN.** drei's `Environment` presets, three's Draco
  decoder and troika's font resolver all default to one. Each is overridden to a
  copy under `public/`, synced from `node_modules` at install time so it cannot
  drift from the installed version.

### Non-negotiables

- Mobile-first.
- WCAG 2.1 AA: keyboard-navigable leaderboard, checked contrast, ARIA live regions
  for rank updates.
- Every 3D surface has a DOM equivalent, and degrades to it without a GPU.
- Motion is on for everyone by default; the member's own switch reduces it, and
  the operating system's `prefers-reduced-motion` is deliberately not consulted
  (D-46). WCAG 2.2.2 is satisfied by the control, not by the OS default.
- Skeletons, never spinners.

### Copy and names (D-81, D-82)

- An LC is shown through `officeLabel()` (`lib/design/names.ts`): EXPA's
  "(EXP)" suffix is dropped, and the MC -- office 182 or its sibling analytics
  entity -- reads "MC". A person's name goes through `personName()`, where it
  is written (sign-in, the roster sync) and where it is read (live EXPA names,
  the current user, the leaderboards, the console), so a stored name that
  predates the rule still shows correctly.
- The admins are users, not developers. No screen shows a decision id, a
  document, a table, field, environment variable, job or step name, an API, GIS,
  GitHub, or a raw error; those stay in comments, logs and `SyncJob.lastError`.
  Messages say what happened and what to do next, in full sentences.
- One word per idea: **refresh** (never sync or import for the EP data job),
  **earns points** (not credited or attributed), **scoring period** (the
  display window), **LC** (not office or entity), and the sources **EXPA**,
  **sign-up sheet** and **added here**. APL, APD and RE stay: every member uses
  them.

---

## 10. Data handling

Recorded decisions (D-17, D-18, D-19): the MC is the data controller, the MCVP IM
is the responsible officer, there is no in-product privacy notice, consent prompt
or opt-out, and EP details appear in the audit trail behind AIESEC auth.

Technical measures that remain regardless:

- **Data minimisation is structural, not a policy.** The sync query does not
  request an EP's name, so no code path can store one (D-42). The only EP datum
  held is `epPersonId`, the join that makes attribution possible at all. Names
  are read from GIS per view and discarded.
- **Collection is bounded by purpose.** Nothing before the term start is fetched
  or stored, because nothing before it can be scored to the right member (D-43,
  amended by D-58). When this bound was introduced, 206 of 269 stored events fell
  outside it and existed for no reason; they were deleted by migration. The bound
  was originally the active display window, which made it move every time the MC
  moved the race — the term is the stable statement of what this holds.
- A test suite reads the schema and the GIS operations as text and fails if a
  name, email or phone field reappears in either.
- No DOB, gender, nationality, CVs or academic history, all of which GIS exposes
  and none of which this product needs.
- No special category data stored.
- Encryption in transit and at rest.
- No third-party analytics with cross-site tracking.
- Access restricted to authenticated members of the 182 subtree (D-16).
- `AuditLog` covers every administrative mutation and every export.
- An admin-only single-person export exists so an access or rectification request
  can be serviced in minutes.

---

## 11. Security

- All GIS traffic server-side. No token of any kind reaches the client.
- No generic GraphQL proxy route (section 4.4).
- Every route and server action authorizes independently; GIS permissions are not
  relied on for isolation.
- CSRF protection on server actions, strict `SameSite` cookies.
- Rate limiting on auth, admin and sync-trigger routes.
- The cron routes (`/api/cron/*`) are the one API surface with no session behind
  them: the proxy lets them through and each authenticates with `CRON_SECRET`
  itself. The job lease and the two-minute gap bound how often even a leaked
  secret can make GIS work, and the routes answer with statuses and counts only,
  because the GitHub Actions logs that print them are public (D-66).
- CSP with a per-request nonce, no inline scripts, built in `lib/security/csp.ts`
  and applied in `proxy.ts`. Because the nonce is minted per request, every route
  must render dynamically — a statically prerendered page gets no nonce and its
  scripts are blocked by `strict-dynamic`.

  Three allowances exist for the 3D layer and each is load-bearing:
  `'wasm-unsafe-eval'` because Rapier and the Draco decoder both instantiate
  WebAssembly, `worker-src blob:` because three assembles the Draco worker as a
  string and loads it through `URL.createObjectURL`, and `img-src blob: data:`
  because glTF textures arrive that way. `tests/csp.test.ts` asserts all three,
  since losing one breaks production while development still works.

  `style-src` carries `'unsafe-inline'` deliberately: React serialises every
  `style={{…}}` prop into a style attribute during SSR and Recharts sizes its
  container that way, so nonce-only styles would break the charts without
  affecting the threat `script-src` actually holds.
- Secrets in the platform secret store; `.env.example` holds placeholders only.
- Admin actions re-verified against live GIS positions rather than cached session
  claims.

---

## 12. Delivery plan (D-22)

**Day 1 — MVP**

1. **GIS spike — done.** Verified against office 182 with the service token;
   harness in `scripts/spike`, reports written to `scripts/spike/out` and not
   committed, since they contain EP names. What it established:

   - Auth is a raw `Authorization` header with no `Bearer` prefix; `Bearer` is
     rejected. Introspection is enabled, 473 types, which is the codegen source.
   - All six funnel date filters return data. Over Jan 2024 to Sep 2026 on
     programmes 7, 8 and 9: 432 applications, 19 approvals, 16 realizations, 4
     broken approvals, no remote realizations and no broken realizations.
   - `programmes` filters correctly: 158 + 261 + 13 sums exactly to the 432
     unfiltered total.
   - Scope confirms outgoing-only: `person_home_mc` returns 432 and
     `opportunity_home_mc` returns 0 (D-27).
   - The subtree is two levels and resolves only through `committees`; three of
     the six children are closed (D-39).
   - 65 active positions, on status value `active`. Role vocabulary closed O-03.
   - EP addresses are relay aliases, which closed the identity question (D-40).
   - `per_page` up to 1000 accepted, no ceiling reached. Ten concurrent requests
     all returned 200, no rate-limit headers of any kind, 287-736ms latency.
     Nothing constrains a 15-minute sync.
2. Repo scaffold, Prisma schema, migrations, codegen, seed config.
3. Auth, role resolution, office-tree scoping, route protection.
4. Sync passes 1–5 with idempotency tests.
5. Scoring engine plus unit suite, including break paths.
6. Individual leaderboard and personal dashboard, correct but unstyled.

**Days 2–3**

7. Assignment UI, pending-assignment creation, CSV import, reconciliation pass 6,
   match review and unattributed queues.
8. Admin config: scoring, display window, rewards, eligibility.
9. LC leaderboard, filters, audit drawer.

**Days 4–5**

10. Visual identity, motion, progress ring, pace meter, SSE, share cards, TV mode.
    The stack this runs on is installed and wired — tokens, type systems, the 3D
    runtime and its fallbacks, the asset pipeline, icons, Motion and Recharts.
    `/lab` renders one of everything and exists only in development.
11. Playwright suite including cross-LC and privilege-escalation tests,
    accessibility pass.

**Days 6–7**

12. Backfill historical events, import existing assignments, clear the match queue.
13. Production deploy, sync monitoring, walkthrough with MCP and MCVP IM.

Steps 1–5 are the correctness core and must not be compressed.

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Service token leaked | Entity-wide read access to AIESEC data by a third party | Section 4.3 handling rules, no proxy route, log redaction, single-env-var rotation |
| Authorization bug with an entity-wide token | One LC sees or edits another's data | Section 4.4 rules, Playwright privilege tests as a release gate |
| Member positions not maintained in EXPA | Those members cannot log in at all (D-31) | Failure is loud rather than silent; the spike reports active position counts per office before launch |
| EP identity cannot be matched on contact details | A reward credited to the wrong person | GIS exposes no real EP address (D-40), so the product does not guess: assignment is selection from the directory, and imported names that are not a single unambiguous hit go to a review queue |
| Wrong identity match | Reward credited to the wrong person | Email and phone auto-match only; name matches require admin confirmation |
| Assignment backlog at launch | Points sit in the unattributed queue | CSV import on day 6; queue visible to every LEAD, not only admins |
| GIS rate limits or schema drift | Sync stalls | Codegen from published schema, backoff, contract tests, staleness banner |
| Gaming via low-quality applications | Reward paid for no exchange value | RE weighted highest; break-driven reduction; weights adjustable at any time |
| Ranking demotivates the bottom half | Net-negative behaviour change | Personal progress first, ranking second, nearby-ranks view |
| The 3D surface is unusable on a member's phone or the office TV | The member cannot read their own score | Every scene declares a DOM fallback and drops to it with no WebGL or on context loss; dpr is clamped and adapts down under load; canvases below the fold never boot a context (section 9) |
| The 3D bundle sinks time-to-interactive | The leaderboard is slow on the device most members use | three, drei and Rapier are all dynamically imported — Rapier alone inlines 1.5MB of WebAssembly and loads only when a scene asks for physics; `next experimental-analyze` is the check |
| 7-day timeline | Scope creep sinks correctness | Day-1 MVP is scoring correctness only; visual work explicitly later |
