import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  renderMetrics,
  startEventLoopLagMonitor,
  statusClass,
  stopEventLoopLagMonitor
} from "#@/metrics";

afterEach(() => {
  stopEventLoopLagMonitor();
  vi.useRealTimers();
});

describe("observability metrics", () => {
  it("maps HTTP status codes to classes", () => {
    expect(statusClass(200)).toBe("2xx");
    expect(statusClass(404)).toBe("4xx");
    expect(statusClass(302)).toBe("3xx");
    expect(statusClass(503)).toBe("5xx");
    expect(statusClass(101)).toBe("other");
  });

  it("renders prometheus exposition format", async () => {
    const body = await renderMetrics();
    expect(body).toContain("http_requests_total");
    expect(body).toContain("# HELP");
  });

  it("records event-loop lag and treats repeated starts as idempotent", async () => {
    vi.useFakeTimers();

    startEventLoopLagMonitor(100);
    startEventLoopLagMonitor(100);
    await vi.advanceTimersByTimeAsync(150);

    const body = await renderMetrics();
    expect(body).toContain("nodejs_event_loop_lag_seconds");

    stopEventLoopLagMonitor();
    stopEventLoopLagMonitor();
  });
});
