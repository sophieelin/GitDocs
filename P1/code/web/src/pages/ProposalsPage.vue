<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { formatDate } from "../investigations.ts";
import { listProposals } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";

/**
 * A repository's proposals: every submitted one, and the signed-in user's own
 * drafts, the most recently changed first. The user's own are marked "Mine".
 */
const repository = useCurrentRepository();
const session = useSession();

type Item = {
  proposal: string;
  author: string;
  commit: string;
  title: string;
  status: string;
  updatedAt: string;
};
const items = ref<Item[] | null>(null);
const error = ref<string | null>(null);

const name = computed(() => repository.value?.name ?? "");

async function load() {
  if (!repository.value) return;
  const result = await listProposals(repository.value);
  if ("error" in result) {
    if (!handleEndedSession(result.error)) error.value = errorMessage(result.error);
    return;
  }
  error.value = null;
  // The server answers two lists, because who may see a proposal depends on its status.
  const { submitted, drafts } = result.repository;
  items.value = [
    ...submitted.map((item) => ({ ...item, status: "PENDING_APPROVAL" })),
    ...drafts.map((item) => ({ ...item, author: session.username ?? "", status: "DRAFT" })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// Reloads when the tab is opened again, so proposals submitted by others appear.
useRefreshOnFocus(load);
watch(repository, () => {
  items.value = null;
  void load();
});

function itemPath(item: Item): string {
  if (!repository.value) return "/repositories";
  const edit = item.status === "DRAFT" ? "/edit" : "";
  return repositoryPath(repository.value, `/proposals/${item.proposal}${edit}`);
}
</script>

<template>
  <section>
    <h1 class="page-title">Proposals</h1>
    <p class="page-subtitle">Restructurings proposed for {{ name }}'s documentation, the most recently changed first.</p>
    <ErrorBanner :message="error" />

    <div v-if="!error" class="card list">
      <p v-if="!items" class="muted">Loading proposals…</p>
      <p v-else-if="items.length === 0" class="muted">
        No proposals yet. Open one of
        <RouterLink v-if="repository" :to="repositoryPath(repository, '/investigations')">{{ name }}'s investigations</RouterLink>
        and choose "Propose a restructuring".
      </p>
      <ul v-else>
        <li v-for="item in items" :key="item.proposal">
          <RouterLink :to="itemPath(item)" class="row">
            <span class="title">
              {{ item.title }}
              <span v-if="item.author === session.username" class="mine">Mine</span>
            </span>
            <span class="meta">
              <StatusBadge :status="item.status" />
              <code>{{ item.commit.slice(0, 7) }}</code> · {{ item.author }} · {{ formatDate(item.updatedAt) }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.list {
  max-width: 820px;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li + li {
  margin-top: 10px;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--ink);
  text-decoration: none;
}

.row:hover {
  border-color: var(--accent);
}

.title {
  font-weight: 600;
}

.mine {
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-faint);
  font-size: 14px;
  white-space: nowrap;
}

code {
  color: var(--accent);
}

.muted a {
  color: var(--accent);
}
</style>
