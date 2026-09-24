import { handleCron } from "@/lib/sync/cron";

export const maxDuration = 300;

/** The office tree and roster, called monthly by .github/workflows/sync-members.yml (D-66). */
export async function POST(request: Request) {
  return handleCron(request, "roster", "SCHEDULE");
}
