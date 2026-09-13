# context.md — AIESEC in Lebanon | AIESEC XP

Status: Decisions locked, GIS verified against office 182, ready for build
Companion: `Architecture.md`

---

## 1. What this is

A permanently-available web dashboard that scores AIESEC in Lebanon members on
exchange funnel performance and ranks them on leaderboards, so that a concrete
personal reward stays visible and peer competition drives volume.

The first reward example is funding a MEXA LDS delegate fee at a given approval
count, but the system is **not** built around that reward or that date. Rewards,
thresholds, point values and the scored time range are all admin configuration.

Two behavioural goals:

1. **Persistence of target** — the member always knows how far they are from the
   next reward.
2. **Social comparison** — LC-vs-LC and member-vs-member ranking.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **SU** | Sign-up. EP registers. Done by the EP, not by a member. **Not scored.** |
| **APL** | Application. Member converts a sign-up into an application. Lowest score. |
| **APD** | Approved. Application accepted by both sides. Higher score. |
| **RE** | Realized. EP lands in the host country. Highest score. |
| **EP** | Exchange Participant — the applicant. |
| **LC / MC** | Local Committee / Member Committee. AIESEC in Lebanon MC office ID is **182**. |
| **MCP / MCVP / LCP / LCVP / TL** | Position roles. MCP and MCVP IM are the admin roles. |
| **GIS / EXPA** | AIESEC GraphQL API at `https://gis-api.aiesec.org/graphql`, and its staff UI. |
| **Assignment** | The EP-to-member link that decides who earns points for that EP's funnel. |
| **Break** | A reversed APL, APD or RE. Reduces count and score. An APL is reversed by the application being withdrawn or rejected (D-41); APD and RE have their own dated break fields. |

---

## 3. Locked decisions

