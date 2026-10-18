<script setup lang="ts">
import { computed } from "vue";

/** A proposal's status as a coloured label. */
const props = defineProps<{ status: string }>();

const labels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
};

const label = computed(() => labels[props.status] ?? props.status);
</script>

<template>
  <span class="badge" :class="status.toLowerCase()">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--sidebar);
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.pending_approval {
  background: #fef3c7;
  color: #92400e;
}

.draft {
  border: 1px solid var(--border);
}
</style>
