import { writeFileSync, mkdirSync } from "node:fs";
import { gis, callStats, redact, MC_OFFICE_ID } from "./gis-client.mjs";
import { loadSchema, describeRootField, describeInput, describeObject, enumValues } from "./schema.mjs";

const OUT_DIR = "scripts/spike/out";
const report = [];
const findings = {};

function section(title) {
  report.push(`\n## ${title}\n`);
}

function line(text) {
  report.push(redact(String(text)));
}

function json(label, value) {
  const body = redact(JSON.stringify(value, null, 2));
  report.push(`${label}:\n\n` + "```json\n" + body + "\n```\n");
}

async function probe(name, fn) {
  try {
    return await fn();
  } catch (error) {
    line(`**${name} threw:** ${redact(error?.message ?? String(error))}`);
    return null;
  }
}

function reportResult(label, result) {
  if (!result) return null;
  if (!result.ok) {
    line(`- ${label}: FAILED (HTTP ${result.status}) ${result.errors?.join("; ") ?? ""}`);
    return null;
  }
  line(`- ${label}: ok (${result.elapsedMs}ms)`);
  return result.data;
}

// --- 1. Schema discovery ----------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
report.push(`# GIS spike - office ${MC_OFFICE_ID}\n`);
report.push(`Run at ${new Date().toISOString()}\n`);

section("1. Schema discovery");
const schema = await probe("introspection", () => loadSchema(OUT_DIR));

if (!schema?.ok) {
  line(`Introspection failed: ${JSON.stringify(schema?.errors ?? "unknown")}`);
} else {
  line(`Introspection saved to ${OUT_DIR}/introspection.json (${schema.types.size} types).`);
  const roots = [
    "currentPerson",
    "allOpportunityApplication",
    "people",
    "peopleAutocomplete",
    "checkPersonPresent",
    "committees",
    "office",
    "memberPositions",
  ];
  json("Root field signatures", Object.fromEntries(roots.map((r) => [r, describeRootField(schema, r)])));
  json("DateInput", describeInput(schema, "DateInput"));
  json(
    "ApplicationFilter date and scope fields",
    describeInput(schema, "ApplicationFilter", [
      "created_at",
      "date_approved",
      "date_realized",
      "date_remote_realized",
      "date_approval_broken",
      "date_realisation_broke",
      "programmes",
      "status",
      "statuses",
      "person_home_lc",
      "person_home_mc",
      "opportunity_home_lc",
      "opportunity_home_mc",
      "person_committee",
      "opportunity_committee",
      "sort",
      "sort_direction",
    ])
  );
  json("PeopleFilter", describeInput(schema, "PeopleFilter"));
  json("MemberPositionFilter", describeInput(schema, "MemberPositionFilter"));
  json("OfficeFilter", describeInput(schema, "OfficeFilter"));
  json(
    "Office fields",
    describeObject(schema, "Office", ["id", "name", "tag", "parent", "suboffices", "children", "full_name"])
  );
  json(
    "ApplicationMetaType break and status dates",
    describeObject(schema, "ApplicationMetaType", [
      "date_approved",
      "date_approval_broken",
      "date_realized",
      "date_realisation_broke",
      "date_remote_realization_broken_at",
      "remote_realized_at",
      "date_rejected",
      "date_withdrawn",
      "ep_approved_by",
      "approved_by",
    ])
  );
  for (const name of ["ApplicationStatus", "ApplicationSortOption", "MemberPositionStatus"]) {
    const values = enumValues(schema, name);
    if (values) json(`enum ${name}`, values);
  }
}

// --- 2. currentPerson on the service token ----------------------------------

section("2. currentPerson (service token identity)");
const CURRENT_PERSON = `{
  currentPerson {
    id
    full_name
    current_office { id name }
    current_positions { id title status office { id name tag } role { id name } }
  }
}`;
const currentPerson = reportResult(
  "currentPerson",
  await probe("currentPerson", () => gis(CURRENT_PERSON))
);
if (currentPerson) json("currentPerson", currentPerson);

// --- 3. Office subtree under the MC ----------------------------------------

section("3. Office subtree");
const subtreeShapes = {
  "office.suboffices": `query($id: ID!) { office(id: $id) { id name tag suboffices { id name tag } } }`,
  "office.children": `query($id: ID!) { office(id: $id) { id name tag children { id name tag } } }`,
  "committees(parent)": `query($id: Int!) { committees(filters: { parent: [$id] }) { data { id name tag parent { id } } paging { total_items total_pages } } }`,
};

let subtree = null;
for (const [label, query] of Object.entries(subtreeShapes)) {
  const variables = label === "committees(parent)" ? { id: MC_OFFICE_ID } : { id: String(MC_OFFICE_ID) };
  const data = reportResult(label, await probe(label, () => gis(query, variables)));
  if (data) {
    json(label, data);
    const offices = data.office?.suboffices ?? data.office?.children ?? data.committees?.data ?? null;
    if (offices && !subtree) subtree = { label, offices };
  }
}
findings.subtree = subtree;

// --- 4. Member positions: role strings (O-03) and coverage ------------------

