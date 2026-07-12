import { registerRepeatableSchedules } from "@saasweave/jobs/schedules";
import { createLogger } from "@saasweave/logger/server";

const log = createLogger({ operation: "server__worker_schedules" });

export async function registerSchedules(): Promise<string[]> {
  const jobs = await registerRepeatableSchedules();
  if (jobs.length === 0) {
    log.info("No repeatable schedules registered", { event: "schedules_empty" });
  }
  return jobs;
}