| # | Decision |
|---|---|
| D-01 | Scope: AIESEC in Lebanon MC (office **182**) and its **operating** descendant offices (D-39). Closed offices are in the tree but out of the competition. |
| D-02 | Eligible competitors: anyone holding an **active member position** in scope — MCP, MCVP, LCP, LCVP, TL, member. There is no manual eligibility override: an active in-scope position is the single gate, enforced at login (see D-31). |
| D-03 | Direction: outgoing and incoming count at the **same weight**. Lebanon is outgoing-only today; incoming must work without code changes (see D-27). |
| D-04 | Products in scope: **7 = GV, 8 = GTa, 9 = GTe**. Per-product point multipliers are admin-editable. |
| D-05 | Scored metrics: **APL < APD < RE** by point value. SU is never scored. |
| D-06 | Multiple members assigned to one EP: **full points to each**. |
| D-07 | No competition season. The admin sets the **display window** — the date range of events that counts toward the visible leaderboard and reward progress. |
| D-08 | Events are scored independently. An APL outside the window does not block its APD inside the window from scoring. |
| D-09 | Rewards are fully admin-defined: threshold, label, description, optional monetary value. No winner cap, no budget ceiling, not necessarily monetary. |
| D-10 | Breaks reduce counts and scores and re-rank immediately. Withdrawing an already-announced reward is an MC decision made outside the system. |
| D-11 | Leaderboards: **LC ranking** (MC-direct members as their own entity), and **individual ranking** filterable by LC and MC. |
| D-12 | Auth: AIESEC OAuth2 for member login. Credentials available. |
| D-13 | **Sync uses a non-expiring entity-wide access token from AIESEC dev applications.** It is a server-only secret, never exposed to any user, never sent to the browser, never logged. See `Architecture.md` sections 4.3 and 4.4. |
| D-14 | Admin access: position **role name matches `MCP` or `MCVP IM`**. |
| D-15 | Config changes **recompute history**. The ledger is replayed. |
| D-16 | Audience: any logged-in member of office 182 or a descendant office. |
| D-17 | Controller: AIESEC in Lebanon MC. DPO: MCVP IM. No public privacy notice, no consent prompt, no opt-out, no privacy messaging in the UI. Participation is compulsory for all members. |
| D-18 | EP details may be shown in the score audit trail. |
| D-19 | `Person.meta.opt_out_of_statistical_data` is **not** honoured for leaderboard exclusion. |
| D-20 | No data purge cycle. The display window filters what is counted and shown. |
| D-21 | No hosting-region constraint. |
| D-22 | MVP built day 1. Production go-live within 7 days. |
| D-23 | Handover is by role: next term's MCP and MCVP IM gain access automatically. |
| D-24 | AIESEC brand colours and typography, applied to a visual identity distinct to this product. |
| D-25 | Direction is decided by the **person side**: an EP whose home office is in the 182 subtree is `OUTGOING`, regardless of where the opportunity sits. An application is one event per stage and therefore exactly one direction. |
| D-26 | A **break only scores if the event it reverses also falls inside the display window.** A break whose original event is outside the window is ingested but contributes nothing, so a visible score can never go negative for work done before the window. |
| D-27 | Sync queries the **person side only** today, because Lebanon runs outgoing exchange only. The opportunity-side scope is implemented and config-gated, so enabling incoming is a configuration change, not a code change (D-03). |
| D-28 | A break is **superseded** if the stage date it reverses is later than the break date — an approve, break, re-approve sequence scores as approved. Breaks are compared against the current stage date, never applied blindly. |
| D-29 | Remote realization scores **identically** to physical realization. No separate weight, no extra config field. Where both dates exist the earlier is taken. |
| D-30 | An event whose programme has no configured weight scores **zero** and is surfaced as an anomaly. A missing weight is never silently treated as 1. |
| D-31 | Login requires an active member position inside the 182 subtree. Anyone else is `DENIED`. Eligibility for the leaderboard is therefore not separate configuration — it is the same gate. |
| D-32 | A member's LC is the office of their highest-ranked active position; MC-direct means that office is 182 itself. A member counts for exactly one entity on the LC leaderboard. |
| D-33 | Leaderboard tie-break order: points, then RE count, then APD count, then APL count, then the earliest timestamp at which the current score was reached. |
| D-34 | A replay that no longer supports a `RewardGrant` **deletes** it. There is no `REVOKED` state; whether to honour an already-announced reward is an MC decision taken outside the system (D-10). The replay itself is audited. |
| D-35 | APL is reversed from application **status** — rejected or withdrawn — not from a date filter, since GIS has no broken-application date. Gated by `ScoreConfig.reverseApl`, which ships **on** (D-41). Closes O-02. |
| D-36 | New assignments default `effectiveFrom` to the EP's earliest known event, so an assignment claims the whole funnel unless an admin narrows it. Only events inside the display window score. Closes O-01. |
| D-37 | Hosting is Vercel, production only. There is no staging deployment: AIESEC auth does not accept Vercel preview URLs as registered redirect URIs. |
| D-38 | Auth is AIESEC OAuth2 directly, following the `auth-template` project. No Auth.js, no second credential system. |
| D-39 | Which offices are **operating** is derived, not hardcoded. The tree comes from `committees(filters: { parent })`, and the operating set is seeded from the public alignments list at `gis-api.aiesec.org/v2/lists/mcs_alignments?mc_name=Lebanon`, which returns 6550, 1735 and 5854 alongside the MC. `Office.isOperating` is admin-editable, so opening or closing an LC is a toggle rather than a deploy. Verified at spike: 6549, 6547 and 5853 are closed. |
| D-40 | **No EP email is stored or matched on.** GIS exposes only a per-person relay alias of the form `p_<hash>@inbound.aiesec.org`, never a real address, so email cannot identify anyone. Assignment picks the EP from the GIS directory and stores `epPersonId` directly. A performance dashboard has no other use for the address. |
| D-41 | The APL count is **net**: an application that is withdrawn or rejected does not count, whenever that happened. APL is evaluated against the application's current status rather than as a dated reversal, because GIS has no broken-application date and the MC wants a final figure. Which statuses reverse an APL is configuration (`ScoreConfig.aplReversingStatuses`), seeded with `withdrawn` and `rejected`. The full observed vocabulary is `open`, `withdrawn`, `approved`, `rejected`, `matched`, `finished`, `completed`, `realized`, `approval_broken`; note that `approval_broken` does **not** reverse an APL, since a broken approval does not undo the application. Measured over the last 365 days: 242 applications, 183 withdrawn or rejected, 59 net. |

