import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => {
  const makeTable = (name: string) =>
    new Proxy(
      { __name: name },
      {
        get(target, property) {
          if (property in target) return target[property as keyof typeof target];
          return `${name}.${String(property)}`;
        }
      }
    );

  return {
    calls: new Map<string, number>(),
    cleanup: vi.fn(),
    isCanceled: vi.fn(),
    tables: {
      apiKey: makeTable("apiKey"),
      auditLog: makeTable("auditLog"),
      invitation: makeTable("invitation"),
      mediaAsset: makeTable("mediaAsset"),
      member: makeTable("member"),
      notification: makeTable("notification"),
      organization: makeTable("organization"),
      usageEvent: makeTable("usageEvent"),
      user: makeTable("user"),
      webhookDelivery: makeTable("webhookDelivery"),
      webhookEndpoint: makeTable("webhookEndpoint")
    },
    updateStatus: vi.fn(),
    upload: vi.fn(),
    writer: {
      bytesWritten: 0,
      close: vi.fn(),
      path: "/tmp/export.ndjson",
      records: [] as unknown[],
      writeLine: vi.fn()
    }
  };
});

function rowFor(key: string): Record<string, unknown>[] {
  const count = state.calls.get(key) ?? 0;
  state.calls.set(key, count + 1);
  if (count > 0 && !key.endsWith(":lookup")) return [];

  const createdAt = new Date("2026-01-02T03:04:05.000Z");
  const base = { createdAt, id: `${key}-1` };
  switch (key) {
    case "organization":
      return [
        {
          ...base,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          lastStripeEventAt: null,
          logo: null,
          metadata: { region: "eu" },
          name: "Workspace",
          planId: "growth",
          slug: "workspace",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          subscriptionStatus: "active"
        }
      ];
    case "member:media-owners":
      return [{ userId: "user-1" }];
    case "member":
      return [
        {
          ...base,
          email: "user@example.test",
          image: null,
          name: "User",
          role: "owner",
          userId: "user-1"
        }
      ];
    case "invitation":
      return [
        {
          ...base,
          email: "invite@example.test",
          expiresAt: null,
          inviterId: "user-1",
          role: "member",
          status: "pending"
        }
      ];
    case "apiKey":
      return [
        {
          ...base,
          createdBy: "user-1",
          keyPrefix: "bn_123",
          lastUsedAt: null,
          name: "CLI",
          revokedAt: null,
          scopes: ["usage:read"]
        }
      ];
    case "webhookEndpoint:lookup":
      return [{ id: "endpoint-1" }];
    case "webhookEndpoint":
      return [
        { ...base, enabled: true, events: ["usage.recorded"], url: "https://example.test/hook" }
      ];
    case "webhookDelivery":
      return [
        {
          ...base,
          attempt: "1",
          endpointId: "endpoint-1",
          eventType: "usage.recorded",
          payload: { quantity: 1 },
          responseBody: "ok",
          responseStatus: "200",
          status: "delivered"
        }
      ];
    case "auditLog":
      return [
        {
          ...base,
          action: "settings.updated",
          actorId: "user-1",
          actorName: "User",
          metadata: null,
          targetLabel: null,
          targetType: "settings"
        }
      ];
    case "usageEvent":
      return [
        {
          ...base,
          feature: "api",
          inputTokens: null,
          metric: "api_calls",
          model: null,
          outputTokens: null,
          provider: null,
          quantity: 1
        }
      ];
    case "notification":
      return [
        {
          ...base,
          actionUrl: "/app",
          body: null,
          readAt: null,
          title: "Ready",
          type: "info",
          userId: "user-1"
        }
      ];
    case "mediaAsset":
      return [
        {
          ...base,
          contentType: "image/png",
          key: "avatar/user-1/a.png",
          linkedAt: createdAt,
          ownerId: "user-1",
          purpose: "avatar",
          replacedAt: null,
          size: 8,
          status: "linked",
          uploadedAt: createdAt
        }
      ];
    default:
      return [];
  }
}

