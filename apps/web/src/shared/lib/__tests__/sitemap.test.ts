import { describe, expect, it } from "vite-plus/test";

import { shouldIncludePathInSitemap } from "@/shared/lib/sitemap";

describe("shouldIncludePathInSitemap", () => {
  it("includes public marketing routes", () => {
    expect(shouldIncludePathInSitemap("/pricing")).toBe(true);
    expect(shouldIncludePathInSitemap("/about")).toBe(true);
  });

  it("excludes authenticated and utility routes", () => {
    expect(shouldIncludePathInSitemap("/app")).toBe(false);
    expect(shouldIncludePathInSitemap("/app/billing")).toBe(false);
    expect(shouldIncludePathInSitemap("/admin")).toBe(false);
    expect(shouldIncludePathInSitemap("/sign-in")).toBe(false);
    expect(shouldIncludePathInSitemap("/accept-invite")).toBe(false);
    expect(shouldIncludePathInSitemap("/docs/_api/reference")).toBe(false);
    expect(shouldIncludePathInSitemap("/docs/_api")).toBe(false);
    expect(shouldIncludePathInSitemap("/sitemap.xml")).toBe(false);
    expect(shouldIncludePathInSitemap("/blog/$slug")).toBe(false);
    expect(shouldIncludePathInSitemap("/blog/:slug")).toBe(false);
    expect(shouldIncludePathInSitemap("/internal_route")).toBe(false);
  });
});
