import { type AnyRoute } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";

import { getRouteTreePathsLocalized } from "#@/tanstack-start/lib/get-route-tree-paths-localized";
import { stripLocalePrefix } from "#@/tanstack-start/lib/strip-locale-prefix";
import { validateNavigateTo } from "#@/tanstack-start/lib/validate-navigate-to";

const routeTree = {
  children: {
    localized: {
      children: [
        {
          fullPath: "/{-$locale}/app/settings/",
          id: "/{-$locale}/app/settings/",
          path: "settings/"
        }
      ],
      fullPath: "/{-$locale}/app/",
      id: "/{-$locale}/app/",
      path: "{-$locale}/app/"
    },
    publicApi: {
      fullPath: "/health",
      id: "/health",
      path: "/health"
    },
    sitemap: {
      fullPath: "/sitemap.xml",
      id: "/sitemap.xml",
      path: "/sitemap.xml"
    }
  },
  id: "__root__"
} as unknown as AnyRoute;

describe("localized route tree", () => {
  it("expands localized routes while preserving full-path trailing slashes", () => {
    const routes = getRouteTreePathsLocalized(routeTree);

    expect(routes).toEqual([
      {
        fullPath: "/app/",
        id: "/{-$locale}/app/",
        locale: "en",
        path: "/app"
      },
      {
        fullPath: "/de/app/",
        id: "/{-$locale}/app/",
        locale: "de",
        path: "/de/app"
      },
      {
        fullPath: "/app/settings/",
        id: "/{-$locale}/app/settings/",
        locale: "en",
        path: "/app/settings"
      },
      {
        fullPath: "/de/app/settings/",
        id: "/{-$locale}/app/settings/",
        locale: "de",
        path: "/de/app/settings"
      }
    ]);
  });

  it("does not expose non-localized or sitemap routes", () => {
    const paths = getRouteTreePathsLocalized(routeTree).map((route) => route.path);
    expect(paths).not.toContain("/health");
    expect(paths).not.toContain("/sitemap.xml");
  });
});

describe("stripLocalePrefix", () => {
  it.each([
    ["/", "/"],
    ["/de/app", "/app"],
    ["/en/en/app", "/app"],
    ["/{-$locale}/{-$locale}/app", "/app"],
    ["/de", "/"],
    ["/denmark/app", "/denmark/app"],
    ["/application", "/application"]
  ])("normalizes %s to %s", (input, expected) => {
    expect(stripLocalePrefix(input)).toBe(expected);
  });
});

describe("validateNavigateTo", () => {
  const includeAll = () => true;

  it("accepts a real localized route and preserves search and hash", () => {
    expect(
      validateNavigateTo({
        routeTree,
        shouldIncludeRoute: includeAll,
        to: "/de/app/settings/?tab=profile#password"
      })
    ).toBe("/de/app/settings/?tab=profile#password");
  });

  it("converts an absolute URL to an internal route destination", () => {
    expect(
      validateNavigateTo({
        routeTree,
        shouldIncludeRoute: includeAll,
        to: "https://untrusted.example/de/app?tab=usage"
      })
    ).toBe("/de/app?tab=usage");
  });

  it("falls back for missing and filtered routes", () => {
    expect(
      validateNavigateTo({
        fallbackTo: "/app",
        routeTree,
        shouldIncludeRoute: includeAll,
        to: "/missing"
      })
    ).toBe("/app");

    expect(
      validateNavigateTo({
        fallbackTo: "/app",
        routeTree,
        shouldIncludeRoute: (route) => !route.id.includes("settings"),
        to: "/app/settings"
      })
    ).toBe("/app");
  });
});
