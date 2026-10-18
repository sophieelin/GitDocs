<script setup lang="ts">
import { ref } from "vue";
import type { DocumentationFolder } from "../github.ts";

/**
 * The proposed structure in the proposal editor. Looks like `TreeView`, but
 * every file and folder can be picked: clicking one emits `select`, and the
 * editor's toolbar then renames, moves, or removes it. The caret collapses a
 * folder without picking it. Calls itself for each subfolder.
 */
export type Picked = { path: string; kind: "file" | "folder" };

defineProps<{ folder: DocumentationFolder; selected: Picked | null }>();
const emit = defineEmits<{ select: [picked: Picked] }>();

const collapsed = ref(new Set<string>());

function toggleFolder(path: string) {
  const next = new Set(collapsed.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsed.value = next;
}
</script>

<template>
  <ul class="tree">
    <li v-for="file in folder.files" :key="file.path" class="file">
      <button
        type="button"
        class="entry"
        :class="{ selected: selected?.path === file.path }"
        :title="file.path"
        :aria-pressed="selected?.path === file.path"
        @click="emit('select', { path: file.path, kind: 'file' })"
      >
        {{ file.name }}
      </button>
    </li>
    <li v-for="child in folder.folders" :key="child.path" class="folder">
      <button
        type="button"
        class="caret"
        :aria-label="collapsed.has(child.path) ? `Expand ${child.name}` : `Collapse ${child.name}`"
        :aria-expanded="!collapsed.has(child.path)"
        @click="toggleFolder(child.path)"
      >
        {{ collapsed.has(child.path) ? "›" : "⌄" }}
      </button>
      <button
        type="button"
        class="entry"
        :class="{ selected: selected?.path === child.path }"
        :title="child.path"
        :aria-pressed="selected?.path === child.path"
        @click="emit('select', { path: child.path, kind: 'folder' })"
      >
        {{ child.name }}/
      </button>
      <p v-if="child.files.length === 0 && child.folders.length === 0" class="empty">empty</p>
      <EditableTree
        v-if="!collapsed.has(child.path)"
        :folder="child"
        :selected="selected"
        class="nested"
        @select="(picked) => emit('select', picked)"
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
  padding: 2px 0;
}

.file {
  padding-left: 18px;
}

.entry,
.caret {
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.caret {
  width: 18px;
  padding: 0;
  color: var(--ink-faint);
}

.entry:hover {
  color: var(--accent);
}

.entry.selected {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.empty {
  display: inline;
  margin: 0 0 0 6px;
  color: var(--ink-faint);
  font-size: 13px;
  font-style: italic;
}
</style>
