<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DiffView from "../components/DiffView.vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readCommit, readTree, type ChangedFile, type CommitResponse } from "../github.ts";
import { formatDate, listCommitProposals, startProposal } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";

/**
 * One commit: its message, whether it changes the documentation, every file it
 * changed with its diff, and the proposals made for it. Investigate asks for a
 * title and starts a draft proposal from the documentation at this commit.
 */
const route = useRoute();
const router = useRouter();
const repository = useCurrentRepository();
const session = useSession();
const sha = computed(() => String(route.params.sha));

type Summary = { proposal: string; author: string; title: string; status: string; updatedAt: string };
const result = ref<CommitResponse | null>(null);
const proposals = ref<Summary[] | null>(null);
const error = ref<string | null>(null);
const open = ref(new Set<string>());

async function load() {
  if (!repository.value) return;
  const answer = await readCommit(repository.value.owner, repository.value.name, sha.value);
  if ("error" in answer) {
    if (!handleEndedSession(answer.error)) {
      error.value = errorMessage(answer.error, { ...gitHubErrorMessages, NOT_FOUND: "This commit was not found on GitHub." });
    }
    return;
  }
  error.value = null;
  result.value = answer;

  const listed = await listCommitProposals(repository.value, answer.commit.sha);
  if ("error" in listed) {
    if (!handleEndedSession(listed.error)) proposals.value = [];
    return;
  }
  // Every submitted proposal, and the user's own drafts, the most recently changed first.
  const { submitted, drafts } = listed.commit;
  proposals.value = [
    ...submitted,
    ...drafts.map((item) => ({ ...item, author: session.username ?? "", status: "DRAFT" })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

useRefreshOnFocus(load);
watch([sha, repository], () => {
  result.value = null;
  proposals.value = null;
  investigating.value = false;
  error.value = null;
  open.value = new Set();
  void load();
});

const title = computed(() => result.value?.commit.message.split("\n")[0] ?? "");
const body = computed(() => result.value?.commit.message.split("\n").slice(1).join("\n").trim() ?? "");

function toggle(path: string) {
  const next = new Set(open.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  open.value = next;
}

const statusLabel: Record<ChangedFile["status"], string> = {
  added: "Added",
  modified: "Modified",
  removed: "Removed",
  renamed: "Renamed",
  copied: "Copied",
};

// Investigate: a draft starts from the documentation structure at this commit.
const investigating = ref(false);
const proposalTitle = ref("");
const startError = ref<string | null>(null);
const starting = ref(false);

async function investigate() {
  if (!repository.value || !result.value) return;
  const title = proposalTitle.value.trim();
  if (title === "") {
    startError.value = "Give the proposal a title.";
    return;
  }
  starting.value = true;
  const commit = result.value.commit.sha;
  const tree = await readTree(repository.value.owner, repository.value.name, commit);
  if ("error" in tree) {
    starting.value = false;
    if (!handleEndedSession(tree.error)) {
      startError.value = errorMessage(tree.error, { ...gitHubErrorMessages, NOT_FOUND: "This commit was not found on GitHub." });
    }
    return;
  }
  const started = await startProposal(repository.value, commit, title, tree.tree);
  starting.value = false;
  if ("error" in started) {
    if (!handleEndedSession(started.error)) {
      startError.value = errorMessage(started.error, { INVALID_REQUEST: "Keep the title to 120 characters." });
    }
    return;
  }
  await router.push(repositoryPath(repository.value, `/proposals/${started.proposal}/edit`));
}

function proposalPath(item: Summary): string {
  if (!repository.value) return "/repositories";
  const edit = item.status === "DRAFT" ? "/edit" : "";
  return repositoryPath(repository.value, `/proposals/${item.proposal}${edit}`);
}

const homePath = computed(() => (repository.value ? repositoryPath(repository.value) : "/repositories"));
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="homePath">← All commits</RouterLink></p>
    <ErrorBanner :message="error" />
    <p v-if="!result && !error" class="muted">Loading the commit from GitHub…</p>

    <template v-if="result">
      <div class="heading">
        <div>
          <h1 class="page-title">{{ title }}</h1>
          <p class="page-subtitle">
            <code>{{ result.commit.sha.slice(0, 7) }}</code> · {{ result.commit.author }}
            <template v-if="result.commit.date"> · {{ formatDate(result.commit.date) }}</template>
          </p>
        </div>
        <button v-if="!investigating" type="button" class="button investigate" @click="investigating = true">Investigate</button>
      </div>
      <form v-if="investigating" class="card start" @submit.prevent="investigate">
        <label>
          <span>Proposal title</span>
          <input v-model="proposalTitle" name="proposal-title" maxlength="120" placeholder="What should change in the documentation?" />
        </label>
        <button type="submit" class="button" :disabled="starting">{{ starting ? "Starting…" : "Start proposal" }}</button>
        <button type="button" class="link" @click="investigating = false">Cancel</button>
        <ErrorBanner :message="startError" />
      </form>
      <pre v-if="body" class="body">{{ body }}</pre>

      <p class="docs-flag" :class="{ yes: result.changesDocumentation }">
        {{ result.changesDocumentation ? "This commit changes the documentation." : "This commit does not change the documentation." }}
      </p>

      <div class="card">
        <h2>{{ result.commit.files.length }} changed {{ result.commit.files.length === 1 ? "file" : "files" }}</h2>
        <p v-if="result.commit.truncated" class="warning" role="status">
          GitHub listed only some of this commit's files.
        </p>
        <p v-if="result.commit.files.length === 0" class="muted">This commit changed no files.</p>
        <ul class="files">
          <li v-for="file in result.commit.files" :key="file.path" class="file">
            <button type="button" class="file-row" :aria-expanded="open.has(file.path)" @click="toggle(file.path)">
              <span class="caret" aria-hidden="true">{{ open.has(file.path) ? "▾" : "›" }}</span>
              <span class="status" :class="file.status">{{ statusLabel[file.status] }}</span>
              <span class="path">
                <template v-if="file.previousPath">{{ file.previousPath }} → </template>{{ file.path }}
              </span>
              <span class="counts"><span class="plus">+{{ file.additions }}</span> <span class="minus">−{{ file.deletions }}</span></span>
            </button>
            <template v-if="open.has(file.path)">
              <DiffView v-if="file.patch" :patch="file.patch" />
              <p v-else class="muted no-diff">GitHub shows no diff for this file (it is binary, too large, or only moved).</p>
            </template>
          </li>
        </ul>
      </div>

      <div class="card proposals">
        <h2>Proposals for this commit</h2>
        <p v-if="!proposals" class="muted">Loading…</p>
        <p v-else-if="proposals.length === 0" class="muted">None yet. Choose "Investigate" to start one.</p>
        <ul v-else>
          <li v-for="item in proposals" :key="item.proposal">
            <RouterLink :to="proposalPath(item)" class="proposal-row">
              <span class="proposal-title">{{ item.title }} <StatusBadge :status="item.status" /></span>
              <span class="muted">{{ item.author }} · {{ formatDate(item.updatedAt) }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
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

.heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 20px;
}

.page-subtitle code {
  color: var(--accent);
  font-weight: 600;
}

.investigate {
  flex-shrink: 0;
  text-decoration: none;
}

.start {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  margin-bottom: 20px;
}

.start label {
  display: grid;
  flex: 1;
  gap: 6px;
  min-width: 260px;
  font-weight: 600;
}

.start input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-weight: normal;
}

.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}

.proposals {
  margin-top: 20px;
}

.proposals ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.proposals li + li {
  margin-top: 8px;
}

.proposal-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--ink);
  text-decoration: none;
}

.proposal-row:hover {
  border-color: var(--accent);
}

.proposal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.body {
  margin: -12px 0 20px;
  color: var(--ink-soft);
  font-family: inherit;
  white-space: pre-wrap;
}

.docs-flag {
  display: inline-block;
  margin: 0 0 20px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--sidebar);
  color: var(--ink-soft);
  font-weight: 600;
}

.docs-flag.yes {
  background: var(--accent-soft);
  color: var(--accent);
}

.files {
  margin: 0;
  padding: 0;
  list-style: none;
}

.file {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.file + .file {
  margin-top: 8px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.file-row:hover {
  background: var(--hover);
}

.caret {
  width: 12px;
  color: var(--ink-faint);
}

.status {
  min-width: 72px;
  font-size: 13px;
  font-weight: 600;
}

.status.added {
  color: #116329;
}

.status.removed {
  color: #82071e;
}

.status.modified,
.status.renamed,
.status.copied {
  color: #9a6700;
}

.path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mono);
  font-size: 14px;
}

.counts {
  font-size: 13px;
  white-space: nowrap;
}

.plus {
  color: #116329;
}

.minus {
  color: #82071e;
}

.no-diff {
  margin: 0;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

.warning {
  padding: 10px 14px;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
}
</style>
