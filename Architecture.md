# Architecture.md — AIESEC in Lebanon | AIESEC XP

Companion: `Context.md` (domain, glossary, decisions D-01…D-41; all open items closed)

---

## 1. Principles

1. **GIS is the source of truth for exchange events; this system is a read-only
   projection.** No writes to EXPA.
2. **The dashboard owns EP-to-member assignment**, because EXPA does not record
   it at sign-up time. See `Context.md` sections 4 and 5.
3. **Event-sourced scoring.** Immutable events in, derived score out. A config
   change is a replay, not a patch — this is what makes D-15 cheap.
4. **Configuration over code.** Point values, per-product multipliers, rewards,
   thresholds, display window, scope sides and admin role matchers all live
   in tables.
5. **KISS / YAGNI.** One Next.js deployment, one Postgres, one scheduled job.

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
| Motion | Framer Motion | Spring progress, FLIP rank transitions, honours `prefers-reduced-motion` |
| Charts | Recharts | Trend and pace views |
| Auth | AIESEC OAuth2 directly, following the `auth-template` project (D-38) | AIESEC auth is not OIDC-discoverable and GIS wants the raw token as `Authorization` with no `Bearer` prefix. A hand-rolled Authorization Code flow is less machinery than bending Auth.js around both. Identity only |
| DB | PostgreSQL (Neon or Supabase) | Relational, transactional, cheap |
| ORM | Prisma | Typed access, versioned migrations |
| GIS client | graphql-request + graphql-codegen | Types generated from the schema, captured by introspection at the spike |
| Scheduling | Vercel Cron | No always-on worker needed. Vercel is the only deployment target and there is no staging (D-37) |
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
| `ADMIN` | Active position matching a configured `AdminMatcher` — seeded `ROLE_NAME: MCP`, `TITLE: MCVP IM`, `TITLE: MCM IM` (D-14, O-03). `role.name = MCVP` is deliberately not a matcher: it also matches MXP and MKT | Everything: config, assignments anywhere, overrides, sync control |
| `LEAD` | Active LCP / LCVP / TL position | Assign EPs within own LC, view all |
| `MEMBER` | Any other active position in scope (D-02) | Own progress, leaderboards |
| `DENIED` | Authenticated but holding no active position inside the office 182 subtree | No access (D-16, D-31) |

Scope is office 182 plus descendants, resolved from GIS into an `Office` table
with a parent pointer. Access derives from live GIS positions, so next term's
officers inherit it automatically (D-23) and terminated officers lose it.

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

// ── EP assignment: owned by this system, not EXPA ────────────────────
enum AssignmentState  { PENDING LINKED NEEDS_REVIEW }
enum AssignmentSource { MANUAL IMPORT GIS_FALLBACK }

model EpAssignment {
  id            String   @id @default(cuid())
  epPersonId    BigInt?                 // null only on an unresolved import row
  epFullName    String                  // the only match key, used by CSV import
  state         AssignmentState @default(PENDING)
  memberId      BigInt
  effectiveFrom DateTime
  effectiveTo   DateTime?               // null = current (O-01)
  source        AssignmentSource
  createdBy     BigInt
  createdAt     DateTime
  @@index([epPersonId, effectiveFrom])
  @@index([state])
}
```

An assignment can be created before the EP exists in GIS. A reconciliation pass
resolves it. Only `LINKED` assignments attribute points; `PENDING` and
`NEEDS_REVIEW` are visible work items, not silent failures.

```prisma
// ── Raw exchange events from GIS ─────────────────────────────────────
enum FunnelEvent { APL APD RE APD_BROKEN RE_BROKEN }
enum Direction   { OUTGOING INCOMING }

