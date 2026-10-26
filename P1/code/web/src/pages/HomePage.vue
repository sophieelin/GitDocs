<script setup lang="ts">
import StatusBadge from "../components/StatusBadge.vue";

/** One line of the example tree: `-` was removed, `+` was added, `" "` is unchanged. */
type TreeLine = { mark: "-" | "+" | " "; depth: number; name: string; note?: string };

// The example proposal in the figure. Its commands are in the format the app gives
// for an approved proposal (see src/github/structureOperations.ts).
const tree: TreeLine[] = [
  { mark: " ", depth: 0, name: "docs/" },
  { mark: "-", depth: 1, name: "INSTALL.md" },
  { mark: "-", depth: 1, name: "config-notes.md" },
  { mark: "+", depth: 1, name: "setup/" },
  { mark: "+", depth: 2, name: "install.md", note: "moved" },
  { mark: "+", depth: 2, name: "configuration.md", note: "renamed" },
  { mark: "+", depth: 2, name: "troubleshooting.md", note: "new" },
  { mark: " ", depth: 1, name: "api.md" },
  { mark: " ", depth: 0, name: "README.md" },
];

const commands = [
  "mkdir -p docs/setup",
  "git mv docs/INSTALL.md docs/setup/install.md",
  "git mv docs/config-notes.md docs/setup/configuration.md",
  "touch docs/setup/troubleshooting.md",
  "git add docs/setup/troubleshooting.md",
];

const steps = [
  {
    title: "Open a commit",
    text: "Sign in with GitHub, choose a repository, and pick the commit to start from. GitDocs shows the files it changed and the documentation tree as it stood.",
  },
  {
    title: "Draft a proposal",
    text: "Move, rename, and add files in the tree, and suggest edits to the text. Each edit carries a reason, so the reviewer knows why it is there.",
  },
  {
    title: "Ask a teammate to review it",
    text: "Name someone with push access. They get a notice on their Home page and see the old and new structure side by side before they approve.",
  },
  {
    title: "Apply it with git",
    text: "Once it is approved, download the patch or copy the commands, commit and push as usual, then record the commit in GitDocs.",
  },
];
</script>

<template>
  <div class="home">
    <header class="top">
      <RouterLink to="/" class="wordmark">GitDocs</RouterLink>
      <RouterLink to="/sign-in" class="sign-in">Sign in</RouterLink>
    </header>

    <section class="intro">
      <div class="pitch">
        <h1>Review documentation changes the way you review code.</h1>
        <p class="lede">
          Reorganize a repository's docs, suggest edits to the text, and get a teammate's approval before anything changes on GitHub.
          When it is approved, GitDocs gives you the patch to apply.
        </p>
        <div class="actions">
          <RouterLink to="/sign-in" class="button">Sign in with GitHub</RouterLink>
          <a href="#how" class="how-link">How it works</a>
        </div>
        <p class="fine">Anyone can read a public repository. Proposing and approving changes needs push access to it.</p>
      </div>

      <figure class="example">
        <div class="proposal">
          <div class="proposal-head">
            <div>
              <p class="repo">acme/handbook · from <code>3f9c2e1</code></p>
              <p class="proposal-title">Put the setup guides in one folder</p>
            </div>
            <StatusBadge status="APPROVED" />
          </div>

          <ul class="tree" aria-label="Documentation tree, before and after">
            <li v-for="line in tree" :key="line.mark + line.name" :class="{ removed: line.mark === '-', added: line.mark === '+' }">
              <span class="mark" aria-hidden="true">{{ line.mark }}</span>
              <span :style="{ paddingLeft: `${line.depth * 18}px` }">{{ line.name }}</span>
              <span v-if="line.note" class="note">{{ line.note }}</span>
            </li>
          </ul>

          <p class="review"><strong>bob</strong> approved this · “Much easier to find. Fill in troubleshooting before you push.”</p>

          <pre class="commands">{{ commands.join("\n") }}</pre>
        </div>
        <figcaption>An approved proposal. The commands at the bottom are the kind GitDocs writes for you.</figcaption>
      </figure>
    </section>

    <section id="how" class="how">
      <h2>How it works</h2>
      <ol>
        <li v-for="(step, index) in steps" :key="step.title">
          <span class="number">{{ index + 1 }}</span>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="why">
      <p>
        Docs get messy one small commit at a time: a guide added at the root, a duplicate in <code>docs/</code>, a file nobody
        remembers renaming. Fixing that is a bigger change than a typo, and it deserves the same review a code change gets.
      </p>
      <RouterLink to="/sign-in" class="button secondary">Sign in to open a repository</RouterLink>
    </section>

    <footer class="bottom">
      <span>GitDocs</span>
      <span>A class project for MIT 6.1040.</span>
    </footer>
  </div>
