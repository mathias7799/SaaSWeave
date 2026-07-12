import { describe, expect, it } from "vite-plus/test";

import { stripSecretFields } from "@saasweave/app/data-export/strip-secrets";

describe("stripSecretFields", () => {
  it("removes api key hashes, webhook secrets, session tokens, and password hashes", () => {
    const input = {
      apiKeys: [
        {
          id: "key-1",
          keyHash: "sha256-deadbeef",
          keyPrefix: "swv_abc…",
          name: "Integration"
        }
      ],
      members: [
        {
          email: "owner@example.com",
          password: "$2a$hashed",
          userId: "user-1"
        }
      ],
      sessions: [
        {
          id: "sess-1",
          token: "secret-session-token"
        }
      ],
      webhooks: [
        {
          id: "wh-1",
          secret: "whsec_supersecret",
          url: "https://example.com/hook"
        }
      ]
    };

    const output = stripSecretFields(input);

    expect(output.apiKeys[0]).toEqual({
      id: "key-1",
      keyPrefix: "swv_abc…",
      name: "Integration"
    });
    expect(output.members[0]).toEqual({
      email: "owner@example.com",
      userId: "user-1"
    });
    expect(output.sessions[0]).toEqual({ id: "sess-1" });
    expect(output.webhooks[0]).toEqual({
      id: "wh-1",
      url: "https://example.com/hook"
    });
    expect(JSON.stringify(output)).not.toContain("sha256-deadbeef");
    expect(JSON.stringify(output)).not.toContain("whsec_supersecret");
    expect(JSON.stringify(output)).not.toContain("secret-session-token");
    expect(JSON.stringify(output)).not.toContain("$2a$hashed");
  });
});
