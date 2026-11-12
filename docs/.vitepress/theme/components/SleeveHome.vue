<script setup lang="ts">
import { withBase } from 'vitepress'

const screenshot = withBase('/screenshot.webp')
const mobileScreenshot = withBase('/screenshot-mobile.webp')
const links = {
  guide: withBase('/guide/getting-started'),
  server: withBase('/guide/getting-started#run-it-on-a-server'),
  library: withBase('/guide/library-and-search'),
  development: withBase('/development/'),
}

const features = [
  {
    tag: 'Collection',
    title: 'Catalog what you own',
    details:
      'Covers, labels, barcodes, genres, ratings and full tracklists pulled from MusicBrainz.',
  },
  {
    tag: 'Import',
    title: 'Bring Discogs over',
    details:
      'Export the CSV, preview the detected columns and move the whole shelf in one pass.',
  },
  {
    tag: 'Insights',
    title: 'Read the collection',
    details:
      'Formats, eras, genres, spending by month, shop and format, plus records that need attention.',
  },
  {
    tag: 'Wishlist',
    title: 'Hunt what is missing',
    details:
      'A buy-intent list with target prices, kept separate from the shelf and from saved finds.',
  },
  {
    tag: 'Discover',
    title: 'Find the next record',
    details:
      'Weekly picks built from your collection, wishlist and the artists you follow.',
  },
  {
    tag: 'Local',
    title: 'Keep it yours',
    details:
      'SQLite on your machine, portable JSON backups and an installable app that works offline.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Bring the shelf over',
    details: 'Start empty, import a Discogs CSV, or add the first record by barcode.',
  },
  {
    number: '02',
    title: 'Let the metadata land',
    details: 'MusicBrainz fills covers, labels and tracklists. Your notes stay untouched.',
  },
  {
    number: '03',
    title: 'Decide what is next',
    details: 'Follow artists, keep a wishlist and check Discover when the shelf feels stale.',
  },
]
</script>

<template>
  <div class="sleeve-home">
    <section class="sleeve-hero">
      <div class="sleeve-hero-copy">
        <h1 class="sleeve-title">
          Every record<br />
          you own, on one<br />
          <em>dust-free</em> shelf.
        </h1>
        <p class="sleeve-lead">
          Sleeve keeps your CDs and vinyl organized: covers, tracklists, what you paid,
          and what you are still hunting for. It runs on your machine — no accounts, no
          cloud, no telemetry.
        </p>
        <div class="sleeve-actions">
          <a class="sleeve-btn sleeve-btn-primary" :href="links.guide">
            Get started
          </a>
          <a class="sleeve-btn sleeve-btn-ghost" :href="links.server">
            Run on a server
          </a>
        </div>
        <ul class="sleeve-meta">
          <li>Single user</li>
          <li>SQLite</li>
          <li>JSON backups</li>
          <li>PWA</li>
        </ul>
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
      </div>
    </section>

    <section class="sleeve-section">
      <div class="sleeve-section-head">
        <p class="sleeve-eyebrow">What it does</p>
        <h2>Built for the shelf, not the cloud.</h2>
      </div>
      <div class="sleeve-grid">
        <article
          v-for="feature in features"
          :key="feature.title"
          class="sleeve-card"
        >
          <p class="sleeve-card-tag">{{ feature.tag }}</p>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.details }}</p>
        </article>
      </div>
    </section>

    <section class="sleeve-flow">
      <div class="sleeve-flow-copy">
        <p class="sleeve-eyebrow">The loop</p>
        <h2>From box to shelf to next find.</h2>
        <p>
          Sleeve stays useful after the catalog is done. Metadata fills the gaps, the
          wishlist keeps the hunt focused and Discover uses what you already own.
        </p>
        <a class="sleeve-text-link" :href="links.library">
          See how the library works
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <ol class="sleeve-steps">
        <li v-for="step in steps" :key="step.number">
          <span class="sleeve-step-number">{{ step.number }}</span>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.details }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="sleeve-cta">
      <div>
        <p class="sleeve-eyebrow">Ready when you are</p>
        <h2>One shelf. Every record.</h2>
        <p>Docker up, open the browser, add the first CD.</p>
      </div>
      <div class="sleeve-actions">
        <a class="sleeve-btn sleeve-btn-primary" :href="links.guide">
          Read the guide
        </a>
        <a class="sleeve-btn sleeve-btn-ghost" :href="links.development">
          Work on the code
        </a>
      </div>
    </section>
  </div>
</template>
