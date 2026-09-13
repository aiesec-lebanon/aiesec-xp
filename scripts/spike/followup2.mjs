import { writeFileSync, mkdirSync } from "node:fs";
import { gis, redact, MC_OFFICE_ID } from "./gis-client.mjs";

// Resolves the two questions left open by the first follow-up: whether the EP
// directory is queryable, and how an email maps to a GIS person now that
// checkPersonPresent has been seen to fail on a known-good address.

const OUT_DIR = "scripts/spike/out";
const report = [];
const log = (text) => report.push(redact(String(text)));
const json = (label, value) =>
  report.push(`${label}:\n\n` + "```json\n" + redact(JSON.stringify(value, null, 2)) + "\n```\n");

mkdirSync(OUT_DIR, { recursive: true });
report.push(`# GIS spike follow-up 2 - office ${MC_OFFICE_ID}\n`);
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

// --- Take a real EP off a real application ---------------------------------

const SAMPLE = `query($filters: ApplicationFilter) {
  allOpportunityApplication(filters: $filters, page: 1, per_page: 5) {
    data { id person { id full_name email home_lc { id name } } }
  }
}`;

const sample = await run("sample applications", SAMPLE, {
  filters: {
    created_at: { from: "2024-01-01", to: "2026-12-31" },
    programmes: [7, 8, 9],
    person_home_mc: [MC_OFFICE_ID],
  },
});

const ep = sample?.allOpportunityApplication?.data?.find((r) => r.person?.email)?.person ?? null;
if (!ep) {
  log("No EP with an email in the sample; the rest of this probe cannot run.");
} else {
  log(`Using a real EP: person id ${ep.id}, home LC ${ep.home_lc?.name ?? "none"}.`);
}

// --- 1. checkPersonPresent, argument variations ----------------------------

report.push(`\n## 1. checkPersonPresent\n`);
const CHECK = `query($email: String!) { checkPersonPresent(email: $email) { id full_name } }`;

if (ep) {
  for (const [label, email] of Object.entries({
    "exact address": ep.email,
    lowercased: ep.email.toLowerCase(),
    trimmed: ep.email.trim(),
  })) {
    const data = await run(`checkPersonPresent, ${label}`, CHECK, { email });
    if (data) json(label, data);
  }
}

// --- 2. people directory, filters typed correctly --------------------------

report.push(`\n## 2. people directory\n`);
const PEOPLE = `query($filters: PeopleFilter, $perPage: Int!) {
  people(filters: $filters, page: 1, per_page: $perPage) {
    data { id full_name email home_lc { id name } }
    paging { total_items total_pages }
  }
}`;

const peopleFilters = {
  "home_committee [182]": { home_committee: [MC_OFFICE_ID] },
  "committee_scope [182]": { committee_scope: [MC_OFFICE_ID] },
  "home_committee + registered range": {
    home_committee: [MC_OFFICE_ID],
    registered: { from: "2020-01-01", to: "2026-12-31" },
  },
  "is_aiesecer false (EPs, not members)": { home_committee: [MC_OFFICE_ID], is_aiesecer: false },
  "has_opportunity_applications": { home_committee: [MC_OFFICE_ID], has_opportunity_applications: true },
};

for (const [label, filters] of Object.entries(peopleFilters)) {
  const data = await run(label, PEOPLE, { filters, perPage: 3 });
  if (data) json(label, { paging: data.people?.paging, firstRow: data.people?.data?.[0] ?? null });
}

// --- 3. Resolving one email to one person ----------------------------------

report.push(`\n## 3. Email to person resolution\n`);

if (ep) {
  const byQuery = await run("people(q: email)", PEOPLE, {
    filters: { q: ep.email },
    perPage: 5,
  });
  if (byQuery) json("people(q: email)", byQuery.people);

  const AUTOCOMPLETE = `query($q: String!) { peopleAutocomplete(filters: { q: $q }) { id full_name email } }`;
  const byAutocompleteEmail = await run("peopleAutocomplete(email)", AUTOCOMPLETE, { q: ep.email });
  if (byAutocompleteEmail) json("peopleAutocomplete(email)", byAutocompleteEmail);

  const byAutocompleteName = await run("peopleAutocomplete(full name)", AUTOCOMPLETE, { q: ep.full_name });
  if (byAutocompleteName) {
    const hits = byAutocompleteName.peopleAutocomplete ?? [];
    json("peopleAutocomplete(full name)", { matches: hits.length, sample: hits.slice(0, 3) });
  }
}

writeFileSync(`${OUT_DIR}/followup2.md`, redact(report.join("\n")));
console.log(`Follow-up 2 complete. Report: ${OUT_DIR}/followup2.md`);
