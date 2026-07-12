import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
  labels: { service: process.env.LOG_SERVICE ?? "unknown" }
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_class"] as const,
  registers: [metricsRegistry]
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_class"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
});

export const authFailuresTotal = new Counter({
  name: "auth_failures_total",
  help: "Authentication failures",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry]
});

export const rateLimitHitsTotal = new Counter({
  name: "rate_limit_hits_total",
  help: "Rate limit rejections",
  labelNames: ["scope"] as const,
  registers: [metricsRegistry]
});

export const redisErrorsTotal = new Counter({
  name: "redis_errors_total",
  help: "Redis client errors",
  registers: [metricsRegistry]
});

export const queueJobsWaiting = new Gauge({
  name: "queue_jobs_waiting",
  help: "Jobs waiting in queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry]
});

export const queueJobsActive = new Gauge({
  name: "queue_jobs_active",
  help: "Jobs actively processing",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry]
});

export const queueJobsDelayed = new Gauge({
  name: "queue_jobs_delayed",
  help: "Delayed jobs in queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry]
});

export const queueJobsFailed = new Gauge({
  name: "queue_jobs_failed",
  help: "Failed jobs retained in queue",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry]
});

export const queueOldestJobAgeSeconds = new Gauge({
  name: "queue_oldest_job_age_seconds",
  help: "Age of the oldest waiting or delayed job",
  labelNames: ["queue"] as const,
  registers: [metricsRegistry]
});

export const jobDurationSeconds = new Histogram({
  name: "job_duration_seconds",
  help: "Background job processing duration",
  labelNames: ["queue", "name", "status"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15, 30, 60, 120, 300],
  registers: [metricsRegistry]
});

export const jobRetriesTotal = new Counter({
  name: "job_retries_total",
  help: "Background job retries",
  labelNames: ["queue", "name"] as const,
  registers: [metricsRegistry]
});

export const webhookFailuresTotal = new Counter({
  name: "webhook_delivery_failures_total",
  help: "Outbound webhook delivery failures",
  registers: [metricsRegistry]
});

export const exportDurationSeconds = new Histogram({
  name: "data_export_duration_seconds",
  help: "Workspace data export duration",
  buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200],
  registers: [metricsRegistry]
});

export const exportSizeBytes = new Histogram({
  name: "data_export_size_bytes",
  help: "Workspace data export artifact size",
  buckets: [1024, 10_240, 102_400, 1_048_576, 10_485_760, 52_428_800, 104_857_600],
  registers: [metricsRegistry]
});

export const storageErrorsTotal = new Counter({
  name: "storage_errors_total",
  help: "Object storage operation failures",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry]
});

export const retentionPurgedRowsTotal = new Counter({
  name: "retention_purged_rows_total",
  help: "Rows purged by retention jobs",
  labelNames: ["class", "dry_run"] as const,
  registers: [metricsRegistry]
});

export const eventLoopLagSeconds = new Gauge({
  name: "nodejs_event_loop_lag_seconds",
  help: "Event loop lag measured by periodic timer drift",
  registers: [metricsRegistry]
});

export function statusClass(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "other";
}

export async function renderMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

let lagTimer: ReturnType<typeof setInterval> | undefined;

export function startEventLoopLagMonitor(intervalMs = 5_000): void {
  if (lagTimer) return;
  let expected = performance.now() + intervalMs;
  lagTimer = setInterval(() => {
    const now = performance.now();
    const lagMs = Math.max(0, now - expected);
    eventLoopLagSeconds.set(lagMs / 1000);
    expected = now + intervalMs;
  }, intervalMs);
  lagTimer.unref();
}

export function stopEventLoopLagMonitor(): void {
  if (lagTimer) {
    clearInterval(lagTimer);
    lagTimer = undefined;
  }
}
