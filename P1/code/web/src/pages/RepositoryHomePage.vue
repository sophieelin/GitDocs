<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, listCommits, readTree, type CommitsResponse, type TreeResponse } from "../github.ts";
import { rememberRepository } from "../recentRepositories.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";

/** A repository's Home, as in sketch 1: its recent commits and its current documentation structure. */
const repository = useCurrentRepository();
const session = useSession();

const commits = ref<CommitsResponse["commits"] | null>(null);
const documentation = ref<TreeResponse | null>(null);
const error = ref<string | null>(null);

const owner = computed(() => repository.value?.owner ?? "");
const name = computed(() => repository.value?.name ?? "");

async function load() {
  const listed = await listCommits(owner.value, name.value);
  if ("error" in listed) {
    if (!handleEndedSession(listed.error)) error.value = errorMessage(listed.error, gitHubErrorMessages);
    return;
  }
  error.value = null;
  commits.value = listed.commits;
  // Opening a repository by its URL also makes it a recent one.
  rememberRepository(session.username ?? "", { owner: owner.value, name: name.value });

  const newest = listed.commits[0];
  if (!newest) {
    documentation.value = null;
    return;
  }
  const tree = await readTree(owner.value, name.value, newest.sha);
  if ("error" in tree) {
    if (!handleEndedSession(tree.error)) error.value = errorMessage(tree.error, gitHubErrorMessages);
    return;
  }
  documentation.value = tree;
}

useRefreshOnFocus(load);
watch([owner, name], () => {
  commits.value = null;
  documentation.value = null;
  error.value = null;
  void load();
});

function firstLine(message: string): string {
  return message.split("\n")[0] ?? "";
}

function commitPath(sha: string): string {
  return repository.value ? repositoryPath(repository.value, `/commits/${sha}`) : "/repositories";
}

function isEmptyFolder(folder: TreeResponse["tree"]): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}

const isEmpty = computed(() => documentation.value !== null && isEmptyFolder(documentation.value.tree));
const isCodeEmpty = computed(() => documentation.value !== null && isEmptyFolder(documentation.value.code));
</script>

<template>
  <section>
    <h1 class="page-title">{{ owner }}/{{ name }}</h1>
    <p class="page-subtitle">Recent commits, and the code and documentation as they are now.</p>
    <ErrorBanner :message="error" />

    <p v-if="!error && commits && commits[0]" class="muted at">
      Structures at the newest commit, <code>{{ commits[0].sha.slice(0, 7) }}</code>.
    </p>
    <p v-if="!error && documentation?.truncated" class="warning" role="status">
      This repository is very large, and GitHub returned only part of it. Some files may be missing.
    </p>

    <!-- The code and the documentation side by side, as in the pitch's Documentation Map:
         the documentation is what a proposal reorganizes, and the code is the context for it. -->
    <div v-if="!error" class="structures">
      <div class="card scroll">
        <h2>Code Structure</h2>
        <p v-if="!documentation && (!commits || commits.length > 0)" class="muted">Loading the repository from GitHub…</p>
        <template v-else-if="documentation">
          <p v-if="isCodeEmpty" class="muted">There are no files yet.</p>
          <TreeView v-else :folder="documentation.code" />
        </template>
      </div>

      <div class="card scroll">
        <h2>Current Documentation Structure</h2>
        <p v-if="!documentation && (!commits || commits.length > 0)" class="muted">Loading the documentation from GitHub…</p>
        <template v-else-if="documentation">
          <p v-if="isEmpty" class="muted">There are no Markdown files yet.</p>
          <TreeView v-else :folder="documentation.tree" />
        </template>
      </div>
    </div>

    <div v-if="!error" class="columns">
      <div class="card">
        <h2>Recent commits</h2>
        <p v-if="!commits" class="muted">Loading commits from GitHub…</p>
        <p v-else-if="commits.length === 0" class="muted">This repository has no commits yet.</p>
        <ol v-else class="commits">
          <li v-for="commit in commits" :key="commit.sha">
            <!-- Each commit opens its own page, with its changes and the Investigate button. -->
            <RouterLink :to="commitPath(commit.sha)" class="commit" :data-sha="commit.sha">
              <code>{{ commit.sha.slice(0, 7) }}</code>
              <span class="message">{{ firstLine(commit.message) }}</span>
              <span class="open" aria-hidden="true">›</span>
            </RouterLink>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.structures {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

/* A large repository's code tree can be long; each panel scrolls on its own. */
.scroll {
  max-height: 60vh;
  overflow: auto;
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.commits {
  margin: 0;
  padding: 0;
  list-style: none;
}

.commits li {
  border-bottom: 1px solid var(--border);
}

.commit {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 6px;
  color: var(--ink);
  text-decoration: none;
}

.commit:hover {
  background: var(--sidebar);
}

.open {
  color: var(--ink-faint);
}

.commits li:last-child {
  border-bottom: none;
}

code {
  color: var(--accent);
  font-weight: 600;
}

.message {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.at {
  margin-top: -8px;
  font-size: 14px;
}

.warning {
  padding: 10px 14px;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
}
</style>
