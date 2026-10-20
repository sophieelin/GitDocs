<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import MarkdownPanel from "../components/MarkdownPanel.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, listCommits, readTree, type CommitsResponse, type TreeResponse } from "../github.ts";
import { highlightProposal, startProposal } from "../proposals.ts";
import { rememberRepository } from "../recentRepositories.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";

/**
 * A repository's Home, laid out like an editor: the Code Structure at the
 * newest commit on the left, and the open file on the right. Selecting text in
 * the file and choosing Investigate starts a proposal with that highlight,
 * without going through a commit's diff. Recent commits are listed below.
 */
const repository = useCurrentRepository();
const session = useSession();
const router = useRouter();

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
  // The root README is open at first, as on GitHub.
  reading.value ??= tree.code.files.find((file) => /^readme(\.|$)/i.test(file.name))?.path ?? null;
}

/** The file shown beside the Code Structure. */
const reading = ref<string | null>(null);

useRefreshOnFocus(load);
watch([owner, name], () => {
  commits.value = null;
  documentation.value = null;
  reading.value = null;
  error.value = null;
  void load();
});

/**
 * Starts a proposal at the newest commit from the documentation as it is, saves
 * the selection as its first highlight, and opens the proposal editor.
 */
async function investigate(highlight: { from: number; to: number; start: number; end: number; text: string; title: string }): Promise<string | null> {
  const newest = commits.value?.[0];
  if (!repository.value || !documentation.value || !newest || !reading.value) return null;
  const started = await startProposal(repository.value, newest.sha, highlight.title, documentation.value.tree);
  if ("error" in started) {
    return handleEndedSession(started.error) ? null : errorMessage(started.error, { INVALID_REQUEST: "Keep the title to 120 characters." });
  }
  const { title: _title, ...range } = highlight;
  // The draft exists now; if the highlight is refused, it can be added again in the editor.
  await highlightProposal(started.proposal, { file: reading.value, ...range });
  await router.push(repositoryPath(repository.value, `/proposals/${started.proposal}/edit`));
  return null;
}

function firstLine(message: string): string {
  return message.split("\n")[0] ?? "";
}

function commitPath(sha: string): string {
  return repository.value ? repositoryPath(repository.value, `/commits/${sha}`) : "/repositories";
}

function isEmptyFolder(folder: TreeResponse["tree"]): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}

const isCodeEmpty = computed(() => documentation.value !== null && isEmptyFolder(documentation.value.code));
</script>

<template>
  <section>
    <h1 class="page-title">{{ owner }}/{{ name }}</h1>
    <p class="page-subtitle">The code as it is now, and recent commits. Open a file and select text to investigate it.</p>
    <ErrorBanner :message="error" />

    <p v-if="!error && commits && commits[0]" class="muted at">
      Structures at the newest commit, <code>{{ commits[0].sha.slice(0, 7) }}</code>.
    </p>
    <p v-if="!error && documentation?.truncated" class="warning" role="status">
      This repository is very large, and GitHub returned only part of it. Some files may be missing.
    </p>

    <!-- Like an editor: the files on the left, the open one on the right. -->
    <div v-if="!error" class="ide">
      <div class="card scroll">
        <h2>Code Structure</h2>
        <p v-if="!documentation && (!commits || commits.length > 0)" class="muted">Loading the repository from GitHub…</p>
        <template v-else-if="documentation">
          <p v-if="isCodeEmpty" class="muted">There are no files yet.</p>
          <TreeView v-else :folder="documentation.code" openable :active="reading" @open="(path) => (reading = path)" />
        </template>
      </div>

      <MarkdownPanel
        v-if="documentation && commits?.[0] && reading"
        class="card"
        :owner="owner"
        :name="name"
        :commit="commits[0].sha"
        :path="reading"
        :highlights="[]"
        :add="investigate"
        investigate
      />
      <div v-else-if="documentation" class="card">
        <p class="muted">Choose a file in the Code Structure to read it.</p>
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
.ide {
  display: grid;
  grid-template-columns: minmax(200px, 300px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

@media (max-width: 800px) {
  .ide {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* A large repository's code tree can be long; it scrolls on its own, beside the file. */
.scroll {
  position: sticky;
  top: 20px;
  max-height: 75vh;
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
