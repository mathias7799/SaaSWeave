import { isRedisEnabled } from "@saasweave/cache";
import { createNotifications, type NotificationInput } from "@saasweave/db";
import { createLogger } from "@saasweave/logger/server";

import {
  enqueueNotification,
  enqueueTemplateEmail,
  type SendTemplateEmailJobData
} from "#@/queues";
import { runTemplateEmail } from "#@/template-email";

const log = createLogger({ operation: "server__jobs_dispatch" });

/**
 * Enqueue or run inline a template email. With Redis configured the job is
 * processed by apps/worker; otherwise it runs in the current process so the
 * app works with zero queue infrastructure. Never throws into the caller.
 */
export async function dispatchTemplateEmail(data: SendTemplateEmailJobData): Promise<void> {
  try {
    if (isRedisEnabled()) {
      await enqueueTemplateEmail(data);
      return;
    }
    await runTemplateEmail(data.key, data.to, data.values ?? {}, data.meta ?? {});
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "job_dispatch_failed",
      job: "email.send-template",
      mode: isRedisEnabled() ? "queue" : "inline"
    });
  }
}

/**
 * Enqueue or run inline a notification fan-out. With Redis configured the job
 * is processed by apps/worker; otherwise it runs in the current process.
 * Never throws into the caller.
 */
export async function dispatchNotification(data: NotificationInput): Promise<void> {
  try {
    if (isRedisEnabled()) {
      await enqueueNotification(data);
      return;
    }
    await createNotifications(data);
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "job_dispatch_failed",
      job: "notification.create",
      mode: isRedisEnabled() ? "queue" : "inline"
    });
  }
}
