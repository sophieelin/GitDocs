<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import SourceView from "../components/SourceView.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readCommit, readFile, readTree, type CommitResponse, type TreeResponse } from "../github.ts";
import { submitInvestigation, type Highlight } from "../investigations.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

/**
 * Writing an investigation of one commit. Clicking a documentation file shows
 * its Markdown source beside the tree; the investigator highlights lines in it
 * and comments on why they do not work. Nothing is saved until Submit: leaving
 * the page discards it.
 */
const route = useRoute();
const router = useRouter();
const repository = useCurrentRepository();
const sha = computed(() => String(route.params.sha));

const commit = ref<CommitResponse["commit"] | null>(null);
const structures = ref<TreeResponse | null>(null);
const loadError = ref<string | null>(null);

const title = ref("");
/** The file whose source is shown. */
const active = ref<string | null>(null);
/** Each file's source once read, or why it could not be read. */
const texts = ref<Record<string, { text: string; truncated: boolean } | { error: string }>>({});
const highlights = ref<Highlight[]>([]);
/** The lines highlighted in the active file but not yet commented on. */
const selection = ref<{ from: number; to: number } | null>(null);
const comment = ref("");
const formError = ref<string | null>(null);
const submitting = ref(false);

async function load() {
  if (!repository.value) return;
  const { owner, name } = repository.value;
  const [commitAnswer, treeAnswer] = await Promise.all([readCommit(owner, name, sha.value), readTree(owner, name, sha.value)]);
  for (const answer of [commitAnswer, treeAnswer]) {
    if ("error" in answer) {
      if (!handleEndedSession(answer.error)) {
        loadError.value = errorMessage(answer.error, { ...gitHubErrorMessages, NOT_FOUND: "This commit was not found on GitHub." });
      }
      return;
    }
  }
  if (!("error" in commitAnswer)) commit.value = commitAnswer.commit;
  if (!("error" in treeAnswer)) {
    structures.value = treeAnswer;
    // The root README is where most investigations start, so it is shown first.
    const readme = treeAnswer.tree.files.find((file) => /^readme\.md$/i.test(file.name));
    if (readme && active.value === null) open(readme.path);
  }
}

void load();
watch([sha, repository], () => {
  commit.value = null;
  structures.value = null;
  loadError.value = null;
  active.value = null;
  texts.value = {};
  highlights.value = [];
  selection.value = null;
  void load();
});

// A message about the form is stale as soon as the form changes.
watch([title, highlights, selection], () => (formError.value = null), { deep: true });

async function loadText(path: string) {
  if (!repository.value) return;
  const answer = await readFile(repository.value.owner, repository.value.name, sha.value, path);
  if ("error" in answer) {
    if (handleEndedSession(answer.error)) return;
    texts.value = {
      ...texts.value,
      [path]: { error: errorMessage(answer.error, { ...gitHubErrorMessages, NOT_FOUND: "This file is not in the repository at this commit." }) },
    };
    return;
  }
  texts.value = { ...texts.value, [path]: { text: answer.text, truncated: answer.truncated } };
}

/** Shows a file's source. An uncommented highlight in the previous file is dropped. */
function open(path: string) {
  if (active.value === path) return;
  active.value = path;
  selection.value = null;
  comment.value = "";
  if (!texts.value[path]) void loadText(path);
}

const activeText = computed(() => (active.value ? texts.value[active.value] : undefined));

/** The files with at least one highlight, marked in the tree. */
const highlightedFiles = computed(() => [...new Set(highlights.value.map((item) => item.path))]);

function highlightsOf(path: string): Highlight[] {
  return highlights.value.filter((item) => item.path === path);
}

function addHighlight() {
  if (!selection.value || !active.value) return;
  if (comment.value.trim() === "") {
    formError.value = "Say why the highlighted lines do not work.";
    return;
  }
  highlights.value.push({ path: active.value, ...selection.value, comment: comment.value.trim() });
  selection.value = null;
  comment.value = "";
}

function cancelSelection() {
  selection.value = null;
  comment.value = "";
}

function removeHighlight(item: Highlight) {
  highlights.value = highlights.value.filter((other) => other !== item);
}

function lineLabel({ from, to }: { from: number; to: number }): string {
  return from === to ? `Line ${from}` : `Lines ${from}–${to}`;
}

/** The same rules the concept checks, so the message can say which one failed. */
function problem(): string | null {
  if (title.value.trim() === "") return "Give the investigation a title.";
  if (title.value.trim().length > 120) return "Keep the title to 120 characters.";
  if (selection.value) return "Add a comment for the highlighted lines, or cancel them.";
  if (highlights.value.length === 0) return "Highlight at least one passage and say why it does not work.";
  return null;
}

async function submit() {
  formError.value = problem();
  if (formError.value || !repository.value || !commit.value) return;
  submitting.value = true;
  const result = await submitInvestigation(repository.value, commit.value.sha, {
    title: title.value.trim(),
    highlights: highlights.value,
  });
  submitting.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      formError.value = errorMessage(result.error, {
        INVALID_REQUEST: "Check the title and the highlights.",
      });
    }
    return;
  }
  await router.push(repositoryPath(repository.value, `/investigations/${result.investigation}`));
}

const commitPath = computed(() => (repository.value ? repositoryPath(repository.value, `/commits/${sha.value}`) : "/repositories"));

