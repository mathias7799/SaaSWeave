import { beforeEach, describe, expect, it } from "vite-plus/test";

import { checkIsDbReady } from "@saasweave/db";

import { resetDb } from "./db-harness";

describe.sequential("db readiness", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reports the database as ready when connected", async () => {
    expect(await checkIsDbReady()).toBe(true);
  });
});
