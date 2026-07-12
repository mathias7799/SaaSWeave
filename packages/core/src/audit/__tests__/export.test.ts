import { describe, expect, it } from "vite-plus/test";

import {
  AUDIT_EXPORT_CSV_COLUMNS,
  AUDIT_EXPORT_FORMATS,
  AUDIT_EXPORT_MAX_ROWS
} from "#@/audit/export";

describe("audit export contracts", () => {
  it("supports csv and json export formats", () => {
    expect(AUDIT_EXPORT_FORMATS).toEqual(["csv", "json"]);
  });

  it("caps exports at ten thousand rows", () => {
    expect(AUDIT_EXPORT_MAX_ROWS).toBe(10_000);
  });

  it("defines the CSV column order for compliance exports", () => {
    expect(AUDIT_EXPORT_CSV_COLUMNS).toEqual([
      "id",
      "createdAt",
      "action",
      "actorName",
      "targetType",
      "targetLabel"
    ]);
  });

  it("shapes a CSV row using the canonical column list", () => {
    const row = {
      id: "audit_1",
      createdAt: "2026-07-11T08:00:00.000Z",
      action: "member.removed",
      actorName: "Alex Admin",
      targetType: "member",
      targetLabel: "sam@example.com"
    };

    const csv = AUDIT_EXPORT_CSV_COLUMNS.map((column) => row[column]).join(",");
    expect(csv).toBe(
      "audit_1,2026-07-11T08:00:00.000Z,member.removed,Alex Admin,member,sam@example.com"
    );
  });
});
