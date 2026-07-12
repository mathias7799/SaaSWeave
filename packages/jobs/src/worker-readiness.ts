import { type Worker } from "bullmq";

import { checkRedisReady } from "@saasweave/cache";
import { type HealthCheckResult, type HealthStatus } from "@saasweave/core/health";
import { checkIsDbReady } from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { getQueue, QUEUE_NAMES, SCHEDULE_JOB_NAMES } from "#@/queues";

export type WorkerReadinessInput = {
  acceptingTraffic: boolean;
  heartbeatAt: number;
  registeredSchedules: string[];
  workers: Worker[];
};

export type WorkerReadinessChecks = {
  acceptingTraffic: HealthCheckResult;
  database: HealthCheckResult;
  heartbeat: HealthCheckResult;
  queues: HealthCheckResult;
  redis: HealthCheckResult;
  schedulers: HealthCheckResult;
  workers: HealthCheckResult;
};

const HEARTBEAT_MAX_AGE_MS = 120_000;
const SCHEDULER_REQUIRED = Object.values(SCHEDULE_JOB_NAMES);

function healthy(data: Record<string, unknown> = {}): HealthCheckResult {
  return { latencyMs: 0, ...data, status: "healthy" };
}

function unhealthy(error: string, data: Record<string, unknown> = {}): HealthCheckResult {
  return { latencyMs: 0, ...data, error, status: "unhealthy" };
}

export async function evaluateWorkerReadiness(
  input: WorkerReadinessInput
): Promise<{ checks: WorkerReadinessChecks; status: HealthStatus }> {
  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);

  const acceptingTraffic: HealthCheckResult = input.acceptingTraffic
    ? healthy({ latencyMs: latency() })
    : unhealthy("Worker is draining or not yet ready", { latencyMs: latency() });

  let redis: HealthCheckResult;
  try {
    const result = await checkRedisReady();
    redis =
      result.status === "healthy"
        ? healthy({ configured: result.configured, latencyMs: latency() })
        : unhealthy("Redis ping failed", { configured: result.configured, latencyMs: latency() });
  } catch (error) {
    redis = unhealthy(error instanceof Error ? error.message : "Redis check failed", {
      latencyMs: latency()
    });
  }

  let database: HealthCheckResult;
  try {
    const ready = await checkIsDbReady();
    database = ready
      ? healthy({ latencyMs: latency() })
      : unhealthy("Database ping failed", { latencyMs: latency() });
  } catch (error) {
    database = unhealthy(error instanceof Error ? error.message : "Database check failed", {
      latencyMs: latency()
    });
  }

  const runningWorkers = input.workers.filter((worker) => worker.isRunning());
  const workers: HealthCheckResult =
    runningWorkers.length === input.workers.length
      ? healthy({ count: runningWorkers.length, latencyMs: latency() })
      : unhealthy("One or more workers are not running", {
          count: runningWorkers.length,
          expected: input.workers.length,
          latencyMs: latency()
        });

  const missingSchedules = SCHEDULER_REQUIRED.filter(
    (name) => !input.registeredSchedules.includes(name)
  );
  const schedulers: HealthCheckResult =
    missingSchedules.length === 0
      ? healthy({ registered: input.registeredSchedules, latencyMs: latency() })
      : unhealthy("Missing repeatable schedulers", {
          missing: missingSchedules,
          latencyMs: latency()
        });

  let queues: HealthCheckResult;
  try {
    await getQueue(QUEUE_NAMES.SCHEDULES).getJobCounts("waiting", "active");
    queues = healthy({ prefix: ENV_SERVER.QUEUE_PREFIX, latencyMs: latency() });
  } catch (error) {
    queues = unhealthy(error instanceof Error ? error.message : "Queue check failed", {
      latencyMs: latency()
    });
  }

  const heartbeatAgeMs = Date.now() - input.heartbeatAt;
  const heartbeat: HealthCheckResult =
    heartbeatAgeMs <= HEARTBEAT_MAX_AGE_MS
      ? healthy({ ageMs: heartbeatAgeMs, latencyMs: latency() })
      : unhealthy("Worker heartbeat is stale", { ageMs: heartbeatAgeMs, latencyMs: latency() });

  const checks: WorkerReadinessChecks = {
    acceptingTraffic,
    database,
    heartbeat,
    queues,
    redis,
    schedulers,
    workers
  };

  const allHealthy = Object.values(checks).every((check) => check.status === "healthy");
  return { checks, status: allHealthy ? "healthy" : "unhealthy" };
}