section("4. Member positions under the subtree");
const officeIds = [MC_OFFICE_ID, ...(subtree?.offices ?? []).map((o) => Number(o.id))];
line(`Offices probed: ${officeIds.join(", ")}`);

const MEMBER_POSITIONS = `query($office: Int!, $page: Int!, $perPage: Int!) {
  memberPositions(filters: { office_id: $office, status: "current" }, page: $page, per_page: $perPage) {
    data { id title status role { id name } office { id name } person { id full_name } }
    paging { total_items total_pages current_page }
  }
}`;

const positionsByOffice = {};
const roleVocabulary = new Map();

for (const officeId of officeIds) {
  const data = reportResult(
    `memberPositions office ${officeId}`,
    await probe("memberPositions", () => gis(MEMBER_POSITIONS, { office: officeId, page: 1, perPage: 100 }))
  );
  if (!data?.memberPositions) continue;

  const page = data.memberPositions;
  positionsByOffice[officeId] = {
    officeName: page.data?.[0]?.office?.name ?? null,
    totalItems: page.paging?.total_items ?? null,
    totalPages: page.paging?.total_pages ?? null,
    sampled: page.data?.length ?? 0,
  };
  for (const position of page.data ?? []) {
    const key = `${position.role?.name ?? "(no role)"} | ${position.title ?? "(no title)"}`;
    roleVocabulary.set(key, (roleVocabulary.get(key) ?? 0) + 1);
  }
}

json("Active positions per office", positionsByOffice);
json(
  "role.name | title vocabulary (first page of each office)",
  Object.fromEntries([...roleVocabulary.entries()].sort((a, b) => b[1] - a[1]))
);
findings.positionsByOffice = positionsByOffice;
findings.roleVocabulary = Object.fromEntries(roleVocabulary);

// --- 5. Application date filters -------------------------------------------

section("5. allOpportunityApplication date filters");
const WINDOW = { from: "2024-01-01", to: new Date().toISOString().slice(0, 10) };
const dateFilters = [
  "created_at",
  "date_approved",
  "date_realized",
  "date_remote_realized",
  "date_approval_broken",
  "date_realisation_broke",
];

const APPLICATION_QUERY = `query($filters: ApplicationFilter, $page: Int!, $perPage: Int!) {
  allOpportunityApplication(filters: $filters, page: $page, per_page: $perPage) {
    data {
      id
      status
      created_at
      person { id full_name contact_detail { email } home_lc { id name } }
      opportunity { id title programme { id short_name } home_lc { id name } home_mc { id name } }
      meta {
        date_approved
        date_approval_broken
        date_realized
        date_realisation_broke
        remote_realized_at
        date_rejected
        date_withdrawn
      }
    }
    paging { total_items total_pages current_page }
  }
}`;

const filterCounts = {};
for (const field of dateFilters) {
  const filters = { [field]: WINDOW, programmes: [7, 8, 9], person_home_mc: [MC_OFFICE_ID] };
  const data = reportResult(
    `${field} (person_home_mc ${MC_OFFICE_ID})`,
    await probe(field, () => gis(APPLICATION_QUERY, { filters, page: 1, perPage: 5 }))
  );
  if (!data?.allOpportunityApplication) continue;
  const page = data.allOpportunityApplication;
  filterCounts[field] = page.paging?.total_items ?? null;
  if ((page.data ?? []).length > 0) {
    json(`${field} - first row`, page.data[0]);
  }
}
json(`Total items per date filter, ${WINDOW.from}..${WINDOW.to}, programmes [7,8,9]`, filterCounts);
findings.filterCounts = filterCounts;

// --- 6. programmes filter actually filters ---------------------------------

section("6. programmes filter");
const programmeCounts = {};
for (const programmes of [[7], [8], [9], [7, 8, 9], null]) {
  const label = programmes ? `programmes ${JSON.stringify(programmes)}` : "no programme filter";
  const filters = { created_at: WINDOW, person_home_mc: [MC_OFFICE_ID] };
  if (programmes) filters.programmes = programmes;
  const data = reportResult(label, await probe(label, () => gis(APPLICATION_QUERY, { filters, page: 1, perPage: 1 })));
  programmeCounts[label] = data?.allOpportunityApplication?.paging?.total_items ?? null;
}
json("created_at totals by programme filter", programmeCounts);
findings.programmeCounts = programmeCounts;

// --- 7. Outgoing vs incoming scope -----------------------------------------

section("7. Scope: person side vs opportunity side");
const scopeCounts = {};
const scopes = {
  person_home_mc: { person_home_mc: [MC_OFFICE_ID] },
  opportunity_home_mc: { opportunity_home_mc: [MC_OFFICE_ID] },
};
for (const [label, scope] of Object.entries(scopes)) {
  const filters = { created_at: WINDOW, programmes: [7, 8, 9], ...scope };
  const data = reportResult(label, await probe(label, () => gis(APPLICATION_QUERY, { filters, page: 1, perPage: 1 })));
  scopeCounts[label] = data?.allOpportunityApplication?.paging?.total_items ?? null;
}
json("created_at totals by scope side", scopeCounts);
findings.scopeCounts = scopeCounts;

