/* eslint-disable unicorn/no-thenable -- mocks Drizzle's thenable query builder */
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const dispatchNotification = vi.fn();
const dispatchTemplateEmail = vi.fn();
const dispatchOrgWebhook = vi.fn();
const recordAudit = vi.fn();
const isFeatureGloballyEnabled = vi.fn();
const getPlatformSettings = vi.fn();
const selectQueues: unknown[][] = [];
const insertCalls: unknown[] = [];

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

vi.mock("@saasweave/jobs/dispatch", () => {
  return {
    dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
    dispatchTemplateEmail: (...args: unknown[]) => dispatchTemplateEmail(...args)
  };
});

vi.mock("@saasweave/jobs/webhook-dispatch", () => {
  return {
    dispatchOrgWebhook: (...args: unknown[]) => dispatchOrgWebhook(...args)
  };
});

vi.mock("@saasweave/db", () => {
  return {
    db: {
      insert: vi.fn(() => {
        return {
          values: vi.fn(async (values: unknown) => {
            insertCalls.push(values);
          })
        };
      }),
      select: vi.fn(() => createSelectChain(selectQueues.shift() ?? []))
    },
    getPlatformSettings: (...args: unknown[]) => getPlatformSettings(...args),
    isFeatureGloballyEnabled: (...args: unknown[]) => isFeatureGloballyEnabled(...args),
    recordAudit: (...args: unknown[]) => recordAudit(...args)
  };
});

import { auth, provisionPersonalWorkspace, slugify } from "#@/index";
import { assertSeatAvailable, assertSignupsOpen } from "#@/platform-policy";

type OrganizationPlugin = {
  id: string;
  options?: {
    organizationHooks?: Record<string, (input: unknown) => Promise<void>>;
    sendInvitationEmail?: (data: {
      email: string;
      id: string;
      inviter: { id: string; name: string; user: { name: string } };
      organization: { id: string; name: string };
    }) => Promise<void>;
  };
};

function getOrganizationPlugin(): OrganizationPlugin {
  const plugin = auth.options.plugins?.find(
    (entry) =>
      typeof entry === "object" && entry !== null && "id" in entry && entry.id === "organization"
  );
  if (!plugin || typeof plugin !== "object") {
    throw new Error("organization plugin not found");
  }
  return plugin as OrganizationPlugin;
}

function getMagicLinkPlugin() {
  const plugin = auth.options.plugins?.find(
    (entry) =>
      typeof entry === "object" && entry !== null && "id" in entry && entry.id === "magic-link"
  );
  if (!plugin || typeof plugin !== "object") {
    throw new Error("magic-link plugin not found");
  }
  return plugin as {
    options?: { sendMagicLink?: (data: { email: string; url: string }) => Promise<void> };
  };
}

describe("slugify", () => {
  it("normalizes names into workspace slugs", () => {
    expect(slugify("Ada Lovelace")).toMatch(/^ada-lovelace-[a-z0-9]{8}$/);
    expect(slugify("!!!")).toMatch(/^workspace-[a-z0-9]{8}$/);
  });
});

describe("provisionPersonalWorkspace", () => {
  beforeEach(() => {
    selectQueues.length = 0;
    insertCalls.length = 0;
    recordAudit.mockReset();
    dispatchTemplateEmail.mockReset();
  });

  it("returns an existing organization when the user already has membership", async () => {
    selectQueues.push([{ organizationId: "org-existing" }]);

    await expect(
      provisionPersonalWorkspace({
        email: "ada@example.com",
        id: "user-1",
        name: "Ada Lovelace"
      })
    ).resolves.toBe("org-existing");
    expect(insertCalls).toHaveLength(0);
  });

  it("creates a workspace, audit entry, and welcome email for new users", async () => {
    selectQueues.push([]);

    const organizationId = await provisionPersonalWorkspace({
      email: "ada@example.com",
      id: "user-1",
      name: "Ada Lovelace"
    });

    expect(organizationId).toEqual(expect.any(String));
    expect(insertCalls).toHaveLength(2);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace.created",
        actorId: "user-1",
        targetType: "organization"
      })
    );
    expect(dispatchTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "welcome",
        to: "ada@example.com",
        values: expect.objectContaining({ name: "Ada" })
      })
    );
  });
});

