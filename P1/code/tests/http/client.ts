import type { Db } from "mongodb";
import { assembleApplication } from "../../src/assembly.ts";
import type { GitHubFetcher } from "../../src/github/GitHubFetcher.ts";
import { tokenBox } from "../../src/github/tokenBox.ts";
import { createHandler } from "../../src/http.ts";
import { StubGitHubFetcher } from "../github/StubGitHubFetcher.ts";
import { StubGitHubSignIn } from "../github/StubGitHubSignIn.ts";

export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

/** The key tokens are sealed with in tests. */
export const testTokens = tokenBox("a test secret that is long enough to use");

/**
 * Calls the HTTP handler in-process with `Request` objects. No server and no port
 * are needed, and GitHub is the offline stubs unless a test passes others.
 */
export function testApi(db: Db, github: GitHubFetcher = new StubGitHubFetcher(), oauth = new StubGitHubSignIn()) {
  const handler = createHandler(assembleApplication({ db }), github, { github: oauth, tokens: testTokens });

  async function post(path: string, body: unknown = {}): Promise<ApiResponse> {
    const response = await handler(
      new Request(`http://localhost/api${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  /** A GET, as the browser sends on a redirect, with an optional cookie. */
  function get(path: string, cookie?: string): Promise<Response> {
    return handler(new Request(`http://localhost/api${path}`, { headers: cookie ? { cookie } : {} }));
  }

  /**
   * Goes through GitHub sign-in as `login`: starts it, comes back from GitHub
   * with `code`, and answers the final redirect.
   */
  async function signInThroughGitHub(login: string, { code = `code-${login}`, redirect = "/repositories" } = {}): Promise<Response> {
    const started = await get(`/auth/github?redirect=${encodeURIComponent(redirect)}`);
    const cookie = started.headers.get("set-cookie")!.split(";")[0]!;
    const state = new URL(started.headers.get("location")!).searchParams.get("state")!;
    return get(`/auth/github/callback?${new URLSearchParams({ code, state })}`, cookie);
  }

  /** Signs in as `login` through GitHub and returns the new session. */
  async function signIn(login: string): Promise<string> {
    const response = await signInThroughGitHub(login);
    const location = response.headers.get("location") ?? "";
    const session = new URLSearchParams(location.split("#")[1] ?? "").get("session");
    if (!session) throw new Error(`sign-in ${login} failed: ${response.status} ${location}`);
    return session;
  }

  /** Asks GitHub (the stub) whether the session's user can push to the repository, which lets them change its proposals. */
  async function grant(session: string, repository: { owner: string; name: string }): Promise<ApiResponse> {
    return post("/github/access", { session, ...repository });
  }

  // The first sign-in makes the account, so registering is signing in.
  return { post, get, signInThroughGitHub, register: signIn, signIn, grant, oauth };
}
