/**
 * Signing in with GitHub, and asking GitHub whether the signed-in user can push
 * to a repository. Plain HTTP routes, not sync-engine endpoints, because they
 * redirect the browser and call GitHub; they call the concepts' actions
 * directly (decision of 2026-10-20, see `design/compositions/Sessions.md`).
 *
 * - `GET  /auth/github?redirect=/path` sends the browser to GitHub.
 * - `GET  /auth/github/callback` is where GitHub sends it back; it starts a
 *   session and redirects to `/signed-in#session=…&redirect=…`, or to
 *   `/sign-in?error=…`.
 * - `POST /github/access` with `{ session, owner, name }` answers `{ canPush }`
 *   and records it for RepositoryAccess.
 */
import { hasOnly, record } from "../compositions/validators.ts";
import { GitHubRateLimited, GitHubRequestFailed } from "./GitHubApi.ts";
import { GitHubCodeRejected, GitHubTokenRejected, type GitHubSignIn } from "./GitHubSignIn.ts";
import type { TokenBox } from "./tokenBox.ts";

/** The concept calls these routes make, as the assembled application answers them. */
export interface SignInConcepts {
  authenticate(input: { githubId: string; login: string; token: string }): Promise<{ account: string } | { error: string }>;
  startSession(input: { subject: string }): Promise<{ session: string } | { error: string }>;
  currentUser(session: string): Promise<string | undefined>;
  token(username: string): Promise<string | undefined>;
  recordAccess(input: { user: string; owner: string; name: string; canPush: boolean; at: Date }): Promise<unknown>;
}

export interface SignInRoutesOptions {
  github: GitHubSignIn;
  /** Without one (no TOKEN_SECRET), sign-in is not set up, as without an OAuth App. */
  tokens: TokenBox | undefined;
  concepts: SignInConcepts;
  basePath: string;
  /** The callback URL registered with the OAuth App; by default, this server's own. */
  callbackUrl?: string;
  /** Marks the state cookie Secure, for HTTPS. */
  secureCookies?: boolean;
}

/** The answer to `POST /github/access`. */
export interface AccessResponse {
  canPush: boolean;
}

const STATE_COOKIE = "gitdocs_oauth";
/** Long enough to sign in at GitHub, short enough that a stale tab cannot reuse it. */
const STATE_LIFETIME_S = 10 * 60;

export function createSignInRoutes({ github, tokens, concepts, basePath, callbackUrl, secureCookies = false }: SignInRoutesOptions) {
  const startPath = `${basePath}/auth/github`;
  const callbackPath = `${basePath}/auth/github/callback`;
  const accessPath = `${basePath}/github/access`;

  const callbackFor = (request: Request) => callbackUrl ?? `${new URL(request.url).origin}${callbackPath}`;

  function cookie(value: string, maxAge: number): string {
    return [`${STATE_COOKIE}=${value}`, `Path=${startPath}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax", ...(secureCookies ? ["Secure"] : [])].join("; ");
  }

  async function start(request: Request): Promise<Response> {
    if (!github.configured || !tokens) return redirect("/sign-in?error=not-configured");
    const asked = new URL(request.url).searchParams.get("redirect");
    const state = crypto.randomUUID();
    // The state proves the callback answers this browser's own request; the page to return to rides along.
    return redirect(github.authorizeUrl(state, callbackFor(request)), cookie(`${state}.${encode(pagePath(asked))}`, STATE_LIFETIME_S));
  }

  async function callback(request: Request): Promise<Response> {
    const query = new URL(request.url).searchParams;
    const cleared = cookie("", 0);
    const [expected, page] = (readCookie(request, STATE_COOKIE) ?? "").split(".");
    if (query.get("error") === "access_denied") return redirect("/sign-in?error=denied", cleared);
    const code = query.get("code");
    if (!expected || query.get("state") !== expected || !code) return redirect("/sign-in?error=state", cleared);
    if (!github.configured || !tokens) return redirect("/sign-in?error=not-configured", cleared);

    try {
      const token = await github.exchange(code, callbackFor(request));
      const { id, login } = await github.user(token);
      const authenticated = await concepts.authenticate({ githubId: id, login, token: tokens.seal(token) });
      if ("error" in authenticated) {
        return redirect(`/sign-in?error=${authenticated.error === "USERNAME_TAKEN" ? "taken" : "failed"}`, cleared);
      }
      const started = await concepts.startSession({ subject: authenticated.account });
      if ("error" in started) return redirect("/sign-in?error=failed", cleared);
      // A fragment is never sent to a server, so the session stays out of logs and Referer headers.
      const fragment = new URLSearchParams({ session: started.session, redirect: decode(page ?? "") });
      return redirect(`/signed-in#${fragment}`, cleared);
    } catch (failure) {
      if (failure instanceof GitHubCodeRejected) return redirect("/sign-in?error=state", cleared);
      if (failure instanceof GitHubRequestFailed || failure instanceof GitHubTokenRejected || failure instanceof GitHubRateLimited) {
        return redirect("/sign-in?error=github", cleared);
      }
      console.error(failure);
      return redirect("/sign-in?error=failed", cleared);
    }
  }

  async function access(request: Request): Promise<Response> {
    if (request.method !== "POST") return error("INVALID_REQUEST", 400);
    const input = await readJson(request);
    const keys = ["session", "owner", "name"];
    if (!record(input) || !hasOnly(input, keys) || !keys.every((key) => boundedString(input[key]))) return error("INVALID_REQUEST", 400);
    const user = await concepts.currentUser(input.session as string);
    if (user === undefined) return error("UNAUTHORIZED", 401);
    const sealed = await concepts.token(user);
    const token = sealed === undefined ? undefined : tokens?.open(sealed);
    // A token that cannot be opened (the key changed) is as good as revoked: sign in again.
    if (token === undefined) return error("UNAUTHORIZED", 401);

    const repository = { owner: input.owner as string, name: input.name as string };
    try {
      const canPush = await github.canPush(token, repository);
      await concepts.recordAccess({ user, ...repository, canPush, at: new Date() });
      return Response.json({ canPush } satisfies AccessResponse);
    } catch (failure) {
      if (failure instanceof GitHubTokenRejected) return error("UNAUTHORIZED", 401);
      if (failure instanceof GitHubRequestFailed || failure instanceof GitHubRateLimited) return error("GITHUB_UNAVAILABLE", 503);
      console.error(failure);
      return error("INTERNAL_ERROR", 500);
    }
  }

  /** Answers these routes, and returns `undefined` for every other path. */
  return async (request: Request): Promise<Response | undefined> => {
    const path = new URL(request.url).pathname;
    if (path === accessPath) return access(request);
    if (path !== startPath && path !== callbackPath) return undefined;
    if (request.method !== "GET") return error("INVALID_REQUEST", 400);
    return path === startPath ? start(request) : callback(request);
  };
}

/** A page of this app to return to: a path on this site, never another site. */
function pagePath(asked: string | null): string {
  if (!asked || !asked.startsWith("/") || asked.startsWith("//") || asked.includes("\\") || asked.length > 500) return "/repositories";
  return asked;
}

function encode(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function decode(text: string): string {
  return pagePath(Buffer.from(text, "base64url").toString("utf8"));
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function redirect(location: string, setCookie?: string): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 10_000) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function error(code: string, status: number): Response {
  return Response.json({ error: code }, { status });
}
