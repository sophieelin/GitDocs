<script setup lang="ts">
import { computed } from "vue";

/** Shows one file's unified diff: added lines in green, removed lines in red. */
const props = defineProps<{ patch: string }>();

const lines = computed(() =>
  props.patch.split("\n").map((text) => ({
    text,
    kind: text.startsWith("@@") ? "hunk" : text.startsWith("+") ? "added" : text.startsWith("-") ? "removed" : "context",
  })),
);
</script>

<template>
  <pre class="diff"><code><span v-for="(line, index) in lines" :key="index" class="line" :class="line.kind">{{ line.text || " " }}
</span></code></pre>
</template>

<style scoped>
.diff {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  border-top: 1px solid var(--border);
  background: #fbfcfd;
  font-size: 13px;
  line-height: 1.5;
}

.line {
  display: block;
  padding: 0 14px;
  white-space: pre;
}

.added {
  background: #e6ffec;
  color: #116329;
}

.removed {
  background: #ffebe9;
  color: #82071e;
}

.hunk {
  background: #eef2ff;
  color: var(--ink-faint);
}
</style>
