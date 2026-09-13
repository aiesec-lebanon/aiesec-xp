import { writeFileSync, mkdirSync } from "node:fs";
import { gis, redact, MC_OFFICE_ID } from "./gis-client.mjs";

// Re-probes the three queries the first spike got wrong, and answers the
// question that run raised: whether an EP email is readable at all, since the
// whole auto-match path depends on it.

const OUT_DIR = "scripts/spike/out";
const report = [];
const log = (text) => report.push(redact(String(text)));
const json = (label, value) =>
  report.push(`${label}:\n\n` + "```json\n" + redact(JSON.stringify(value, null, 2)) + "\n```\n");

mkdirSync(OUT_DIR, { recursive: true });
report.push(`# GIS spike follow-up - office ${MC_OFFICE_ID}\n`);
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

// --- 1. Member positions, with the status value GIS actually uses -----------

report.push(`\n## 1. Member positions by status value\n`);

const SUBTREE = `query($id: Int!) {
  committees(filters: { parent: [$id] }, per_page: 100) {
    data { id name tag }
  }
}`;
const subtreeData = await run("committees(parent)", SUBTREE, { id: MC_OFFICE_ID });
const offices = [
  { id: String(MC_OFFICE_ID), name: "Lebanon (MC root)" },
  ...(subtreeData?.committees?.data ?? []),
];

const MEMBER_POSITIONS = `query($office: Int!, $status: [String], $perPage: Int!) {
  memberPositions(filters: { office_id: $office, status: $status }, page: 1, per_page: $perPage) {
    data { id title status role { id name } office { id name } person { id full_name } }
    paging { total_items total_pages }
  }
}`;

for (const status of [["active"], ["current"], null]) {
  const label = status ? `status ${JSON.stringify(status)}` : "no status filter";
  const data = await run(`${label} @ office ${MC_OFFICE_ID}`, MEMBER_POSITIONS, {
    office: MC_OFFICE_ID,
    status,
    perPage: 1,
  });
  log(`  total_items=${data?.memberPositions?.paging?.total_items ?? "n/a"}`);
}

const positionsByOffice = {};
const roleVocabulary = new Map();
const titleVocabulary = new Map();

for (const office of offices) {
  const data = await run(`positions @ ${office.name} (${office.id})`, MEMBER_POSITIONS, {
    office: Number(office.id),
    status: ["active"],
    perPage: 200,
  });
  const page = data?.memberPositions;
  if (!page) continue;

  positionsByOffice[`${office.id} ${office.name}`] = {
    activePositions: page.paging?.total_items ?? 0,
    pages: page.paging?.total_pages ?? 0,
  };
  for (const position of page.data ?? []) {
    const role = position.role?.name ?? "(no role)";
    const title = position.title ?? "(no title)";
    roleVocabulary.set(role, (roleVocabulary.get(role) ?? 0) + 1);
    titleVocabulary.set(`${role} | ${title}`, (titleVocabulary.get(`${role} | ${title}`) ?? 0) + 1);
  }
}

json("Active member positions per office", positionsByOffice);
json("role.name frequency", Object.fromEntries([...roleVocabulary].sort((a, b) => b[1] - a[1])));
json("role.name | title frequency", Object.fromEntries([...titleVocabulary].sort((a, b) => b[1] - a[1])));

// --- 2. Is an EP email readable at all? ------------------------------------

report.push(`\n## 2. EP email availability\n`);

const EMAIL_PROBE = `query($filters: ApplicationFilter, $perPage: Int!) {
  allOpportunityApplication(filters: $filters, page: 1, per_page: $perPage) {
    data {
      id
      person {
        id
        full_name
        email
        aiesec_email
        alternate_email
        contact_detail { email }
      }
    }
    paging { total_items }
  }
}`;

const emailData = await run("application person email fields", EMAIL_PROBE, {
  filters: { created_at: { from: "2024-01-01", to: "2026-12-31" }, programmes: [7, 8, 9], person_home_mc: [MC_OFFICE_ID] },
  perPage: 200,
});

const rows = emailData?.allOpportunityApplication?.data ?? [];
const coverage = { rows: rows.length, email: 0, aiesec_email: 0, alternate_email: 0, contact_detail_email: 0, any: 0 };
let sampleEmail = null;

for (const row of rows) {
  const person = row.person ?? {};
  if (person.email) coverage.email += 1;
  if (person.aiesec_email) coverage.aiesec_email += 1;
  if (person.alternate_email) coverage.alternate_email += 1;
  if (person.contact_detail?.email) coverage.contact_detail_email += 1;
  const any = person.email || person.contact_detail?.email || person.alternate_email;
  if (any) {
    coverage.any += 1;
    if (!sampleEmail) sampleEmail = any;
  }
}
json("How many of the sampled applications expose an EP email, by field", coverage);

// --- 3. checkPersonPresent against a real address --------------------------

report.push(`\n## 3. checkPersonPresent\n`);
const CHECK = `query($email: String!) { checkPersonPresent(email: $email) { id full_name } }`;

if (sampleEmail) {
  const data = await run("checkPersonPresent(real EP email)", CHECK, { email: sampleEmail });
  if (data) json("resolved", data);
} else {
  log("- No EP email was readable, so checkPersonPresent could not be exercised against a real address.");
}
await run("checkPersonPresent(absent address)", CHECK, { email: "no-such-person-spike@example.invalid" });

// --- 4. people directory, with registered typed correctly ------------------

report.push(`\n## 4. EP directory\n`);
const PEOPLE = `query($office: Int!, $filters: PeopleFilter, $perPage: Int!) {
  people(filters: $filters, page: 1, per_page: $perPage) {
    data { id full_name email home_lc { id name } }
    paging { total_items total_pages }
  }
}`;

for (const [label, filters] of Object.entries({
  "home_committee only": { home_committee: [MC_OFFICE_ID] },
  "home_committee + registered range": {
    home_committee: [MC_OFFICE_ID],
    registered: { from: "2024-01-01", to: "2026-12-31" },
  },
  "committee_scope": { committee_scope: [MC_OFFICE_ID] },
})) {
  const data = await run(label, PEOPLE, { office: MC_OFFICE_ID, filters, perPage: 3 });
  if (data) json(label, data.people?.paging ?? {});
}

writeFileSync(`${OUT_DIR}/followup.md`, redact(report.join("\n")));
console.log(`Follow-up complete. Report: ${OUT_DIR}/followup.md`);
