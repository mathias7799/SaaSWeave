import { type AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const evaluateWorkerReadiness = vi.fn();
const metricsHandler = vi.fn();
const startEventLoopLagMonitor = vi.fn();
const logger = { info: vi.fn() };

vi.mock("@saasweave/env/server/env", () => {
  return { ENV_SERVER: { METRICS_ENABLED: true, WORKER_HEALTH_PORT: 9100 } };
});
vi.mock("@saasweave/jobs/worker-readiness", () => {
  return { evaluateWorkerReadiness: (...args: unknown[]) => evaluateWorkerReadiness(...args) };
});
vi.mock("@saasweave/logger/server", () => {
  return { createLogger: () => logger };
});
vi.mock("@saasweave/observability", () => {
  return {
    metricsHandler: (...args: unknown[]) => metricsHandler(...args),
    startEventLoopLagMonitor: (...args: unknown[]) => startEventLoopLagMonitor(...args)
  };
});

const { closeWorkerHealthServer, createWorkerHealthServer } = await import("#@/health-server");

const servers: ReturnType<typeof createWorkerHealthServer>[] = [];

async function startServer() {
  const server = createWorkerHealthServer({
    getReadinessInput: () => {
      return {
        acceptingTraffic: true,
        heartbeatAt: Date.now(),
        registeredSchedules: [],
        workers: []
      };
    },
    port: 0
  });
  servers.push(server);
  if (!server.listening) {
    await new Promise<void>((resolve) => server.once("listening", resolve));
  }
  const port = (server.address() as AddressInfo).port;
  return { baseUrl: `http://127.0.0.1:${port}`, server };
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server?.listening) await closeWorkerHealthServer(server);
  }
});

describe("worker health server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateWorkerReadiness.mockResolvedValue({ checks: {}, status: "healthy" });
    metricsHandler.mockResolvedValue(
      new Response("metric 1\n", { headers: { "Content-Type": "text/plain" } })
    );
  });

  it("serves liveness, readiness, metrics, and not-found responses", async () => {
    const { baseUrl, server } = await startServer();

    const live = await fetch(`${baseUrl}/health/live`);
    expect(live.status).toBe(200);
    await expect(live.json()).resolves.toEqual(expect.objectContaining({ status: "healthy" }));

    const ready = await fetch(`${baseUrl}/health/ready`);
    expect(ready.status).toBe(200);
    expect(evaluateWorkerReadiness).toHaveBeenCalledOnce();

    const metrics = await fetch(`${baseUrl}/metrics`);
    expect(metrics.status).toBe(200);
    await expect(metrics.text()).resolves.toBe("metric 1\n");

    expect((await fetch(`${baseUrl}/missing`)).status).toBe(404);
    expect(startEventLoopLagMonitor).toHaveBeenCalledOnce();

    await closeWorkerHealthServer(server);
    expect(server.listening).toBe(false);
  });

  it("returns 503 when readiness checks fail", async () => {
    evaluateWorkerReadiness.mockResolvedValue({
      checks: { redis: { status: "unhealthy" } },
      status: "unhealthy"
    });
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/health/ready`);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ status: "unhealthy" })
    );
  });
});
