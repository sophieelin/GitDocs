<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readFile } from "../github.ts";
import type { Highlight } from "../proposals.ts";
import ErrorBanner from "./ErrorBanner.vue";
import SourceView, { type TextRange } from "./SourceView.vue";
import type { Draft } from "./SuggestionEditor.vue";

/** The editor is loaded only when suggesting first starts, so pages that only read stay small. */
const SuggestionEditor = defineAsyncComponent(() => import("./SuggestionEditor.vue"));

/**
 * One file's text at a commit, documentation or code, with the proposal's
 * highlights in it shaded, its suggestions struck through with their new text
 * after them in [brackets], and their comments beside it.
 *
 * With `add`, the file itself is edited, as in a document's suggesting mode,
 * and each run of edits is saved as a suggestion with a comment saying why.
 * With `remove`, each highlight can be removed. Each answers an error message,
 * or null once it is done.
 *
 * With `investigate`, saving adds the suggestion to an investigation not yet
 * started, rather than to a proposal.
 */
const props = withDefaults(
  defineProps<{
    owner: string;
    name: string;
    commit: string;
    path: string;
    highlights: Highlight[];
    add?: (highlight: Required<TextRange> & { text: string; kind: Highlight["kind"]; replacement: string }) => Promise<string | null>;
    remove?: (highlight: string) => Promise<string | null>;
    investigate?: boolean;
  }>(),
  { add: undefined, remove: undefined, investigate: false },
);

const text = ref<{ text: string; truncated: boolean } | null>(null);
const error = ref<string | null>(null);

const comments = computed(() => props.highlights.filter((item) => item.kind === "COMMENT"));
const suggestions = computed(() => props.highlights.filter((item) => item.kind === "SUGGESTION"));

/** Edits not yet saved as suggestions, and the reason written for each. */
const drafts = ref<Draft[]>([]);
const reasons = ref<Record<number, string>>({});
/** The text selected in the editor, which a comment box opens on at once, and the comment being written. */
const picked = ref<Required<TextRange> | null>(null);
const note = ref("");
const editor = ref<{ discard: (key: number) => void } | null>(null);
const commentError = ref<string | null>(null);
const busy = ref(false);

/** A file too long to read whole cannot be edited, since its end is not known. */
const canSuggest = computed(() => props.add !== undefined && text.value !== null && !text.value.truncated);

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
  if (answer.binary) {
    error.value = "This file is not text, so it cannot be shown.";
    return;
  }
  text.value = { text: answer.text, truncated: answer.truncated };
}

// One string, so the file is read again only when it is another file, not on every new array.
watch(() => `${props.owner}/${props.name}@${props.commit}:${props.path}`, load, { immediate: true });

// The edits belong to the file they were made in.
watch(
  () => props.path,
  () => {
    drafts.value = [];
    reasons.value = {};
    picked.value = null;
    note.value = "";
    commentError.value = null;
  },
);

/** A new selection moves the comment box; an empty one closes it, unless a comment is being written. */
function pick(range: Required<TextRange> | null) {
  if (range || note.value.trim() === "") picked.value = range;
}

async function saveComment() {
  if (!props.add || !picked.value) return;
  const comment = note.value.trim();
  if (comment === "") {
    commentError.value = "Write a comment first.";
    return;
  }
  busy.value = true;
  const failed = await props.add({ ...picked.value, text: comment, kind: "COMMENT", replacement: "" });
  busy.value = false;
  commentError.value = failed;
  if (!failed) cancelComment();
}

function cancelComment() {
  picked.value = null;
  note.value = "";
  commentError.value = null;
}

/** Saves a run of edits as a suggestion; the editor then shows it as saved. */
async function saveDraft(edit: Draft) {
  if (!props.add) return;
  const reason = (reasons.value[edit.key] ?? "").trim();
  if (reason === "") {
    commentError.value = "Say why the text should change.";
    return;
  }
  busy.value = true;
  const failed = await props.add({ ...edit.range, text: reason, kind: "SUGGESTION", replacement: edit.replacement });
  busy.value = false;
  commentError.value = failed;
  if (!failed) delete reasons.value[edit.key];
}

