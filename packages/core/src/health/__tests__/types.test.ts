import { describe, expect, it } from "vite-plus/test";

import {
  BaseHealthSchema,
  HEALTH_STATUSES,
  HealthCheckResultSchema,
  HealthReadyOutputSchema,
  HealthStatusSchema
} from "#@/health/types";

const sampleTimestamp = "2026-07-11T08:00:00.000Z";

describe("HEALTH_STATUSES", () => {
  it("defines healthy and unhealthy rollup states", () => {
    expect(HEALTH_STATUSES).toEqual(["healthy", "unhealthy"]);
  });
});

describe("HealthStatusSchema", () => {
  it.each(["healthy", "unhealthy"])("accepts %s", (status) => {
    expect(HealthStatusSchema.safeParse(status).success).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(HealthStatusSchema.safeParse("degraded").success).toBe(false);
  });
});

describe("HealthCheckResultSchema", () => {
  it("accepts latency and optional error metadata", () => {
    expect(
      HealthCheckResultSchema.safeParse({
        latencyMs: 12,
        status: "healthy",
        error: "timeout"
      }).success
    ).toBe(true);
  });

  it("rejects negative latency", () => {
    expect(
      HealthCheckResultSchema.safeParse({
        latencyMs: -1,
        status: "healthy"
      }).success
    ).toBe(false);
  });
});

describe("BaseHealthSchema", () => {
  it("validates live health payloads", () => {
    expect(
      BaseHealthSchema.safeParse({
        buildSha: "abc123",
        environment: "production",
        status: "healthy",
        timestamp: sampleTimestamp,
        uptimeMs: 60_000,
        url: "https://example.com/health/live"
      }).success
    ).toBe(true);
  });
});

describe("HealthReadyOutputSchema", () => {
  it("aggregates dependency checks into a ready payload", () => {
    const payload = {
      buildSha: "abc123",
      environment: "production",
      status: "unhealthy",
      timestamp: sampleTimestamp,
      uptimeMs: 120_000,
      url: "https://example.com/health/ready",
      checks: {
        database: { latencyMs: 4, status: "healthy" },
        redis: { latencyMs: 90, status: "unhealthy", error: "connection refused" }
      }
    };

    const parsed = HealthReadyOutputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.status).toBe("unhealthy");
    expect(parsed.success && parsed.data.checks.redis?.error).toBe("connection refused");
  });

  it("rejects ready payloads with invalid check statuses", () => {
    expect(
      HealthReadyOutputSchema.safeParse({
        buildSha: "abc123",
        environment: "production",
        status: "healthy",
        timestamp: sampleTimestamp,
        uptimeMs: 1,
        url: "https://example.com/health/ready",
        checks: {
          database: { latencyMs: 1, status: "unknown" }
        }
      }).success
    ).toBe(false);
  });
});
