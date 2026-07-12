import { describe, expect, it, vi } from "vite-plus/test";

import { getPublicAuthProviderFlags } from "#@/public-providers";

vi.mock("@saasweave/db", () => {
  return {
    isFeatureGloballyEnabled: vi.fn(async (key: string) => key === "magic_link")
  };
});

describe("getPublicAuthProviderFlags", () => {
  const empty = {
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: ""
  };

  it("returns false when credentials are missing", async () => {
    await expect(getPublicAuthProviderFlags(empty)).resolves.toEqual({
      github: false,
      google: false,
      magicLink: true
    });
  });

  it("enables github when both client id and secret are set", async () => {
    await expect(
      getPublicAuthProviderFlags({
        ...empty,
        GITHUB_CLIENT_ID: "gh-id",
        GITHUB_CLIENT_SECRET: "gh-secret"
      })
    ).resolves.toEqual({ github: true, google: false, magicLink: true });
  });

  it("enables google when both client id and secret are set", async () => {
    await expect(
      getPublicAuthProviderFlags({
        ...empty,
        GOOGLE_CLIENT_ID: "go-id",
        GOOGLE_CLIENT_SECRET: "go-secret"
      })
    ).resolves.toEqual({ github: false, google: true, magicLink: true });
  });
});
