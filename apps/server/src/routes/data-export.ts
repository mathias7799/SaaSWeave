import { Hono } from "hono";

import { handleSessionDataExportDownload } from "@saasweave/api/lib/data-export/download";
import { auth } from "@saasweave/auth/index";

export const dataExportRoutes = new Hono();

dataExportRoutes.get("/:exportId/download", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "unauthorized" }, 401);
  }

  return handleSessionDataExportDownload({
    exportId: c.req.param("exportId"),
    session
  });
});
