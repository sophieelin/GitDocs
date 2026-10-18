<script setup lang="ts">
defineProps<{ message: string | null }>();
</script>

<template>
  <p v-if="message" class="error" role="alert">{{ message }}</p>
</template>

<style scoped>
.error {
  margin: 12px 0;
  padding: 10px 14px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
}
</style>