describe("auth database hooks", () => {
  beforeEach(() => {
    selectQueues.length = 0;
    recordAudit.mockReset();
    dispatchTemplateEmail.mockReset();
    getPlatformSettings.mockReset();
  });

  it("session create before attaches an existing organization", async () => {
    selectQueues.push([{ organizationId: "org-1" }]);
    const before = auth.options.databaseHooks?.session?.create?.before;
    if (!before) throw new Error("session create before hook missing");

    await expect(before({ impersonatedBy: null, userId: "user-1" } as never)).resolves.toEqual({
      data: { impersonatedBy: null, userId: "user-1", activeOrganizationId: "org-1" }
    });
  });

  it("session create before provisions a workspace when membership is missing", async () => {
    selectQueues.push([], [{ email: "ada@example.com", id: "user-1", name: "Ada Lovelace" }], []);
    const before = auth.options.databaseHooks?.session?.create?.before;
    if (!before) throw new Error("session create before hook missing");

    const result = await before({ impersonatedBy: null, userId: "user-1" } as never);
    expect(result).toEqual({
      data: expect.objectContaining({
        userId: "user-1",
        activeOrganizationId: expect.any(String)
      })
    });
    expect(dispatchTemplateEmail).toHaveBeenCalled();
  });

  it("session create after audits platform-admin impersonation", async () => {
    selectQueues.push([{ name: "Admin", role: "admin" }], [{ email: "target@example.com" }]);
    const after = auth.options.databaseHooks?.session?.create?.after;
    if (!after) throw new Error("session create after hook missing");

    await after({
      impersonatedBy: "admin-1",
      userId: "target-1"
    } as never);

    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.impersonated",
        actorId: "admin-1",
        targetLabel: "target@example.com"
      })
    );
  });

  it("session create after ignores non-admin impersonation", async () => {
    selectQueues.push([{ name: "Owner", role: "user" }]);
    const after = auth.options.databaseHooks?.session?.create?.after;
    if (!after) throw new Error("session create after hook missing");

    await after({
      impersonatedBy: "owner-1",
      userId: "target-1"
    } as never);

    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("user create before assigns platform role after sign-up checks", async () => {
    getPlatformSettings.mockResolvedValue({ signupsOpen: true });
    selectQueues.push([]);
    const before = auth.options.databaseHooks?.user?.create?.before;
    if (!before) throw new Error("user create before hook missing");

    await expect(
      before({ email: "founder@example.com", name: "Founder" } as never)
    ).resolves.toEqual({
      data: expect.objectContaining({
        email: "founder@example.com",
        role: expect.stringMatching(/^(admin|user)$/)
      })
    });
  });
});

