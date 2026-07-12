import { type Server } from "node:http";
import process from "node:process";

import { type Worker } from "bullmq";

import { closeRedis } from "@saasweave/cache";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { refreshQueueMetrics } from "@saasweave/jobs/queue-metrics";
import { closeQueues } from "@saasweave/jobs/queues";
import { closeAllWorkers, createAllWorkers } from "@saasweave/jobs/worker";
import { LOG_SERVICES, createLogger, initLogger } from "@saasweave/logger/server";

import { closeWorkerHealthServer, createWorkerHealthServer } from "#@/health-server";
import { registerSchedules } from "#@/schedules";

initLogger({
  env: {
    environment: ENV_SERVER.NODE_ENV,
    service: LOG_SERVICES.WORKER,
    version: ENV_SERVER.SOURCE_COMMIT
  }
});

const log = createLogger({ operation: "server__worker" });

export type WorkerRuntime = {
  registeredSchedules: string[];
  workers: ReturnType<typeof createAllWorkers>;
};

export function createWorkerRuntime(): WorkerRuntime {
  return {
    registeredSchedules: [],
    workers: createAllWorkers()
  };
}

const runtime = createWorkerRuntime();
const allWorkers = runtime.workers;

let isShuttingDown = false;
let acceptingTraffic = false;
let heartbeatAt = Date.now();
let healthServer: Server | undefined;

const heartbeatTimer = setInterval(() => {
  heartbeatAt = Date.now();
}, 30_000);
heartbeatTimer.unref();

const queueMetricsTimer = setInterval(() => {
  void refreshQueueMetrics().catch((error) => {
    log.warn("Queue metrics refresh failed", { error, event: "queue_metrics_refresh_failed" });
  });
}, 15_000);
queueMetricsTimer.unref();

function touchHeartbeat(): void {
  heartbeatAt = Date.now();
}

allWorkers.forEach((worker) => {
  worker.on("completed", () => touchHeartbeat());
  worker.on("failed", () => touchHeartbeat());
});

export function setWorkerAcceptingTraffic(value: boolean): void {
  acceptingTraffic = value;
}

export function getWorkerReadinessInput() {
  return {
    acceptingTraffic: acceptingTraffic && !isShuttingDown,
    heartbeatAt,
    registeredSchedules: runtime.registeredSchedules,
    workers: allWorkers
  };
}

/** Gracefully closes all workers, queues, and Redis connections (unit-testable). */
export async function shutdownWorkerRuntime(
  workerRuntime: WorkerRuntime,
  signal: string
): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  acceptingTraffic = false;

  log.info("Worker shutdown started", { event: "worker_shutdown_started", signal });

  if (healthServer) {
    await closeWorkerHealthServer(healthServer);
    healthServer = undefined;
  }

  await closeAllWorkers(workerRuntime.workers);
  await closeQueues();
  await closeRedis();
  clearInterval(heartbeatTimer);
  clearInterval(queueMetricsTimer);
  log.info("Worker shutdown completed", { event: "worker_shutdown_completed", signal });
}

/** Resets the shutdown guard so repeated shutdown tests can run in isolation. */
export function resetWorkerShutdownState(): void {
  isShuttingDown = false;
  acceptingTraffic = false;
}

export async function runShutdownWorkerRuntime(
  workerRuntime: WorkerRuntime,
  signal: string
): Promise<void> {
  const timeout = new Promise<never>((_, reject) => {
    const t = setTimeout(() => reject(new Error("shutdown_timeout")), 15_000);
    t.unref();
  });
  try {
    await Promise.race([shutdownWorkerRuntime(workerRuntime, signal), timeout]);
    process.exit(0);
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "worker_shutdown_failed",
      signal
    });
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void runShutdownWorkerRuntime(runtime, "SIGINT");
});

process.on("SIGTERM", () => {
  void runShutdownWorkerRuntime(runtime, "SIGTERM");
});

process.on("uncaughtException", (error) => {
  log.error(error, { event: "worker_uncaught_exception" });
  void shutdownWorkerRuntime(runtime, "uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (error) => {
  log.error(error instanceof Error ? error : String(error), {
    event: "worker_unhandled_rejection"
  });
});

async function startWorker(): Promise<void> {
  healthServer = createWorkerHealthServer({ getReadinessInput: getWorkerReadinessInput });
  runtime.registeredSchedules = await registerSchedules();
  await refreshQueueMetrics();
  acceptingTraffic = true;
  touchHeartbeat();

  log.info("Worker started", {
    concurrency: ENV_SERVER.WORKER_CONCURRENCY,
    event: "worker_started",
    healthPort: ENV_SERVER.WORKER_HEALTH_PORT,
    queues: allWorkers.map((worker: Worker) => worker.name),
    schedules: runtime.registeredSchedules
  });
}

void startWorker().catch((error) => {
  log.error(error instanceof Error ? error : String(error), { event: "worker_startup_failed" });
  process.exit(1);
});
