<script setup lang="ts">
import { ref } from "vue";
import type { DocumentationFolder } from "../github.ts";

/**
 * Shows one folder's contents in the UI sketches' style (`› docs/`): its own
 * files first, so a file is never separated from its folder by a subtree, then
 * each subfolder, which collapses when clicked. Calls itself for each subfolder.
 *
 * With `selectable`, each file has a checkbox and clicking it emits `toggle`.
 * Files in `marked` are highlighted (selected, or affected by an investigation).
 */
const props = withDefaults(defineProps<{ folder: DocumentationFolder; selectable?: boolean; marked?: string[] }>(), {
  selectable: false,
  marked: () => [],
});
const emit = defineEmits<{ toggle: [path: string] }>();

const collapsed = ref(new Set<string>());

function toggleFolder(path: string) {
  const next = new Set(collapsed.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsed.value = next;
}

function isMarked(path: string): boolean {
  return props.marked.includes(path);
}
</script>

<template>
  <ul class="tree">
    <li v-for="file in folder.files" :key="file.path" class="file" :class="{ marked: isMarked(file.path) }" :title="file.path">
      <label v-if="selectable" class="pick">
        <input type="checkbox" :checked="isMarked(file.path)" :data-path="file.path" @change="emit('toggle', file.path)" />
        {{ file.name }}
      </label>
      <template v-else>{{ file.name }}</template>
    </li>
    <li v-for="child in folder.folders" :key="child.path" class="folder">
      <button
        type="button"
        class="name"
        :title="child.path"
        :aria-expanded="!collapsed.has(child.path)"
        @click="toggleFolder(child.path)"
      >
        <span class="caret" aria-hidden="true">›</span>{{ child.name }}/
      </button>
      <TreeView
        v-if="!collapsed.has(child.path)"
        :folder="child"
        :selectable="selectable"
        :marked="marked"
        class="nested"
        @toggle="(path) => emit('toggle', path)"
      />
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

.file.marked {
  margin-left: 12px;
  padding-left: 6px;
  border-radius: 4px;
  background: var(--accent-soft);
  font-weight: 600;
}

.pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
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
}
</style>
