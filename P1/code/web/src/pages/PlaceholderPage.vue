<script setup lang="ts">
import { useRoute } from "vue-router";

// Stands in for each screen until its step in plan-vue.md builds it.
const route = useRoute();
</script>

<template>
  <section>
    <h2>{{ route.meta.title }}</h2>
    <p v-if="route.meta.step" class="note">Placeholder. This screen is built in {{ route.meta.step }}.</p>
    <dl v-if="Object.keys(route.params).length">
      <template v-for="(value, name) in route.params" :key="name">
        <dt>{{ name }}</dt>
        <dd>
          <code>{{ value }}</code>
        </dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
.note {
  color: #6b7280;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
}

dt {
  font-weight: 600;
}

dd {
  margin: 0;
}
</style>