</template>

<style scoped>
.home {
  --serif: "Iowan Old Style", "Charter", "Palatino Linotype", Georgia, serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  max-width: 1080px;
  margin: 0 auto;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.wordmark {
  color: var(--strong);
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
}

.sign-in {
  padding: 7px 14px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.sign-in:hover {
  background: var(--accent-soft);
}

.intro {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: 56px;
  align-items: start;
  padding: 72px 0 80px;
}

h1 {
  margin: 0 0 20px;
  font-family: var(--serif);
  font-size: 44px;
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.01em;
}

.lede {
  margin: 0 0 28px;
  color: var(--ink-soft);
  font-size: 18px;
  line-height: 1.55;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.actions .button,
.why .button {
  display: inline-block;
  text-decoration: none;
}

.how-link {
  color: var(--ink-soft);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.fine {
  margin: 20px 0 0;
  color: var(--ink-faint);
  font-size: 14px;
}

.example {
  margin: 0;
}

.proposal {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  box-shadow: 0 1px 0 var(--border);
  overflow: hidden;
}

.proposal-head {
  display: flex;
  gap: 16px;
  align-items: start;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.repo {
  margin: 0 0 4px;
  color: var(--ink-faint);
  font-size: 13px;
}

.proposal-title {
  margin: 0;
  color: var(--strong);
  font-weight: 600;
}

code,
.tree,
.commands {
  font-family: var(--mono);
}

.tree {
  margin: 0;
  padding: 12px 0;
  list-style: none;
  font-size: 13.5px;
  line-height: 1.75;
}

.tree li {
  display: flex;
  gap: 10px;
  padding: 0 20px;
}

.mark {
  width: 10px;
  color: var(--ink-faint);
}

.removed {
  background: #fbeeec;
  color: #8a3324;
}

.removed span:nth-child(2) {
  text-decoration: line-through;
  text-decoration-color: #d9a59b;
}

.added {
  background: #edf5ee;
  color: #2f5f37;
}

.removed .mark,
.added .mark {
  color: inherit;
}

.note {
  margin-left: auto;
  color: var(--ink-faint);
  font-family: Inter, system-ui, sans-serif;
  font-size: 12px;
}

.review {
  margin: 0;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  color: var(--ink-soft);
  font-size: 14px;
}

.commands {
  margin: 0;
  padding: 14px 20px;
  background: #23201b;
  color: #e9e4d8;
  font-size: 12.5px;
  line-height: 1.7;
  overflow-x: auto;
}

figcaption {
  margin-top: 10px;
  color: var(--ink-faint);
  font-size: 13px;
}

.how {
  padding: 56px 0;
  border-top: 1px solid var(--border);
}

h2 {
  margin: 0 0 32px;
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 600;
}

.how ol {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 36px 56px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.how li {
  display: flex;
  gap: 18px;
}

.number {
  flex: none;
  color: var(--accent);
  font-family: var(--serif);
  font-size: 26px;
  line-height: 1;
}

h3 {
  margin: 0 0 6px;
  font-size: 17px;
}

.how p {
  margin: 0;
  color: var(--ink-soft);
  line-height: 1.6;
}

.why {
  display: flex;
  gap: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 40px 0 56px;
  border-top: 1px solid var(--border);
}

.why p {
  max-width: 620px;
  margin: 0;
  font-family: var(--serif);
  font-size: 20px;
  line-height: 1.5;
}

.why .button {
  flex: none;
}

.bottom {
  display: flex;
  justify-content: space-between;
  padding: 20px 0 8px;
  border-top: 1px solid var(--border);
  color: var(--ink-faint);
  font-size: 13px;
}

@media (max-width: 860px) {
  .intro {
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
    padding: 40px 0 56px;
  }

  h1 {
    font-size: 34px;
  }

  .how ol {
    grid-template-columns: 1fr;
  }

  .why {
    flex-direction: column;
    align-items: start;
  }
}
</style>
