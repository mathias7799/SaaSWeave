import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'

// Reuse the screenshots and GIFs that already live in docs/media instead of
// duplicating them. VitePress serves everything in publicDir at the site root,
// so docs/media/tour/home.png is reachable as /tour/home.png (base is applied
// automatically).
const mediaDir = fileURLToPath(new URL('../../docs/media', import.meta.url))

export default defineConfig({
  title: 'SaaSWeave',
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
          text: 'Reference',
          items: [
            { text: 'Product tour', link: '/tour' },
            { text: 'Package reference', link: '/reference/packages' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Package reference', link: '/reference/packages' },
            { text: 'Product tour', link: '/tour' },
            { text: 'Guide', link: '/guide/introduction' },
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
})
