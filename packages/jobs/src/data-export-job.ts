import { processDataExportRequest } from "@saasweave/app/data-export/process";

import { dispatchNotification } from "#@/dispatch";

export async function runDataExportJob(requestId: string): Promise<void> {
  const result = await processDataExportRequest(requestId);
  if (result.status !== "ready") return;

  void dispatchNotification({
    actionUrl: "/app/settings",
    audience: { kind: "user", userId: result.notify.requestedByUserId },
    body: "Your workspace data export is ready to download.",
    organizationId: result.notify.organizationId,
    title: "Data export ready",
    type: "data_export.ready"
  });
}
