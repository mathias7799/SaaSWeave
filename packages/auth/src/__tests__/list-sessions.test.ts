/* eslint-disable unicorn/no-thenable -- mocks Drizzle's thenable query builder */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const selectResult = vi.fn();

vi.mock("@saasweave/db", () => {
  function chainFor(result: unknown) {
    const chain = {
      from: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      where: vi.fn(() => chain),
      then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
        return Promise.resolve(result).then(resolve, reject);
      }
    };
    return chain;
  }

  return {
    db: {
      select: vi.fn(() => chainFor(selectResult()))
    }
  };
});

import { listActiveSessionsForUser, type ActiveSession } from "#@/list-sessions";

describe("listActiveSessionsForUser", () => {
  beforeEach(() => {
    selectResult.mockReset();
  });

  it("returns active sessions ordered by updatedAt", async () => {
    const sessions: ActiveSession[] = [
      {
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
        id: "session-newer",
        ipAddress: "203.0.113.1",
        token: "token-newer",
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        userAgent: "vitest"
      },
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
        id: "session-older",
        ipAddress: null,
        token: "token-older",
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        userAgent: null
      }
    ];
    selectResult.mockReturnValue(sessions);

    await expect(listActiveSessionsForUser("user-1")).resolves.toEqual(sessions);
  });

  it("returns an empty list when no sessions match", async () => {
    selectResult.mockReturnValue([]);
    await expect(listActiveSessionsForUser("user-empty")).resolves.toEqual([]);
  });
});
