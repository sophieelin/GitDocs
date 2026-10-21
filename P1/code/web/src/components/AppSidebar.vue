<script setup lang="ts">
import { computed } from "vue";
import { repositoryPath, useCurrentRepository } from "../repository.ts";

// The left sidebar from the UI sketches. Inside a repository's workspace it links
// to that repository's pages; outside one, only to the Repositories page.
const repository = useCurrentRepository();

const links = computed(() => {
  const current = repository.value;
  if (!current) return [{ to: "/repositories", label: "Repositories", icon: "home", exact: true }];
  return [
    // The repository's Home is labelled with its name, such as "PaperNet".
    { to: repositoryPath(current), label: current.name, icon: "home", exact: true },
    { to: repositoryPath(current, "/proposals"), label: "Proposals", icon: "bulb", exact: false },
    { to: repositoryPath(current, "/reviews"), label: "Reviews", icon: "review", exact: false },
  ];
});
</script>

<template>
  <aside class="sidebar">
    <RouterLink to="/repositories" class="brand">GitDocs</RouterLink>
    <nav>
      <RouterLink
        v-for="link in links"
        :key="link.label"
        :to="link.to"
        class="link"
        :exact-active-class="link.exact ? 'current' : ''"
        :active-class="link.exact ? '' : 'current'"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="link.icon === 'home'" d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          <template v-else-if="link.icon === 'document'">
            <path d="M6 3h9l4 4v14H6z" />
            <path d="M9 11h7M9 15h7M9 7h4" />
          </template>
          <template v-else-if="link.icon === 'bulb'">
            <path d="M9 18h6M10 21h4" />
            <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
          </template>
          <template v-else>
            <path d="M4 4h16v12H8l-4 4z" />
            <path d="M8 9h8M8 12h5" />
          </template>
        </svg>
        {{ link.label }}
      </RouterLink>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 28px 16px;
  border-right: 1px solid var(--border);
  background: var(--sidebar);
}

.brand {
  padding: 0 12px;
  color: var(--strong);
  font-size: 24px;
  font-weight: 700;
  text-decoration: none;
}

nav {
  display: grid;
  gap: 6px;
}

.link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--ink-soft);
  text-decoration: none;
}

.link:hover {
  background: var(--hover);
}

.link.current {
  background: var(--hover);
  color: var(--ink);
  font-weight: 600;
}

svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
