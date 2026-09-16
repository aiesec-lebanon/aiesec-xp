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
| D-18 | **Superseded by D-44.** EP details are not shown in this product at all. The audit trail explains a score in terms of stage, date, product and points; whoever the EP was is looked up in EXPA. |
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
| D-42 | **No EP personal data is held at rest.** `ExchangeEvent` stores scoring facts only: no name, no opportunity title, no contact detail. The sole EP datum retained is `epPersonId`, which is the join to `EpAssignment` and without which no event could be attributed to anyone. Names for the audit trail, the assignment picker and the review queue are read from GIS per view and discarded. `EpAssignment.epFullName` survives only while an imported row is unresolved and is cleared once it links. |
| D-43 | **Nothing before the active display window is collected.** Sync is floored at `DisplayWindow.startsAt`, not at a lookback constant, so the system holds only what it scores. Moving the window later narrows collection immediately. |
| D-44 | **Scope: rewards and ranking, nothing else.** EP-to-member assignment happens in the MC's Google Sheet and EP data is viewed in EXPA; this product does neither. It therefore has no EP directory, no assignment UI and no EP display surface. `ExchangeEvent` keeps only what the scoring engine reads — application, stage, date, EP id, product, direction, status — and the sync query requests only those fields. Supersedes D-18 and narrows option C in section 5. |
| D-45 | Assignment is **imported** from the MC's sheets, and an admin may **correct** a row afterwards. A correction is marked `ADMIN` and survives re-import, because it is a deliberate decision about who earned something and the sheet must not quietly reverse it. Sheet labels are mapped to members through `ManagerAlias`, never guessed: suggestions are ranked for a human to confirm (O-10). This narrows D-44, which said the product does no assignment at all. |
| D-46 | **Motion is on for everyone by default, and the operating system's `prefers-reduced-motion` is not consulted.** This product is a game; a system default set long ago for an unrelated reason should not silently mute the thing it exists to be. WCAG 2.2.2 is satisfied by a control instead: a "reduce motion" switch in the footer, reachable from every page including before sign-in, which the member sets themselves. The preference is a cookie so the root layout renders it server-side — reading it after hydration would show a burst of exactly the motion the member opted out of. One switch governs every animated surface: Motion, the three.js frame loop, the Rapier simulation, Recharts and the CSS backstop. This amends the `Architecture.md` 9 non-negotiable, which previously made the OS setting the trigger. |
| D-47 | **The game surface is React Three Fiber, and every asset is free-forever and self-hosted.** three.js + `@react-three/fiber` + `@react-three/drei` (MIT), physics by `@react-three/rapier` (MIT over Apache-2.0 Rapier); art from Poly Haven and Kenney (CC0) and Blender (GPL), compressed with glTF-Transform and Draco (MIT/Apache-2.0); icons from game-icons.net (CC BY 3.0, attribution required — `ATTRIBUTIONS.md`); typefaces from Google Fonts (OFL). Nothing is fetched from a CDN at runtime, which matters beyond principle: the CSP would block it. Each of drei's `Environment`, three's `DRACOLoader` and troika's font resolver defaults to a CDN, and each is overridden to a copy under `public/` synced from `node_modules` at install. Spline was evaluated and rejected: its free tier caps scenes and exports, so it is not free-forever by this project's own bar. |

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

**Option C — an assignment register inside the dashboard, populated by import.
Chosen, in a narrower form than first written (D-44).** One assignment drives
APL, APD and RE for that EP, consistent by construction.

Assignment itself is **not performed here**. The MC assigns EPs to members in a
Google Sheet, and this product imports that sheet to learn who earns what. There
is no assignment UI, no EP picker and no EP directory to browse: the register is
a mirror of a decision taken elsewhere, held only so points can be attributed.
Unassigned events go to a visible **unattributed queue**, never silently dropped.

The open question this leaves is what the sheet identifies an EP by. A GIS
person id joins reliably; a name does not, which is precisely why option A was
rejected. See O-08.

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
| EP on an application, for sync | `OpportunityApplication.person { id home_lc { id } }`. Ids only: the sync query does not request a name, so it cannot store one (D-42). No contact details exist to request in any case — `contact_detail.email` is null on every row and `person.email` is a relay alias (D-40) |
| EP details, for display | `people(filters: { ids })`, read per view and discarded. The audit trail (D-18), the assignment picker and the review queue all render from this, never from stored data |
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
- **Assigning EPs to members.** That happens in the MC's Google Sheet (D-44).
- **Viewing EP data.** That is what EXPA is for (D-44).
- Native mobile apps. Responsive web plus a fullscreen TV mode.

---

## 8. Open items

- **O-12 — Licence of the member-avatar character models.** Four stylized child
  characters were downloaded free from CGTrader for the avatar surface. D-47
  requires every asset to be free-forever and self-hosted, and names CC0 sources
  only; CGTrader free downloads are not CC0 and ship under either Royalty-Free
  terms (which permit embedding in an application) or Editorial terms (which
  forbid it). Which applies cannot be read off the downloaded files. Each
  model's source URL, author and granted licence must be recorded in
  `ATTRIBUTIONS.md` before the avatars ship; if any is Editorial, that model is
  replaced from a CC0 source. Until then the models are prototype-only and D-47
  is not demonstrably satisfied. **Open.**
- **O-11 — Which design direction, and whose typeface.** Three type systems are
  built and switchable in one line at `lib/design/fonts.ts`: **Arena** (Orbitron
  / Rajdhani / Space Mono), **Clay Arcade** (Fredoka / Poppins / Baloo 2 / Space
  Mono) and **Overworld** (Bricolage Grotesque / Space Grotesk / Space Mono).
  Arena is active, chosen because D-24 asks for a dark competitive surface and
  heavy numerals — not because the direction has been decided.

  Underneath sits a real tension nobody has resolved: D-24 says "AIESEC brand
  typography", and none of these is AIESEC's brand typeface. A display face
  distinct from EXPA is exactly what D-24 also asks for, so the two readings
  pull in opposite directions. Someone with the current AIESEC brand book needs
  to say which face carries the brand and which carries the product. **Open.**
- **O-10 — Manager labels in the sheet.** The sheet names a manager by first
  name: `Joseph`, `Mona`, `Ahmad M`, `Ahmad K`, `Nour`. Those are a human
  convention, disambiguated by initial, and cannot be matched to a member
  reliably. An admin maps each label to a member once, in `ManagerAlias`, and
  the import refuses a label it has not been told about rather than guessing.
  The mapping needs filling in before any score is attributed. **Open.**
- **O-09 — Production sync token.** Development runs on a standard two-hour
  token, which cannot drive a fifteen-minute cron. Production uses a separate
  non-expiring token per D-13, added directly to the deployment platform. **Open
  until production is configured.**

Closed:

- **O-08** — closed. The sheet carries the EXPA person id, so an imported
  assignment resolves exactly. The identity problem moves to the manager column
  instead; see O-10.
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
