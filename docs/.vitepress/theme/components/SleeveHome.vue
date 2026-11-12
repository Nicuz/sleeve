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
  contribute: withBase('/development/contributing'),
}

const features = [
  {
    step: '01',
    tag: 'Import',
    title: 'Bring Discogs over',
    details:
      'Start with what you own: export a Discogs collection as CSV, or add the first CD, record or cassette by hand.',
    wide: true,
    preview: 'import',
  },
  {
    step: '02',
    tag: 'Shelf',
    title: 'Archive the collection',
    details:
      'CDs, vinyl and cassettes with pressing, condition, rating, notes and what you paid.',
  },
  {
    step: '03',
    tag: 'Wishlist',
    title: 'Keep the hunt focused',
    details:
      'A buy-intent list with target prices, separate from the shelf and from saved finds.',
  },
  {
    step: '04',
    tag: 'Discover',
    title: 'Find the next record',
    details:
      'Recommendations shaped by what you own, rate, wishlist and follow — not generic charts.',
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
          Every record<br />
          you own, on one<br />
          <em>dust-free</em> shelf.
        </h1>
        <p class="sleeve-lead">
          Sleeve is a digital shelf for your CDs, vinyl and cassettes. Archive what you
          own, know exactly what is in the collection, and discover the next record
          through recommendations shaped by your purchases, wishlist and the artists you
          follow.
        </p>
        <div class="sleeve-actions">
          <a class="sleeve-btn sleeve-btn-primary" :href="links.guide">
            Get started
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
            <p>For you</p>
            <strong>Justice — Cross</strong>
            <span>Because you own Daft Punk</span>
          </div>
        </div>
      </div>
    </section>

    <section class="sleeve-section">
      <div class="sleeve-section-head" data-reveal>
        <p class="sleeve-eyebrow">What it does</p>
        <h2>Built for the shelf, not the cloud.</h2>
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
          <p class="sleeve-card-copy">{{ feature.details }}</p>

          <div
            v-if="feature.preview === 'import'"
            class="sleeve-preview is-import"
            aria-hidden="true"
          >
            <div class="sleeve-preview-head">
              <span>discogs.csv</span>
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
              cover, purchase price or MusicBrainz match.
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
        <h2>One shelf. Every record.</h2>
        <p>Docker up, open the browser, add the first CD.</p>
      </div>
      <div class="sleeve-actions">
        <a class="sleeve-btn sleeve-btn-primary" :href="links.guide">
          Read the docs
        </a>
        <a class="sleeve-btn sleeve-btn-ghost" :href="links.contribute">
          Contribute
        </a>
      </div>
    </section>
  </div>
</template>
