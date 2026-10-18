<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import AppSidebar from "./components/AppSidebar.vue";
import AppTopBar from "./components/AppTopBar.vue";
import { useRefreshOnFocus } from "./refresh.ts";
import { recheckSession, useSession } from "./session.ts";

const route = useRoute();
const router = useRouter();
const session = useSession();

// Each time the tab is opened again, check the session is still active. If it
// ended (expired, or signed out in another tab), leave the protected page.
useRefreshOnFocus(async () => {
  await recheckSession();
  if (!session.session && !route.meta.public) {
    await router.push({ path: "/sign-in", query: { redirect: route.fullPath } });
  }
});
</script>

<template>
  <!-- The layout from the UI sketches: sidebar, top bar, and the page. Sign-in has none of it. -->
  <div v-if="session.session && !route.meta.public" class="shell">
    <AppSidebar />
    <div class="workspace">
      <AppTopBar />
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