// --- 8. APL break statuses (rejected / withdrawn) --------------------------

section("8. Application statuses, for APL reversal");
const statusCounts = {};
const statusData = reportResult(
  "status distribution sample",
  await probe("statuses", () =>
    gis(APPLICATION_QUERY, {
      filters: { created_at: WINDOW, programmes: [7, 8, 9], person_home_mc: [MC_OFFICE_ID] },
      page: 1,
      perPage: 100,
    })
  )
);
for (const row of statusData?.allOpportunityApplication?.data ?? []) {
  const key = row.status ?? "(null)";
  statusCounts[key] = (statusCounts[key] ?? 0) + 1;
}
json("status values seen in a 100-row sample", statusCounts);

for (const status of Object.keys(statusCounts)) {
  const data = reportResult(
    `statuses filter [${status}]`,
    await probe("statusFilter", () =>
      gis(APPLICATION_QUERY, {
        filters: {
          created_at: WINDOW,
          programmes: [7, 8, 9],
          person_home_mc: [MC_OFFICE_ID],
          statuses: [status],
        },
        page: 1,
        perPage: 1,
      })
    )
  );
  if (data) {
    const row = data.allOpportunityApplication?.data?.[0];
    const total = data.allOpportunityApplication?.paging?.total_items;
    line(`  total_items=${total}, sample meta=${redact(JSON.stringify(row?.meta ?? null))}`);
  }
}
findings.statusCounts = statusCounts;

// --- 9. EP directory and identity resolution -------------------------------

section("9. EP directory and checkPersonPresent");
const PEOPLE_QUERY = `query($office: Int!, $page: Int!, $perPage: Int!) {
  people(filters: { home_committee: [$office], registered: true }, page: $page, per_page: $perPage) {
    data { id full_name contact_detail { email } home_lc { id name } }
    paging { total_items total_pages }
  }
}`;
const peopleData = reportResult(
  "people(home_committee, registered)",
  await probe("people", () => gis(PEOPLE_QUERY, { office: MC_OFFICE_ID, page: 1, perPage: 5 }))
);
if (peopleData) json("people page 1", peopleData);

const CHECK_PERSON = `query($email: String!) { checkPersonPresent(email: $email) { id full_name } }`;
const knownEmail =
  statusData?.allOpportunityApplication?.data?.find((r) => r.person?.contact_detail?.email)?.person?.contact_detail
    ?.email ?? null;

if (knownEmail) {
  line("Resolving a known EP email taken from an application row.");
  const presentData = reportResult(
    "checkPersonPresent(known email)",
    await probe("checkPersonPresent", () => gis(CHECK_PERSON, { email: knownEmail }))
  );
  if (presentData) json("checkPersonPresent", presentData);
} else {
  line("No EP email available from the sample, so checkPersonPresent was not exercised.");
}

const absentData = reportResult(
  "checkPersonPresent(absent email)",
  await probe("checkPersonPresentAbsent", () =>
    gis(CHECK_PERSON, { email: "no-such-person-spike-probe@example.invalid" })
  )
);
if (absentData) json("checkPersonPresent, absent", absentData);

// --- 10. Page size ceiling --------------------------------------------------

section("10. Maximum page size");
const PAGE_SIZE_QUERY = `query($filters: ApplicationFilter, $perPage: Int!) {
  allOpportunityApplication(filters: $filters, page: 1, per_page: $perPage) {
    data { id }
    paging { total_items total_pages current_page }
  }
}`;
const pageSizes = {};
for (const perPage of [100, 250, 500, 1000]) {
  const data = reportResult(
    `per_page ${perPage}`,
    await probe("pageSize", () =>
      gis(PAGE_SIZE_QUERY, {
        filters: { created_at: WINDOW, programmes: [7, 8, 9], person_home_mc: [MC_OFFICE_ID] },
        perPage,
      })
    )
  );
  pageSizes[perPage] = {
    rowsReturned: data?.allOpportunityApplication?.data?.length ?? null,
    totalPages: data?.allOpportunityApplication?.paging?.total_pages ?? null,
  };
}
json("rows actually returned per requested per_page", pageSizes);
findings.pageSizes = pageSizes;

// --- 11. Rate limiting ------------------------------------------------------

section("11. Rate limits");
const burst = await Promise.all(
  Array.from({ length: 10 }, () => probe("burst", () => gis(`{ currentPerson { id } }`)))
);
const burstSummary = burst.map((r) => ({
  status: r?.status ?? null,
  ms: r?.elapsedMs ?? null,
  headers: r?.rateLimitHeaders ?? {},
  errors: r?.errors ?? null,
}));
json("10 concurrent requests", burstSummary);
json("call timings across the whole spike", callStats());
findings.burst = burstSummary;
findings.callStats = callStats();

// --- Write report -----------------------------------------------------------

writeFileSync(`${OUT_DIR}/report.md`, redact(report.join("\n")));
writeFileSync(`${OUT_DIR}/findings.json`, redact(JSON.stringify(findings, null, 2)));
console.log(`Spike complete. Report: ${OUT_DIR}/report.md`);
