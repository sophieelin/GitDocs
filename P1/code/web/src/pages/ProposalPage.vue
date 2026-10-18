<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import StatusBadge from "../components/StatusBadge.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import type { DocumentationFolder } from "../github.ts";
import { formatDate } from "../investigations.ts";
import { getProposal } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";

/**
 * One proposal, read-only: its status, both structures, and the rationale.
 * Its author sees "Continue editing" while it is a draft. Another user never
 * reaches someone else's draft: the server answers it as not found.
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
        By {{ proposal.author }} · last changed {{ formatDate(proposal.updatedAt) }} · from
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/investigations/${proposal.investigation}`)">its investigation</RouterLink>
        of commit
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/commits/${proposal.commit}`)"><code>{{ proposal.commit.slice(0, 7) }}</code></RouterLink>
      </p>
      <p v-if="editable" class="edit">
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/proposals/${proposal.proposal}/edit`)" class="button">
          Continue editing
        </RouterLink>
        <span class="muted">This draft is visible only to you until you submit it.</span>
      </p>
    </template>
    <h1 v-else-if="!error" class="page-title">Proposal</h1>
    <ErrorBanner :message="error" />

    <template v-if="proposal && !error">
      <div class="card rationale">
        <h2>Rationale</h2>
        <p v-if="proposal.rationale === ''" class="muted">No rationale yet.</p>
        <p v-else>{{ proposal.rationale }}</p>
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
