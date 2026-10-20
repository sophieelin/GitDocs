<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import EditableTree, { type Picked } from "../components/EditableTree.vue";
import ErrorBanner from "../components/ErrorBanner.vue";
import MarkdownPanel from "../components/MarkdownPanel.vue";
import StatusBadge from "../components/StatusBadge.vue";
import TreeView from "../components/TreeView.vue";
import { errorMessage, handleEndedSession } from "../errors.ts";
import { readTree, type DocumentationFolder } from "../github.ts";
import {
  discardProposal,
  formatDate,
  getProposal,
  highlightProposal,
  modifyProposal,
  proposalErrorMessages,
  submitProposal,
  unhighlightProposal,
} from "../proposals.ts";
import { useRefreshOnFocus } from "../refresh.ts";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { useSession } from "../session.ts";
import { createFile, createFolder, folderPaths, move, removeFolder, rename, type Edit, type Operation } from "../tree/edit.ts";

/**
 * The proposal editor, as in UI sketch 3: the code structure at the commit,
 * read-only, next to the proposed documentation structure, which the author
 * reorganizes; the text of a file, where the author highlights what no longer
 * holds; then the title
 * and rationale. Only the author of a draft edits it; anyone else, or a
 * submitted proposal, is sent to the proposal's page.
 */
const route = useRoute();
const router = useRouter();
const repository = useCurrentRepository();
const session = useSession();
const id = computed(() => String(route.params.proposal));

type Detail = Extract<Awaited<ReturnType<typeof getProposal>>, { proposal: unknown }>["proposal"];
const proposal = ref<Detail | null>(null);
const loadError = ref<string | null>(null);

const title = ref("");
const rationale = ref("");
const proposed = ref<DocumentationFolder | null>(null);
/** The changes that turn the current structure into `proposed`, in order; this is what is saved. */
const operations = ref<Operation[]>([]);
/** What was last loaded or saved, to tell whether there are unsaved changes. */
const saved = ref("");
const current = computed(() => JSON.stringify({ title: title.value, rationale: rationale.value, operations: operations.value }));
const dirty = computed(() => proposed.value !== null && current.value !== saved.value);

const selected = ref<Picked | null>(null);
const newName = ref("");
const moveTarget = ref("");
const editError = ref<string | null>(null);

/** The username of the account asked to review the proposal on submit. */
const reviewer = ref("");

const formError = ref<string | null>(null);
const notice = ref<string | null>(null);
const busy = ref(false);

function proposalPath(): string {
  return repository.value ? repositoryPath(repository.value, `/proposals/${id.value}`) : "/repositories";
}

function sameRepository(a: { owner: string; name: string }, b: { owner: string; name: string }): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}

async function load() {
  const found = await getProposal(id.value);
  if ("error" in found) {
    if (!handleEndedSession(found.error)) {
      loadError.value = errorMessage(found.error, { NOT_FOUND: "This proposal does not exist." });
    }
    return;
  }
  if (!repository.value || !sameRepository(found.proposal, repository.value)) {
    loadError.value = "This proposal belongs to another repository.";
    return;
  }
  // The server lets only the author change a draft; this only saves a refused attempt.
  if (found.proposal.status !== "DRAFT" || found.proposal.author !== session.username) {
    await router.replace(proposalPath());
    return;
  }
  loadError.value = null;
  proposal.value = found.proposal;
  // Every file at the commit can be read and highlighted. Without it, the documentation is shown.
  if (!code.value) {
    const tree = await readTree(found.proposal.owner, found.proposal.name, found.proposal.commit);
    if ("error" in tree) handleEndedSession(tree.error);
    else code.value = tree.code;
  }
  // The first highlighted file is shown at once; with none, the root README is.
  const readme = found.proposal.currentStructure.files.find((file) => /^readme\.md$/i.test(file.name));
  reading.value ??= found.proposal.highlights[0]?.path ?? readme?.path ?? null;
  // Coming back to the tab must not throw away edits that are not saved yet.
  if (dirty.value) return;
  title.value = found.proposal.title;
  rationale.value = found.proposal.rationale;
  proposed.value = found.proposal.proposedStructure;
  operations.value = found.proposal.operations;
  saved.value = current.value;
}