model ExchangeEvent {
  id                  String      @id @default(cuid())
  applicationId       BigInt
  eventType           FunnelEvent
  occurredAt          DateTime
  epPersonId          BigInt                  // always present on an application
  epFullName          String                  // D-18
  epHomeLcId          BigInt?                 // EP's own office, not the scoring office
  programmeId         Int                     // 7 | 8 | 9
  direction           Direction
  personHomeLcId      BigInt?
  opportunityHomeLcId BigInt?
  opportunityTitle    String?
  applicationStatus   String?                 // net APL is a status check (D-41)
  gisManagerIds       BigInt[]                // fallback attribution
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
  configVersion   Int
  points          Decimal                       // negative on break
  countDelta      Int
  occurredAt      DateTime
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

Runs every 15 minutes on the service token, scoped to the 182 subtree and
`programmes: [7, 8, 9]`. Scope is applied on the person side today; the
opportunity side is the same code path selected by `ScoreConfig.scopeSides`, so
incoming exchange is a configuration change (D-27). Results from both sides
converge on the same idempotency key, so an application that is Lebanese on both
sides is stored once, as `OUTGOING` (D-25).

| Pass | GIS filter | Produces |
|---|---|---|
| 1 | `created_at` | `APL` |
| 2 | `date_approved` | `APD` |
| 3 | `date_realized` + `date_remote_realized` | `RE` |
| 4 | `date_approval_broken` | `APD_BROKEN` |
| 5 | `date_realisation_broke` | `RE_BROKEN` |
| 5b | `statuses` = rejected / withdrawn | `applicationStatus` on the existing `APL` row (D-41) |

Pass 5b is not a break pass and emits no event. It has no date filter to
watermark against, because GIS exposes none for rejection or withdrawal, so it
re-reads the status of applications already in the ledger and updates
`ExchangeEvent.applicationStatus` in place. That field is raw observed state from
GIS, not a derived value, so writing it is not a ledger patch.

Each pass paginates to `paging.total_pages`, sorted ascending on its date field,
and upserts on `(applicationId, eventType)`, so reruns are idempotent. A 48-hour
overlap behind the watermark absorbs back-dated records. The watermark advances
only on a fully successful pass.

**Pass 6 — import reconciliation.** Assignments made through the UI are `LINKED`
on creation, because the LCVP picks the EP out of the GIS directory and the row
stores `epPersonId` (D-40). This pass exists only for rows from the bulk CSV
import, which arrive as typed names. Each is resolved by exact full name within
the LC; anything that is not a single unambiguous hit becomes `NEEDS_REVIEW` for
admin confirmation, never applied silently, because a wrong match sends someone
else's reward to the wrong person. No contact detail is used or stored: GIS
exposes only a relay alias in place of an EP's email, which identifies nobody.

**Pass 7 — nightly reconciliation of ledger applications.** `ApplicationFilter`
has no `updated_at` filter, so applications already ingested are re-read nightly
to repair silent drift.

**Pass 8 — nightly roster, office tree and EP directory refresh.**

Every pass writes a `SyncRun` row. Repeated failures raise an alert and the
UI shows a staleness banner with the last successful sync time.

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

### Attribution chain

One interface, strategies tried in order:

1. `EpAssignmentStrategy` — `LINKED` assignment matched on `epPersonId`, using
   whichever assignment was effective at `occurredAt` (O-01). Multiple concurrent
   assignees each receive **full** points (D-06).
2. `GisPersonManagerStrategy` — `Person.managers`, if the MC later adopts EXPA
   assignment.
3. `GisApplicationManagerStrategy` — `application.managers`, populated only
   post-approval.
4. `UnattributedStrategy` — recorded, scored to nobody, surfaced in the admin
   unattributed queue.

Attribution keyed on the EP means APL, APD and RE for one EP credit the same
member by construction.

### Points

```
points = basePoints(eventType)
       × productWeight(programmeId)
       × directionWeight(direction)
```

An `APL` scores only while its application is neither withdrawn nor rejected
(D-41). This is evaluated against `applicationStatus`, the current observed state,
rather than as a dated reversal, because GIS dates neither transition. One
consequence is deliberate and worth stating: an application rejected after the
display window closes removes its point from that window retrospectively. That is
consistent with a system whose ledger is rebuilt rather than patched (D-15), and
it is what "final APL count" means. At spike volumes it is the difference between
432 gross applications and 71 net.

An event whose `programmeId` has no entry in `productWeights` scores zero and is
returned as an anomaly, never scored at an assumed weight of 1 (D-30). Remote and
physical realization share one weight; where both dates exist the earlier wins
(D-29).

Only events whose `occurredAt` falls inside the active `DisplayWindow` contribute
to the visible leaderboard, and each event is evaluated independently (D-08).

Breaks emit negated points and `countDelta = -1` (D-10), under two constraints
that keep a visible score defensible:

- A break scores only if the event it reverses is **also inside the window**
  (D-26). A break of pre-window work reduces nothing, because nothing was
  credited.
- A break is ignored if the stage date it reverses is **later** than the break
  date (D-28), so approve, break, re-approve nets out as approved.

Ranking ties break on RE count, then APD, then APL, then the earliest timestamp
at which the current score was reached (D-33).

### Replay

Any change to `ScoreConfig`, `EpAssignment` or `Reward` triggers a full rebuild
of the ledger and re-evaluation of grants. At Lebanon's volume a full rebuild is
the simplest correct option. Replays are audited.

---

## 8. Admin surface (`/admin`)

- **Scoring config** — APL/APD/RE points, product and direction multipliers, APL
  reversal toggle, scope sides. Saving creates a new version and shows a
  leaderboard diff preview before committing.
- **Display window** — the date range everyone sees.
- **Rewards** — create, edit, activate.
- **Assignments** — search the GIS-backed EP directory and pick the EP, which
  links the assignment immediately. Bulk CSV/Sheet import with dry-run preview and
  per-row error report for the launch backfill.
- **Offices** — which offices are operating (D-39), seeded from the alignments
  list and editable without a deploy.
- **Match review queue** — `NEEDS_REVIEW` assignments awaiting confirmation.
- **Unattributed queue** — events with no assignment.
- **Sync health** — per-pass last run, watermark, errors, manual run, manual replay.
- **Admin matchers** — role-name and title patterns.

Every mutation writes an `AuditLog` row with before/after JSON.

---

## 9. Front end

### Routes

| Route | Purpose |
|---|---|
| `/` | Personal dashboard |
| `/leaderboard` | Individual ranking, filterable by LC and MC |
| `/leaderboard/lcs` | LC ranking, MC-direct as its own entity (D-11) |
| `/me` | Full event history and point trail |
| `/assignments` | LEAD and ADMIN: assign EPs |
| `/tv` | Fullscreen display mode for office screens |
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
- **Milestone moment.** Full-screen celebration on a new scored event, plus a
  server-rendered share card.
- **Audit drawer.** Any score expands into the events behind it, including EP name
  and opportunity (D-18).
- **Break transparency.** A score reduction is explained inline. Unexplained drops
  destroy trust in the mechanism.

### Visual identity (D-24)

AIESEC brand colours and typography, arranged into a product identity distinct
from EXPA: dark competitive surface, one accent per funnel stage, heavy numerals,
motion only on state change. Read `/mnt/skills/public/frontend-design/SKILL.md`
before building UI.

### Non-negotiables

- Mobile-first.
- WCAG 2.1 AA: keyboard-navigable leaderboard, checked contrast, ARIA live regions
  for rank updates.
- `prefers-reduced-motion` disables every celebratory animation.
- Skeletons, never spinners.

---

## 10. Data handling

Recorded decisions (D-17, D-18, D-19): the MC is the data controller, the MCVP IM
is the responsible officer, there is no in-product privacy notice, consent prompt
or opt-out, and EP details appear in the audit trail behind AIESEC auth.

Technical measures that remain regardless:

- Only the fields in `Context.md` section 6 are pulled. No DOB, gender,
  nationality, CVs or academic history, all of which GIS exposes and none of which
  this product needs.
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
- CSP with a nonce, no inline scripts.
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
| 7-day timeline | Scope creep sinks correctness | Day-1 MVP is scoring correctness only; visual work explicitly later |
