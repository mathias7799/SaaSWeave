import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const enPath = resolve(import.meta.dirname, "../../../../../../packages/i18n/messages/en.json");
const messages = JSON.parse(readFileSync(enPath, "utf8")) as Record<string, string>;

describe("console i18n keys", () => {
  const requiredPrefixes = [
    "console_common__",
    "console_overview__",
    "console_billing__",
    "console_settings__sso_",
    "console_security__"
  ];

  it.each(requiredPrefixes)("includes keys for %s", (prefix) => {
    const matches = Object.keys(messages).filter((key) => key.startsWith(prefix));
    expect(matches.length).toBeGreaterThan(0);
  });

  it("includes SSO sign-in copy", () => {
    expect(messages.auth__continue_with_sso).toBeTruthy();
  });
});
