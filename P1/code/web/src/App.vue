<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
</script>

<template>
  <AppHeader />
  <main>
    <RouterView />
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1f2937;
  background: #f9fafb;
}

main {
  padding: 24px;
}
</style>