/** The file whose text is shown. */
const reading = ref<string | null>(null);
/** Every file at the proposal's commit, the Code Structure. */
const code = ref<DocumentationFolder | null>(null);

const highlightedFiles = computed(() => [...new Set((proposal.value?.highlights ?? []).map((item) => item.path))]);
const readingHighlights = computed(() => (proposal.value?.highlights ?? []).filter((item) => item.path === reading.value));

const highlightErrorMessages = {
  ...proposalErrorMessages,
  INVALID_REQUEST: "Select some text in this file, and say why it no longer holds.",
  CONFLICT: "This suggestion overlaps another suggestion in this file. Remove that one first.",
};

const suggestionCount = computed(() => (proposal.value?.highlights ?? []).filter((item) => item.kind === "SUGGESTION").length);

/** Saves a highlight or suggestion in the file being read at once, then rereads the proposal to show it. */
async function addHighlight({
  from,
  to,
  start,
  end,
  text,
  kind,
  replacement,
}: {
  from: number;
  to: number;
  start: number;
  end: number;
  text: string;
  kind: "COMMENT" | "SUGGESTION";
  replacement: string;
}): Promise<string | null> {
  if (!reading.value) return null;
  const result = await highlightProposal(id.value, { file: reading.value, from, to, start, end, text, kind, replacement });
  if ("error" in result) return handleEndedSession(result.error) ? null : errorMessage(result.error, highlightErrorMessages);
  await load();
  return null;
}

async function removeHighlight(highlight: string): Promise<string | null> {
  const result = await unhighlightProposal(id.value, highlight);
  if ("error" in result && result.error !== "NOT_FOUND") {
    return handleEndedSession(result.error) ? null : errorMessage(result.error, highlightErrorMessages);
  }
  // A highlight already gone is shown as gone.
  await load();
  return null;
}

useRefreshOnFocus(load);
watch(id, () => {
  reading.value = null;
  code.value = null;
  proposal.value = null;
  proposed.value = null;
  operations.value = [];
  saved.value = "";
  selected.value = null;
  void load();
});

// A message about the form is stale as soon as the form changes.
watch([title, rationale, proposed], () => {
  formError.value = null;
  notice.value = null;
});

watch(selected, (picked) => {
  editError.value = null;
  newName.value = picked ? picked.path.slice(picked.path.lastIndexOf("/") + 1) : "";
  moveTarget.value = "";
});

/** Folders the selected entry may move into: not its own folder, and for a folder, not itself or below it. */
const moveTargets = computed(() => {
  if (!proposed.value || !selected.value) return [];
  const { path, kind } = selected.value;
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return folderPaths(proposed.value).filter(
    (folder) => folder !== parent && !(kind === "folder" && (folder === path || folder.startsWith(`${path}/`))),
  );
});

function apply(edit: Edit, nowSelected: Picked | null): boolean {
  if ("error" in edit) {
    editError.value = edit.error;
    return false;
  }
  proposed.value = edit.tree;
  operations.value = [...operations.value, ...edit.operations];
  selected.value = nowSelected;
  return true;
}

