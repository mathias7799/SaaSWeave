/**
 * Stable service names used in evlog events.
 *
 * Naming convention:
 * - `web__server`: TanStack Start / web SSR logs
 * - `web__client`: browser logs sent through the Hono ingest endpoint
 * - `server`: standalone Hono server logs
 * - `worker`: background worker process logs
 * - `default`: fallback when a service is not explicitly selected
 *
 * Future feature-specific services should append segments, for example
 * `web__server__todo`.
 *
 * Import these from the relevant logger facade:
 * `@saasweave/logger/client` or `@saasweave/logger/server`.
 */
export const LOG_SERVICES = Object.freeze({
  DEFAULT: "default",
  SERVER: "server",
  WORKER: "worker",
  WEB_CLIENT: "web__client",
  WEB_SERVER: "web__server"
});

export type LogService = (typeof LOG_SERVICES)[keyof typeof LOG_SERVICES];
