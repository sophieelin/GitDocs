<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import MarkdownPanel from "../components/MarkdownPanel.vue";
import StatusBadge from "../components/StatusBadge.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import type { DocumentationFolder } from "../github.ts";
import { applyProposal, approveReview, formatDate, getProposal } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";

/**
 * One proposal, read-only: its status, the rationale, its highlights, and both
 * structures. Its author sees "Continue editing" while it is a draft. Once
 * approved, it shows the git commands that make the changes, and its author
 * marks it applied with the commit that did. Another user never reaches
 * someone else's draft: the server answers it as not found.
 */
const route = useRoute();
const repository = useCurrentRepository();
const session = useSession();
const id = computed(() => String(route.params.proposal));

type Detail = Extract<Awaited<ReturnType<typeof getProposal>>, { proposal: unknown }>["proposal"];
const proposal = ref<Detail | null>(null);
const error = ref<string | null>(null);

function sameRepository(a: { owner: string; name: string }, b: { owner: string; name: string }): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}

async function load() {
  const found = await getProposal(id.value);
  if ("error" in found) {
    if (!handleEndedSession(found.error)) {
      error.value = errorMessage(found.error, { NOT_FOUND: "This proposal does not exist." });
    }
    return;
  }
  if (!repository.value || !sameRepository(found.proposal, repository.value)) {
    error.value = "This proposal belongs to another repository.";
    return;
  }
  error.value = null;
  proposal.value = found.proposal;
}

// Reloads when the tab is opened again, so a status change by someone else shows up.
useRefreshOnFocus(load);
watch([id, repository], () => {
  proposal.value = null;
  error.value = null;
  void load();
});

const editable = computed(() => proposal.value?.status === "DRAFT" && proposal.value.author === session.username);

/** The named reviewer sees Approve while their review is pending. */
const canApprove = computed(
  () => proposal.value?.reviewer === session.username && proposal.value.decision === "PENDING" && proposal.value.review !== null,
);
const approveError = ref<string | null>(null);
const approving = ref(false);

async function approve() {
  const review = proposal.value?.review;
  if (!review) return;
  approving.value = true;
  const result = await approveReview(review);
  approving.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      approveError.value = errorMessage(result.error, {
        FORBIDDEN: "Only the reviewer the author named can approve this proposal.",
        CONFLICT: "This proposal has already been approved.",
        NOT_FOUND: "This review no longer exists.",
      });
    }
    return;
  }
  approveError.value = null;
  // The answer has the proposal's new status; reading it again also brings its commands.
  await load();
}

/** The highlighted file whose Markdown is shown. */
const reading = ref<string | null>(null);
const highlightedFiles = computed(() => [...new Set((proposal.value?.highlights ?? []).map((item) => item.path))]);
const readingHighlights = computed(() => (proposal.value?.highlights ?? []).filter((item) => item.path === reading.value));
watch(highlightedFiles, (files) => {
  if (reading.value === null || !files.includes(reading.value)) reading.value = files[0] ?? null;
});

const script = computed(() => (proposal.value?.commands ?? []).map((item) => item.command).join("\n"));
const copied = ref(false);

async function copyCommands() {
  try {
    await navigator.clipboard.writeText(script.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}

/** The author marks an approved proposal applied with the commit that made its changes. */
const canApply = computed(() => proposal.value?.status === "APPROVED" && proposal.value.author === session.username);
const appliedCommit = ref("");
const applyError = ref<string | null>(null);
const applying = ref(false);

async function markApplied() {
  const commit = appliedCommit.value.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    applyError.value = "Paste the full 40-character SHA of the commit that made these changes.";
    return;
  }
  applying.value = true;
  const result = await applyProposal(id.value, commit);
  applying.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      applyError.value = errorMessage(result.error, {
        FORBIDDEN: "Only the proposal's author can mark it applied.",
        CONFLICT: "Only an approved proposal that is not applied yet can be marked applied.",
        INVALID_REQUEST: "Paste the full 40-character SHA of the commit that made these changes.",
        NOT_FOUND: "This proposal no longer exists.",
      });
    }
    return;
  }
  applyError.value = null;
  appliedCommit.value = "";
  await load();
}

