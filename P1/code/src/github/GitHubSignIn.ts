import { GitHubError, GitHubRequestFailed, InvalidRepositoryName, repoPath } from "./GitHubApi.ts";
import type { RepositoryRef } from "./types.ts";

/** GitHub refused the token: it was revoked, or the OAuth App was removed. */
export class GitHubTokenRejected extends GitHubError {}

/** GitHub turned down the code from its redirect: it expired, was used, or is not this app's. */
export class GitHubCodeRejected extends GitHubError {}

/**
 * GitHub's OAuth web flow, and the one question asked with a user's own
 * token. It knows nothing about HTTP routes or MongoDB, so routes are tested
 * with a stub.
 */
export interface GitHubSignIn {
  /** False until the OAuth App's client id and secret are set. */
  readonly configured: boolean;
  /** Where to send the browser to ask the user; GitHub then redirects to `redirectUri` with `state` and a code. */
  authorizeUrl(state: string, redirectUri: string): string;
  /** The user's token for the code GitHub redirected with. */
  exchange(code: string, redirectUri: string): Promise<string>;
  /** Whose token it is: GitHub's numeric user id, as a string, and login. */
  user(token: string): Promise<{ id: string; login: string }>;
  /** Whether the token's user can push to the repository. A repository they cannot see is false. */
  canPush(token: string, repository: RepositoryRef): Promise<boolean>;
}

export interface GitHubSignInOptions {
  clientId?: string;
  clientSecret?: string;
  webUrl?: string;
  apiUrl?: string;
  fetch?: typeof fetch;
}

export class GitHubOAuth implements GitHubSignIn {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webUrl: string;
  private readonly apiUrl: string;
  private readonly fetch: typeof fetch;

  constructor({
    clientId = "",
    clientSecret = "",
    webUrl = "https://github.com",
    apiUrl = "https://api.github.com",
    fetch: fetchImpl = fetch,
  }: GitHubSignInOptions = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.webUrl = webUrl;
    this.apiUrl = apiUrl;
    this.fetch = fetchImpl;
  }

  get configured(): boolean {
    return this.clientId !== "" && this.clientSecret !== "";
  }

  authorizeUrl(state: string, redirectUri: string): string {
    // No scope: the user's identity and public repositories, which is all GitDocs reads.
    const query = new URLSearchParams({ client_id: this.clientId, redirect_uri: redirectUri, state, allow_signup: "false" });
    return `${this.webUrl}/login/oauth/authorize?${query}`;
  }

  async exchange(code: string, redirectUri: string): Promise<string> {
    const response = await this.send(`${this.webUrl}/login/oauth/access_token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, code, redirect_uri: redirectUri }),
    });
    if (!response.ok) throw new GitHubRequestFailed(`GitHub answered ${response.status} to the code exchange.`, response.status);
    // GitHub answers 200 with an `error` field for a bad code.
    const body = (await response.json()) as { access_token?: string; error?: string };
    if (typeof body.access_token !== "string" || body.access_token === "") {
      throw new GitHubCodeRejected(`GitHub turned down the sign-in code (${body.error ?? "no token"}).`);
    }
    return body.access_token;
  }

  async user(token: string): Promise<{ id: string; login: string }> {
    const response = await this.api("/user", token);
    if (!response.ok) throw new GitHubRequestFailed(`GitHub answered ${response.status} for the user.`, response.status);
    const body = (await response.json()) as { id?: number; login?: string };
    if (typeof body.id !== "number" || typeof body.login !== "string") throw new GitHubRequestFailed("GitHub's user had no id or login.");
    return { id: String(body.id), login: body.login };
  }

  async canPush(token: string, repository: RepositoryRef): Promise<boolean> {
    let path: string;
    try {
      path = repoPath(repository);
    } catch (error) {
      if (error instanceof InvalidRepositoryName) return false;
      throw error;
    }
    const response = await this.api(path, token);
    // A private repository the user cannot see looks missing, as GitHub intends.
    if (response.status === 404) return false;
    if (!response.ok) throw new GitHubRequestFailed(`GitHub answered ${response.status} for the repository.`, response.status);
    const body = (await response.json()) as { permissions?: { push?: boolean } };
    return body.permissions?.push === true;
  }

  private async api(path: string, token: string): Promise<Response> {
    const response = await this.send(`${this.apiUrl}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GitDocs",
      },
    });
    if (response.status === 401) throw new GitHubTokenRejected("GitHub no longer accepts this sign-in.");
    return response;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetch(url, init);
    } catch (error) {
      throw new GitHubRequestFailed(`Could not reach GitHub: ${(error as Error).message}`);
    }
  }
}

/** The OAuth App configured from the environment. This is the only place that reads its client id and secret. */
export function gitHubSignInFromEnv(): GitHubOAuth {
  return new GitHubOAuth({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET });
}
