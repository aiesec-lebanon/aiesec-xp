import { writeFileSync, mkdirSync } from "node:fs";
import { gis, redact, MC_OFFICE_ID } from "./gis-client.mjs";

// The EP email turned out to be a per-person relay alias rather than a real
// address, which would remove the auto-match key the assignment design leans
// on. This measures how universal that is, and whether searching the EP
// directory by name can replace it.

const OUT_DIR = "scripts/spike/out";
const report = [];
const log = (text) => report.push(redact(String(text)));
const json = (label, value) =>
  report.push(`${label}:\n\n` + "```json\n" + redact(JSON.stringify(value, null, 2)) + "\n```\n");

mkdirSync(OUT_DIR, { recursive: true });
report.push(`# GIS spike follow-up 3 - office ${MC_OFFICE_ID}\n`);
report.push(`Run at ${new Date().toISOString()}\n`);

async function run(label, query, variables) {
  const result = await gis(query, variables);
  if (!result.ok) {
    log(`- ${label}: FAILED ${result.errors?.join("; ") ?? `HTTP ${result.status}`}`);
    return null;
  }
  log(`- ${label}: ok (${result.elapsedMs}ms)`);
  return result.data;
}

// --- 1. Are any EP addresses real? -----------------------------------------

report.push(`\n## 1. Email domain distribution across the EP directory\n`);

const PEOPLE = `query($filters: PeopleFilter, $page: Int!, $perPage: Int!) {
  people(filters: $filters, page: $page, per_page: $perPage) {
    data { id full_name email aiesec_email home_lc { id name } }
    paging { total_items total_pages }
  }
}`;

const domains = {};
const aiesecEmailDomains = {};
let scanned = 0;

for (const page of [1, 2, 3]) {
  const data = await run(`people page ${page}`, PEOPLE, {
    filters: { home_committee: [MC_OFFICE_ID], has_opportunity_applications: true },
    page,
    perPage: 200,
  });
  for (const person of data?.people?.data ?? []) {
    scanned += 1;
    const domain = (person.email ?? "(null)").split("@")[1] ?? "(malformed)";
    domains[domain] = (domains[domain] ?? 0) + 1;
    if (person.aiesec_email) {
      const d = person.aiesec_email.split("@")[1] ?? "(malformed)";
      aiesecEmailDomains[d] = (aiesecEmailDomains[d] ?? 0) + 1;
    }
  }
}

json(`email domains across ${scanned} EPs with applications`, domains);
json("aiesec_email domains among the same people", aiesecEmailDomains);

// --- 2. Can the directory be searched by name? -----------------------------

report.push(`\n## 2. Directory search, as the assignment picker would use it\n`);

const seed = await run("seed person", PEOPLE, {
  filters: { home_committee: [MC_OFFICE_ID], has_opportunity_applications: true },
  page: 1,
  perPage: 1,
});
const target = seed?.people?.data?.[0] ?? null;

if (target) {
  log(`Searching for a person known to exist: LC ${target.home_lc?.name ?? "none"}.`);
  const firstName = target.full_name.split(/\s+/)[0];

  for (const [label, filters] of Object.entries({
    "name: full name": { home_committee: [MC_OFFICE_ID], name: target.full_name },
    "name: first name only": { home_committee: [MC_OFFICE_ID], name: firstName },
    "q: full name": { home_committee: [MC_OFFICE_ID], q: target.full_name },
    "name within one LC": { home_committee: [Number(target.home_lc?.id ?? MC_OFFICE_ID)], name: target.full_name },
  })) {
    const data = await run(label, PEOPLE, { filters, page: 1, perPage: 5 });
    if (!data) continue;
    const hits = data.people?.data ?? [];
    json(label, {
      totalItems: data.people?.paging?.total_items ?? 0,
      exactNameMatches: hits.filter((p) => p.full_name === target.full_name).length,
      foundTarget: hits.some((p) => p.id === target.id),
    });
  }
}

// --- 3. Does an application carry the EP home LC for scoping? --------------

report.push(`\n## 3. Application person home LC coverage\n`);

const APPS = `query($filters: ApplicationFilter) {
  allOpportunityApplication(filters: $filters, page: 1, per_page: 200) {
    data { id person { id home_lc { id name } } }
  }
}`;

const apps = await run("applications", APPS, {
  filters: {
    created_at: { from: "2024-01-01", to: "2026-12-31" },
    programmes: [7, 8, 9],
    person_home_mc: [MC_OFFICE_ID],
  },
});

const lcCounts = {};
for (const row of apps?.allOpportunityApplication?.data ?? []) {
  const key = row.person?.home_lc ? `${row.person.home_lc.id} ${row.person.home_lc.name}` : "(no home LC)";
  lcCounts[key] = (lcCounts[key] ?? 0) + 1;
}
json("EP home LC distribution across sampled applications", lcCounts);

writeFileSync(`${OUT_DIR}/followup3.md`, redact(report.join("\n")));
console.log(`Follow-up 3 complete. Report: ${OUT_DIR}/followup3.md`);
