<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ErrorBanner from "../components/ErrorBanner.vue";
import { errorMessage } from "../errors.ts";
import { register, signIn } from "../session.ts";

const route = useRoute();
const router = useRouter();

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

// The same rules as Authenticating, checked here because the API answers both
// with the same INVALID_REQUEST and cannot say which one failed.
const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

function registrationProblem(): string | null {
  if (!USERNAME.test(username.value)) return "A username must be 3 to 32 letters, numbers, underscores, or hyphens.";
  if (password.value.length < 8 || password.value.length > 128) return "A password must be 8 to 128 characters.";
  return null;
}

async function submit(action: "sign-in" | "register") {
  error.value = action === "register" ? registrationProblem() : null;
  if (error.value) return;

  busy.value = true;
  const result =
    action === "sign-in" ? await signIn(username.value, password.value) : await register(username.value, password.value);
  busy.value = false;

  if ("error" in result) {
    error.value = errorMessage(
      result.error,
      action === "sign-in"
        ? { UNAUTHORIZED: "Wrong username or password.", INVALID_REQUEST: "Wrong username or password." }
        : {
            CONFLICT: "That username is already taken.",
            INVALID_REQUEST: "Check that your username and password follow the rules.",
          },
    );
    return;
  }
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/repositories";
  await router.push(redirect);
}
</script>

<template>
  <section class="sign-in">
    <h2>Sign in to GitDocs</h2>
    <form @submit.prevent="submit('sign-in')">
      <label>
        Username
        <input v-model="username" name="username" autocomplete="username" required />
      </label>
      <label>
        Password
        <input v-model="password" name="password" type="password" autocomplete="current-password" required />
      </label>
      <ErrorBanner :message="error" />
      <div class="actions">
        <button type="submit" :disabled="busy">Sign in</button>
        <button type="button" class="secondary" :disabled="busy" @click="submit('register')">Create account</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.sign-in {
  max-width: 360px;
  margin: 48px auto;
}

form {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}

input {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
}

.actions {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  border: 1px solid #2563eb;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

button.secondary {
  background: #fff;
  color: #2563eb;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