function join(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function renameSelected() {
  if (!proposed.value || !selected.value) return;
  const { path, kind } = selected.value;
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  apply(rename(proposed.value, path, newName.value), { path: join(parent, newName.value.trim()), kind });
}

function moveSelected() {
  if (!proposed.value || !selected.value) return;
  const { path, kind } = selected.value;
  const name = path.slice(path.lastIndexOf("/") + 1);
  apply(move(proposed.value, path, moveTarget.value), { path: join(moveTarget.value, name), kind });
}

function removeSelected() {
  if (!proposed.value || !selected.value) return;
  apply(removeFolder(proposed.value, selected.value.path), null);
}

/** Where a new file or folder goes: the selected folder, the selected file's folder, or the root. */
function newEntryParent(): string {
  if (!selected.value) return "";
  const { path, kind } = selected.value;
  if (kind === "folder") return path;
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

/** The name typed for a new file or folder. */
const newEntryName = ref("");

function addEntry(kind: "file" | "folder") {
  if (!proposed.value) return;
  const parent = newEntryParent();
  const name = newEntryName.value.trim();
  const edit = kind === "file" ? createFile(proposed.value, parent, name) : createFolder(proposed.value, parent, name);
  if (apply(edit, { path: join(parent, name), kind })) newEntryName.value = "";
}

/** Starts over from the current structure. The saved changes stay until the draft is saved again. */
function resetChanges() {
  if (!proposal.value || operations.value.length === 0) return;
  if (!window.confirm("Undo every change to the proposed structure?")) return;
  proposed.value = proposal.value.currentStructure;
  operations.value = [];
  selected.value = null;
}

function folderLabel(path: string): string {
  return path === "" ? "(root)" : `${path}/`;
}

/** Saves the draft. Returns true when it was saved. */
async function save(): Promise<boolean> {
  if (!proposed.value) return false;
  if (title.value.trim() === "") {
    formError.value = "Give the proposal a title.";
    return false;
  }
  if (title.value.trim().length > 120) {
    formError.value = "Keep the title to 120 characters.";
    return false;
  }
  busy.value = true;
  const result = await modifyProposal(id.value, {
    title: title.value.trim(),
    operations: operations.value,
    rationale: rationale.value,
  });
  busy.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) formError.value = errorMessage(result.error, proposalErrorMessages);
    return false;
  }
  title.value = title.value.trim();
  saved.value = current.value;
  notice.value = "Saved.";
  return true;
}

async function submitForReview() {
  if (operations.value.length === 0 && suggestionCount.value === 0) {
    formError.value = "Change the documentation structure or suggest an edit before submitting.";
    return;
  }
  if (rationale.value.trim() === "") {
    formError.value = "Explain the proposed changes before submitting them.";
    return;
  }
  const name = reviewer.value.trim();
  if (name === "") {
    formError.value = "Name the person who should review this proposal.";
    return;
  }
  if (name === session.username) {
    formError.value = "Name someone else as the reviewer. You cannot review your own proposal.";
    return;
  }
  if (!(await save())) return;
  busy.value = true;
  const result = await submitProposal(id.value, name);
  busy.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) {
      formError.value = errorMessage(result.error, {
        ...proposalErrorMessages,
        CONFLICT: "This proposal needs a change to the structure or a suggestion, and a rationale, and must still be a draft.",
        INVALID_REQUEST: `No one named "${name}" has signed in to GitDocs yet. Check the reviewer's GitHub username, or ask them to sign in once.`,
      });
    }
    return;
  }
  await router.push(proposalPath());
}

async function discard() {
  if (!window.confirm("Discard this draft? It cannot be brought back.")) return;
  busy.value = true;
  const result = await discardProposal(id.value);
  busy.value = false;
  if ("error" in result) {
    if (!handleEndedSession(result.error)) formError.value = errorMessage(result.error, proposalErrorMessages);
    return;
  }
  saved.value = current.value;
  await router.push(repository.value ? repositoryPath(repository.value, "/proposals") : "/repositories");
}

onBeforeRouteLeave(() => !dirty.value || window.confirm("You have unsaved changes. Leave without saving?"));

function isEmpty(folder: DocumentationFolder): boolean {
  return folder.files.length === 0 && folder.folders.length === 0;
}
</script>

