import { reactive, readonly } from "vue";
import { api } from "./api.ts";

const STORAGE_KEY = "gitdocs.session";

const state = reactive({
  session: null as string | null,
  username: null as string | null,
});

// The browser can refuse storage (private windows, blocked site data), so every
// access is wrapped: GitDocs still works, it just forgets the session on reload.
function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(session: string | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, session);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not stored; the user stays signed in until the page is reloaded.
  }
}

function setSession(session: string, username: string): void {
  state.session = session;
  state.username = username;
  store(session);
}

/** Forgets the session in this browser, without calling the API. */
export function clearSession(): void {
  state.session = null;
  state.username = null;
  store(null);
}

let restoring: Promise<void> | undefined;

/** Checks a stored session with `/auth/current` once per page load. */
export function restoreSession(): Promise<void> {
  restoring ??= (async () => {
    const session = stored();
    if (!session) return;
    const result = await api.auth.current({ session });
    if ("error" in result) clearSession();
    else setSession(session, result.username);
  })();
  return restoring;
}

/**
 * Asks the server again whether the session is still active, for example after
 * it expired or the user signed out in another tab. Forgets it if not.
 */
export async function recheckSession(): Promise<void> {
  await restoreSession();
  const session = state.session;
  if (!session) return;
  const result = await api.auth.current({ session });
  if ("error" in result && state.session === session) clearSession();
}

/**
 * Starts signing in with GitHub: the browser leaves for GitHub, and comes back
 * to `/signed-in` with a session, then goes on to `redirect`.
 */
export function signInWithGitHub(redirect: string): void {
  window.location.assign(`/api/auth/github?${new URLSearchParams({ redirect })}`);
}

/** Keeps the session GitHub sign-in handed over, once the server confirms it is active. */
export async function adoptSession(session: string): Promise<boolean> {
  const result = await api.auth.current({ session });
  if ("error" in result) return false;
  setSession(session, result.username);
  return true;
}

/** Ends the session on the server, then forgets it here even if the server refused. */
export async function signOut(): Promise<void> {
  if (state.session) await api.auth["sign-out"]({ session: state.session });
  clearSession();
}

/** The `session` field every signed-in request sends. */
export function sessionInput(): { session: string } {
  if (!state.session) throw new Error("Not signed in.");
  return { session: state.session };
}

export function useSession() {
  return readonly(state);
}
