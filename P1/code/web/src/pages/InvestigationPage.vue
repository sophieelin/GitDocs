<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import SourceView from "../components/SourceView.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readFile, readTree, type TreeResponse } from "../github.ts";
import { formatDate, getInvestigation, type Highlight } from "../investigations.ts";
import { createProposal } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

/**
 * One submitted investigation, read-only: its title, each highlighted file's
 * source at its commit with the highlighted lines shaded and their comments,
 * and the code and documentation structures with the highlighted files marked.
 */
const route = useRoute();
const repository = useCurrentRepository();
const id = computed(() => String(route.params.investigation));

type Detail = {
  owner: string;
  name: string;
  commit: string;
  investigator: string;
  title: string;
  submittedAt: string;
  highlights: Highlight[];
};
const investigation = ref<Detail | null>(null);
const structures = ref<TreeResponse | null>(null);
const error = ref<string | null>(null);

/** Each file's text at the investigation's commit once read, or why it could not be read. */
type FileText = { text: string; truncated: boolean } | { error: string };
const texts = ref<Record<string, FileText>>({});
/** The documentation file whose Markdown is shown. */
const active = ref<string | null>(null);

/** The highlighted files, each once, in the order first highlighted. */
function filesOf(detail: Detail): string[] {
  return [...new Set(detail.highlights.map((item) => item.path))];
}

async function loadText(detail: Detail, path: string) {
  const answer = await readFile(detail.owner, detail.name, detail.commit, path);
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

/** Shows a documentation file's Markdown at the investigation's commit. */
function open(path: string) {
  active.value = path;
  if (investigation.value && !texts.value[path]) void loadText(investigation.value, path);
}

const activeText = computed(() => (active.value ? texts.value[active.value] : undefined));

function sameRepository(a: { owner: string; name: string }, b: { owner: string; name: string }): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}

async function load() {
  const found = await getInvestigation(id.value);
  if ("error" in found) {
    if (!handleEndedSession(found.error)) {
      error.value = errorMessage(found.error, { NOT_FOUND: "This investigation does not exist." });
    }
    return;
  }
  // The URL's repository must be the investigation's, so one repository's pages never show another's.
  if (!repository.value || !sameRepository(found.investigation, repository.value)) {
    error.value = "This investigation belongs to another repository.";
    return;
  }
  investigation.value = found.investigation;
  // The first highlighted file is shown at once; with none, the root README is, once the tree is read.
  const first = filesOf(found.investigation)[0];
  if (active.value === null && first) open(first);

  const tree = await readTree(found.investigation.owner, found.investigation.name, found.investigation.commit);
  if ("error" in tree) {
    if (!handleEndedSession(tree.error)) {
      error.value = errorMessage(tree.error, { ...gitHubErrorMessages, NOT_FOUND: "This commit was not found on GitHub." });
    }
    return;
  }
  error.value = null;
  structures.value = tree;
  const readme = tree.tree.files.find((file) => /^readme\.md$/i.test(file.name));
  if (active.value === null && readme) open(readme.path);
}

useRefreshOnFocus(load);
watch([id, repository], () => {
  investigation.value = null;
  structures.value = null;
  texts.value = {};
  active.value = null;
  error.value = null;
  void load();
});

const affectedPaths = computed(() => (investigation.value ? filesOf(investigation.value) : []));

function highlightsOf(path: string): Highlight[] {
  return investigation.value?.highlights.filter((item) => item.path === path) ?? [];
}

function lineLabel({ from, to }: { from: number; to: number }): string {
  return from === to ? `Line ${from}` : `Lines ${from}–${to}`;
}

function isEmpty(folder: TreeResponse["tree"]): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}

const listPath = computed(() => (repository.value ? repositoryPath(repository.value, "/investigations") : "/repositories"));

// "Propose a restructuring": a draft starts from the documentation structure at this investigation's commit.
const router = useRouter();
const proposing = ref(false);
const proposalTitle = ref("");
const proposalError = ref<string | null>(null);
const creating = ref(false);