function discard(edit: Draft) {
  editor.value?.discard(edit.key);
  delete reasons.value[edit.key];
  commentError.value = null;
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

/** Exactly the text a range is on. */
function selected({ from, to, start, end }: Required<TextRange>): string {
  if (!text.value) return "";
  return text.value.text
    .split("\n")
    .slice(from - 1, to)
    .map((line, index, all) => line.slice(index === 0 ? start : 0, index === all.length - 1 ? end : undefined))
    .join("\n");
}

/** Words, shortened to fit beside the file. */
function shorten(words: string): string {
  const flat = words.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 79)}…` : flat;
}

/** The words a highlight is on, shortened to fit beside the file. */
function excerpt(range: Required<TextRange>): string {
  return shorten(selected(range));
}
</script>

<template>
  <div class="panel">
    <h2><code>{{ path }}</code></h2>
    <p v-if="canSuggest" class="muted hint">
      Select text to comment on it, or type in the file to suggest new text.
    </p>
    <p v-else-if="add && text" class="muted hint">This file is too long to edit here.</p>
    <div class="body">
      <div>
        <p v-if="error" class="muted">{{ error }}</p>
        <p v-else-if="!text" class="muted">Loading the file at this commit from GitHub…</p>
        <template v-else>
          <SuggestionEditor
            v-if="canSuggest"
            ref="editor"
            :key="path"
            :text="text.text"
            :suggestions="suggestions"
            @drafts="(list) => (drafts = list)"
            @select="pick"
          />
          <SourceView v-else :text="text.text" :highlights="comments" :suggestions="suggestions" />
          <p v-if="text.truncated" class="muted">This file is very long; only its beginning is shown.</p>
        </template>
      </div>
      <div v-if="highlights.length > 0 || drafts.length > 0 || picked" class="notes">
        <form v-if="picked" class="comment-box draft" @submit.prevent="saveComment">
          <div class="field">
            <span>{{ lineLabel(picked) }} · comment</span>
            <q v-if="excerpt(picked)" class="quote">{{ excerpt(picked) }}</q>
          </div>
          <label>
            <span>Comment</span>
            <textarea v-model="note" name="comment" rows="2" maxlength="2000" placeholder="What about this text?" />
          </label>
          <div class="actions">
            <button type="submit" class="button" :disabled="busy">Comment</button>
            <button type="button" class="button secondary" :disabled="busy" @click="cancelComment">Cancel</button>
          </div>
        </form>
        <form v-for="(edit, index) in drafts" :key="edit.key" class="comment-box draft" @submit.prevent="saveDraft(edit)">
          <div class="field">
            <span><span class="number">{{ index + 1 }}</span> {{ lineLabel(edit.range) }} · not saved</span>
            <del v-if="edit.original" class="quote">{{ shorten(edit.original) }}</del>
            <ins class="quote">{{ edit.replacement === "" ? "(delete)" : `[${shorten(edit.replacement)}]` }}</ins>
          </div>
          <label>
            <span>Why</span>
            <textarea v-model="reasons[edit.key]" name="why" rows="2" maxlength="2000" placeholder="Why should the text change? Needed." />
          </label>
          <div class="actions">
            <button type="submit" class="button" :disabled="busy">{{ investigate ? "Add" : "Save suggestion" }}</button>
            <button type="button" class="button secondary" :disabled="busy" @click="discard(edit)">Discard</button>
          </div>
        </form>
        <ErrorBanner :message="commentError" />
        <ul class="list">
          <li v-for="item in highlights" :key="item.highlight" :class="item.kind === 'SUGGESTION' ? 'suggestion' : 'highlight'">
            <strong>{{ item.kind === "SUGGESTION" ? "Suggestion · " : "" }}{{ lineLabel(item) }}</strong>
            <template v-if="item.kind === 'SUGGESTION'">
              <del v-if="excerpt(item)" class="quote">{{ excerpt(item) }}</del>
              <ins class="quote">{{ item.replacement === "" ? "(delete)" : `[${shorten(item.replacement)}]` }}</ins>
            </template>
            <q v-else-if="excerpt(item)" class="quote">{{ excerpt(item) }}</q>
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

/* An edit not yet saved, numbered as in the file. */
.draft {
  padding: 8px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
}

.draft ins.quote {
  color: var(--accent);
}

.number {
  display: inline-block;
  min-width: 1.4em;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  font-size: 12px;
  text-align: center;
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

.suggestion {
  border-left: 3px solid #16a34a;
  background: #f0fdf4;
}

del.quote {
  color: #991b1b;
}

ins.quote {
  color: #166534;
  font-style: normal;
  text-decoration: none;
}

.field {
  display: grid;
  gap: 6px;
  font-weight: 600;
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
