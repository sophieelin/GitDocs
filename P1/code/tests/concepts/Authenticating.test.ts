import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { AuthenticatingConcept, InvalidIdentity, UsernameTaken } from "../../src/concepts/Authenticating.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let authenticating: AuthenticatingConcept;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  authenticating = new AuthenticatingConcept(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

describe("Authenticating", () => {
  test("its principle: the first sign-in adds the account, the next returns it, and a renamed login keeps it", async () => {
    expect(await authenticating._registered({ username: "ari" })).toEqual({ registered: false });
    expect(await authenticating.authenticate({ githubId: "101", login: "ari", token: "sealed-1" })).toEqual({ account: "ari" });
    expect(await authenticating._registered({ username: "ari" })).toEqual({ registered: true });

    // Signed in again after renaming on GitHub: the same account, with the newest token.
    expect(await authenticating.authenticate({ githubId: "101", login: "ari-renamed", token: "sealed-2" })).toEqual({ account: "ari" });
    expect(await authenticating._token({ username: "ari" })).toEqual([{ token: "sealed-2" }]);
    expect(await authenticating._registered({ username: "ari-renamed" })).toEqual({ registered: false });
  });

  test("one GitHub account is one account: another GitHub account with a held login is refused", async () => {
    await authenticating.authenticate({ githubId: "101", login: "ari", token: "sealed" });

    await expect(authenticating.authenticate({ githubId: "202", login: "ari", token: "other" })).rejects.toThrow(UsernameTaken);
    expect(await authenticating._token({ username: "ari" })).toEqual([{ token: "sealed" }]);
    expect(await testDb.db.collection("Authenticating.accounts").countDocuments()).toBe(1);
  });

  test("signing in twice at once for the first time makes one account", async () => {
    const results = await Promise.all([
      authenticating.authenticate({ githubId: "101", login: "ari", token: "a" }),
      authenticating.authenticate({ githubId: "101", login: "ari", token: "b" }),
    ]);

    expect(results).toEqual([{ account: "ari" }, { account: "ari" }]);
    expect(await testDb.db.collection("Authenticating.accounts").countDocuments()).toBe(1);
  });

  test("refuses an identity GitHub could not have given", async () => {
    for (const identity of [
      { githubId: "", login: "ari", token: "t" },
      { githubId: "12a", login: "ari", token: "t" },
      { githubId: "101", login: "", token: "t" },
      { githubId: "101", login: "a_b", token: "t" },
      { githubId: "101", login: "x".repeat(40), token: "t" },
      { githubId: "101", login: "ari", token: "" },
    ]) {
      await expect(authenticating.authenticate(identity)).rejects.toThrow(InvalidIdentity);
    }
    expect(await testDb.db.collection("Authenticating.accounts").countDocuments()).toBe(0);
  });

  test("a refused sign-in leaves an existing account's token alone", async () => {
    await authenticating.authenticate({ githubId: "101", login: "ari", token: "sealed" });

    await expect(authenticating.authenticate({ githubId: "101", login: "ari", token: "" })).rejects.toThrow(InvalidIdentity);
    expect(await authenticating._token({ username: "ari" })).toEqual([{ token: "sealed" }]);
  });

  test("different GitHub accounts get separate accounts and tokens", async () => {
    expect(await authenticating.authenticate({ githubId: "101", login: "ari", token: "a" })).toEqual({ account: "ari" });
    expect(await authenticating.authenticate({ githubId: "202", login: "bo", token: "b" })).toEqual({ account: "bo" });

    expect(await authenticating._token({ username: "ari" })).toEqual([{ token: "a" }]);
    expect(await authenticating._token({ username: "bo" })).toEqual([{ token: "b" }]);
  });

  test("an unknown username has no token", async () => {
    expect(await authenticating._token({ username: "nobody" })).toEqual([]);
  });

  test("accounts from before GitHub sign-in do not block it", async () => {
    await testDb.db.collection("Authenticating.accounts").insertMany([
      { _id: "old-1", salt: "s", verifier: "v" },
      { _id: "old-2", salt: "s", verifier: "v" },
    ] as never);

    expect(await authenticating.authenticate({ githubId: "101", login: "ari", token: "t" })).toEqual({ account: "ari" });
  });
});
