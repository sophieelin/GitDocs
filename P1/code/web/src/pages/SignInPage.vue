<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import SiteHeader from "../components/SiteHeader.vue";
import { GENERAL_ERROR } from "../errors.ts";
import { signInWithGitHub } from "../session.ts";

const route = useRoute();
const busy = ref(false);

/** Why the last sign-in came back here, from the server's `?error=`. */
const reasons: Record<string, string> = {
  denied: "GitHub sign-in was cancelled.",
  state: "That sign-in expired or was started in another tab. Try again.",
  taken: "Another GitDocs account already uses this GitHub name. Ask the person who runs GitDocs for help.",
  github: "GitHub could not be reached. Try again later.",
  // Setup details are for whoever runs the server, so they go only to the backend's log.
  "not-configured": GENERAL_ERROR,
  failed: GENERAL_ERROR,
};

const error = computed(() => {
  const reason = route.query.error;
  return typeof reason === "string" ? (reasons[reason] ?? GENERAL_ERROR) : null;
});

function start() {
  busy.value = true;
  signInWithGitHub(typeof route.query.redirect === "string" ? route.query.redirect : "/repositories");
}
</script>

<template>
  <div class="page">
    <SiteHeader>
      <RouterLink to="/" class="about">What is GitDocs?</RouterLink>
    </SiteHeader>
    <section class="sign-in card">
      <h1>Sign in</h1>
      <p class="muted">
        GitDocs uses your GitHub account. To start, edit, or approve a repository's proposals, you need push access to it on GitHub.
      </p>
      <ErrorBanner :message="error" />
      <button type="button" class="button github" :disabled="busy" @click="start">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        Sign in with GitHub
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 1080px;
  margin: 0 auto;
}

.about {
  color: var(--ink-soft);
  font-size: 14px;
  text-underline-offset: 4px;
}

.sign-in {
  display: grid;
  gap: 16px;
  max-width: 380px;
  margin: 80px auto 0;
}

h1 {
  margin: 0;
  font-family: var(--serif);
  font-size: 26px;
  font-weight: 600;
}

.sign-in p {
  margin: 0;
  font-size: 14px;
}

.github {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  border-color: #1f2328;
  background: #1f2328;
}

.github svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
</style>
