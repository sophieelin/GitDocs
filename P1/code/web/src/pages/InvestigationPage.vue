<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readTree, type TreeResponse } from "../github.ts";
import { formatDate, getInvestigation } from "../investigations.ts";
import { createProposal } from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

/**
 * One submitted investigation, read-only, as in sketch 2: its title, the
 * affected documentation with reasons, the evidence, and the code and
 * documentation structures at its commit with the affected files highlighted.
 */
const route = useRoute();
const repository = useCurrentRepository();
const id = computed(() => String(route.params.investigation));

type Detail = {
  owner: string;
  name: string;
  commit: string;
  investigator: string;
  title: string;
  submittedAt: string;
  affected: { path: string; reason: string }[];
  evidence: { text: string }[];
};
const investigation = ref<Detail | null>(null);
const structures = ref<TreeResponse | null>(null);
const error = ref<string | null>(null);

function sameRepository(a: { owner: string; name: string }, b: { owner: string; name: string }): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}

async function load() {
  const found = await getInvestigation(id.value);
  if ("error" in found) {
    if (!handleEndedSession(found.error)) {
      error.value = errorMessage(found.error, { NOT_FOUND: "This investigation does not exist." });
    }
    return;
  }
  // The URL's repository must be the investigation's, so one repository's pages never show another's.
  if (!repository.value || !sameRepository(found.investigation, repository.value)) {
    error.value = "This investigation belongs to another repository.";
    return;
  }
  investigation.value = found.investigation;

  const tree = await readTree(found.investigation.owner, found.investigation.name, found.investigation.commit);
  if ("error" in tree) {
    if (!handleEndedSession(tree.error)) {
      error.value = errorMessage(tree.error, { ...gitHubErrorMessages, NOT_FOUND: "This commit was not found on GitHub." });
    }
    return;
  }
  error.value = null;
  structures.value = tree;
}

useRefreshOnFocus(load);
watch([id, repository], () => {
  investigation.value = null;
  structures.value = null;
  error.value = null;
  void load();
});

const affectedPaths = computed(() => investigation.value?.affected.map((item) => item.path) ?? []);

