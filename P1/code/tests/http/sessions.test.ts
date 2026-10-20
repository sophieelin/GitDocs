import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import { createHandler } from "../../src/http.ts";
import { StubGitHubFetcher } from "../github/StubGitHubFetcher.ts";
import { StubGitHubSignIn } from "../github/StubGitHubSignIn.ts";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi, testTokens } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  api = testApi(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

const paperNet = { owner: "sophieelin", name: "PaperNet" };

function fragment(response: Response): URLSearchParams {
  return new URLSearchParams((response.headers.get("location") ?? "").split("#")[1] ?? "");
}

describe("signing in with GitHub", () => {
  test("starting sends the browser to GitHub with a state, kept in a cookie for the callback only", async () => {
    const response = await api.get("/auth/github?redirect=/repositories/a/b");

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://github.test/login/oauth/authorize");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost/api/auth/github/callback");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie.startsWith(`gitdocs_oauth=${location.searchParams.get("state")}.`)).toBe(true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/auth/github");
  });

  test("the callback starts a session for the GitHub user and returns to the page asked for", async () => {
    const response = await api.signInThroughGitHub("ari", { redirect: "/repositories/sophieelin/PaperNet" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")!.startsWith("/signed-in#")).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    const session = fragment(response).get("session")!;
    expect(fragment(response).get("redirect")).toBe("/repositories/sophieelin/PaperNet");
    expect(await api.post("/auth/current", { session })).toEqual({ status: 200, body: { username: "ari" } });
  });

  test("the token is stored sealed, not as GitHub gave it", async () => {
    await api.signIn("ari");

    const [account] = await testDb.db.collection("Authenticating.accounts").find().toArray();
    expect(account!.username).toBe("ari");
    expect(account!.token).not.toContain("token-ari");
    expect(testTokens.open(account!.token)).toBe("token-ari");
  });

  test("signing in again is the same account with a new session", async () => {
    const first = await api.signIn("ari");
    const second = await api.signIn("ari");

    expect(second).not.toBe(first);
    expect(await api.post("/auth/current", { session: second })).toEqual({ status: 200, body: { username: "ari" } });
    expect(await testDb.db.collection("Authenticating.accounts").countDocuments()).toBe(1);
  });

  test("another GitHub account with a login already held here is sent back to sign-in", async () => {
    const oauth = new StubGitHubSignIn({ ids: { ari: "101" } });
    const first = testApi(testDb.db, new StubGitHubFetcher(), oauth);
    await first.signIn("ari");
    // The same login, now on a different GitHub account.
    const second = testApi(testDb.db, new StubGitHubFetcher(), new StubGitHubSignIn({ ids: { ari: "202" } }));

    const response = await second.signInThroughGitHub("ari");
    expect(response.headers.get("location")).toBe("/sign-in?error=taken");
  });

  test("a callback whose state does not match the cookie, or has no cookie, starts no session", async () => {
    const started = await api.get("/auth/github");
    const cookie = started.headers.get("set-cookie")!.split(";")[0]!;

    const forged = await api.get("/auth/github/callback?code=code-ari&state=forged", cookie);
    expect(forged.headers.get("location")).toBe("/sign-in?error=state");
    const state = new URL(started.headers.get("location")!).searchParams.get("state")!;
    const cookieless = await api.get(`/auth/github/callback?code=code-ari&state=${state}`);
    expect(cookieless.headers.get("location")).toBe("/sign-in?error=state");
    expect(api.oauth.calls).toEqual([]);
    expect(await testDb.db.collection("Sessioning.sessions").countDocuments()).toBe(0);
  });

  test("a code GitHub turns down, or the user saying no at GitHub, goes back to sign-in", async () => {
    expect((await api.signInThroughGitHub("ari", { code: "expired" })).headers.get("location")).toBe("/sign-in?error=state");

    const started = await api.get("/auth/github");
    const cookie = started.headers.get("set-cookie")!.split(";")[0]!;
    const denied = await api.get("/auth/github/callback?error=access_denied", cookie);
    expect(denied.headers.get("location")).toBe("/sign-in?error=denied");
  });

  test("only a page of this site is returned to", async () => {
    for (const redirect of ["https://evil.test/", "//evil.test/", "/\\evil.test", "repositories"]) {
      const response = await api.signInThroughGitHub("ari", { redirect });
      expect(fragment(response).get("redirect")).toBe("/repositories");
    }
  });

  test("without an OAuth App configured, starting goes back to sign-in with a reason", async () => {
    const unconfigured = testApi(testDb.db, new StubGitHubFetcher(), new StubGitHubSignIn({ configured: false }));

    expect((await unconfigured.get("/auth/github")).headers.get("location")).toBe("/sign-in?error=not-configured");
  });

  test("without TOKEN_SECRET the server still answers, and sign-in says it is not set up", async () => {
    const handler = createHandler(assembleApplication({ db: testDb.db }), new StubGitHubFetcher(), {
      github: new StubGitHubSignIn(),
      tokens: undefined,
    });

    const response = await handler(new Request("http://localhost/api/auth/github"));
    expect(response.headers.get("location")).toBe("/sign-in?error=not-configured");
    const current = await handler(
      new Request("http://localhost/api/auth/current", { method: "POST", headers: { "content-type": "application/json" }, body: '{"session":"x"}' }),
    );
    expect(current.status).toBe(401);
  });

  test("the old password endpoints are gone", async () => {
    expect((await api.post("/auth/register", { username: "ari", password: "correct horse" })).status).toBe(404);
    expect((await api.post("/auth/sign-in", { username: "ari", password: "correct horse" })).status).toBe(404);
  });
});

describe("/github/access", () => {
  test("answers whether the user can push, as GitHub says with their own token", async () => {
    const session = await api.signIn("ari");
    api.oauth.denyPush("ari", { owner: "sophieelin", name: "Other" });

    expect(await api.grant(session, paperNet)).toEqual({ status: 200, body: { canPush: true } });
    expect(await api.grant(session, { owner: "sophieelin", name: "Other" })).toEqual({ status: 200, body: { canPush: false } });
    expect(api.oauth.calls.filter((call) => call.startsWith("canPush"))).toEqual(["canPush ari sophieelin/PaperNet", "canPush ari sophieelin/Other"]);
  });

  test("a revoked token or an ended session is a 401; a malformed request is a 400", async () => {
    const session = await api.signIn("ari");
    api.oauth.revoke("ari");

    expect(await api.grant(session, paperNet)).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await api.grant("invented", paperNet)).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect((await api.post("/github/access", { session, owner: "sophieelin" })).status).toBe(400);
  });
});

describe("/auth/current", () => {
  test("an invented session is a 401", async () => {
    expect(await api.post("/auth/current", { session: "invented" })).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
  });
});

describe("/auth/sign-out", () => {
  test("ends the session, so reusing it is a 401", async () => {
    const session = await api.signIn("ari");

    expect(await api.post("/auth/sign-out", { session })).toEqual({ status: 200, body: { signedOut: true } });
    expect(await api.post("/auth/current", { session })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await api.post("/auth/sign-out", { session })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
  });

  test("signing out one session leaves the user's other sessions active", async () => {
    const first = await api.signIn("ari");
    const second = await api.signIn("ari");
    await api.post("/auth/sign-out", { session: first });

    expect(await api.post("/auth/current", { session: second })).toEqual({ status: 200, body: { username: "ari" } });
  });
});

test("two users get separate sessions", async () => {
  const a = await api.signIn("ari");
  const b = await api.signIn("bob");

  expect((await api.post("/auth/current", { session: a })).body).toEqual({ username: "ari" });
  expect((await api.post("/auth/current", { session: b })).body).toEqual({ username: "bob" });
});
