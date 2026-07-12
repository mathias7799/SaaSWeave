import { beforeEach, describe, expect, it } from "vite-plus/test";

import { flushMemoryLogs, setupMemoryLogger } from "#@/server/__tests__/helpers";

describe("@saasweave/logger/server", () => {
  describe("wide-event and error helpers", () => {
    beforeEach(() => {
      setupMemoryLogger("server-index");
    });

    it("createLogger supports set/emit lifecycle for standalone work", async () => {
      const { createLogger } = await import("#@/server/index");

      const logger = createLogger({ operation: "sync_users" });
      logger.set({ users: { processed: 42 } });
      const event = logger.emit();

      expect(event).toEqual(
        expect.objectContaining({
          operation: "sync_users",
          users: { processed: 42 },
          level: "info"
        })
      );

      const events = await flushMemoryLogs("server-index");
      expect(events.at(-1)).toEqual(expect.objectContaining({ operation: "sync_users" }));
    });

    it("createRequestLogger emits request-scoped wide events", async () => {
      const { createRequestLogger } = await import("#@/server/index");

      const logger = createRequestLogger({
        method: "GET",
        path: "/health",
        requestId: "req-health"
      });
      logger.set({ health: { live: true } });
      const event = logger.emit({ status: 200 });

      expect(event).toEqual(
        expect.objectContaining({
          method: "GET",
          path: "/health",
          requestId: "req-health",
          health: { live: true },
          status: 200
        })
      );
    });

    it("log writes one-off structured events", async () => {
      const { log } = await import("#@/server/index");

      log.info({ event: "server_started", port: 5000 });

      const events = await flushMemoryLogs("server-index");
      expect(events.at(-1)).toEqual(
        expect.objectContaining({
          event: "server_started",
          port: 5000,
          level: "info"
        })
      );
    });

    it("createError and parseError expose structured error contracts", async () => {
      const { createError, parseError } = await import("#@/server/index");

      const structured = createError({
        message: "Checkout failed",
        status: 402,
        why: "Card declined by issuer",
        fix: "Try a different payment method"
      });

      const parsed = parseError(structured);

      expect(parsed).toEqual(
        expect.objectContaining({
          message: "Checkout failed",
          status: 402,
          why: "Card declined by issuer",
          fix: "Try a different payment method",
          raw: structured
        })
      );
    });

    it("parseError normalizes unknown thrown values", async () => {
      const { parseError } = await import("#@/server/index");

      expect(parseError(new Error("boom"))).toEqual(
        expect.objectContaining({
          message: "boom",
          status: 500,
          raw: expect.any(Error)
        })
      );

      expect(parseError("plain failure")).toEqual(
        expect.objectContaining({
          message: "plain failure",
          status: 500,
          raw: "plain failure"
        })
      );
    });
  });

  describe("LOG_SERVICES re-export", () => {
    it("re-exports stable service constants from the server facade", async () => {
      const server = await import("#@/server/index");
      const constants = await import("#@/constants/services");

      expect(server.LOG_SERVICES).toBe(constants.LOG_SERVICES);
    });
  });
});
