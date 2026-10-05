import { handleCron } from "@/lib/sync/cron";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleCron(request, "roster", "SCHEDULE");
}
