import { GitHubCodeRejected, GitHubTokenRejected, type GitHubSignIn } from "../../src/github/GitHubSignIn.ts";
import type { RepositoryRef } from "../../src/github/types.ts";

/**
 * GitHub's OAuth flow with fixed answers, so tests run without the network.
 * The code `code-<login>` signs in as `<login>`, whose GitHub id is given in
 * `ids` or made from the login. By default every user can push everywhere;
 * `denyPush` takes that away for one user and repository, and `revoke` makes
 * GitHub refuse a user's token.
 */
export class StubGitHubSignIn implements GitHubSignIn {
  readonly configured: boolean;
  /** Every call, in order, so tests can check what was asked. */
  readonly calls: string[] = [];
  private readonly denied = new Set<string>();
  private readonly revoked = new Set<string>();

  constructor({ configured = true, ids = {} }: { configured?: boolean; ids?: Record<string, string> } = {}) {
    this.configured = configured;
    this.ids = ids;
  }

  private readonly ids: Record<string, string>;

  authorizeUrl(state: string, redirectUri: string): string {
    return `https://github.test/login/oauth/authorize?${new URLSearchParams({ state, redirect_uri: redirectUri })}`;
  }

  async exchange(code: string): Promise<string> {
    this.calls.push(`exchange ${code}`);
    if (!code.startsWith("code-")) throw new GitHubCodeRejected("bad code");
    return `token-${code.slice("code-".length)}`;
  }

  async user(token: string): Promise<{ id: string; login: string }> {
    const login = this.login(token);
    return { id: this.ids[login] ?? String([...login].reduce((sum, c) => sum * 31 + c.charCodeAt(0), 7) % 1e9), login };
  }

  async canPush(token: string, { owner, name }: RepositoryRef): Promise<boolean> {
    const login = this.login(token);
    this.calls.push(`canPush ${login} ${owner}/${name}`);
    return !this.denied.has(`${login} ${owner}/${name}`.toLowerCase());
  }

  denyPush(login: string, { owner, name }: RepositoryRef): void {
    this.denied.add(`${login} ${owner}/${name}`.toLowerCase());
  }

  revoke(login: string): void {
    this.revoked.add(login);
  }

  private login(token: string): string {
    const login = token.slice("token-".length);
    if (!token.startsWith("token-") || this.revoked.has(login)) throw new GitHubTokenRejected("revoked");
    return login;
  }
}
