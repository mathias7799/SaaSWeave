import { describe, it } from "vite-plus/test";

/**
 * SAML SSO round-trip is manual-only: requires the `sso-test` compose profile,
 * browser redirects, and IdP credentials. See docs/SSO-TESTING.md.
 */
describe("SSO / SAML (manual — see docs/SSO-TESTING.md)", () => {
  it.todo("SP-initiated login lands in the org after IdP authentication");
});
