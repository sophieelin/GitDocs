<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { adoptSession } from "../session.ts";

/**
 * Where GitHub sign-in ends: the server put the session and the page to go on
 * to in the URL fragment, which no server sees. The session is kept, and this
 * page's history entry, fragment and all, is replaced by the next page.
 */
const router = useRouter();

onMounted(async () => {
  const handed = new URLSearchParams(window.location.hash.slice(1));
  const session = handed.get("session");
  const redirect = handed.get("redirect") ?? "/repositories";
  // The server only hands over a path on this site; check again before following it.
  const next = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/repositories";
  if (session && (await adoptSession(session))) await router.replace(next);
  else await router.replace({ path: "/sign-in", query: { error: "failed" } });
});
</script>

<template>
  <p class="muted signing-in">Signing in…</p>
</template>

<style scoped>
.signing-in {
  padding-top: 120px;
  text-align: center;
}
</style>
