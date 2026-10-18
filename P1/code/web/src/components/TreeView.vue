<script setup lang="ts">
import { ref } from "vue";
import type { DocumentationFolder } from "../github.ts";

/**
 * Shows one folder's contents in the UI sketches' style (`› docs/`), read-only:
 * its own files first, so a file is never separated from its folder by a
 * subtree, then each subfolder, which collapses when clicked. Calls itself for
 * each subfolder.
 */
defineProps<{ folder: DocumentationFolder }>();

const collapsed = ref(new Set<string>());

function toggle(path: string) {
  const next = new Set(collapsed.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsed.value = next;
}
</script>

<template>
  <ul class="tree">
    <li v-for="file in folder.files" :key="file.path" class="file" :title="file.path">{{ file.name }}</li>
    <li v-for="child in folder.folders" :key="child.path" class="folder">
      <button
        type="button"
        class="name"
        :title="child.path"
        :aria-expanded="!collapsed.has(child.path)"
        @click="toggle(child.path)"
      >
        <span class="caret" :class="{ open: !collapsed.has(child.path) }" aria-hidden="true">›</span>{{ child.name }}/
      </button>
      <TreeView v-if="!collapsed.has(child.path)" :folder="child" class="nested" />
    </li>
  </ul>
</template>

<style scoped>
.tree {
  margin: 0;
  padding: 0;
  list-style: none;
}

.nested {
  margin-top: 4px;
  padding-left: 22px;
}

li {
  padding: 4px 0;
}

.file {
  padding-left: 18px;
  color: var(--ink);
}

.name {
  padding: 0;
  border: none;
  background: none;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.name:hover {
  color: var(--accent);
}

.caret {
  display: inline-block;
  width: 18px;
  color: var(--ink-faint);
  transition: transform 0.1s;
}
</style>
