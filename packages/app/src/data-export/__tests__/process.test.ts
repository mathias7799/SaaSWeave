import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    getRequest: vi.fn(),
    observeDuration: vi.fn(),
    observeSize: vi.fn(),
    recordAudit: vi.fn(),
    stream: vi.fn(),
    updateStatus: vi.fn()
  };
});

vi.mock("@saasweave/db", () => {
  return {
    getDataExportRequestById: mocks.getRequest,
    recordAudit: mocks.recordAudit,
    updateDataExportRequestStatus: mocks.updateStatus
  };
});
vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: () => {
      return { error: vi.fn(), warn: vi.fn() };
    }
  };
});
vi.mock("@saasweave/observability", () => {
  return {
    exportDurationSeconds: { observe: mocks.observeDuration },
    exportSizeBytes: { observe: mocks.observeSize }
  };
});
vi.mock("#@/data-export/stream-export", () => {
  class DataExportLimitError extends Error {}
  return { DataExportLimitError, streamOrganizationDataExport: mocks.stream };
});

import { processDataExportRequest } from "#@/data-export/process";
import { buildDataExportObjectKey, computeDataExportExpiresAt } from "#@/data-export/storage";
import { DataExportLimitError } from "#@/data-export/stream-export";

const request = {
  canceledAt: null,
  organizationId: "org-1",
  requestedByUserId: "user-1",
  status: "pending"
};

describe("data export process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequest.mockResolvedValue(request);
    mocks.recordAudit.mockResolvedValue(undefined);
    mocks.updateStatus.mockResolvedValue(undefined);
  });

  it("returns stable outcomes for missing, ready, and canceled requests", async () => {
    mocks.getRequest.mockResolvedValueOnce(null);
    await expect(processDataExportRequest("missing")).resolves.toEqual({ status: "missing" });
    mocks.getRequest.mockResolvedValueOnce({ ...request, status: "ready" });
    await expect(processDataExportRequest("ready")).resolves.toEqual({ status: "already_ready" });
    mocks.getRequest.mockResolvedValueOnce({ ...request, status: "canceled" });
    await expect(processDataExportRequest("canceled")).resolves.toEqual({ status: "canceled" });
    mocks.getRequest.mockResolvedValueOnce({
      ...request,
      canceledAt: new Date(),
      status: "processing"
    });
    await expect(processDataExportRequest("cancel-marked")).resolves.toEqual({
      status: "canceled"
    });
  });

  it("marks a streamed export ready, audits it, and records metrics", async () => {
    mocks.stream.mockResolvedValue({
      bytesWritten: 128,
      fileKey: "exports/org-1/export-1.ndjson",
      rowsWritten: 4
    });

    await expect(processDataExportRequest("export-1")).resolves.toEqual({
      notify: { organizationId: "org-1", requestedByUserId: "user-1", requestId: "export-1" },
      status: "ready"
    });
    expect(mocks.updateStatus).toHaveBeenCalledWith("export-1", { status: "processing" });
    expect(mocks.updateStatus).toHaveBeenCalledWith(
      "export-1",
      expect.objectContaining({ bytesWritten: 128, rowsWritten: 4, status: "ready" })
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "data_export.completed", organizationId: "org-1" })
    );
    expect(mocks.observeDuration).toHaveBeenCalledOnce();
    expect(mocks.observeSize).toHaveBeenCalledWith(128);
  });

  it("classifies stream cancellation without recording a failure", async () => {
    mocks.stream.mockRejectedValue(new DataExportLimitError("export_canceled"));

    await expect(processDataExportRequest("export-1")).resolves.toEqual({ status: "canceled" });
    expect(mocks.updateStatus).toHaveBeenLastCalledWith(
      "export-1",
      expect.objectContaining({ status: "canceled" })
    );
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("marks and audits failures before rethrowing", async () => {
    const failure = new Error("storage unavailable");
    mocks.stream.mockRejectedValue(failure);

    await expect(processDataExportRequest("export-1")).rejects.toThrow("storage unavailable");
    expect(mocks.updateStatus).toHaveBeenLastCalledWith(
      "export-1",
      expect.objectContaining({ error: "storage unavailable", status: "failed" })
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "data_export.failed", organizationId: "org-1" })
    );
  });

  it("builds private object keys and expiry dates deterministically", () => {
    expect(buildDataExportObjectKey("org-1", "request-1")).toBe("exports/org-1/request-1.json");
    expect(computeDataExportExpiresAt(new Date("2026-07-01T00:00:00Z"))).toEqual(
      new Date("2026-07-08T00:00:00Z")
    );
  });
});
