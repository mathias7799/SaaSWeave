import { ENV_SERVER } from "@saasweave/env/server/env";

/** Prefer live process env so Vitest and CI can isolate BullMQ namespaces per run. */
export function resolveQueuePrefix(): string {
  const runtimePrefix = process.env.QUEUE_PREFIX?.trim();
  if (runtimePrefix) return runtimePrefix;
  return ENV_SERVER.QUEUE_PREFIX;
}
