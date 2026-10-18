<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { repositoryPath, useCurrentRepository } from "../repository.ts";
import { signOut, useSession } from "../session.ts";

const session = useSession();
const route = useRoute();
const router = useRouter();
const repository = useCurrentRepository();

interface Crumb {
  label: string;
  to?: string;
}

/**
 * Inside a repository: its name, then the page's title when it is not the
 * repository's Home ("PaperNet › Proposals"). Outside one: just the title.
 */
const crumbs = computed<Crumb[]>(() => {
  const current = repository.value;
  if (!current) return [{ label: route.meta.title }];
  const home: Crumb = { label: current.name, to: repositoryPath(current) };
  return route.meta.title === "Home" ? [{ label: current.name }] : [home, { label: route.meta.title }];
});

async function leave() {
  await signOut();
  await router.push("/sign-in");
}
</script>

<template>
  <header class="topbar">
    <p class="breadcrumb">
      <template v-for="(crumb, index) in crumbs" :key="index">
        <span v-if="index > 0" class="separator">›</span>
        <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
        <span v-else>{{ crumb.label }}</span>
      </template>
    </p>
    <div class="account">
      <!-- The username leads back to the starting page, like the GitDocs logo. -->
      <RouterLink to="/repositories" class="user" title="Back to your repositories">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.5 18.5c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3" />
        </svg>
        <span class="username">{{ session.username }}</span>
      </RouterLink>
      <button type="button" @click="leave">Sign out</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 40px;
  border-bottom: 1px solid var(--border);
  background: #fff;
}

.breadcrumb {
  margin: 0;
  color: var(--ink-faint);
  font-size: 18px;
}

.breadcrumb a {
  color: var(--ink-faint);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--accent);
}

.separator {
  margin: 0 8px;
}

.account {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink-soft);
  text-decoration: none;
}

.user:hover {
  color: var(--accent);
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
}

.account button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: var(--ink-soft);
  font: inherit;
  cursor: pointer;
}
</style>