describe("auth email and organization hooks", () => {
  beforeEach(() => {
    recordAudit.mockReset();
    dispatchNotification.mockReset();
    dispatchTemplateEmail.mockReset();
    dispatchOrgWebhook.mockReset();
    isFeatureGloballyEnabled.mockReset();
    selectQueues.length = 0;
  });

  it("sendResetPassword dispatches a password reset template", async () => {
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword;
    if (!sendResetPassword) throw new Error("sendResetPassword hook missing");

    await sendResetPassword({
      user: { email: "ada@example.com", name: "Ada Lovelace" },
      url: "https://example.com/reset"
    } as never);

    expect(dispatchTemplateEmail).toHaveBeenCalledWith({
      key: "password-reset",
      to: "ada@example.com",
      values: { actionUrl: "https://example.com/reset", name: "Ada" }
    });
  });

  it("sendVerificationEmail dispatches a welcome template", async () => {
    const sendVerificationEmail = auth.options.emailVerification?.sendVerificationEmail;
    if (!sendVerificationEmail) throw new Error("sendVerificationEmail hook missing");

    await sendVerificationEmail({
      user: { email: "ada@example.com", name: "Ada Lovelace" },
      url: "https://example.com/verify"
    } as never);

    expect(dispatchTemplateEmail).toHaveBeenCalledWith({
      key: "welcome",
      to: "ada@example.com",
      values: { actionUrl: "https://example.com/verify", name: "Ada" }
    });
  });

  it("magic link send rejects disabled feature flag", async () => {
    isFeatureGloballyEnabled.mockResolvedValue(false);
    const sendMagicLink = getMagicLinkPlugin().options?.sendMagicLink;
    if (!sendMagicLink) throw new Error("sendMagicLink hook missing");

    await expect(
      sendMagicLink({ email: "ada@example.com", url: "https://example.com/magic" })
    ).rejects.toThrow("Magic link sign-in is not enabled on this platform.");
  });

  it("magic link send dispatches email when enabled", async () => {
    isFeatureGloballyEnabled.mockResolvedValue(true);
    const sendMagicLink = getMagicLinkPlugin().options?.sendMagicLink;
    if (!sendMagicLink) throw new Error("sendMagicLink hook missing");

    await sendMagicLink({ email: "ada@example.com", url: "https://example.com/magic" });

    expect(dispatchTemplateEmail).toHaveBeenCalledWith({
      key: "magic-link",
      to: "ada@example.com",
      values: { actionUrl: "https://example.com/magic", name: "there" }
    });
  });

  it("organization invitation email uses accept URL values", async () => {
    const sendInvitationEmail = getOrganizationPlugin().options?.sendInvitationEmail;
    if (!sendInvitationEmail) throw new Error("sendInvitationEmail hook missing");

    await sendInvitationEmail({
      email: "invite@example.com",
      id: "invite-1",
      inviter: { id: "user-1", name: "Ada", user: { name: "Ada" } },
      organization: { id: "org-1", name: "Acme" }
    });

    expect(dispatchTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "invitation",
        to: "invite@example.com",
        values: expect.objectContaining({
          inviterName: "Ada",
          workspaceName: "Acme"
        })
      })
    );
  });

  it("afterAddMember records audit, notification, and webhook dispatch", async () => {
    const afterAddMember = getOrganizationPlugin().options?.organizationHooks?.afterAddMember;
    if (!afterAddMember) throw new Error("afterAddMember hook missing");

    await afterAddMember({
      member: { role: "developer", userId: "member-1" },
      organization: { id: "org-1", name: "Acme" },
      user: { email: "member@example.com", name: "Member" }
    });

    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.added", organizationId: "org-1" })
    );
    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "member.added", organizationId: "org-1" })
    );
    expect(dispatchOrgWebhook).toHaveBeenCalledWith("org-1", "member.added", {
      email: "member@example.com",
      role: "developer",
      userId: "member-1"
    });
  });

  it("afterRemoveMember records audit and webhook dispatch", async () => {
    const afterRemoveMember = getOrganizationPlugin().options?.organizationHooks?.afterRemoveMember;
    if (!afterRemoveMember) throw new Error("afterRemoveMember hook missing");

    await afterRemoveMember({
      organization: { id: "org-1", name: "Acme" },
      user: { email: "member@example.com", id: "member-1" }
    });

    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.removed", organizationId: "org-1" })
    );
    expect(dispatchOrgWebhook).toHaveBeenCalledWith("org-1", "member.removed", {
      email: "member@example.com",
      userId: "member-1"
    });
  });
});

describe("platform policy guards", () => {
  beforeEach(() => {
    getPlatformSettings.mockReset();
    selectQueues.length = 0;
  });

  it("assertSignupsOpen throws when sign-ups are closed", async () => {
    getPlatformSettings.mockResolvedValue({ signupsOpen: false });

    await expect(assertSignupsOpen()).rejects.toThrow("New sign-ups are currently closed.");
  });

  it("assertSeatAvailable throws when seat limit is reached", async () => {
    selectQueues.push([{ count: 3 }], [{ planId: "plan-1" }], [{ seatsIncluded: 3 }]);

    await expect(assertSeatAvailable("org-1")).rejects.toThrow(
      "This workspace has reached its seat limit (3)."
    );
  });

  it("assertSeatAvailable throws when pending invitations consume remaining seats", async () => {
    selectQueues.push(
      [{ count: 1 }],
      [{ planId: "plan-1" }],
      [{ seatsIncluded: 2 }],
      [{ count: 1 }]
    );

    await expect(assertSeatAvailable("org-2")).rejects.toThrow(
      "This workspace has no open seats for new invitations."
    );
  });
});
