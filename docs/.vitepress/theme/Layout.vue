<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import SleeveHome from './components/SleeveHome.vue'

const { frontmatter } = useData()
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-before>
      <SleeveHome v-if="frontmatter.layout === 'home'" />
    </template>
  </DefaultTheme.Layout>
</template>