---

## 4. Identity: what exists in GIS and what does not

This is the sharpest constraint in the project and the design is built around it.

### 4.1 Members

Any member who logs into this dashboard necessarily has a GIS `person_id`,
because AIESEC auth **is** the GIS identity. Login therefore cannot fail for lack
of a person record.

**Eligibility** (D-02) depends on an active `member_position` in EXPA. That same
position is what admits the member to the product at all (D-31): no active
in-scope position, no login, no leaderboard row. There is no manual override and
no `eligibilityMode` — a member who can sign in is by definition eligible, which
removes a whole class of divergence between "can see the dashboard" and "appears
on it".

The consequence to watch is an LC that does not maintain positions in EXPA: its
members cannot log in at all, which is loud rather than silent. The spike reports
the active position count per office so this is visible before launch.

### 4.2 EPs

Every **application** in GIS carries a person: `OpportunityApplication.person`.
So at APL, APD and RE, the EP always has a `person_id`. Scoring is never blocked.

**All sign-ups arrive through EXPA** (closes O-06), so in the normal case the EP
already exists in GIS at assignment time and is picked from a directory — the
assignment is `LINKED` on creation and never enters reconciliation.

Identity matching on contact details is not possible and is not attempted
(D-40). GIS returns only a per-person relay alias in place of an EP's email —
every one of the 600 EPs sampled at the spike had an address of the form
`p_<hash>@inbound.aiesec.org`. Those aliases resolve nothing: `checkPersonPresent`
rejects them, and both `people(q:)` and `peopleAutocomplete` return empty for
them. No EP email or phone number is stored by this system.

Assignment therefore works by **selection, not matching**. The LCVP searches the
GIS-backed EP directory — `people(filters: { home_committee, has_opportunity_applications }, q)`,
which the spike confirmed resolves a full name to a single person — and picks the
EP. The assignment stores `epPersonId` and is `LINKED` on creation.

`PENDING` survives for one path only: the bulk CSV import used to backfill
existing assignments, where rows arrive as names typed by humans. Those resolve
against the directory by exact full name within the LC, and any row that is not a
single unambiguous hit becomes `NEEDS_REVIEW` for admin confirmation. A name
match is never applied silently, because a wrong match sends someone else's
reward to the wrong person.

---

## 5. The attribution problem

EXPA records a manager on an application only **after approval**. The real
assignment — which member owns which EP — happens at sign-up, manually, outside
EXPA. So APL points cannot be attributed from EXPA at all, and APD/RE attribution
from EXPA would be late and inconsistent with how the MC works.

Attribution is therefore **per EP, not per application**, and the registry lives
in this system.

### Options evaluated

**Option A — Google Sheet as system of record.** Rejected. It stores EP *names*,
which cannot be reliably joined to GIS person IDs; duplicates and transliteration
misattribute rewards silently. No access control, no audit. Retained only as a
**bulk import format**.

**Option B — adopt EXPA `Person.managers`.** GIS supports it
(`Person.managers`, `PeopleFilter.managers`, `bulkAssignManagersForPeople`).
Rejected for v1: it forces a process change on every LC in the same week the
product goes live. Kept as a fallback strategy in the attribution chain, so
adopting it later requires no code change.

