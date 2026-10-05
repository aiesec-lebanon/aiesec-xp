# Context — AIESEC XP

The domain and the rules the product follows. `Architecture.md` covers how it is built.

## 1. What this is

A web dashboard that scores AIESEC in Lebanon members on exchange-funnel performance
and ranks them on leaderboards, so a concrete personal reward stays visible and peer
competition drives volume.

Two behavioural goals:

1. **Persistence of target** — a member always knows how far they are from the next reward.
2. **Social comparison** — LC-vs-LC and member-vs-member ranking.

Rewards, thresholds, point values and scoring periods are all admin configuration; nothing
is built around one reward or one date.

## 2. Glossary

| Term | Meaning |
|---|---|
| **SU** | Sign-up. The EP registers. Never scored. |
| **APL** | Application. Lowest score. |
| **APD** | Approved. Higher score. |
| **RE** | Realized (physical or remote). Highest score. |
| **Break** | A reversed APD or RE (`APD_BROKEN`, `RE_BROKEN`). Takes back what the stage paid. |
| **EP** | Exchange Participant — the applicant. |
| **LC / MC** | Local Committee / Member Committee. The MC office id is `MC_OFFICE_ID` (182). |
| **MC-direct** | Members whose position sits on the MC office itself. Ranked as their own entity. |
| **GIS / EXPA** | AIESEC's GraphQL API (`gis-api.aiesec.org/graphql`) and its staff UI. |
| **Manager** | A member credited with an EP. An EP can have several. |
| **Main manager** | The one manager an admin picks on an EP; they take full points. |
| **Scoring period** | The admin-set date range (`DisplayWindow`) rewards and `/`, `/me`, `/tv` are measured in. |
| **Term start** | The floor under everything: nothing earlier is collected, scored or offered in a range. |

## 3. Rules

### Scope and membership

- Scope is the MC office and its **operating** descendant offices. The office tree is read
  from GIS; which offices operate comes from the public `mcs_alignments` list.
- A person is a **member** if they hold a position that is `active`, in an operating office,
  and had not ended before the term start (a null end date counts as not ended). One rule
  (`isInTermPosition` / `inTermMemberWhere`) decides sign-in, every request, leaderboard
  rows, who can be credited and member counts.
- A member's LC is the office of their most senior in-term position
  (MCP > MCVP > LCP > LCVP > TL > ESTL > ESTM > TM). That same position decides the role
  their share is weighted by.
- Products in scope are 7 (GV), 8 (GTa) and 9 (GTe). Outgoing and incoming count at the same
  weight. Lebanon is outgoing-only today; direction is decided by the EP's home office, and
  incoming is a configuration change (`ScoreConfig.scopeSides`), not a code change.

### Access

- Sign-in is AIESEC OAuth2. No in-term position means **DENIED**.
- **ADMIN**: an in-term position whose role name or title matches an `AdminMatcher`
  (seeded: role `MCP`; titles `MCVP IM`, `MCM IM`, `MCVP oGX`, `MCVP TM`). Matching is exact
  and case-insensitive; `role = MCVP` is deliberately not a matcher because it also matches
  other VPs.
- **LEAD** (LCP, LCVP, TL) and **MEMBER** see the same product: their own progress and the
  leaderboards.
- Next term's officers inherit access automatically because roles come from positions.

### What scores

- Only APL, APD and RE score, each in the range its own date falls in. A stage is never
  re-credited when a later one lands, and accepted/finished/completed are not stages.
- APL is **net**: an application whose current status is in
  `ScoreConfig.aplReversingStatuses` (seeded `withdrawn`, `rejected`) never earns its APL,
  whenever that happened.
- RE is the earlier of physical and remote realization; both score the same.
- A break takes back exactly what its stage paid, and only if that stage was credited in the
  same range. A break whose stage date is later than the break (approve → break → re-approve)
  is ignored.
- A product with no configured weight scores zero and is recorded as an anomaly; it is never
  treated as weight 1.

### Points and credit

```
points = basePoints(stage) × productWeight(programme) × directionWeight(direction) × share
```

- An EP's managers come from three sources at once: **EXPA** (`Person.managers`), the
  **sign-up sheet**, and **added here** by an admin. Each automatic source rewrites only its
  own flag, and only for EPs it actually read, so a failed read takes nobody's credit away.
- An admin removal outranks every source and survives every sync.
- **Shares**: the main manager takes 1 (full points, counts the stage as 1). Everyone else
  takes their role's `ScoreConfig.roleShares` percentage of points *and* counts (an MCVP at
  15% counts 0.15 APD). People in the same role each take the full percentage, so an EP can
  pay out more than its points. With no main picked, a manager alone on an EP takes 1.
