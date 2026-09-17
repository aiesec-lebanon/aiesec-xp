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
| D-46 | **Motion is on for everyone by default, and the operating system's `prefers-reduced-motion` is not consulted.** This product is a game; a system default set long ago for an unrelated reason should not silently mute the thing it exists to be. WCAG 2.2.2 is satisfied by a control instead in /me page. The preference is a cookie so the root layout renders it server-side — reading it after hydration would show a burst of exactly the motion the member opted out of. One switch governs every animated surface: Motion, the three.js frame loop, the Rapier simulation, Recharts and the CSS backstop. This amends the `Architecture.md` 9 non-negotiable, which previously made the OS setting the trigger. |
| D-48 | **The design direction is STUDIO, and its type system is Fredoka / Figtree / Baloo 2 / Space Mono.** Four directions were comped — 1a STUDIO, 1b DESK, 1c PATH, 1d GALLERY — and STUDIO is built: a warm-paper cyclorama, the member's character centre-frame at full height, one large number and four chips that open when asked. The dark `D‑24` surface is gone, and so are the three unchosen type systems (Arena, Clay Arcade, Overworld) and the second, dark chart ramp; `lib/design/fonts.ts` now declares one set of faces rather than switching between three. The stage hues are unchanged — they are what carries the brand — and each gains a wash / mid / ink triple so an accent can be a background without failing contrast as text. Closes O-11. |
| D-47 | **The game surface is React Three Fiber, and every asset is free-forever and self-hosted.** three.js + `@react-three/fiber` + `@react-three/drei` (MIT), physics by `@react-three/rapier` (MIT over Apache-2.0 Rapier); art from Poly Haven and Kenney (CC0) and Blender (GPL), compressed with glTF-Transform and Draco (MIT/Apache-2.0); icons from game-icons.net (CC BY 3.0, credited in `ATTRIBUTIONS.md` rather than in the UI — D-49); typefaces from Google Fonts (OFL). Nothing is fetched from a CDN at runtime, which matters beyond principle: the CSP would block it. Each of drei's `Environment`, three's `DRACOLoader` and troika's font resolver defaults to a CDN, and each is overridden to a copy under `public/` synced from `node_modules` at install. Spline was evaluated and rejected: its free tier caps scenes and exports, so it is not free-forever by this project's own bar. |
| D-49 | **Licence obligations are met in the repository, never in the UI.** AIESEC XP is an internal tool behind AIESEC OAuth2: every viewer is a logged-in member of office 182 or a descendant (D-16, D-31), there is no public surface and nothing is distributed outside the MC. Attribution therefore lives in `ATTRIBUTIONS.md` and `assets/README.md`, which are reachable to everyone who can reach the product's source, and **no credits line, licence notice or about-page attribution ships in the product**. The footer credits line D-47 implied is removed. Asset choice still prefers CC0 and free-forever sources, but an unconfirmed licence is no longer a release blocker: it is a note in `ATTRIBUTIONS.md` to settle if this product ever leaves the member wall. Closes O-12 and amends D-47. |

