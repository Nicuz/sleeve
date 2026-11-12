<script setup lang="ts">
import { withBase } from 'vitepress'

const year = new Date().getFullYear()

const groups = [
  {
    title: 'Product',
    links: [
      { label: 'Getting started', href: withBase('/guide/getting-started') },
      { label: 'Importing Discogs', href: withBase('/guide/importing-discogs') },
      { label: 'Discover', href: withBase('/guide/discover') },
      { label: 'FAQ', href: withBase('/guide/faq') },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'Architecture', href: withBase('/development/architecture') },
      { label: 'API', href: withBase('/development/api') },
      { label: 'Operations', href: withBase('/development/operations') },
      { label: 'Contributing', href: withBase('/development/contributing') },
    ],
  },
  {
    title: 'Elsewhere',
    links: [
      { label: 'GitHub', href: 'https://github.com/Nicuz/sleeve' },
      { label: 'Issues', href: 'https://github.com/Nicuz/sleeve/issues' },
      { label: 'License', href: 'https://github.com/Nicuz/sleeve/blob/main/LICENSE' },
    ],
  },
]
</script>

<template>
  <footer class="sleeve-footer">
    <div class="sleeve-footer-inner">
      <div class="sleeve-footer-brand">
        <a class="sleeve-footer-logo" :href="withBase('/')">
          <img :src="withBase('/favicon.svg')" alt="" width="26" height="26" />
          <span>Sleeve</span>
        </a>
        <p>Your records, on a shelf you chose.</p>
      </div>

      <nav class="sleeve-footer-links" aria-label="Footer">
        <div v-for="group in groups" :key="group.title">
          <p class="sleeve-footer-title">{{ group.title }}</p>
          <a
            v-for="link in group.links"
            :key="link.label"
            :href="link.href"
            :target="link.href.startsWith('http') ? '_blank' : undefined"
            :rel="link.href.startsWith('http') ? 'noreferrer' : undefined"
          >
            {{ link.label }}
          </a>
        </div>
      </nav>
    </div>

    <div class="sleeve-footer-bottom">
      <span>© {{ year }} Sleeve</span>
      <span>MIT licensed</span>
      <span>Made for people who still put records on.</span>
    </div>
  </footer>
</template>
