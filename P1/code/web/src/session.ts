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

export async function signIn(username: string, password: string) {
  const result = await api.auth["sign-in"]({ username, password });
  if (!("error" in result)) setSession(result.session, result.account);
  return result;
}

export async function register(username: string, password: string) {
  const result = await api.auth.register({ username, password });
  if (!("error" in result)) setSession(result.session, result.account);
  return result;
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
