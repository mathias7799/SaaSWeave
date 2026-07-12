import { createEnv } from "@t3-oss/env-core";
import { isProduction } from "std-env";
import { z } from "zod";

export const ENV_WEB_ISOMORPHIC = createEnv({
  client: {
    VITE_IMGPROXY_SIGNATURE: z.string().default("_"),
    VITE_IMGPROXY_URL: z.url().optional(),
    // Origin imgproxy fetches from. Defaults to VITE_WEB_URL; in Docker set to the internal
    // web service URL (e.g. http://web:3000) so imgproxy can reach static assets.
    VITE_IMGPROXY_SOURCE_WEB_URL: z.url().optional(),
    VITE_SERVER_URL: isProduction ? z.url() : z.url().default("http://localhost:5000/server"),
    VITE_WEB_URL: isProduction ? z.url() : z.url().default("http://localhost:3000")
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: import.meta.env ?? process.env
});