/** Splits evidence text so links can be shown as links, without rendering any HTML from it. */
function parts(text: string): { text: string; href?: string }[] {
  return text
    .split(/(https?:\/\/[^\s]+)/g)
    .filter((part) => part !== "")
    .map((part) => (/^https?:\/\//.test(part) ? { text: part, href: part } : { text: part }));
}

function isEmpty(folder: TreeResponse["tree"]): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}

const listPath = computed(() => (repository.value ? repositoryPath(repository.value, "/investigations") : "/repositories"));

// "Propose a restructuring": a draft starts from the documentation structure at this investigation's commit.
const router = useRouter();
const proposing = ref(false);
const proposalTitle = ref("");
const proposalError = ref<string | null>(null);
const creating = ref(false);

async function startProposal() {
  if (!structures.value || !repository.value) return;
  const title = proposalTitle.value.trim();
  if (title === "") {
    proposalError.value = "Give the proposal a title.";
    return;
  }
  creating.value = true;
  const result = await createProposal(id.value, title, structures.value.tree);
  creating.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      proposalError.value = errorMessage(result.error, {
        NOT_FOUND: "This investigation no longer exists.",
        INVALID_REQUEST: "Keep the title to 120 characters.",
      });
    }
    return;
  }
  await router.push(repositoryPath(repository.value, `/proposals/${result.proposal}/edit`));
}
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="listPath">← All investigations</RouterLink></p>
    <template v-if="investigation">
      <h1 class="page-title">{{ investigation.title }}</h1>
      <p class="page-subtitle">
        Submitted by {{ investigation.investigator }} · {{ formatDate(investigation.submittedAt) }} · commit
        <RouterLink v-if="repository" :to="repositoryPath(repository, `/commits/${investigation.commit}`)" class="commit-link">
          <code>{{ investigation.commit.slice(0, 7) }}</code> — see what it changed
        </RouterLink>
      </p>
    </template>
    <h1 v-else-if="!error" class="page-title">Investigation</h1>
    <ErrorBanner :message="error" />

    <div v-if="investigation && !error" class="propose">
      <button v-if="!proposing" type="button" class="button" :disabled="!structures" @click="proposing = true">
        Propose a restructuring
      </button>
      <form v-else class="card propose-form" @submit.prevent="startProposal">
        <label>
          <span>Proposal title</span>
          <input v-model="proposalTitle" name="proposal-title" maxlength="120" placeholder="What should the documentation look like?" />
        </label>
        <button type="submit" class="button" :disabled="creating">{{ creating ? "Starting…" : "Start proposal" }}</button>
        <button type="button" class="link" @click="proposing = false">Cancel</button>
        <ErrorBanner :message="proposalError" />
      </form>
    </div>

    <div v-if="investigation" class="findings">
      <div class="card">
        <h2>Affected documentation</h2>
        <p v-if="investigation.affected.length === 0" class="muted">None recorded.</p>
        <ul class="affected">
          <li v-for="item in investigation.affected" :key="item.path">
            <code>{{ item.path }}</code>
            <p>{{ item.reason }}</p>
          </li>
        </ul>
      </div>
      <div class="card">
        <h2>Evidence</h2>
        <p v-if="investigation.evidence.length === 0" class="muted">None recorded.</p>
        <ul class="evidence">
          <li v-for="(item, index) in investigation.evidence" :key="index">
            <template v-for="(part, partIndex) in parts(item.text)" :key="partIndex">
              <a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
              <template v-else>{{ part.text }}</template>
            </template>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="structures?.truncated" class="warning" role="status">
      This repository is very large, and GitHub returned only part of it. Some files may be missing.
    </p>
    <div v-if="investigation && !error" class="structures">
      <div class="card scroll">
        <h2>Code Structure</h2>
        <p v-if="!structures" class="muted">Loading the code at this commit from GitHub…</p>
        <p v-else-if="isEmpty(structures.code)" class="muted">There are no files at this commit.</p>
        <TreeView v-else :folder="structures.code" />
      </div>
      <div class="card scroll">
        <h2>Documentation Structure</h2>
        <p v-if="!structures" class="muted">Loading the documentation at this commit from GitHub…</p>
        <p v-else-if="isEmpty(structures.tree)" class="muted">There are no Markdown files at this commit.</p>
        <TreeView v-else :folder="structures.tree" :marked="affectedPaths" />
      </div>
    </div>
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

.commit-link {
  color: var(--accent);
}

.commit-link code {
  font-weight: 600;
}

.propose {
  margin-bottom: 20px;
}

.propose-form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  max-width: 820px;
}

.propose-form label {
  display: grid;
  flex: 1;
  gap: 6px;
  font-weight: 600;
}

.propose-form input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  font-weight: normal;
}

.propose-form .link {
  padding: 0;
  border: none;
  background: none;
  color: var(--ink-faint);
  font: inherit;
  cursor: pointer;
}

.findings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

.affected,
.evidence {
  margin: 0;
  padding: 0;
  list-style: none;
}

.affected li + li,
.evidence li + li {
  margin-top: 12px;
}

.affected code {
  color: var(--accent);
  font-weight: 600;
}

.affected p {
  margin: 4px 0 0;
  color: var(--ink-soft);
}

.evidence li {
  padding-left: 14px;
  border-left: 3px solid var(--accent-soft);
  overflow-wrap: anywhere;
}

.evidence a {
  color: var(--accent);
}

.structures {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

/* A large repository's code tree can be long; each panel scrolls on its own. */
.scroll {
  max-height: 65vh;
  overflow: auto;
}

.warning {
  padding: 10px 14px;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
}
</style>
