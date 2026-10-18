<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, listCommits, readTree, type CommitsResponse, type TreeResponse } from "../github.ts";
import { rememberRepository } from "../recentRepositories.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { useCurrentRepository } from "../repository.ts";
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

const isEmpty = computed(
  () => documentation.value && documentation.value.tree.files.length === 0 && documentation.value.tree.folders.length === 0,
);
</script>

<template>
  <section>
    <h1 class="page-title">{{ owner }}/{{ name }}</h1>
    <p class="page-subtitle">Recent commits and the documentation as it is now.</p>
    <ErrorBanner :message="error" />

    <div v-if="!error" class="columns">
      <div class="card">
        <h2>Recent commits</h2>
        <p v-if="!commits" class="muted">Loading commits from GitHub…</p>
        <p v-else-if="commits.length === 0" class="muted">This repository has no commits yet.</p>
        <ol v-else class="commits">
          <li v-for="commit in commits" :key="commit.sha">
            <code>{{ commit.sha.slice(0, 7) }}</code>
            <span class="message">{{ firstLine(commit.message) }}</span>
          </li>
        </ol>
      </div>

      <div class="card">
        <h2>Current Documentation Structure</h2>
        <p v-if="commits && commits[0]" class="muted at">At the newest commit, <code>{{ commits[0].sha.slice(0, 7) }}</code>.</p>
        <p v-if="!documentation && (!commits || commits.length > 0)" class="muted">Loading the documentation from GitHub…</p>
        <template v-else-if="documentation">
          <p v-if="documentation.truncated" class="warning" role="status">
            This repository is very large, and GitHub returned only part of it. Some documentation may be missing.
          </p>
          <p v-if="isEmpty" class="muted">There are no Markdown files yet.</p>
          <TreeView v-else :folder="documentation.tree" />
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.commits {
  margin: 0;
  padding: 0;
  list-style: none;
}

.commits li {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.commits li:last-child {
  border-bottom: none;
}

code {
  color: var(--accent);
  font-weight: 600;
}

.message {
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
