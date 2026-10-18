<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { formatDate, listInvestigations } from "../investigations.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

/** A repository's investigations, the most recently submitted first. */
const repository = useCurrentRepository();

type Item = { investigation: string; commit: string; investigator: string; title: string; submittedAt: string };
const items = ref<Item[] | null>(null);
const error = ref<string | null>(null);

const name = computed(() => repository.value?.name ?? "");

async function load() {
  if (!repository.value) return;
  const result = await listInvestigations(repository.value);
  if ("error" in result) {
    if (!handleEndedSession(result.error)) error.value = errorMessage(result.error);
    return;
  }
  error.value = null;
  items.value = result.repository.investigations;
}

// Reloads when the tab is opened again, so investigations submitted by others appear.
useRefreshOnFocus(load);
watch(repository, () => {
  items.value = null;
  void load();
});

function detailPath(investigation: string): string {
  return repository.value ? repositoryPath(repository.value, `/investigations/${investigation}`) : "/repositories";
}
</script>

<template>
  <section>
    <h1 class="page-title">Investigations</h1>
    <p class="page-subtitle">What {{ name }}'s commits mean for its documentation, the most recent first.</p>
    <ErrorBanner :message="error" />

    <div v-if="!error" class="card list">
      <p v-if="!items" class="muted">Loading investigations…</p>
      <p v-else-if="items.length === 0" class="muted">
        No investigations yet. Open a commit on
        <RouterLink v-if="repository" :to="repositoryPath(repository)">{{ name }}</RouterLink>
        and choose "Investigate".
      </p>
      <ul v-else>
        <li v-for="item in items" :key="item.investigation">
          <RouterLink :to="detailPath(item.investigation)" class="row">
            <span class="title">{{ item.title }}</span>
            <span class="meta">
              <code>{{ item.commit.slice(0, 7) }}</code> · {{ item.investigator }} · {{ formatDate(item.submittedAt) }}
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
}

code {
  color: var(--accent);
}

.muted a {
  color: var(--accent);
}
</style>
