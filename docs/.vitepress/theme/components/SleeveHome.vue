<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const element = root.value
  if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!('IntersectionObserver' in window)) return

  element.classList.add('sleeve-motion')
  const items = element.querySelectorAll<HTMLElement>('[data-reveal]')

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer?.unobserve(entry.target)
      }
    },
    { threshold: 0.12 },
  )

  items.forEach((item) => observer?.observe(item))
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

const screenshot = withBase('/screenshot.webp')
const mobileScreenshot = withBase('/screenshot-mobile.webp')
const proofWishlist = withBase('/shelf-wishlist.webp')
const proofInsights = withBase('/shelf-insights.webp')
const links = {
  guide: withBase('/guide/getting-started'),
  demo: withBase('/demo/'),
  contribute: withBase('/development/contributing'),
}

const features = [
  {
    step: '01',
    tag: 'Import',
    title: 'Import your collection',
    details: '',
    detailsBefore: 'Import an existing collection from a CSV. If you already keep yours on ',
    highlight: 'Discogs',
    detailsAfter: ', its export works as-is.',
    wide: true,
    preview: 'import',
  },
  {
    step: '02',
    tag: 'Shelf',
    title: 'Keep the shelf accurate',
    details:
      'CDs, vinyl and cassettes with pressing, condition, rating, notes and what you paid.',
  },
  {
    step: '03',
    tag: 'Wishlist',
    title: 'Keep the hunt focused',
    details:
      'A want list with target prices, separate from the shelf and from saved finds.',
  },
  {
    step: '04',
    tag: 'Discover',
    title: 'Find the next record',
    details:
      'Records worth checking next, shaped by what you own, rate, wishlist and follow. Nothing is added until you choose.',
    wide: true,
    preview: 'discover',
  },
  {
    step: '05',
    tag: 'Insights',
    title: 'Read the collection',
    details:
      'Formats, eras, genres, spending by month, shop and format, plus records that need attention.',
  },
  {
    step: '06',
    tag: 'Local',
    title: 'Keep it yours',
    details:
      'SQLite on your machine, portable JSON backups and an installable app that works offline.',
    wide: true,
    preview: 'local',
  },
]

</script>

