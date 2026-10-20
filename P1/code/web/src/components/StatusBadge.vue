<script setup lang="ts">
import { computed } from "vue";

/** A proposal's status as a coloured label. */
const props = defineProps<{ status: string }>();

const labels: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Under review",
  APPROVED: "Approved",
  APPLIED: "Applied",
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

.submitted {
  background: #fef3c7;
  color: #92400e;
}

.approved {
  background: #dcfce7;
  color: #166534;
}

.applied {
  background: var(--accent-soft);
  color: var(--accent);
}

.draft {
  border: 1px solid var(--border);
}
</style>