function isEmpty(folder: TreeResponse["tree"]): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="commitPath">← Back to the commit</RouterLink></p>
    <h1 class="page-title">New investigation</h1>
    <p class="page-subtitle">
      <template v-if="commit">
        Of <code>{{ commit.sha.slice(0, 7) }}</code> “{{ commit.message.split("\n")[0] }}”. Nothing is saved until you submit.
      </template>
      <template v-else>Nothing is saved until you submit.</template>
    </p>
    <ErrorBanner :message="loadError" />

    <template v-if="!loadError">
      <div class="workspace">
        <div class="card scroll">
          <h2>Documentation Structure</h2>
          <p class="muted hint">Click a file to see its Markdown.</p>
          <p v-if="!structures" class="muted">Loading the documentation at this commit…</p>
          <p v-else-if="isEmpty(structures.tree)" class="muted">There are no Markdown files at this commit.</p>
          <TreeView v-else :folder="structures.tree" openable :active="active" :marked="highlightedFiles" @open="open" />
        </div>

        <div class="card source-panel">
          <template v-if="active">
            <h2><code>{{ active }}</code></h2>
            <p class="muted hint">Drag over lines to highlight them, then say why they don't work.</p>
            <p v-if="!activeText" class="muted">Loading the Markdown from GitHub…</p>
            <p v-else-if="'error' in activeText" class="muted">{{ activeText.error }}</p>
            <template v-else>
              <SourceView
                :text="activeText.text"
                :highlights="highlightsOf(active)"
                :selection="selection"
                selectable
                @select="(range) => (selection = { from: range.from, to: range.to })"
              />
              <p v-if="activeText.truncated" class="muted">This file is very long; only its beginning is shown.</p>
            </template>

            <div v-if="selection" class="comment-box">
              <label>
                <span>{{ lineLabel(selection) }}: why don't they work?</span>
                <textarea v-model="comment" name="comment" rows="3" maxlength="2000" placeholder="What is wrong or out of date here?" />
              </label>
              <div class="actions">
                <button type="button" class="button" @click="addHighlight">Add comment</button>
                <button type="button" class="link" @click="cancelSelection">Cancel</button>
              </div>
            </div>

            <ul v-if="highlightsOf(active).length > 0" class="highlights">
              <li v-for="(item, index) in highlightsOf(active)" :key="index">
                <div class="highlight-head">
                  <strong>{{ lineLabel(item) }}</strong>
                  <button type="button" class="link" @click="removeHighlight(item)">Remove</button>
                </div>
                <p>{{ item.comment }}</p>
              </li>
            </ul>
          </template>
          <p v-else class="muted">Click a documentation file on the left to see its Markdown here.</p>
        </div>
      </div>

      <form class="card form" @submit.prevent="submit">
        <label class="field">
          <span>Title</span>
          <input v-model="title" name="title" maxlength="120" placeholder="What did this commit change?" />
        </label>
        <div class="field">
          <span>Highlights</span>
          <p v-if="highlights.length === 0" class="muted">None yet. Highlight lines in a file above and comment on them.</p>
          <ul v-else class="summary">
            <li v-for="(item, index) in highlights" :key="index">
              <button type="button" class="link" @click="open(item.path)">{{ item.path }}</button>
              · {{ lineLabel(item) }}: {{ item.comment }}
            </li>
          </ul>
        </div>

        <ErrorBanner :message="formError" />
        <div class="actions">
          <button type="submit" class="button" :disabled="submitting || !commit">{{ submitting ? "Submitting…" : "Submit investigation" }}</button>
          <RouterLink :to="commitPath" class="cancel">Cancel</RouterLink>
        </div>
      </form>

      <details class="card code">
        <summary>Code Structure</summary>
        <p v-if="!structures" class="muted">Loading the code at this commit…</p>
        <p v-else-if="isEmpty(structures.code)" class="muted">There are no files at this commit.</p>
        <TreeView v-else :folder="structures.code" />
      </details>
    </template>
  </section>
</template>

<style scoped>
.back {
  margin: 0 0 12px;
}

.back a,
.cancel {
  color: var(--ink-faint);
  text-decoration: none;
}

.page-subtitle code {
  color: var(--accent);
  font-weight: 600;
}

/* The tree on the left, the open file's Markdown beside it. */
.workspace {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

.scroll {
  max-height: 80vh;
  overflow: auto;
}

.hint {
  margin: -8px 0 12px;
  font-size: 14px;
}

.source-panel {
  display: grid;
  gap: 12px;
}

.source-panel h2 code {
  color: var(--accent);
}

.source-panel .hint {
  margin: -8px 0 0;
}

.highlight-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.comment-box {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid #93c5fd;
  border-radius: 8px;
  background: #eff6ff;
}

.comment-box label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}

.highlights {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.highlights li {
  padding: 8px 12px;
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.highlights p {
  margin: 4px 0 0;
  color: var(--ink-soft);
  white-space: pre-wrap;
}

.summary {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  overflow-wrap: anywhere;
}

.form {
  display: grid;
  gap: 20px;
  max-width: 820px;
  margin-bottom: 20px;
}

.field {
  display: grid;
  gap: 8px;
}

.field > span {
  font-weight: 600;
}

.code summary {
  font-weight: 600;
  cursor: pointer;
}

input,
textarea {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-weight: normal;
}

textarea {
  resize: vertical;
}

.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