**Option C — assignment registry inside the dashboard. Chosen.** One assignment
drives APL, APD and RE for that EP, consistent by construction. LCVPs and TLs
assign within their own LC; MCP and MCVP IM assign anywhere. Unassigned events
go to a visible **unattributed queue**, never silently dropped.

---

## 6. Data pulled from GIS

Verified against the published schema.

| Need | GIS query / field |
|---|---|
| EP directory for assignment | `people(filters: PeopleFilter{ home_committee, has_opportunity_applications, q }, page, per_page)`. Use `q` for name search; the `name` filter is prefix-only and does not match a full name |
| APL events | `allOpportunityApplication(filters: { created_at: DateInput, ... })` |
| APD events | `ApplicationFilter.date_approved` |
| RE events | `ApplicationFilter.date_realized`, `date_remote_realized` |
| Break events | `ApplicationFilter.date_approval_broken`, `date_realisation_broke` |
| APL reversal (D-35) | `ApplicationFilter.statuses`, with `meta.date_rejected` / `meta.date_withdrawn` as the occurrence date |
| Scope | `person_home_lc`, `person_home_mc`, `opportunity_home_lc`, `opportunity_home_mc`, `committee_scope` |
| Product | `ApplicationFilter.programmes: [Int]` — 7, 8, 9 |
| EP on an application | `OpportunityApplication.person { id full_name home_lc { id name } }`. No contact details: `contact_detail.email` is null on every row, and `person.email` is a relay alias, never a real address (D-40) |
| Fallback attribution | `OpportunityApplication.managers`, `Person.managers`, `meta.ep_approved_by` |
| Logged-in identity | `currentPerson { id full_name profile_photo current_office current_positions { role { name } title office { id } status } }` |
| Office tree under 182 | `committees(filters: OfficeFilter{ parent: [...] })`, recursed. There is **no root `office` field** on this schema, so the `office(id:)` shape used by `finance-dashboard` does not work here. The subtree is always derived, never hardcoded. |
| Which offices are operating | `GET gis-api.aiesec.org/v2/lists/mcs_alignments?mc_name=Lebanon` — public, unauthenticated, returns the operating office ids (D-39) |
| Roster | `memberPositions(filters: MemberPositionFilter{ office_id, status: ["active"] }, page, per_page)`. The status value is `active`; `current` is accepted and matches nothing |

**Known limitation:** `ApplicationFilter` has no `updated_at` filter. Change
detection uses the per-stage date windows plus a nightly re-read of applications
already in the ledger.

---

## 7. Out of scope

- Writing to GIS.
- Paying out rewards. The dashboard declares eligibility; finance pays.
- Sign-up scoring.
- Native mobile apps. Responsive web plus a fullscreen TV mode.

---

## 8. Open items

All open items are closed. The spike measured the last of them.

Closed:

- **O-03** — closed. Measured against office 182: `role.name` takes the values
  `TM`, `LCVP`, `TL`, `MCVP`, `LCP`, `ESTL`, `MCP`, `ESTM`. `role.name = MCP`
  identifies the president safely, but `role.name = MCVP` does not identify the
  IM — it also matches MXP and MKT. The IM is identified by title, and there are
  two spellings in use, `MCVP IM` and `MCM IM`. `AdminMatcher` therefore seeds
  with `ROLE_NAME: MCP`, `TITLE: MCVP IM` and `TITLE: MCM IM`.

- **O-01** — closed by D-36. Effective-dated assignments, defaulting
  `effectiveFrom` to the EP's earliest known event.
- **O-02** — closed by D-35. APL reversal is driven by application status.
- **O-05** — withdrawn. Position coverage is no longer measured against a
  headcount, because an active position is the login gate (D-31) and there is no
  manual eligibility path to choose between.
- **O-06** — closed. All sign-ups arrive through EXPA.
- **O-07** — out of product scope. The MCVP IM holds the service token and
  briefs their successor directly; nothing about custody lives in the code.
