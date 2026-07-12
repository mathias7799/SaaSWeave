import type * as EvlogModule from "evlog";
import type * as EvlogHttpModule from "evlog/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const initEvlogLogger = vi.hoisted(() => vi.fn());
const createHttpLogDrain = vi.hoisted(() => vi.fn(() => vi.fn()));
const infoLogMethod = vi.hoisted(() => vi.fn());
const warnLogMethod = vi.hoisted(() => vi.fn());
const debugLogMethod = vi.hoisted(() => vi.fn());
const errorLogMethod = vi.hoisted(() => vi.fn());

vi.mock("evlog", async (importOriginal) => {
  const actual = await importOriginal<typeof EvlogModule>();
  return {
    ...actual,
    initLogger: initEvlogLogger,
    log: {
      ...actual.log,
      debug: debugLogMethod,
      error: errorLogMethod,
      info: infoLogMethod,
      warn: warnLogMethod
    }
  };
});

vi.mock("evlog/http", async (importOriginal) => {
  const actual = await importOriginal<typeof EvlogHttpModule>();
  return {
    ...actual,
    createHttpLogDrain
  };
});

describe("@saasweave/logger/client", () => {
  beforeEach(() => {
    vi.resetModules();
    initEvlogLogger.mockReset();
    createHttpLogDrain.mockReset();
    infoLogMethod.mockReset();
    warnLogMethod.mockReset();
    debugLogMethod.mockReset();
    errorLogMethod.mockReset();
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initLog", () => {
    it("initializes evlog in the browser with default service and optional HTTP drain", async () => {
      const { initLog, LOG_SERVICES } = await import("#@/client/index");

      initLog({
        batchedTransport: {
          drain: {
            credentials: "include",
            endpoint: "https://example.com/_logs/ingest"
          }
        },
        console: false,
        enabled: true,
        minLevel: "warn",
        pretty: true,
        service: LOG_SERVICES.WEB_CLIENT
      });
      initLog({ service: "ignored" });

      expect(initEvlogLogger).toHaveBeenCalledTimes(1);
      expect(createHttpLogDrain).toHaveBeenCalledWith({
        drain: {
          credentials: "include",
          endpoint: "https://example.com/_logs/ingest"
        }
      });
      expect(initEvlogLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          drain: expect.any(Function),
          enabled: true,
          env: { service: LOG_SERVICES.WEB_CLIENT },
          minLevel: "warn",
          pretty: true,
          silent: true
        })
      );
    });

    it("no-ops outside browser runtimes", async () => {
      vi.unstubAllGlobals();

      const { initLog } = await import("#@/client/index");
      initLog();

      expect(initEvlogLogger).not.toHaveBeenCalled();
    });
  });

  describe("log with identity context", () => {
    it("merges identity into object payloads and supports tag/message overloads", async () => {
      const { clearIdentity, log, setIdentity } = await import("#@/client/index");

      setIdentity({ user: { id: "user-1" } });
      log.info({ event: "page_view", path: "/dashboard" });
      log.warn("checkout", "Payment retry scheduled");

      expect(infoLogMethod).toHaveBeenCalledWith({
        user: { id: "user-1" },
        event: "page_view",
        path: "/dashboard"
      });
      expect(warnLogMethod).toHaveBeenCalledWith("checkout", "Payment retry scheduled");

      clearIdentity();
      log.info({ event: "signed_out" });

      expect(infoLogMethod).toHaveBeenLastCalledWith({ event: "signed_out" });
    });

    it("ignores identity helpers and log calls outside browser runtimes", async () => {
      vi.unstubAllGlobals();

      const { clearIdentity, log, setIdentity } = await import("#@/client/index");

      setIdentity({ user: { id: "user-1" } });
      log.info({ event: "ignored" });
      clearIdentity();

      expect(infoLogMethod).not.toHaveBeenCalled();
    });
  });

  describe("LOG_SERVICES re-export", () => {
    it("re-exports stable service constants from the client facade", async () => {
      const client = await import("#@/client/index");
      const constants = await import("#@/constants/services");

      expect(client.LOG_SERVICES).toBe(constants.LOG_SERVICES);
    });
  });
});