| D-50 | **A member's colours are per-part materials on the model, not a shader.** The four characters arrive as one welded mesh with one baked 2048px texture each, so every colour is painted into pixels and none of it can change at runtime. `scripts/assets/avatar-parts.py` labels each triangle with the part it belongs to -- from the body region its heaviest bone implies, plus how close its texel sits to that character's own cluster colours -- splits the mesh into one material per part, and rewrites the baked texture as a luminance map normalised per part. A part then recolours by writing `material.color`, which three multiplies with that luminance, so the shading survives and no custom shader is needed. Two consequences are deliberate. A triangle no reference colour claims becomes `detail`, which keeps the original colour texture and is never tinted -- eyes, a printed logo, a shoe's red flashes and the pink bow all look as drawn, and being over-inclusive there is safe, because `detail` only ever means "leave this alone". And a garment's secondary hue is left unreferenced on purpose, so a swatch repaints the shoe and leaves its trim. The bodies export standing at the origin, 1.5m tall, in an A-pose rather than the authoring T-pose. `scripts/assets/avatar-stills.py` renders a still per character from the shipped `.glb`, replacing the three placeholder PNGs: a live canvas is spent only where one body is shown and can change -- the dashboard hero and the character lab -- while the login crowd, the podium and every leaderboard row use the still, which is also the DOM fallback when there is no GPU, so the two are never different characters. |
| D-51 | **A member's avatar is saved in `MemberAvatar`, a table of its own.** The chosen character plus a colour per part (D-50) persist, closing O-14. It is not columns on `Member`, because `Member` is the GIS sync projection and its `lastSyncedAt` is `@updatedAt` -- saving an avatar there would keep reporting a sync that never happened. A NULL colour means the part keeps the colour it was authored with, which is not any hex a member could pick, so the column is nullable rather than defaulted. The member id comes from the session and is never accepted from the client. Colours are validated as `#RRGGBB` rather than checked against the swatch lists, because the lab also offers a picker for the garments, where any colour is reachable; the character id *is* checked against the four, because it names a `.glb` that has to exist. `/me` and the dashboard hero read the saved avatar; every other surface still shows the body a member's name hashes to, because those screens render other people and a per-row lookup is not worth it yet. |
| D-52 | **The characters ship as they were drawn, and recolouring is parked.** D-50 split each mesh into per-part materials over a luminance map so a member could repaint skin, hair and garments. It worked, but it cost the models their look: a luminance map plus a tint flattens the painted shading, and the one character whose source wired its base colour into Emission as well read as self-lit next to the rest. Reviewed against what this product is for -- ranking exchange performance -- perfecting a dress-up feature is not where the time goes. `scripts/assets/avatar-export.py` now exports the authored materials untouched; `avatar-parts.py` and every client-side piece of the recolouring stay in the tree, commented, so restoring it is uncommenting rather than rewriting. `MemberAvatar` keeps its nullable colour columns for the same reason -- no migration either way. Two things come free with the simpler export. The A-pose is baked into the geometry and the rig dropped, so the shipped body is in world coordinates and three's `Box3` measures what is drawn -- which is what finally made all four render at the same size, after two attempts that measured a skinned mesh's bind pose instead. And each character gains a name -- Milo, Remi, Sami, Juno -- plus a portrait render, so a member picks one at first sign-in (`/welcome`) and their character's face becomes their profile picture everywhere. The export also corrects the surface, which the sources get wrong in two ways: three of the four carry Mixamo's default roughness of 0.5, which reads as wet plastic on a cloth character, and the fourth carries no metallic factor at all -- which glTF reads as fully metal. Both are now written explicitly, matte and non-metal. The lab is a viewer: drag to turn, and a body turns in when it is swapped. Zoom is deliberately off -- it took the body off the floor it was composed on, and scrolling over a canvas mid-page stole the page's own scroll. Animation still needs the export re-run with `export_skins`, which the .blend is still set up for. |
| D-53 | **The characters are animated by one shared Mixamo clip library, and ship rigged.** Sixteen clips live in `public/models/avatar-animations.glb` -- skeleton and tracks, no mesh -- because every clip is a set of bone rotations on the Mixamo skeleton and all four characters carry it, so one file drives any of them. Three were already Mixamo-rigged with identical 65-bone skeletons; Juno was auto-rigged onto the 33-bone subset, which is the same names minus fingers, so her finger tracks are dropped at load rather than warned about once per track. The bind pose stays Mixamo's T-pose, because that is what the clips are authored against -- no screen shows it, since a clip plays from the first frame, and `avatar-stills.py` poses the arms itself before photographing. Two faults in the downloads are corrected at build time: `Rallying` was not exported in place and advances over a metre, so its net drift is subtracted, and Mixamo keys a location on every bone when only the hips use one. With those dropped and keyframes decimated to about half a degree, the library is 875kB rather than 1.9MB -- it is served over Lebanese mobile data, which is the same reason the flat stills still carry every screen that shows more than one body. Behaviour is per surface: a body standing anywhere cycles seven idles at random with a wave about a quarter of the time; the leaderboard podium celebrates; and in the lab and the first-run picker the outgoing character walks off the frame -- its width measured from the viewport, not assumed -- while the next jumps in from the side the member reached towards, its jump re-timed to the width of the screen it has to cross. The clips are retargeted onto one of the characters' own rigs before export, which is the part that is easy to get wrong: a glTF rotation channel *replaces* a node's local rotation rather than adding to it, so a clip is only valid against the rest pose it was authored on. Mixamo's download rig rests differently from the rigs in the .blend -- and is in centimetres besides -- so played directly it collapsed every body to a third of its height. All four characters share a rest, so retargeting once is enough for one shared file. Translation channels are stripped for the same reason: they are authored in the clip skeleton's units, where the hips travel twelve units on a body one and a half units tall. A swap is one walk through the frame: the body on stage leaves the way the arrow pointed, and once it is clear the next follows it in from the far side, both facing the same way. It was a jump landing on the spot first, which was busier than it needed to be. Overlapping them read as a collision, and it also kept two models mounted at once, so a character whose file had not finished loading took the Suspense boundary down with it and the one walking off vanished mid-stride. The lab's canvas fills its panel rather than sitting in a portrait box inside it, because a body that walks off has to leave *the frame the member can see* -- in a box, the edge of the canvas was the middle of the screen. The walk is timed from the distance at a fixed pace, so a wider frame is a longer walk rather than a sprint. Transitions are crossfades, never cuts. Under reduce-motion (D-46) the mixer is advanced once and the canvas left on `demand`: a still pose, not a still T-pose. Mixamo clips are royalty-free but Adobe-account-gated rather than CC0, which is a new kind of source for D-47 and is recorded in `ATTRIBUTIONS.md`. |
| D-54 | **Motion is caused, and the vocabulary for it is `mood` plus `beat`.** The characters moved constantly and signified nothing, while the leaderboard changed meaning and did not move at all -- the product was loudest where it carried the least information. A `mood` is the pool a body idles from (`idle`, `calm` for a hero shot, `celebrate`, `empty`) and a `beat` is a one-shot a surface asks for because something happened; changing the beat is the entire trigger, so a surface bumps a prop rather than reaching into the body. Beats are named semantically (`greet`, `acknowledge`, `thumbsUp`, `point`, `disappointed`, `celebrate`, `talk`/`talkAgain`, `agree`, `glance`) and resolved to clips in one place, so a surface never names a file. Twelve of those clips are social and live in a second 617kB library a surface opts into, because only a few screens need a body to talk, point or nod. What this buys: an empty board gets a restless idle instead of a celebration, which is the difference between a product that knows its state and one that does not; the dashboard greets once per *browser session* rather than once per render; the lab nods when a character is saved and goes quiet so the next save is a second nod; and hovering the rival you are chasing makes the body point at them, which is the thesis in one interaction -- the card and the body sit in different columns of a server-rendered grid, so `HeroBeatScope` is the smallest thing that connects them. Groups hold a conversation rather than posing: a random pair every 5-13s, the listener answering 0.9s in, and a third body looking over only 40% of the time, because everybody reacting at once is as artificial as nobody reacting. De-syncing a group needs three independent perturbations, not one -- a random offset into the clip, a per-body speed, *and* a random first dwell; without the third they drift apart and then all change on the same beat. The podium's facing signs were backwards and nobody had noticed: a glTF body exported facing +Z turns towards +x on a positive yaw, so second place, laid out to the *left* of first, had been turning away from the winner. Angles are now derived from where a body actually stands. On the data side the motion provider loads `domMax`, because `layout` is inert under `domAnimation` and projection is the whole feature; a rank change moves its row and the digits roll to the new value, ten-digit columns offset in **em, not percent** -- a percentage there is a share of the whole column, so one digit travels ten lines. Everything degrades to plain text and a held pose under reduce-motion (D-46). Two things followed from measuring rather than looking: `/tv` said "Live" and polled nothing, so it now refreshes every 60s while the tab is visible -- `router.refresh()` keeps the tree mounted, which is what makes a rank change visible as movement rather than as a different page -- and it gained the leader's body in the roughly 300px of empty wall its left column was holding, since the most-watched screen in the product had no character on it. `heightFraction` is exposed on `Character` for that: a cheer puts the hands well above standing height, and the fit measures the bind pose. Finally, collapsing the near-whites (D-48's surface work) silently cost `/tv` and the LC hero their cards -- `bg-surface` became the same value as the wall -- so both are raised now. |
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

- **O-14** — closed by D-51. The character lab saves: `MemberAvatar` holds the
  chosen body and a colour per part, and `/me` and the dashboard hero both read
  it back.
- **O-15** — parked with D-52. Eye colour was the one part the classifier could
  not isolate; with recolouring itself parked, there is nothing to decide until
  it comes back.
- **O-13 — Whose typeface carries the brand.** D-48 settles the direction but
  not this: D-24 says "AIESEC brand typography", and Fredoka / Figtree / Baloo 2
  is not AIESEC's brand typeface. A display face distinct from EXPA is exactly
  what D-24 also asks for, so the two readings still pull in opposite
  directions. Someone with the current AIESEC brand book needs to say which face
  carries the brand and which carries the product; until then STUDIO's faces
  stand, and swapping them is one file. **Open.**
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

- **O-12** — closed by D-49. The CGTrader character models' licence is still
  unconfirmed, and that is accepted rather than resolved: the product is
  internal, behind the member wall, and is not distributed. The models ship. The
  unanswered question is recorded in `ATTRIBUTIONS.md` and has to be settled
  before any public or external release.
- **O-11** — closed by D-48. STUDIO is the direction; the three unchosen type
  systems are deleted rather than left switchable. The typeface question that
  sat underneath it is not settled and continues as O-13.
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
