/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import { createCallerFor, expectOrpcError, integrationIt, seedOrgWithOwner } from "./harness";

describe.sequential("console profile", () => {
  integrationIt("get returns the caller profile fields", async () => {
    const seed = await seedOrgWithOwner({
      email: "profile@integration.test",
      name: "Profile User"
    });
    const caller = await createCallerFor({ seed });

    const profile = await caller.console.profile.get();

    expect(profile).toEqual({
      email: seed.email,
      id: seed.userId,
      image: null,
      name: seed.name,
      role: "user"
    });
  });

  integrationIt("update persists a new display name", async () => {
    const seed = await seedOrgWithOwner({ name: "Before Update" });
    const caller = await createCallerFor({ seed });

    const updated = await caller.console.profile.update({ name: "After Update" });
    expect(updated).toEqual({ ok: true });
  });

  integrationIt("requestAvatarUpload rejects invalid content types (INVALID_UPLOAD)", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () =>
        caller.console.profile.requestAvatarUpload({
          contentType: "application/pdf",
          fileName: "avatar.pdf",
          size: 1024
        }),
      "INVALID_UPLOAD"
    );
  });

  integrationIt("requestAvatarUpload rejects oversized files (INVALID_UPLOAD)", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () =>
        caller.console.profile.requestAvatarUpload({
          contentType: "image/png",
          fileName: "avatar.png",
          size: 3 * 1024 * 1024
        }),
      "INVALID_UPLOAD"
    );
  });

  integrationIt("completeAvatarUpload returns UPLOAD_NOT_READY for unknown assets", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () =>
        caller.console.profile.completeAvatarUpload({
          mediaAssetId: "00000000-0000-4000-8000-000000000001"
        }),
      "UPLOAD_NOT_READY"
    );
  });
});
