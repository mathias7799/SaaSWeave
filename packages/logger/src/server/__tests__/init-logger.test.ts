import type * as EvlogModule from "evlog";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const initEvlogLogger = vi.hoisted(() => vi.fn());

vi.mock("evlog", async (importOriginal) => {
  const actual = await importOriginal<typeof EvlogModule>();
  return {
    ...actual,
    initLogger: initEvlogLogger
  };
});

describe("initLogger", () => {
  beforeEach(() => {
    vi.resetModules();
    initEvlogLogger.mockReset();
  });

  it("merges package defaults and initializes evlog only once", async () => {
    const { initLogger, LOG_SERVICES } = await import("#@/server/index");

    initLogger({ env: { environment: "test", service: LOG_SERVICES.WEB_SERVER } });
    initLogger({ env: { environment: "ignored" } });

    expect(initEvlogLogger).toHaveBeenCalledTimes(1);
    expect(initEvlogLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          environment: "test",
          service: LOG_SERVICES.WEB_SERVER
        }),
        redact: {
          paths: expect.arrayContaining([
            "password",
            "token",
            "authorization",
            "apiKey",
            "refreshToken"
          ])
        }
      })
    );
  });

  it("uses LOG_SERVICES.DEFAULT when service is omitted", async () => {
    const { initLogger, LOG_SERVICES } = await import("#@/server/index");
    initLogger();

    expect(initEvlogLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          service: LOG_SERVICES.DEFAULT
        })
      })
    );
  });
});
