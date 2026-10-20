<script setup lang="ts">
import { ref, watch } from "vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readFile } from "../github.ts";
import type { Highlight } from "../proposals.ts";
import ErrorBanner from "./ErrorBanner.vue";
import SourceView, { type TextRange } from "./SourceView.vue";

/**
 * One documentation file's Markdown at a commit, with the proposal's
 * highlights in it shaded and their comments beside it.
 *
 * With `add`, text can be selected (drag over it, or click a line) and
 * highlighted with a comment; with `remove`, each highlight can be removed.
 * Each answers an error message, or null once it is done.
 */
const props = withDefaults(
  defineProps<{
    owner: string;
    name: string;
    commit: string;
    path: string;
    highlights: Highlight[];
    add?: (highlight: Required<TextRange> & { text: string }) => Promise<string | null>;
    remove?: (highlight: string) => Promise<string | null>;
  }>(),
  { add: undefined, remove: undefined },
);

const text = ref<{ text: string; truncated: boolean } | null>(null);
const error = ref<string | null>(null);

/** The text selected but not yet commented on. */
const selection = ref<Required<TextRange> | null>(null);
const draft = ref("");
const commentError = ref<string | null>(null);
const busy = ref(false);

async function load() {
  const { owner, name, commit, path } = props;
  text.value = null;
  error.value = null;
  const answer = await readFile(owner, name, commit, path);
  // Another file may have been opened while this one was read.
  if (path !== props.path) return;
  if ("error" in answer) {
    if (!handleEndedSession(answer.error)) {
      error.value = errorMessage(answer.error, { ...gitHubErrorMessages, NOT_FOUND: "This file is not in the repository at this commit." });
    }
    return;
  }
  text.value = { text: answer.text, truncated: answer.truncated };
}

// One string, so the file is read again only when it is another file, not on every new array.
watch(() => `${props.owner}/${props.name}@${props.commit}:${props.path}`, load, { immediate: true });

// A selection belongs to the file it was made in.
watch(() => props.path, cancel);

function cancel() {
  selection.value = null;
  draft.value = "";
  commentError.value = null;
}

async function addComment() {
  if (!props.add || !selection.value) return;
  if (draft.value.trim() === "") {
    commentError.value = "Write a comment for the selected lines.";
    return;
  }
  busy.value = true;
  const failed = await props.add({ ...selection.value, text: draft.value.trim() });
  busy.value = false;
  if (failed) {
    commentError.value = failed;
    return;
  }
  cancel();
}

async function removeHighlight(highlight: string) {
  if (!props.remove) return;
  busy.value = true;
  commentError.value = await props.remove(highlight);
  busy.value = false;
}

function lineLabel({ from, to }: { from: number; to: number }): string {
  return from === to ? `Line ${from}` : `Lines ${from}–${to}`;
}

/** The words a comment is on, shortened to fit beside the Markdown. */
function excerpt({ from, to, start, end }: Required<TextRange>): string {
  if (!text.value) return "";
  const words = text.value.text
    .split("\n")
    .slice(from - 1, to)
    .map((line, index, all) => line.slice(index === 0 ? start : 0, index === all.length - 1 ? end : undefined))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return words.length > 80 ? `${words.slice(0, 79)}…` : words;
}
</script>

<template>
  <div class="panel">
    <h2><code>{{ path }}</code></h2>
    <p v-if="add && text" class="muted hint">Select any text to highlight it, or click a line to highlight the whole line, and say why it no longer holds.</p>
    <div class="body">
      <div>
        <p v-if="error" class="muted">{{ error }}</p>
        <p v-else-if="!text" class="muted">Loading the Markdown at this commit from GitHub…</p>
        <template v-else>
          <SourceView
            :text="text.text"
            :highlights="highlights"
            :selectable="add !== undefined"
            :selection="selection"
            @select="(range) => (selection = range)"
          />
          <p v-if="text.truncated" class="muted">This file is very long; only its beginning is shown.</p>
        </template>
      </div>
      <div v-if="highlights.length > 0 || selection" class="notes">
        <form v-if="selection" class="comment-box" @submit.prevent="addComment">
          <label>
            <span>{{ lineLabel(selection) }}</span>
            <q v-if="excerpt(selection)" class="quote">{{ excerpt(selection) }}</q>
            <textarea v-model="draft" name="comment" rows="3" maxlength="2000" placeholder="What should change here, and why?" />
          </label>
          <div class="actions">
            <button type="submit" class="button" :disabled="busy">Add highlight</button>
            <button type="button" class="button secondary" :disabled="busy" @click="cancel">Cancel</button>
          </div>
        </form>
        <ErrorBanner :message="commentError" />
        <ul class="list">
          <li v-for="item in highlights" :key="item.highlight" class="highlight">
            <strong>{{ lineLabel(item) }}</strong>
            <q v-if="excerpt(item)" class="quote">{{ excerpt(item) }}</q>
            <p>{{ item.text }}</p>
            <button v-if="remove" type="button" class="link" :disabled="busy" @click="removeHighlight(item.highlight)">Remove</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel h2 code {
  color: var(--accent);
}

.hint {
  margin: -8px 0 12px;
  font-size: 14px;
}

/* The Markdown, with its comments beside it. */
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: start;
}

.notes {
  display: grid;
  gap: 10px;
  width: 260px;
}

.list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.list li {
  padding: 8px 12px;
}

.highlight {
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.list p {
  margin: 4px 0 0;
  color: var(--ink-soft);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.quote {
  display: block;
  margin-top: 4px;
  color: var(--ink-faint);
  font-size: 13px;
  font-style: italic;
  font-weight: normal;
  overflow-wrap: anywhere;
}

.comment-box {
  display: grid;
  gap: 8px;
}

.comment-box label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}

.comment-box textarea {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-weight: normal;
  resize: vertical;
}

.actions {
  display: flex;
  gap: 8px;
}

.link {
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  color: #b91c1c;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
</style>