<template>
  <div ref="root" class="sleeve-home">
    <section class="sleeve-hero">
      <div class="sleeve-hero-copy">
        <h1 class="sleeve-title">
          A shelf for the<br />
          records <em>you chose</em>.
        </h1>
        <p class="sleeve-lead">
          Sleeve is a catalog for a physical collection, and a slower way to decide what
          to play next. It is not a streaming replacement. Keep a want list, follow the
          artists you care about, and find records worth checking next. Nothing plays or
          gets added until you choose.
        </p>
        <div class="sleeve-actions">
          <a class="sleeve-btn sleeve-btn-primary" :href="links.guide">
            Get started
          </a>
          <a class="sleeve-btn sleeve-btn-ghost" :href="links.demo" target="_blank" rel="noreferrer">
            Try the demo
          </a>
        </div>
      </div>

      <div class="sleeve-visual">
        <div class="sleeve-halo" aria-hidden="true"></div>
        <div class="sleeve-disc" aria-hidden="true"></div>
        <img
          class="sleeve-shot"
          :src="screenshot"
          alt="Sleeve library on desktop with album covers, formats and collection stats"
        />
        <img
          class="sleeve-mobile"
          :src="mobileScreenshot"
          alt="Sleeve library on a phone with a two-column collection grid"
        />
        <div class="sleeve-float" aria-hidden="true">
          <span class="sleeve-float-cover">J</span>
          <div>
            <p>Picks</p>
            <strong>Justice — Cross</strong>
            <span>Because you own Daft Punk</span>
          </div>
        </div>
      </div>
    </section>

    <section class="sleeve-section">
      <div class="sleeve-section-head" data-reveal>
        <p class="sleeve-eyebrow">What it does</p>
        <h2>Made for a physical collection.</h2>
      </div>
      <div class="sleeve-grid">
        <article
          v-for="feature in features"
          :key="feature.title"
          class="sleeve-card"
          :class="{ 'is-wide': feature.wide }"
          data-reveal
        >
          <div class="sleeve-card-head">
            <span class="sleeve-card-step">{{ feature.step }}</span>
            <p class="sleeve-card-tag">{{ feature.tag }}</p>
          </div>
          <h3>{{ feature.title }}</h3>
          <p class="sleeve-card-copy">
            <template v-if="feature.highlight">
              {{ feature.detailsBefore }}<em>{{ feature.highlight }}</em>{{ feature.detailsAfter }}
            </template>
            <template v-else>{{ feature.details }}</template>
          </p>

          <div
            v-if="feature.preview === 'import'"
            class="sleeve-preview is-import"
            aria-hidden="true"
          >
            <div class="sleeve-preview-head">
              <span>collection.csv</span>
              <span>auto-mapped</span>
            </div>
            <div class="sleeve-preview-row is-labels">
              <span>Title</span>
              <span>Artist</span>
              <span>Year</span>
            </div>
            <div class="sleeve-preview-row">
              <span>Random Access Memories</span>
              <span>Daft Punk</span>
              <span>2013</span>
            </div>
            <div class="sleeve-preview-row">
              <span>Discovery</span>
              <span>Daft Punk</span>
              <span>2001</span>
            </div>
          </div>

          <div
            v-else-if="feature.preview === 'discover'"
            class="sleeve-preview is-discover"
            aria-hidden="true"
          >
            <span class="sleeve-mini-cover">J</span>
            <div class="sleeve-mini-copy">
              <span>Because you own Daft Punk</span>
              <strong>Justice — Cross</strong>
              <small>Album · 2007</small>
            </div>
            <span class="sleeve-mini-pill">Save</span>
          </div>

          <div
            v-else-if="feature.preview === 'local'"
            class="sleeve-preview is-local"
            aria-hidden="true"
          >
            <span class="sleeve-file-icon">JSON</span>
            <div class="sleeve-mini-copy">
              <strong>sleeve-backup.json</strong>
              <small>releases · wishlist · follows</small>
            </div>
            <span class="sleeve-mini-pill">Restore</span>
          </div>
        </article>
      </div>
    </section>

    <section class="sleeve-proof">
      <div class="sleeve-section-head" data-reveal>
        <p class="sleeve-eyebrow">Look inside</p>
        <h2>The shelf, the hunt, the numbers.</h2>
      </div>

      <div class="sleeve-proof-list">
        <article class="sleeve-proof-row" data-reveal>
          <div class="sleeve-proof-copy">
            <p class="sleeve-proof-kicker">01 · The shelf</p>
            <h3>Know exactly what you own.</h3>
            <p>
              Each CD, record and cassette with pressing, condition, rating, notes and
              what you paid. One shelf, not a folder of spreadsheets.
            </p>
          </div>
          <figure class="sleeve-proof-media">
            <img
              :src="screenshot"
              alt="Sleeve library with album covers, formats and collection stats"
              loading="lazy"
            />
          </figure>
        </article>

        <article class="sleeve-proof-row is-reverse" data-reveal>
          <div class="sleeve-proof-copy">
            <p class="sleeve-proof-kicker">02 · The hunt</p>
            <h3>A wishlist that stays a wishlist.</h3>
            <p>
              Target prices, notes and formats kept separate from the collection and from
              Discover saves. What you want never mixes with what you own.
            </p>
          </div>
          <figure class="sleeve-proof-media">
            <img
              :src="proofWishlist"
              alt="Sleeve wishlist with target prices and format badges"
              loading="lazy"
            />
          </figure>
        </article>

        <article class="sleeve-proof-row" data-reveal>
          <div class="sleeve-proof-copy">
            <p class="sleeve-proof-kicker">03 · The numbers</p>
            <h3>See the shape of the collection.</h3>
            <p>
              Formats, eras, genres and spending, plus the records that still need a
              cover or purchase price.
            </p>
          </div>
          <figure class="sleeve-proof-media">
            <img
              :src="proofInsights"
              alt="Sleeve insights with collection stats, formats, eras and genres"
              loading="lazy"
            />
          </figure>
        </article>
      </div>
    </section>

    <section class="sleeve-cta" data-reveal>
      <div>
        <p class="sleeve-eyebrow">Ready when you are</p>
        <h2>Start with one record.</h2>
        <p>Docker up, open the browser, add the first CD.</p>
      </div>
      <div class="sleeve-actions">
        <a class="sleeve-btn sleeve-btn-primary" :href="links.demo" target="_blank" rel="noreferrer">
          Try the demo
        </a>
        <a class="sleeve-btn sleeve-btn-ghost" :href="links.guide">
          Read the docs
        </a>
        <a class="sleeve-btn sleeve-btn-ghost" :href="links.contribute">
          Contribute
        </a>
      </div>
    </section>
  </div>
</template>
