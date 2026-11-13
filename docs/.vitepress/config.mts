import { defineConfig } from 'vitepress'
import type { Plugin } from 'vite'

const rawBase = (process.env.DOCS_BASE || '/').replace(/^\/+|\/+$/g, '')
const base = rawBase ? `/${rawBase}/` : '/'

const demoDevPlugin: Plugin = {
  name: 'docs-demo-dev',
  apply: 'serve',
  configureServer(server) {
    const demoPath = `${base}demo/`
    const demoSansSlash = demoPath.slice(0, -1)
    server.middlewares.use((request, _response, next) => {
      const [pathname, search] = (request.url ?? '').split('?')
      if (pathname === demoPath || pathname === demoSansSlash) {
        request.url = `${demoPath}index.html${search ? `?${search}` : ''}`
      }
      next()
    })
  },
}

export default defineConfig({
  lang: 'en',
  title: 'Sleeve',
  description: 'A catalog for the records you chose, and a slower way to decide what to play next.',
  base,
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'force-dark',
  ignoreDeadLinks: [/^http:\/\/localhost/, /^http:\/\/127\.0\.0\.1/],
  head: [
    ['link', { rel: 'icon', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#07080b' }],
  ],
  vite: {
    plugins: [demoDevPlugin],
  },
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'Sleeve',
    nav: [
      { text: 'Demo', link: '/demo/', target: '_blank' },
      { text: 'Docs', link: '/guide/getting-started' },
      { text: 'Contribute', link: '/development/contributing' },
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
  },
})
