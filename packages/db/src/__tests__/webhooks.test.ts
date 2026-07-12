import { describe, expect, it } from "vite-plus/test";

import { assertPublicWebhookUrl } from "#@/outbound-http";

describe("assertPublicWebhookUrl", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://192.168.1.10",
    "http://[::1]/",
    "ftp://8.8.8.8",
    "not-a-url"
  ])("rejects %s", async (url) => {
    await expect(assertPublicWebhookUrl(url)).rejects.toThrow(
      /invalid_webhook_url|blocked_webhook_url|dns_empty|connect_failed/
    );
  });

  it("accepts a public literal IP when DNS resolves publicly", async () => {
    await expect(
      assertPublicWebhookUrl("https://93.184.216.34/hook", {
        resolver: async () => [{ address: "93.184.216.34", family: 4 }]
      })
    ).resolves.toBeUndefined();
  });
});
