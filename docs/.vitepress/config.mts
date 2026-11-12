import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en',
  title: 'Sleeve',
  description: 'A local-first catalog for your CD and vinyl collection.',
  base: process.env.DOCS_BASE ?? '/',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'force-dark',
  ignoreDeadLinks: [/^http:\/\/localhost/, /^http:\/\/127\.0\.0\.1/],
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#07080b' }],
  ],
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'Sleeve',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Development', link: '/development/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'User guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Adding releases', link: '/guide/adding-releases' },
            { text: 'Importing from Discogs', link: '/guide/importing-discogs' },
            { text: 'Library and search', link: '/guide/library-and-search' },
            { text: 'Wishlist', link: '/guide/wishlist' },
            { text: 'Discover', link: '/guide/discover' },
            { text: 'Stats and spending', link: '/guide/stats-and-spending' },
            { text: 'Settings and backup', link: '/guide/settings-and-backup' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
      ],
      '/development/': [
        {
          text: 'Development',
          items: [
            { text: 'Overview', link: '/development/' },
            { text: 'Architecture', link: '/development/architecture' },
            { text: 'API', link: '/development/api' },
            { text: 'Data model', link: '/development/data-model' },
            { text: 'Design system', link: '/development/design-system' },
            { text: 'Discovery', link: '/development/discovery' },
            { text: 'Operations', link: '/development/operations' },
            { text: 'Decisions', link: '/development/decisions' },
            { text: 'Contributing', link: '/development/contributing' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/Nicuz/sleeve/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/Nicuz/sleeve' }],
    footer: {
      message: 'Local-first. No accounts, no telemetry.',
      copyright: 'MIT licensed',
    },
  },
})
