<script setup lang="ts">
import { ref } from "vue";
import type { DocumentationFolder } from "../github.ts";

/**
 * Shows one folder's contents in the UI sketches' style (`› docs/`): its own
 * files first, so a file is never separated from its folder by a subtree, then
 * each subfolder, which collapses when clicked. Calls itself for each subfolder.
 *
 * With `openable`, each file name is a button that emits `open`, and the
 * `active` file is shown as open. Files in `marked` are highlighted (affected
 * by an investigation).
 */
const props = withDefaults(
  defineProps<{ folder: DocumentationFolder; openable?: boolean; active?: string | null; marked?: string[] }>(),
  { openable: false, active: null, marked: () => [] },
);
const emit = defineEmits<{ open: [path: string] }>();

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
    <li
      v-for="file in folder.files"
      :key="file.path"
      class="file"
      :class="{ marked: isMarked(file.path), active: active === file.path }"
      :title="file.path"
    >
      <button v-if="openable" type="button" class="open" :data-path="file.path" @click="emit('open', file.path)">
        {{ file.name }}
      </button>
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
        :openable="openable"
        :active="active"
        :marked="marked"
        class="nested"
        @open="(path) => emit('open', path)"
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

.file.active {
  outline: 2px solid var(--accent);
  border-radius: 4px;
}

.open {
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.open:hover {
  color: var(--accent);
  text-decoration: underline;
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
