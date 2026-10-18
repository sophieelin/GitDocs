import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

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

describe("/auth/register", () => {
  test("creates an account and starts a session", async () => {
    const { status, body } = await api.post("/auth/register", { username: "ari", password: "correct horse" });

    expect(status).toBe(200);
    expect(body.account).toBe("ari");
    expect(typeof body.session).toBe("string");
    expect(new Date(body.expiresAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  test("a taken username is a 409", async () => {
    await api.register("ari");

    expect(await api.post("/auth/register", { username: "ari", password: "another password" })).toEqual({
      status: 409,
      body: { error: "CONFLICT" },
    });
  });

  test("an invalid username or weak password is a 400", async () => {
    const invalid = await api.post("/auth/register", { username: "a!", password: "correct horse" });
    const weak = await api.post("/auth/register", { username: "ari", password: "short" });

    expect(invalid).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(weak).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
  });

  test("malformed input is a 400 before any action runs", async () => {
    expect((await api.post("/auth/register", { username: "ari" })).status).toBe(400);
    expect((await api.post("/auth/register", { username: 1, password: "correct horse" })).status).toBe(400);
    expect((await api.post("/auth/register", { username: "ari", password: "correct horse", admin: true })).status).toBe(
      400,
    );
  });
});

describe("/auth/sign-in", () => {
  test("the right password starts a new session", async () => {
    const first = await api.register("ari");
    const second = await api.signIn("ari");

    expect(second).not.toBe(first);
    expect(await api.post("/auth/current", { session: second })).toEqual({ status: 200, body: { username: "ari" } });
  });

  test("a wrong password or unknown user is a 401", async () => {
    await api.register("ari");

    expect(await api.post("/auth/sign-in", { username: "ari", password: "wrong password" })).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(await api.post("/auth/sign-in", { username: "nobody", password: "wrong password" })).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
  });
});

describe("/auth/current", () => {
  test("resolves a session to its username", async () => {
    const session = await api.register("ari");

    expect(await api.post("/auth/current", { session })).toEqual({ status: 200, body: { username: "ari" } });
  });

  test("an invented session is a 401", async () => {
    expect(await api.post("/auth/current", { session: "invented" })).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
  });
});

describe("/auth/sign-out", () => {
  test("ends the session, so reusing it is a 401", async () => {
    const session = await api.register("ari");

    expect(await api.post("/auth/sign-out", { session })).toEqual({ status: 200, body: { signedOut: true } });
    expect(await api.post("/auth/current", { session })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(await api.post("/auth/sign-out", { session })).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
  });

  test("signing out one session leaves the user's other sessions active", async () => {
    const first = await api.register("ari");
    const second = await api.signIn("ari");
    await api.post("/auth/sign-out", { session: first });

    expect(await api.post("/auth/current", { session: second })).toEqual({ status: 200, body: { username: "ari" } });
  });
});

test("two users get separate sessions", async () => {
  const a = await api.register("ari");
  const b = await api.register("bob");

  expect((await api.post("/auth/current", { session: a })).body).toEqual({ username: "ari" });
  expect((await api.post("/auth/current", { session: b })).body).toEqual({ username: "bob" });
});