<template>
  <section>
    <p class="back"><RouterLink :to="repository ? repositoryPath(repository, '/proposals') : '/repositories'">← All proposals</RouterLink></p>
    <h1 class="page-title">Edit proposal</h1>
    <p v-if="proposal" class="page-subtitle">
      <StatusBadge :status="proposal.status" />
      Investigating commit
      <RouterLink v-if="repository" :to="repositoryPath(repository, `/commits/${proposal.commit}`)"><code>{{ proposal.commit.slice(0, 7) }}</code></RouterLink>
      · last saved {{ formatDate(proposal.updatedAt) }}
    </p>
    <ErrorBanner :message="loadError" />

    <template v-if="proposal && proposed && !loadError">
      <div class="structures">
        <div class="card scroll">
          <h2>Code Structure</h2>
          <p class="muted hint">Click a file to read it below, highlight what no longer holds, and suggest new text. Highlighted files are shaded.</p>
          <p v-if="isEmpty(code ?? proposal.currentStructure)" class="muted">There are no files at this commit.</p>
          <TreeView
            v-else
            :folder="code ?? proposal.currentStructure"
            openable
            :active="reading"
            :marked="highlightedFiles"
            @open="(path) => (reading = path)"
          />
        </div>
        <div class="card scroll">
          <h2>Proposed Documentation Structure</h2>
          <p class="muted hint">Click a file or folder to rename or move it.</p>
          <EditableTree :folder="proposed" :selected="selected" @select="(picked) => (selected = picked)" />
          <p class="muted changes">
            {{ operations.length === 0 ? "No changes yet." : `${operations.length} ${operations.length === 1 ? "change" : "changes"}.` }}
            <button v-if="operations.length > 0" type="button" class="link" @click="resetChanges">Start over</button>
          </p>
        </div>
      </div>

      <MarkdownPanel
        v-if="reading"
        class="card markdown"
        :owner="proposal.owner"
        :name="proposal.name"
        :commit="proposal.commit"
        :path="reading"
        :highlights="readingHighlights"
        :add="addHighlight"
        :remove="removeHighlight"
      />

      <div class="card toolbar">
        <template v-if="selected">
          <p class="picked">
            <code>{{ selected.path }}{{ selected.kind === "folder" ? "/" : "" }}</code>
            <button type="button" class="link" @click="selected = null">Clear</button>
          </p>
          <form class="tool" @submit.prevent="renameSelected">
            <input v-model="newName" name="new-name" aria-label="New name" />
            <button type="submit" class="button secondary">Rename</button>
          </form>
          <form class="tool" @submit.prevent="moveSelected">
            <select v-model="moveTarget" name="move-target" aria-label="Move to folder">
              <option value="" disabled>Move to…</option>
              <option v-for="folder in moveTargets" :key="folder" :value="folder">{{ folderLabel(folder) }}</option>
            </select>
            <button type="submit" class="button secondary" :disabled="!moveTargets.includes(moveTarget)">Move</button>
          </form>
          <button v-if="selected.kind === 'folder'" type="button" class="button secondary" @click="removeSelected">
            Remove empty folder
          </button>
        </template>
        <p v-else class="muted picked">Select a file or folder in the Proposed Structure to rename or move it.</p>
        <form class="tool" @submit.prevent="addEntry('file')">
          <input
            v-model="newEntryName"
            name="new-entry"
            :aria-label="`New file or folder in ${folderLabel(newEntryParent())}`"
            :placeholder="`New in ${folderLabel(newEntryParent())}`"
          />
          <button type="submit" class="button secondary">New file</button>
          <button type="button" class="button secondary" @click="addEntry('folder')">New folder</button>
        </form>
        <ErrorBanner :message="editError" />
      </div>

      <form class="card form" @submit.prevent="save">
        <label class="field">
          <span>Title</span>
          <input v-model="title" name="title" maxlength="120" />
        </label>
        <label class="field">
          <span>Rationale</span>
          <textarea v-model="rationale" name="rationale" rows="5" placeholder="Why are the proposed changes better? Needed before you submit." />
        </label>
        <label class="field">
          <span>Reviewer</span>
          <input v-model="reviewer" name="reviewer" maxlength="39" autocomplete="off" placeholder="GitHub username of the person who approves it. Needed before you submit." />
        </label>

        <ErrorBanner :message="formError" />
        <p v-if="notice" class="notice" role="status">{{ notice }}</p>
        <div class="actions">
          <button type="submit" class="button secondary" :disabled="busy">Save</button>
          <button type="button" class="button" :disabled="busy" @click="submitForReview">Submit for review</button>
          <span v-if="dirty" class="muted">Unsaved changes</span>
          <button type="button" class="link danger" :disabled="busy" @click="discard">Discard draft</button>
        </div>
      </form>
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

.page-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.page-subtitle a,
.page-subtitle code {
  color: var(--accent);
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

.markdown {
  margin-bottom: 20px;
}

.changes {
  display: flex;
  gap: 8px;
  margin: 12px 0 0;
  font-size: 14px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.picked {
  display: flex;
  gap: 8px;
  margin: 0;
}

.picked code {
  color: var(--accent);
  font-weight: 600;
}

.tool {
  display: flex;
  gap: 6px;
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
select,
textarea {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
}

textarea {
  resize: vertical;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.link {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}

.danger {
  margin-left: auto;
  color: #b91c1c;
}

.notice {
  margin: 0;
  color: #166534;
}
</style>
