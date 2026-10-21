<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, listCommits } from "../github.ts";
import {
  forgetRepository,
  recentRepositories,
  rememberRepository,
  type RecentRepository,
} from "../recentRepositories.ts";
import { repositoryPath } from "../repository.ts";
import { useSession } from "../session.ts";

const router = useRouter();
const username = useSession().username ?? "";

const input = ref("");
const error = ref<string | null>(null);
const busy = ref(false);
const recent = ref<RecentRepository[]>(recentRepositories(username));

/** Accepts `owner/name` or a pasted `https://github.com/owner/name` link. */
function parse(text: string): RecentRepository | null {
  const match = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(text.trim());
  return match ? { owner: match[1]!, name: match[2]! } : null;
}

/** A repository's Home in its workspace. */
function homePath(repository: RecentRepository): string {
  return repositoryPath(repository);
}

async function open() {
  const repository = parse(input.value);
  if (!repository) {
    error.value = "Enter a repository as owner/name, or paste its github.com link.";
    return;
  }
  error.value = null;
  busy.value = true;
  const result = await listCommits(repository.owner, repository.name);
  busy.value = false;

  if ("error" in result) {
    if (!handleEndedSession(result.error)) error.value = errorMessage(result.error, gitHubErrorMessages);
    return;
  }
  recent.value = rememberRepository(username, repository);
  await router.push(homePath(repository));
}

function remove(repository: RecentRepository) {
  recent.value = forgetRepository(username, repository);
}
</script>

<template>
  <section>
    <h1 class="page-title">Repositories</h1>
    <p class="page-subtitle">Open a public GitHub repository to work on its documentation.</p>

    <div class="cards">
      <div class="card">
        <h2>Open a repository</h2>
        <form class="open" @submit.prevent="open">
          <input
            v-model="input"
            name="repository"
            placeholder="owner/name"
            aria-label="Public GitHub repository"
            autocomplete="off"
            required
          />
          <button type="submit" class="button" :disabled="busy">{{ busy ? "Checking…" : "Open" }}</button>
        </form>
        <p class="muted hint">Only public repositories work. You can also paste a github.com link.</p>
        <ErrorBanner :message="error" />
      </div>

      <div class="card">
        <h2>Recent repositories</h2>
        <p v-if="recent.length === 0" class="muted">Repositories you open appear here.</p>
        <ul v-else class="recent">
          <li v-for="repository in recent" :key="`${repository.owner}/${repository.name}`">
            <RouterLink :to="homePath(repository)">{{ repository.owner }}/{{ repository.name }}</RouterLink>
            <button
              type="button"
              class="remove"
              :aria-label="`Remove ${repository.owner}/${repository.name}`"
              @click="remove(repository)"
            >
              Remove
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cards {
  display: grid;
  gap: 20px;
  max-width: 720px;
}

.open {
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
}

.hint {
  margin: 10px 0 0;
  font-size: 14px;
}

.recent {
  margin: 0;
  padding: 0;
  list-style: none;
}

.recent li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.recent li + li {
  margin-top: 10px;
}

.recent a {
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
}

.recent a:hover {
  color: var(--accent);
}

.remove {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card);
  color: var(--ink-faint);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
</style>
