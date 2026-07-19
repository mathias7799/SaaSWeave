import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// Reuse the screenshots and GIFs that already live in docs/media instead of
// duplicating them. VitePress serves everything in publicDir at the site root,
// so docs/media/tour/home.png is reachable as /tour/home.png (base is applied
// automatically).
const mediaDir = fileURLToPath(new URL('../../docs/media', import.meta.url))

export default withMermaid(defineConfig({
  title: 'SaaSWeave',
  titleTemplate: ':title · SaaSWeave',
  description:
    'A production-oriented, multi-tenant SaaS starter built as a full-stack TypeScript monorepo.',
  lang: 'en-US',

  // Project Pages site is served from https://<user>.github.io/SaaSWeave/.
  base: '/SaaSWeave/',

  cleanUrls: true,
  lastUpdated: true,
  metaChunk: true,

  // Local service addresses in the quick-start table are valid for a reader
  // running the stack; they just cannot be reached from the build machine.
  ignoreDeadLinks: [/^https?:\/\/localhost/],

  head: [
    ['meta', { name: 'theme-color', content: '#0f8a5f' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'SaaSWeave' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Workspaces, auth, billing, background jobs, observability, and typed APIs in one TypeScript starter.',
      },
    ],
  ],

  vite: {
    publicDir: mediaDir,
  },

  themeConfig: {
    siteTitle: 'SaaSWeave',

    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Product tour', link: '/tour' },
      { text: 'Develop', link: '/develop', activeMatch: '/develop' },
      { text: 'Packages', link: '/reference/packages' },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/mathias7799/SaaSWeave' },
          { text: 'Security policy', link: 'https://github.com/mathias7799/SaaSWeave/blob/main/SECURITY.md' },
          { text: 'Contributing', link: 'https://github.com/mathias7799/SaaSWeave/blob/main/CONTRIBUTING.md' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick start', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
        {
          text: 'Understanding the stack',
          items: [
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Security model', link: '/guide/security' },
            { text: 'Production operations', link: '/guide/operations' },
          ],
        },
        {
          text: 'Runbooks',
          items: [
            { text: 'Local stack', link: '/guide/local-stack' },
            { text: 'SSO testing', link: '/guide/sso-testing' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Product tour', link: '/tour' },
            { text: 'Development guide', link: '/develop' },
            { text: 'Package reference', link: '/reference/packages' },
          ],
        },
      ],
      '/develop': [
        {
          text: 'Working in the codebase',
          items: [
            { text: 'Overview', link: '/develop' },
            { text: 'Workflow', link: '/develop/workflow' },
            { text: 'Vite Plus toolchain', link: '/develop/vite-plus' },
            { text: 'TypeScript conventions', link: '/develop/typescript' },
            { text: 'Testing', link: '/develop/testing' },
          ],
        },
        {
          text: 'Backend',
          items: [
            { text: 'Core contracts', link: '/develop/core' },
            { text: 'Environment variables', link: '/develop/environment-variables' },
            { text: 'Auth patterns', link: '/develop/auth' },
            { text: 'oRPC patterns', link: '/develop/orpc' },
            { text: 'API fetching patterns', link: '/develop/api-fetching-patterns' },
            { text: 'Logging', link: '/develop/logging' },
            { text: 'Media storage', link: '/develop/media-storage' },
            { text: 'End-to-end features', link: '/develop/end-to-end-features' },
          ],
        },
        {
          text: 'Frontend',
          items: [
            { text: 'TanStack patterns', link: '/develop/tanstack-patterns' },
            { text: 'Zustand state', link: '/develop/zustand' },
            { text: 'UI components', link: '/develop/ui' },
            { text: 'Internationalization', link: '/develop/i18n' },
            { text: 'SEO', link: '/develop/seo' },
          ],
        },
        {
          text: 'Agent skills',
          items: [
            { text: 'Building a feature end-to-end', link: '/develop/skills/feature-building' },
            { text: 'Redis, queues, and caching', link: '/develop/skills/redis-cache-jobs' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Overview',
          items: [
            { text: 'Package reference', link: '/reference/packages' },
          ],
        },
        {
          text: 'Applications',
          items: [
            { text: 'web', link: '/reference/apps/web' },
            { text: 'server', link: '/reference/apps/server' },
            { text: 'worker', link: '/reference/apps/worker' },
          ],
        },
        {
          text: 'Packages',
          items: [
            { text: 'core', link: '/reference/packages/core' },
            { text: 'env', link: '/reference/packages/env' },
            { text: 'db', link: '/reference/packages/db' },
            { text: 'app', link: '/reference/packages/app' },
            { text: 'jobs', link: '/reference/packages/jobs' },
            { text: 'auth', link: '/reference/packages/auth' },
            { text: 'api', link: '/reference/packages/api' },
            { text: 'cache', link: '/reference/packages/cache' },
            { text: 'logger', link: '/reference/packages/logger' },
            { text: 'observability', link: '/reference/packages/observability' },
            { text: 'mailer', link: '/reference/packages/mailer' },
            { text: 'i18n', link: '/reference/packages/i18n' },
            { text: 'ui', link: '/reference/packages/ui' },
            { text: 'seo', link: '/reference/packages/seo' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/mathias7799/SaaSWeave' },
    ],

    editLink: {
      pattern:
        'https://github.com/mathias7799/SaaSWeave/edit/main/website/:path',
      text: 'Suggest an edit to this page',
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright:
        'SaaSWeave builds on the foundation of tsu-moe/tsu-stack.',
    },

    outline: { level: [2, 3] },
  },

  // Mermaid renders in the browser; the plugin re-initializes on light/dark
  // toggle (forcing its dark theme in dark mode). "neutral" is grayscale and
  // sits far better on the warm-neutral base than the default yellow/lavender.
  mermaid: {
    securityLevel: 'strict',
    theme: 'neutral',
  },
}))
