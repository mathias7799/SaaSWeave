import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { auth } from "@saasweave/auth/index";
import { freshAuthMiddleware } from "@saasweave/auth/react/tanstack-start/middleware";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

export const changePassword = createServerFn({ method: "POST" })
  .middleware([freshAuthMiddleware])
  .validator(changePasswordSchema)
  .handler(async ({ data }) => {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: true
      },
      headers: getRequest().headers,
      returnHeaders: true
    });

    const cookies = result.headers?.getSetCookie();
    if (cookies?.length) {
      setResponseHeader("Set-Cookie", cookies);
    }

    if (!result.response) {
      throw new Error("Could not change password.");
    }
    return { ok: true };
  });
