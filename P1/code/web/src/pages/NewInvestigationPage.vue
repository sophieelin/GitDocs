<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { gitHubErrorMessages, readCommit, readTree, type CommitResponse, type TreeResponse } from "../github.ts";
import { submitInvestigation, type AffectedDocument } from "../investigations.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

/**
 * Writing an investigation of one commit. Nothing is saved until Submit:
 * leaving the page discards what was written.
 */
const route = useRoute();
const router = useRouter();
const repository = useCurrentRepository();
const sha = computed(() => String(route.params.sha));

const commit = ref<CommitResponse["commit"] | null>(null);
const structures = ref<TreeResponse | null>(null);
const loadError = ref<string | null>(null);

const title = ref("");
const affected = ref<AffectedDocument[]>([]);
const evidence = ref<string[]>([""]);
const formError = ref<string | null>(null);
const submitting = ref(false);

async function load() {
  if (!repository.value) return;
  const { owner, name } = repository.value;
  const [commitAnswer, treeAnswer] = await Promise.all([readCommit(owner, name, sha.value), readTree(owner, name, sha.value)]);
  for (const answer of [commitAnswer, treeAnswer]) {
    if ("error" in answer) {
      if (!handleEndedSession(answer.error)) {
        loadError.value = errorMessage(answer.error, { ...gitHubErrorMessages, NOT_FOUND: "This commit was not found on GitHub." });
      }
      return;
    }
  }
  if (!("error" in commitAnswer)) commit.value = commitAnswer.commit;
  if (!("error" in treeAnswer)) structures.value = treeAnswer;
}

void load();
watch([sha, repository], () => {
  commit.value = null;
  structures.value = null;
  loadError.value = null;
  void load();
});

// A message about the form is stale as soon as the form changes.
watch([title, affected, evidence], () => (formError.value = null), { deep: true });

const markedPaths = computed(() => affected.value.map((item) => item.path));

/** Ticking a file adds it with an empty reason; unticking removes it. */
function toggleAffected(path: string) {
  const index = affected.value.findIndex((item) => item.path === path);
  if (index === -1) affected.value.push({ path, reason: "" });
  else affected.value.splice(index, 1);
}

function addEvidence() {
  evidence.value.push("");
}

function removeEvidence(index: number) {
  evidence.value.splice(index, 1);
  if (evidence.value.length === 0) evidence.value.push("");
}

/** The same rules the concept checks, so the message can say which one failed. */
function problem(): string | null {
  if (title.value.trim() === "") return "Give the investigation a title.";
  if (title.value.trim().length > 120) return "Keep the title to 120 characters.";
  if (affected.value.length === 0) return "Tick at least one affected documentation file.";
  const missing = affected.value.find((item) => item.reason.trim() === "");
  if (missing) return `Say why ${missing.path} needs to change.`;
  if (evidence.value.every((text) => text.trim() === "")) return "Give at least one piece of evidence.";
  return null;
}

async function submit() {
  formError.value = problem();
  if (formError.value || !repository.value || !commit.value) return;
  submitting.value = true;
  const result = await submitInvestigation(repository.value, commit.value.sha, {
    title: title.value.trim(),
    affected: affected.value.map((item) => ({ path: item.path, reason: item.reason.trim() })),
    evidence: evidence.value.map((text) => text.trim()).filter((text) => text !== ""),
  });
  submitting.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      formError.value = errorMessage(result.error, {
        INVALID_REQUEST: "Check the title, the affected documentation, and the evidence.",
      });
    }
    return;
  }
  await router.push(repositoryPath(repository.value, `/investigations/${result.investigation}`));
}

const commitPath = computed(() => (repository.value ? repositoryPath(repository.value, `/commits/${sha.value}`) : "/repositories"));

function isEmpty(folder: TreeResponse["tree"]): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="commitPath">← Back to the commit</RouterLink></p>
    <h1 class="page-title">New investigation</h1>
    <p class="page-subtitle">
      <template v-if="commit">
        Of <code>{{ commit.sha.slice(0, 7) }}</code> “{{ commit.message.split("\n")[0] }}”. Nothing is saved until you submit.
      </template>
      <template v-else>Nothing is saved until you submit.</template>
    </p>
    <ErrorBanner :message="loadError" />

    <template v-if="!loadError">
      <div class="structures">
        <div class="card scroll">
          <h2>Code Structure</h2>
          <p v-if="!structures" class="muted">Loading the code at this commit…</p>
          <p v-else-if="isEmpty(structures.code)" class="muted">There are no files at this commit.</p>
          <TreeView v-else :folder="structures.code" />
        </div>
        <div class="card scroll">
          <h2>Documentation Structure</h2>
          <p class="muted hint">Tick the documentation that needs to change.</p>
          <p v-if="!structures" class="muted">Loading the documentation at this commit…</p>
          <p v-else-if="isEmpty(structures.tree)" class="muted">There are no Markdown files at this commit.</p>
          <TreeView v-else :folder="structures.tree" selectable :marked="markedPaths" @toggle="toggleAffected" />
        </div>
      </div>

      <form class="card form" @submit.prevent="submit">
        <label class="field">
          <span>Title</span>
          <input v-model="title" name="title" maxlength="120" placeholder="What did this commit change?" />
        </label>

        <div class="field">
          <span>Affected documentation</span>
          <p v-if="affected.length === 0" class="muted">Tick files in the Documentation Structure above.</p>
          <div v-for="item in affected" :key="item.path" class="affected">
            <div class="affected-head">
              <code>{{ item.path }}</code>
              <button type="button" class="link" @click="toggleAffected(item.path)">Remove</button>
            </div>
            <textarea v-model="item.reason" :name="`reason-${item.path}`" rows="2" placeholder="Why does it need to change?" />
          </div>
        </div>

        <div class="field">
          <span>Evidence</span>
          <div v-for="(_, index) in evidence" :key="index" class="evidence">
            <input v-model="evidence[index]" :name="`evidence-${index}`" placeholder="A code reference, an issue, a pull request link…" />
            <button v-if="evidence.length > 1" type="button" class="link" @click="removeEvidence(index)">Remove</button>
          </div>
          <button type="button" class="link add" @click="addEvidence">+ Add evidence</button>
        </div>

        <ErrorBanner :message="formError" />
        <div class="actions">
          <button type="submit" class="button" :disabled="submitting || !commit">{{ submitting ? "Submitting…" : "Submit investigation" }}</button>
          <RouterLink :to="commitPath" class="cancel">Cancel</RouterLink>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.back {
  margin: 0 0 12px;
}

.back a,
.cancel {
  color: var(--ink-faint);
  text-decoration: none;
}

.page-subtitle code {
  color: var(--accent);
  font-weight: 600;
}

.structures {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

.scroll {
  max-height: 55vh;
  overflow: auto;
}

.hint {
  margin: -8px 0 12px;
  font-size: 14px;
}

.form {
  display: grid;
  gap: 20px;
  max-width: 820px;
}

.field {
  display: grid;
  gap: 8px;
}

.field > span {
  font-weight: 600;
}

input,
textarea {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
}

textarea {
  resize: vertical;
}

.affected {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.affected-head {
  display: flex;
  justify-content: space-between;
}

.affected-head code {
  color: var(--accent);
}

.evidence {
  display: flex;
  gap: 8px;
}

.evidence input {
  flex: 1;
}

.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}

.add {
  justify-self: start;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