function isEmpty(folder: DocumentationFolder): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="repository ? repositoryPath(repository, '/proposals') : '/repositories'">← All proposals</RouterLink></p>
    <template v-if="proposal">
      <div class="heading">
        <h1 class="page-title">{{ proposal.title }}</h1>
        <StatusBadge :status="proposal.status" />
      </div>
      <p class="page-subtitle">
        By {{ proposal.author }} · last changed {{ formatDate(proposal.updatedAt) }} · investigating commit
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/commits/${proposal.commit}`)"><code>{{ proposal.commit.slice(0, 7) }}</code></RouterLink>
      </p>
      <p v-if="editable" class="edit">
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/proposals/${proposal.proposal}/edit`)" class="button">
          Continue editing
        </RouterLink>
        <span class="muted">This draft is visible only to you until you submit it.</span>
      </p>
      <p v-if="proposal.reviewer" class="edit">
        <span v-if="canApprove" class="muted">{{ proposal.author }} asked you to review this proposal.</span>
        <span v-else class="muted">Reviewer: {{ proposal.reviewer }}</span>
        <button v-if="canApprove" type="button" class="button" :disabled="approving" @click="approve">Approve</button>
      </p>
      <ErrorBanner :message="approveError" />
    </template>
    <h1 v-else-if="!error" class="page-title">Proposal</h1>
    <ErrorBanner :message="error" />

    <template v-if="proposal && !error">
      <div class="card rationale">
        <h2>Rationale</h2>
        <p v-if="proposal.rationale === ''" class="muted">No rationale yet.</p>
        <p v-else>{{ proposal.rationale }}</p>
      </div>

      <div v-if="proposal.commands.length > 0" class="card commands">
        <div class="commands-heading">
          <h2>Git commands</h2>
          <button type="button" class="button secondary" @click="copyCommands">{{ copied ? "Copied" : "Copy" }}</button>
        </div>
        <p class="muted hint">
          Run these from the root of a clone of the repository, at or after commit <code>{{ proposal.commit.slice(0, 7) }}</code>.
          New files are created empty: write them before you commit and push.
        </p>
        <pre class="script">{{ script }}</pre>
        <p v-if="proposal.status === 'APPLIED'" class="applied">
          Applied in commit
          <RouterLink v-if="repository" :to="repositoryPath(repository, `/commits/${proposal.appliedCommit}`)"><code>{{ proposal.appliedCommit.slice(0, 7) }}</code></RouterLink>.
        </p>
        <form v-else-if="canApply" class="apply" @submit.prevent="markApplied">
          <label>
            <span>Once you have pushed these changes, paste the commit's SHA</span>
            <input v-model="appliedCommit" name="applied-commit" maxlength="64" autocomplete="off" placeholder="Full commit SHA" />
          </label>
          <button type="submit" class="button" :disabled="applying">Mark as applied</button>
        </form>
        <ErrorBanner :message="applyError" />
      </div>

      <div v-if="highlightedFiles.length > 0" class="card highlights">
        <h2>Highlights</h2>
        <div class="files">
          <button
            v-for="path in highlightedFiles"
            :key="path"
            type="button"
            class="file"
            :class="{ active: path === reading }"
            @click="reading = path"
          >
            {{ path }}
          </button>
        </div>
        <MarkdownPanel
          v-if="reading"
          :owner="proposal.owner"
          :name="proposal.name"
          :commit="proposal.commit"
          :path="reading"
          :highlights="readingHighlights"
        />
      </div>

      <div class="structures">
        <div class="card scroll">
          <h2>Current Structure</h2>
          <p v-if="isEmpty(proposal.currentStructure)" class="muted">There are no Markdown files at this commit.</p>
          <TreeView v-else :folder="proposal.currentStructure" />
        </div>
        <div class="card scroll">
          <h2>Proposed Structure</h2>
          <p v-if="isEmpty(proposal.proposedStructure)" class="muted">The proposed structure is empty.</p>
          <TreeView v-else :folder="proposal.proposedStructure" />
        </div>
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

.heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-subtitle a,
.page-subtitle code {
  color: var(--accent);
}

.edit {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 20px;
}

.edit .button {
  text-decoration: none;
}

.rationale {
  max-width: 820px;
  margin-bottom: 20px;
}

.rationale p {
  margin: 0;
  white-space: pre-wrap;
}

.commands,
.highlights {
  margin-bottom: 20px;
}

.commands-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hint {
  margin: 0 0 12px;
  font-size: 14px;
}

.script {
  margin: 0 0 16px;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 8px;
  background: var(--sidebar);
  font-family: ui-monospace, monospace;
  font-size: 14px;
}

.applied {
  margin: 0;
  color: #166534;
}

.applied code {
  color: var(--accent);
}

.apply {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
}

.apply label {
  display: grid;
  flex: 1;
  gap: 6px;
  min-width: 260px;
}

.apply input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
}

.files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.file {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: none;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  cursor: pointer;
}

.file.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.structures {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.scroll {
  max-height: 65vh;
  overflow: auto;
}
</style>
