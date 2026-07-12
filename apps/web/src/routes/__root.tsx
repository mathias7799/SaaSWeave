import geistMonoCyrillic from "@fontsource-variable/geist-mono/files/geist-mono-cyrillic-wght-normal.woff2?url";
import geistMonoLatinExt from "@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2?url";
import geistMonoLatin from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url";
import geistVariableCyrillic from "@fontsource-variable/geist/files/geist-cyrillic-wght-normal.woff2?url";
import geistVariableLatinExt from "@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?url";
import geistVariableLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import instrumentSerifLatin400 from "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url";
import { type QueryClient } from "@tanstack/react-query";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { Fragment, Suspense, lazy } from "react";

import { type AuthUserQueryResult } from "@saasweave/auth/react/tanstack-start/queries";
import { getAuthUserQueryOptions } from "@saasweave/auth/react/tanstack-start/queries";
import { resolvePublicAssetUrl } from "@saasweave/core/assets";
import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";
import {
  LocaleProvider,
  useLocale
} from "@saasweave/i18n/tanstack-start/components/locale-provider";
import { Toaster } from "@saasweave/ui/components/sonner";

import { generateAppSeo } from "@/shared/lib/seo";
import { ProgressProvider } from "@/shared/providers/progress.provider";
import appCss from "@/shared/styles/app.css?url";
import { ThemeProvider } from "@/shared/ui/theme-switcher";

import { DefaultErrorPage } from "@/pages/default-error";

declare const __BUILD_IS_BUILD__: boolean;

const RootDevtools =
  import.meta.env.MODE === "development"
    ? lazy(async () => {
        const { RootDevtools } = await import("@/shared/ui/root-devtools");
        return { default: RootDevtools };
      })
    : null;

// Root route with shared context for the entire app, inject them in router.tsx
type RouterAppContext = {
  queryClient: QueryClient;
  user: AuthUserQueryResult;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  errorComponent: DefaultErrorPage,
  shellComponent: RootDocument,
  // Consider removing this if you don't need the auth state everywhere
  // An example of when to KEEP it is when you conditionally display a sign-up button in the header based on the auth state
  beforeLoad: ({ context, preload }) => {
    // Don't prefetch during preload to prevent spamming the server with getSession requests
    if (!preload && !__BUILD_IS_BUILD__) {
      // Prefetch (don't await) the user data on app load to have it ready for any route that needs it, and to set the auth state early
      void context.queryClient.prefetchQuery(getAuthUserQueryOptions());
    }
  },
  head: () => {
    const rootSeo = generateAppSeo({
      includeDocumentMeta: true
    });
    const faviconHref = resolvePublicAssetUrl(ENV_WEB_ISOMORPHIC.VITE_WEB_URL, "/favicon.ico");
    const sitemapHref = resolvePublicAssetUrl(ENV_WEB_ISOMORPHIC.VITE_WEB_URL, "/sitemap.xml");

    return {
      links: [
        ...(rootSeo.links ?? []),
        {
          href: faviconHref,
          rel: "icon"
        },
        {
          href: sitemapHref,
          rel: "sitemap",
          type: "application/xml"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: instrumentSerifLatin400,
          crossOrigin: "anonymous"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: geistVariableLatin,
          crossOrigin: "anonymous"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: geistVariableLatinExt,
          crossOrigin: "anonymous"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: geistVariableCyrillic,
          crossOrigin: "anonymous"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: geistMonoLatin,
          crossOrigin: "anonymous"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: geistMonoLatinExt,
          crossOrigin: "anonymous"
        },
        {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: geistMonoCyrillic,
          crossOrigin: "anonymous"
        },
        { href: appCss, rel: "stylesheet" }
      ],
      meta: [...(rootSeo.meta ?? [])]
    };
  }
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <RootDocumentInner>{children}</RootDocumentInner>
    </LocaleProvider>
  );
}

function RootDocumentInner({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* We place the progress provider here otherwise we will get "Cannot render a <style> outside the main document" error */}
        <ThemeProvider attribute="class" defaultTheme="dark">
          <ProgressProvider>
            <Fragment key={locale}>{children}</Fragment>
            <Toaster richColors />
            {RootDevtools ? (
              <Suspense fallback={null}>
                <RootDevtools />
              </Suspense>
            ) : null}
            <Scripts />
          </ProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