async function startProposal() {
  if (!structures.value || !repository.value) return;
  const title = proposalTitle.value.trim();
  if (title === "") {
    proposalError.value = "Give the proposal a title.";
    return;
  }
  creating.value = true;
  const result = await createProposal(id.value, title, structures.value.tree);
  creating.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      proposalError.value = errorMessage(result.error, {
        NOT_FOUND: "This investigation no longer exists.",
        INVALID_REQUEST: "Keep the title to 120 characters.",
      });
    }
    return;
  }
  await router.push(repositoryPath(repository.value, `/proposals/${result.proposal}/edit`));
}
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="listPath">← All investigations</RouterLink></p>
    <template v-if="investigation">
      <h1 class="page-title">{{ investigation.title }}</h1>
      <p class="page-subtitle">
        Submitted by {{ investigation.investigator }} · {{ formatDate(investigation.submittedAt) }} · commit
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/commits/${investigation.commit}`)" class="commit-link">
          <code>{{ investigation.commit.slice(0, 7) }}</code> — see what it changed
        </RouterLink>
      </p>
    </template>
    <h1 v-else-if="!error" class="page-title">Investigation</h1>
    <ErrorBanner :message="error" />

    <div v-if="investigation && !error" class="propose">
      <button v-if="!proposing" type="button" class="button" :disabled="!structures" @click="proposing = true">
        Propose a restructuring
      </button>
      <form v-else class="card propose-form" @submit.prevent="startProposal">
        <label>
          <span>Proposal title</span>
          <input v-model="proposalTitle" name="proposal-title" maxlength="120" placeholder="What should the documentation look like?" />
        </label>
        <button type="submit" class="button" :disabled="creating">{{ creating ? "Starting…" : "Start proposal" }}</button>
        <button type="button" class="link" @click="proposing = false">Cancel</button>
        <ErrorBanner :message="proposalError" />
      </form>
    </div>

    <p v-if="structures?.truncated" class="warning" role="status">
      This repository is very large, and GitHub returned only part of it. Some files may be missing.
    </p>
    <template v-if="investigation && !error">
      <p v-if="investigation.highlights.length === 0" class="muted">
        This investigation has no highlights: it was saved before highlights existed.
      </p>
      <div class="workspace">
        <div class="card scroll">
          <h2>Documentation Structure</h2>
          <p class="muted hint">Click a file to see its Markdown. Highlighted files are shaded.</p>
          <p v-if="!structures" class="muted">Loading the documentation at this commit from GitHub…</p>
          <p v-else-if="isEmpty(structures.tree)" class="muted">There are no Markdown files at this commit.</p>
          <TreeView v-else :folder="structures.tree" openable :active="active" :marked="affectedPaths" @open="open" />
        </div>

        <div class="card source-panel">
          <template v-if="active">
            <h2><code>{{ active }}</code></h2>
            <div class="file-body">
              <div>
                <p v-if="!activeText" class="muted">Loading the Markdown at this commit from GitHub…</p>
                <p v-else-if="'error' in activeText" class="muted">{{ activeText.error }}</p>
                <template v-else>
                  <SourceView :text="activeText.text" :highlights="highlightsOf(active)" />
                  <p v-if="activeText.truncated" class="muted">This file is very long; only its beginning is shown.</p>
                </template>
              </div>
              <ul v-if="highlightsOf(active).length > 0" class="highlights">
                <li v-for="(item, index) in highlightsOf(active)" :key="index">
                  <strong>{{ lineLabel(item) }}</strong>
                  <p>{{ item.comment }}</p>
                </li>
              </ul>
            </div>
          </template>
          <p v-else class="muted">Click a documentation file on the left to see its Markdown here.</p>
        </div>
      </div>

      <details class="card code">
        <summary>Code Structure</summary>
        <p v-if="!structures" class="muted">Loading the code at this commit from GitHub…</p>
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

.back a {
  color: var(--ink-faint);
  text-decoration: none;
}

.back a:hover {
  color: var(--accent);
}

.commit-link {
  color: var(--accent);
}

.commit-link code {
  font-weight: 600;
}

.propose {
  margin-bottom: 20px;
}

.propose-form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  max-width: 820px;
}

.propose-form label {
  display: grid;
  flex: 1;
  gap: 6px;
  font-weight: 600;
}

.propose-form input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-weight: normal;
}

.propose-form .link {
  padding: 0;
  border: none;
  background: none;
  color: var(--ink-faint);
  font: inherit;
  cursor: pointer;
}

/* The tree on the left, the open file's Markdown beside it. */
.workspace {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

.hint {
  margin: -8px 0 12px;
  font-size: 14px;
}

.source-panel h2 code {
  color: var(--accent);
}

/* The Markdown, with its comments beside it. */
.file-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: start;
}

.highlights {
  width: 260px;
}

.code summary {
  font-weight: 600;
  cursor: pointer;
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
  overflow-wrap: anywhere;
}

/* A large repository's tree can be long; it scrolls on its own. */
.scroll {
  max-height: 80vh;
  overflow: auto;
}

.warning {
  padding: 10px 14px;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
}
</style>
