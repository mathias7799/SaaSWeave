import { ORPCError } from "@orpc/server";

import { ENV_SERVER } from "@saasweave/env/server/env";

import { protectedProcedure } from "#@/lib/procedures/factory";

export const privateRouter = {
  data: protectedProcedure
    .route({
      description: "Internal diagnostics (disabled in production)",
      method: "GET"
    })
    .handler(() => {
      if (ENV_SERVER.NODE_ENV === "production") {
        throw new ORPCError("NOT_FOUND");
      }
      throw new ORPCError("NOT_IMPLEMENTED", {
        message: "Private API surface is reserved for future internal integrations."
      });
    })
};
