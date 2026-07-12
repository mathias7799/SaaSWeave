import { APIError } from "better-auth/api";
/* eslint-disable unicorn/no-thenable -- mocks Drizzle's thenable query builder */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSessionFromCtx = vi.fn();
const deleteSessionCookie = vi.fn();
const setSessionCookie = vi.fn();
const recordAudit = vi.fn();
const selectQueues: unknown[][] = [];

function createSelectChain(result: unknown) {
  const chain = {
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
      return Promise.resolve(result).then(resolve, reject);
    }
  };
  return chain;
}

vi.mock("better-auth/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getSessionFromCtx: (...args: unknown[]) => getSessionFromCtx(...args)
  };
});

vi.mock("better-auth/cookies", () => {
  return {
    deleteSessionCookie: (...args: unknown[]) => deleteSessionCookie(...args),
    setSessionCookie: (...args: unknown[]) => setSessionCookie(...args)
  };
});

vi.mock("@saasweave/db", () => {
  return {
    db: {
      select: vi.fn(() => createSelectChain(selectQueues.shift() ?? []))
    },
    recordAudit: (...args: unknown[]) => recordAudit(...args)
  };
});

import { handleImpersonateWorkspaceMember } from "#@/plugins/workspace-impersonation";

type ImpersonationCtx = Parameters<typeof handleImpersonateWorkspaceMember>[0];

function createCtx(overrides: Partial<ImpersonationCtx> = {}): ImpersonationCtx {
  return {
    body: { userId: "target-1" },
    context: {
      authCookies: {
        dontRememberToken: { name: "dont-remember" },
        sessionToken: { attributes: { httpOnly: true } }
      },
      createAuthCookie: (name: string) => {
        return { name };
      },
      internalAdapter: {
        createSession: vi.fn(async () => {
          return { token: "impersonation-token" };
        }),
        findUserById: vi.fn(async () => {
          return { email: "target@example.com", id: "target-1" };
        })
      },
      secret: "test-secret"
    },
    getSignedCookie: vi.fn(async () => ""),
    json: vi.fn((payload: unknown) => payload),
    setSignedCookie: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("handleImpersonateWorkspaceMember", () => {
  beforeEach(() => {
    getSessionFromCtx.mockReset();
    deleteSessionCookie.mockReset();
    setSessionCookie.mockReset();
    recordAudit.mockReset();
    selectQueues.length = 0;
  });

  it("rejects unauthenticated requests", async () => {
    getSessionFromCtx.mockResolvedValue(null);

    await expect(handleImpersonateWorkspaceMember(createCtx())).rejects.toThrow(APIError);
  });

  it("rejects nested impersonation attempts", async () => {
    getSessionFromCtx.mockResolvedValue({
      session: { activeOrganizationId: "org-1", impersonatedBy: "admin-1", token: "actor-token" },
      user: { id: "actor-1", name: "Actor" }
    });

    await expect(handleImpersonateWorkspaceMember(createCtx())).rejects.toThrow(
      "Stop impersonating before starting a new session."
    );
  });

  it("requires an active workspace", async () => {
    getSessionFromCtx.mockResolvedValue({
      session: { activeOrganizationId: null, token: "actor-token" },
      user: { id: "actor-1", name: "Actor" }
    });

    await expect(handleImpersonateWorkspaceMember(createCtx())).rejects.toThrow(
      "No active workspace."
    );
  });

  it("rejects actors who are not workspace members", async () => {
    getSessionFromCtx.mockResolvedValue({
      session: { activeOrganizationId: "org-1", token: "actor-token" },
      user: { id: "actor-1", name: "Actor" }
    });
    selectQueues.push([]);

    await expect(handleImpersonateWorkspaceMember(createCtx())).rejects.toThrow(
      "You are not a member of this workspace."
    );
  });

  it("rejects targets who are not workspace members", async () => {
    getSessionFromCtx.mockResolvedValue({
      session: { activeOrganizationId: "org-1", token: "actor-token" },
      user: { id: "actor-1", name: "Actor" }
    });
    selectQueues.push([{ role: "owner" }], []);

    await expect(handleImpersonateWorkspaceMember(createCtx())).rejects.toThrow(
      "That user is not a member of this workspace."
    );
  });

  it("rejects policy-blocked impersonation", async () => {
    getSessionFromCtx.mockResolvedValue({
      session: { activeOrganizationId: "org-1", token: "actor-token" },
      user: { id: "actor-1", name: "Actor" }
    });
    selectQueues.push(
      [{ role: "admin" }],
      [{ role: "admin", userId: "target-1" }],
      [{ role: "user" }]
    );

    await expect(handleImpersonateWorkspaceMember(createCtx())).rejects.toThrow(
      "Admins cannot impersonate other admins."
    );
  });

  it("creates an impersonation session and records audit on success", async () => {
    getSessionFromCtx.mockResolvedValue({
      session: { activeOrganizationId: "org-1", token: "actor-token" },
      user: { id: "actor-1", name: "Actor" }
    });
    selectQueues.push(
      [{ role: "owner" }],
      [{ role: "developer", userId: "target-1" }],
      [{ role: "user" }]
    );

    const ctx = createCtx();
    const result = await handleImpersonateWorkspaceMember(ctx);

    expect(result).toEqual({
      session: { token: "impersonation-token" },
      user: { email: "target@example.com", id: "target-1" }
    });
    expect(deleteSessionCookie).toHaveBeenCalledWith(ctx);
    expect(setSessionCookie).toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.impersonated",
        actorId: "actor-1",
        organizationId: "org-1",
        targetLabel: "target@example.com"
      })
    );
  });
});
