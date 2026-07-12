import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@saasweave/db", () => {
  return {
    db: {
      update: (...args: unknown[]) => mockUpdate(...args)
    }
  };
});

vi.mock("@saasweave/db/schema", () => {
  return {
    invitation: {
      expiresAt: "expiresAt",
      id: "id",
      status: "status"
    }
  };
});

const { expireStaleInvitations } = await import("#@/maintenance");

describe("expireStaleInvitations", () => {
  beforeEach(() => {
    mockReturning.mockReset();
    mockWhere.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();

    mockReturning.mockResolvedValue([{ id: "inv_1" }, { id: "inv_2" }]);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
  });

  it("cancels pending invitations older than 30 days and returns the count", async () => {
    const count = await expireStaleInvitations();

    expect(count).toBe(2);
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith({ status: "canceled" });
    expect(mockWhere).toHaveBeenCalledOnce();

    const cutoff = mockWhere.mock.calls[0]?.[0];
    expect(cutoff).toBeDefined();
  });

  it("returns zero when no invitations match the expiry cutoff", async () => {
    mockReturning.mockResolvedValue([]);

    await expect(expireStaleInvitations()).resolves.toBe(0);
  });
});
