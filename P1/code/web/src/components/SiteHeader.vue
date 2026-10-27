<script setup lang="ts">
// The header on the pages seen before signing in: the wordmark on the left,
// and whatever the page puts in the slot on the right.
</script>

<template>
  <header class="site-header">
    <RouterLink to="/" class="wordmark">GitDocs</RouterLink>
    <slot />
  </header>
</template>

<style scoped>
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.wordmark {
  color: var(--strong);
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
}
</style>
