<script setup lang="ts">
import { useRouter } from "vue-router";
import { signOut, useSession } from "../session.ts";

const session = useSession();
const router = useRouter();

async function leave() {
  await signOut();
  await router.push("/sign-in");
}
</script>

<template>
  <header>
    <RouterLink to="/" class="brand">GitDocs</RouterLink>
    <nav v-if="session.session">
      <RouterLink to="/repositories">Repositories</RouterLink>
      <RouterLink to="/proposals">My proposals</RouterLink>
      <RouterLink to="/reviews">Reviews</RouterLink>
    </nav>
    <div class="account">
      <template v-if="session.session">
        <span class="username">{{ session.username }}</span>
        <button type="button" @click="leave">Sign out</button>
      </template>
      <RouterLink v-else to="/sign-in">Sign in</RouterLink>
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  text-decoration: none;
}

nav {
  display: flex;
  gap: 20px;
}

nav a,
.account a {
  color: #4b5563;
  text-decoration: none;
}

nav a.router-link-active {
  color: #2563eb;
  font-weight: 600;
}

.account {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.username {
  font-weight: 600;
}

.account button {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  cursor: pointer;
}
</style>