- A main who loses their member position keeps the pick and earns nothing; nobody is promoted.
- Only in-term members are credited. Managers EXPA names who are not members are shown on the
  console and earn nothing.
- Leaderboard ties break on points, then RE, APD and APL counts, then who reached the score first.

### Scoring periods and ranges

- Each scoring period keeps the weights it was saved with. Editing weights changes the
  **current** period only and re-scores it; past periods never move.
- A date takes the weights of the most recently saved period covering it; a date no period
  covers takes the latest period that started before it.
- `/leaderboard` and `/leaderboard/lcs` take any `from`/`to` range back to the term start
  (default: term start → today). `/`, `/me`, `/tv` and rewards use the active scoring period.
- Rewards are admin-defined (threshold on points or a stage count, label, optional value).
  A reward that a re-score no longer supports is simply no longer granted; honouring an
  announced reward is an MC decision outside the system.

### LC ranking

- `/leaderboard/lcs` and `/tv` score LCs live from the AIESEC Analytics API's per-office
  funnel counts with the same base × product × direction weights. Nothing is stored.
- These counts are AIESEC's own cumulative totals: no APL netting, no break netting, no
  shares. An LC's total can therefore differ from the sum of its members' points; that is
  accepted.
- The MC office is the query root, never a ranked row. MC-direct's analytics live under a
  sibling entity (`MC_DIRECT_ENTITY_ID`), displayed as the MC.
- If the API cannot be read, the board shows zeros and says so.

### Data handling

- No EP personal data is stored. Events keep scoring facts only; `epPersonId` is the sole EP
  datum. EP names, statuses and managers are read from GIS per view on the admin console and
  discarded.
- GIS exposes only relay aliases for EP emails, so no EP is ever matched on contact details.
- Nothing before the term start is collected.
- The sheet import reads four columns only.
- The MC is the data controller and the MCVP IM the responsible officer. Participation is
  compulsory; there is no in-product privacy notice or opt-out.

### Product and copy

- Admins are users, not developers: no screen shows a field, job, API or raw error name.
- One word per idea: **refresh**, **earns points**, **scoring period**, **LC**, and the sources
  **EXPA**, **sign-up sheet**, **added here**. APL, APD and RE stay.
- LC names drop EXPA's "(EXP)" suffix and the MC reads "MC". Person names are title-cased
  (keeping mixed case such as "McDonald"; an apostrophe does not start a new word).
- Motion is on by default; the member's own switch on `/me` turns it down. The OS
  `prefers-reduced-motion` setting is deliberately not consulted.
- Licence attribution lives in `ATTRIBUTIONS.md`, never in the UI (internal tool behind
  member sign-in).

## 4. Data read from GIS

| Need | Source |
|---|---|
| Funnel events | `allOpportunityApplication` sorted `updated_at` desc, read until older than the watermark. One row carries every stage date: `created_at` (APL), `meta.date_approved`, `meta.date_realized` / `remote_realized_at`, and the break dates |
| APL reversal | The application's current `status` |
| EP managers | `Person.managers` (not `OpportunityApplication.managers`, which is empty) |
| Assignment console | `people(filters: { home_committee, sort: updated_at })` back to the current period's start, plus `people(filters: { ids })` for EPs who can score. `Person.status` lags its applications, so the console shows the furthest of the two |
| Signed-in identity | `currentPerson`, with the user's own token, discarded afterwards |
| Office tree | `committees(filters: { parent })`, recursed (there is no root `office` field) |
| Operating offices | `GET gis-api.aiesec.org/v2/lists/mcs_alignments?mc_name=…` (public) |
| Roster | `memberPositions(filters: { office_id, status: ["active"], end_date: { from: termStart } })` |
| LC funnel counts | AIESEC Analytics `applications/analyze.json` per office and programme |

GIS has no `updated_at` filter but sorts on it, so sync reads newest first and stops at the
watermark. A person's `updated_at` does not move with their applications.

## 5. Out of scope

- Writing to GIS.
- Paying out rewards — the dashboard declares eligibility.
- Scoring sign-ups.
- Assigning EPs beyond correcting who is credited (that happens in EXPA and the sheet).
- Showing EP data to members.
- Native mobile apps (responsive web plus `/tv`).

## 6. Open questions

- **Brand typeface.** The STUDIO faces (Fredoka, Figtree, Baloo 2, Space Mono) are not
  AIESEC's brand typeface. Someone with the current brand book should decide; swapping is
  one file (`lib/design/fonts.ts`).
- **Character model licences.** The CGTrader character models' licence is unconfirmed;
  acceptable for an internal tool, but must be settled before any public release
  (see `ATTRIBUTIONS.md`).
