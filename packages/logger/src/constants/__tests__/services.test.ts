import { describe, expect, it } from "vite-plus/test";

import { LOG_SERVICES, type LogService } from "#@/constants/services";

describe("LOG_SERVICES", () => {
  it("exposes stable, frozen service identifiers", () => {
    expect(Object.isFrozen(LOG_SERVICES)).toBe(true);
    expect(LOG_SERVICES).toEqual({
      DEFAULT: "default",
      SERVER: "server",
      WORKER: "worker",
      WEB_CLIENT: "web__client",
      WEB_SERVER: "web__server"
    });
  });

  it("types service values as LogService union members", () => {
    const services: LogService[] = [
      LOG_SERVICES.DEFAULT,
      LOG_SERVICES.SERVER,
      LOG_SERVICES.WORKER,
      LOG_SERVICES.WEB_CLIENT,
      LOG_SERVICES.WEB_SERVER
    ];

    expect(services).toHaveLength(5);
    expect(new Set(services).size).toBe(5);
  });
});
