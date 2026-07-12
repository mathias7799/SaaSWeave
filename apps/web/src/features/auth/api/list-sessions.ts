import { createServerFn } from "@tanstack/react-start";

import { listActiveSessionsForUser } from "@saasweave/auth/list-sessions";
import { authMiddleware } from "@saasweave/auth/react/tanstack-start/middleware";

export const listSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listActiveSessionsForUser(context.user.id));
