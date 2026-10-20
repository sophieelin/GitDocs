<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { canPush, checkAccess } from "./access.ts";
import AppSidebar from "./components/AppSidebar.vue";
import AppTopBar from "./components/AppTopBar.vue";
import { handleEndedSession } from "./errors.ts";
import { useRefreshOnFocus } from "./refresh.ts";
import { useCurrentRepository } from "./repository.ts";
import { recheckSession, useSession } from "./session.ts";

const route = useRoute();
const router = useRouter();
const session = useSession();
const repository = useCurrentRepository();

/** Asks GitHub again whether the user can push to the open repository; the server keeps the answer 30 minutes. */
async function refreshAccess() {
  const current = repository.value;
  if (!current || !session.session) return;
  const answer = await checkAccess(current);
  if ("error" in answer) handleEndedSession(answer.error);
}

// Each time the tab is opened again, check the session is still active. If it
// ended (expired, or signed out in another tab), leave the protected page.
useRefreshOnFocus(async () => {
  // Until the first page is resolved, the route is a placeholder `/` that is not public.
  await router.isReady();
  await recheckSession();
  if (!session.session && !route.meta.public) {
    await router.push({ path: "/sign-in", query: { redirect: route.fullPath } });
    return;
  }
  await refreshAccess();
});

watch(() => (repository.value ? `${repository.value.owner}/${repository.value.name}` : null), refreshAccess);
// Well within the 30 minutes, so a long edit in one sitting is not refused.
const timer = setInterval(refreshAccess, 10 * 60 * 1000);
onUnmounted(() => clearInterval(timer));

const readOnly = computed(() => repository.value !== null && canPush(repository.value) === false);
</script>

<template>
  <!-- The layout from the UI sketches: sidebar, top bar, and the page. Sign-in has none of it. -->
  <div v-if="session.session && !route.meta.public" class="shell">
    <AppSidebar />
    <div class="workspace">
      <AppTopBar />
      <p v-if="readOnly && repository" class="read-only" role="status">
        You can read <strong>{{ repository.owner }}/{{ repository.name }}</strong>, but not change it here: GitHub says you cannot
        push to it. Starting, editing, and approving proposals needs push access.
      </p>
      <main>
        <RouterView />
      </main>
    </div>
  </div>
  <main v-else class="bare">
    <RouterView />
  </main>
</template>

<style>
:root {
  --ink: #1e293b;
  --ink-soft: #475569;
  --ink-faint: #64748b;
  --border: #e2e8f0;
  --sidebar: #f8fafc;
  --accent: #4263eb;
  --accent-soft: #e7edff;
  --surface: #fff;
}

body {
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
  color: var(--ink);
  background: var(--surface);
}

.shell {
  display: grid;
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}

.workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

main {
  padding: 32px 40px;
}

.read-only {
  margin: 0;
  padding: 10px 40px;
  border-bottom: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  font-size: 14px;
}

main.bare {
  min-height: 100vh;
  background: var(--sidebar);
}

/* Shared pieces from the UI sketches. */
h1.page-title {
  margin: 0 0 6px;
  font-size: 28px;
}

.page-subtitle {
  margin: 0 0 28px;
  color: var(--ink-faint);
}

.card {
  padding: 22px 24px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
}

.card > h2 {
  margin: 0 0 16px;
  font-size: 17px;
}

.button {
  padding: 10px 18px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.button.secondary {
  background: #fff;
  color: var(--accent);
}

.button:disabled {
  opacity: 0.6;
  cursor: default;
}

.muted {
  color: var(--ink-faint);
}
</style>
