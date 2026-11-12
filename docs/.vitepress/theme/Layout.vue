<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import SleeveFooter from './components/SleeveFooter.vue'
import SleeveHome from './components/SleeveHome.vue'

const { frontmatter } = useData()
</script>

<template>
  <DefaultTheme.Layout>
    <template #home-hero-before>
      <SleeveHome v-if="frontmatter.layout === 'home'" />
    </template>
    <template #layout-bottom>
      <SleeveFooter />
    </template>
  </DefaultTheme.Layout>
</template>
