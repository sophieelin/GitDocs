<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { formatDate, listReviewQueue } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

/**
 * The repository's proposals whose author named the signed-in user as
 * reviewer, the longest waiting first. Each opens the proposal's page, where
 * the reviewer approves it.
 */
const repository = useCurrentRepository();

type Item = { proposal: string; author: string; commit: string; title: string; updatedAt: string };
const items = ref<Item[] | null>(null);
const error = ref<string | null>(null);

const name = computed(() => repository.value?.name ?? "");

async function load() {
  if (!repository.value) return;
  const result = await listReviewQueue(repository.value);
  if ("error" in result) {
    if (!handleEndedSession(result.error)) error.value = errorMessage(result.error);
    return;
  }
  error.value = null;
  items.value = result.repository.proposals;
}

// Reloads when the tab is opened again, so proposals submitted for you since appear.
useRefreshOnFocus(load);
watch(repository, () => {
  items.value = null;
  void load();
});
</script>

<template>
  <section>
    <h1 class="page-title">Reviews</h1>
    <p class="page-subtitle">Proposals for {{ name }} waiting for your review, the longest waiting first.</p>
    <ErrorBanner :message="error" />

    <div v-if="!error" class="card list">
      <p v-if="!items" class="muted">Loading reviews…</p>
      <p v-else-if="items.length === 0" class="muted">No proposals are waiting for your review.</p>
      <ul v-else>
        <li v-for="item in items" :key="item.proposal">
          <RouterLink v-if="repository" :to="repositoryPath(repository, `/proposals/${item.proposal}`)" class="row">
            <span class="title">{{ item.title }}</span>
            <span class="meta">
              <code>{{ item.commit.slice(0, 7) }}</code> · {{ item.author }} · submitted {{ formatDate(item.updatedAt) }}
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

.meta {
  color: var(--ink-faint);
  font-size: 14px;
  white-space: nowrap;
}

code {
  color: var(--accent);
}
</style>
