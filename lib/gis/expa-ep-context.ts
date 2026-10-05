import "server-only";

import { displayStatus, isLiveApplication, isMemberNotEp, lastAction } from "@/lib/admin/ep-order";
import { parseGisDate } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { personName } from "@/lib/design/names";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import type { PeopleQuery } from "@/gis/generated";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

// Read at display time and never stored: EP names must not be persisted.

export type ExpaManager = { id: bigint; fullName: string };

export type ExpaEp = {
  fullName: string | null;
  status: string | null;
  signedUpAt: Date | null;
  lastActionAt: Date | null;
  isMemberNotEp: boolean;
  // null when EXPA did not say, which is not the same as nobody.
  managers: ExpaManager[] | null;
  activeProgrammeIds: number[];
};

export type ExpaEpDirectory = {
  byEp: Map<string, ExpaEp>;
  // False when a GIS read failed part way, so the page can say the list is partial.
  ok: boolean;
};

type Person = NonNullable<NonNullable<NonNullable<PeopleQuery["people"]>["data"]>[number]>;
type Application = { status: string | null; updatedAt: Date | null; programmeId: number | null };

const PAGE_SIZE = 200;
const MAX_PAGES = 20;

// Applications are scanned separately because an application moving does not
// bump its person's updated_at in GIS.
export async function expaEpDirectory({
  floor,
  alsoIds,
}: {
  floor: Date;
  alsoIds: readonly bigint[];
}): Promise<ExpaEpDirectory> {
  const byEp = new Map<string, ExpaEp>();
  const people = new Map<string, Person>();
  const applications = new Map<string, Application[]>();

  const [config, operating, term] = await Promise.all([
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    operatingOfficeIds(),
    termStart(),
  ]);
  if (!config) return { byEp, ok: false };

  const operatingSet = new Set(operating.map(String));
  const programmes = Object.keys(config.productWeights as Record<string, unknown>)
    .map(Number)
    .filter(Number.isInteger);
  const reversingStatuses = config.aplReversingStatuses as string[];
  const office = Number(mcOfficeId());

  let ok = true;

  const scanApplications = async () => {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await gis().ApplicationContext({
        filters: { programmes, person_home_mc: [office], sort: "updated_at", sort_direction: "desc" },
        pagination: { page, per_page: PAGE_SIZE },
      });
      const body = result.allOpportunityApplication;

      for (const row of body?.data ?? []) {
        const epId = row?.person?.id;
        if (!row || !epId) continue;
        const updatedAt = parseGisDate(row.updated_at);
        if (updatedAt && updatedAt < floor) return;
        const programmeId = Number(row.opportunity?.programme?.id);
        const bucket = applications.get(epId) ?? [];
        bucket.push({
          status: row.status ?? null,
          updatedAt,
          programmeId: Number.isInteger(programmeId) ? programmeId : null,
        });
        applications.set(epId, bucket);
      }

      if (page >= (body?.paging?.total_pages ?? 0)) return;
    }
  };

  const scanPeople = async () => {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await gis().People({
        filters: { home_committee: [office], sort: "updated_at", sort_direction: "desc" },
        pagination: { page, per_page: PAGE_SIZE },
      });

      for (const person of result.people?.data ?? []) {
        if (!person?.id) continue;
        const updatedAt = parseGisDate(person.updated_at);
        if (updatedAt && updatedAt < floor) return;
        people.set(person.id, person);
      }

      if (page >= (result.people?.paging?.total_pages ?? 0)) return;
    }
  };

  try {
    // allSettled, not all: a failure must not leave the other scan still writing into the maps.
    const scans = await Promise.allSettled([scanApplications(), scanPeople()]);
    const failed = scans.find((scan): scan is PromiseRejectedResult => scan.status === "rejected");
    if (failed) throw failed.reason;

    const unseen = [...new Set([...applications.keys(), ...alsoIds.map(String)])].filter(
      (id) => !people.has(id)
    );
    for (let index = 0; index < unseen.length; index += PAGE_SIZE) {
      const batch = unseen.slice(index, index + PAGE_SIZE);
      const result = await gis().People({
        filters: { ids: batch },
        pagination: { page: 1, per_page: batch.length },
      });
      for (const person of result.people?.data ?? []) {
        if (person?.id) people.set(person.id, person);
      }
    }
  } catch (error) {
    logger.warn("Could not read EP context from EXPA", { error });
    ok = false;
  }

  for (const [id, person] of people) {
    const own = applications.get(id) ?? [];
    const activeProgrammeIds = [
      ...new Set(
        own
          .filter((application) => isLiveApplication(application.status, reversingStatuses))
          .flatMap((application) => (application.programmeId === null ? [] : [application.programmeId]))
      ),
    ].sort((a, b) => a - b);

    byEp.set(id, {
      fullName: person.full_name ? personName(person.full_name) : null,
      status: displayStatus(person.status ?? null, own),
      signedUpAt: parseGisDate(person.created_at),
      lastActionAt: lastAction([parseGisDate(person.updated_at), ...own.map((application) => application.updatedAt)]),
      isMemberNotEp: isMemberNotEp(
        {
          hasApplications: person.has_opportunity_applications === true || own.length > 0,
          positions: (person.current_positions ?? []).flatMap((position) =>
            position.office?.id
              ? [
                  {
                    status: position.status,
                    officeId: BigInt(position.office.id),
                    endDate: parseGisDate(position.end_date),
                  },
                ]
              : []
          ),
        },
        operatingSet,
        term
      ),
      managers: person.managers
        ? person.managers.flatMap((manager) =>
            manager?.id ? [{ id: BigInt(manager.id), fullName: personName(manager.full_name ?? `Person ${manager.id}`) }] : []
          )
        : null,
      activeProgrammeIds,
    });
  }

  return { byEp, ok };
}