vi.mock("drizzle-orm", () => {
  return {
    and: vi.fn((...values) => values),
    asc: vi.fn((value) => value),
    eq: vi.fn((...values) => values),
    gt: vi.fn((...values) => values),
    inArray: vi.fn((...values) => values),
    or: vi.fn((...values) => values)
  };
});

vi.mock("@saasweave/db/schema", () => state.tables);

vi.mock("@saasweave/db", () => {
  return {
    db: {
      select: (selection?: Record<string, unknown>) => {
        let tableName = "";
        const builder = {
          from(table: { __name: string }) {
            tableName = table.__name;
            return builder;
          },
          innerJoin() {
            return builder;
          },
          limit() {
            return Promise.resolve(resolveRows());
          },
          orderBy() {
            return builder;
          },
          where() {
            const keys = Object.keys(selection ?? {});
            const isDirectLookup =
              (tableName === "member" && keys.length === 1 && keys[0] === "userId") ||
              (tableName === "webhookEndpoint" && keys.length === 1 && keys[0] === "id");
            if (isDirectLookup) {
              return Promise.resolve(resolveRows());
            }
            return builder;
          }
        };
        const resolveRows = () => {
          const keys = Object.keys(selection ?? {});
          if (tableName === "member" && keys.length === 1 && keys[0] === "userId") {
            return rowFor("member:media-owners");
          }
          if (tableName === "webhookEndpoint" && keys.length === 1 && keys[0] === "id") {
            return rowFor("webhookEndpoint:lookup");
          }
          return rowFor(tableName);
        };
        return builder;
      }
    },
    isDataExportCanceled: state.isCanceled,
    updateDataExportRequestStatus: state.updateStatus
  };
});

vi.mock("#@/data-export/stream-writer", () => {
  return {
    buildDataExportNdjsonKey: (organizationId: string, requestId: string) =>
      `exports/${organizationId}/${requestId}.ndjson`,
    cleanupDataExportWriter: state.cleanup,
    createDataExportWriter: vi.fn(async () => state.writer),
    uploadDataExportFile: state.upload
  };
});

import { streamOrganizationDataExport } from "#@/data-export/stream-export";

describe("streamOrganizationDataExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.calls.clear();
    state.isCanceled.mockResolvedValue(false);
    state.updateStatus.mockResolvedValue(undefined);
    state.upload.mockResolvedValue(undefined);
    state.writer.bytesWritten = 0;
    state.writer.records.length = 0;
    state.writer.writeLine.mockImplementation(async (record: unknown) => {
      state.writer.records.push(record);
      state.writer.bytesWritten += Buffer.byteLength(`${JSON.stringify(record)}\n`);
    });
  });

  it("serializes every tenant table, persists progress, uploads, and cleans up", async () => {
    const result = await streamOrganizationDataExport({
      organizationId: "org-1",
      requestId: "export-1"
    });

    expect(result).toEqual({
      bytesWritten: state.writer.bytesWritten,
      fileKey: "exports/org-1/export-1.ndjson",
      rowsWritten: 10
    });
    expect(state.writer.records.map((record) => (record as { table: string }).table)).toEqual([
      "meta",
      "organization",
      "members",
      "invitations",
      "api_keys",
      "webhooks",
      "webhook_deliveries",
      "audit_logs",
      "usage_events",
      "notifications",
      "media_assets"
    ]);
    expect(state.writer.close).toHaveBeenCalledOnce();
    expect(state.upload).toHaveBeenCalledWith("exports/org-1/export-1.ndjson", state.writer.path);
    expect(state.cleanup).toHaveBeenCalledWith(state.writer.path);
    expect(state.updateStatus).toHaveBeenCalled();
  });

  it("cleans up the writer when the organization is missing", async () => {
    state.calls.set("organization", 1);

    await expect(
      streamOrganizationDataExport({ organizationId: "missing", requestId: "export-2" })
    ).rejects.toThrow("organization_not_found");
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.cleanup).toHaveBeenCalledWith(state.writer.path);
  });
});
