import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";

import { ENV_SERVER } from "@saasweave/env/server/env";
import {
  evaluateWorkerReadiness,
  type WorkerReadinessInput
} from "@saasweave/jobs/worker-readiness";
import { createLogger } from "@saasweave/logger/server";
import { metricsHandler, startEventLoopLagMonitor } from "@saasweave/observability";

const log = createLogger({ operation: "server__worker_health" });

function hasValidMetricsToken(authorization: string | undefined): boolean {
  const expected = ENV_SERVER.METRICS_BEARER_TOKEN;
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const actualDigest = createHash("sha256").update(authorization.slice(7)).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export type WorkerHealthServerOptions = {
  getReadinessInput: () => WorkerReadinessInput;
  port?: number;
};

export function createWorkerHealthServer(options: WorkerHealthServerOptions): Server {
  const port = options.port ?? ENV_SERVER.WORKER_HEALTH_PORT;

  if (ENV_SERVER.METRICS_ENABLED) {
    startEventLoopLagMonitor();
  }

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (url === "/health/live") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }));
      return;
    }

    if (url === "/health/ready") {
      const evaluation = await evaluateWorkerReadiness(options.getReadinessInput());
      const statusCode = evaluation.status === "healthy" ? 200 : 503;
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: evaluation.status,
          checks: evaluation.checks,
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    if (url === "/metrics" && ENV_SERVER.METRICS_ENABLED) {
      if (!hasValidMetricsToken(req.headers.authorization)) {
        res.writeHead(401, { "WWW-Authenticate": "Bearer" }).end();
        return;
      }
      const response = await metricsHandler();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, "0.0.0.0", () => {
    log.info("Worker health server listening", { event: "worker_health_listening", port });
  });

  return server;
}

export async function closeWorkerHealthServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
