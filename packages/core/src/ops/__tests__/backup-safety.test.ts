import { describe, expect, it } from "vite-plus/test";

import { assertLocalDatabaseTarget } from "#@/ops/backup-safety";

describe("backup restore safety gate", () => {
  it("allows localhost targets", () => {
    expect(() =>
      assertLocalDatabaseTarget("postgresql://postgres:pw@localhost:5432/saasweave")
    ).not.toThrow();
  });

  it("blocks remote targets without override", () => {
    expect(() =>
      assertLocalDatabaseTarget("postgresql://postgres:pw@db.prod.example:5432/saasweave")
    ).toThrow(/Refusing non-local database host/);
  });

  it("allows remote targets when explicitly enabled", () => {
    expect(() =>
      assertLocalDatabaseTarget("postgresql://postgres:pw@db.prod.example:5432/saasweave", true)
    ).not.toThrow();
  });
});
