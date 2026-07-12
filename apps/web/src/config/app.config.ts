import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";
import { baseLocale, locales } from "@saasweave/i18n/runtime";

const emailSupport = `support@${new URL(ENV_WEB_ISOMORPHIC.VITE_WEB_URL).host}`;

// We load it in vite.config.ts because they are originally from ENV_WEB_SERVER variables
declare const __BUILD_SOURCE_COMMIT__: string;

export const appConfig = Object.freeze({
  i18n: {
    baseLocale,
    cookieName: "LOCALE",
    locales
  },
  site: {
    author: "SaaSWeave",
    basePath: new URL(ENV_WEB_ISOMORPHIC.VITE_WEB_URL).pathname,
    baseUrl: new URL(ENV_WEB_ISOMORPHIC.VITE_WEB_URL).origin,
    description:
      "SaaSWeave is the operations console for AI-native businesses: an enterprise dashboard, real-time AI usage analytics, and usage-based billing in one workspace.",
    emailSupport,
    jurisdictionCountry: "Denmark",
    longName: "SaaSWeave — Enterprise console for AI usage, analytics, and billing",
    serverLocation: "the EU (Frankfurt)",
    shortName: "SaaSWeave",
    tagline: "Run your niche on numbers.",
    url: ENV_WEB_ISOMORPHIC.VITE_WEB_URL,
    version: __BUILD_SOURCE_COMMIT__
  }
});
