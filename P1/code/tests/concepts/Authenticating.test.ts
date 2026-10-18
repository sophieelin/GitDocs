import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  AuthenticatingConcept,
  InvalidCredentials,
  InvalidUsername,
  UsernameTaken,
  WeakPassword,
} from "../../src/concepts/Authenticating.ts";
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
  test("its principle: register, refuse a duplicate and a wrong password, accept the right one", async () => {
    expect(await authenticating.register({ username: "ari", password: "correct horse" })).toEqual({ account: "ari" });
    expect(await authenticating._registered({ username: "ari" })).toEqual({ registered: true });

    const duplicate = authenticating.register({ username: "ari", password: "another password" });
    await expect(duplicate).rejects.toThrow(UsernameTaken);

    const wrong = authenticating.authenticate({ username: "ari", password: "wrong pass" });
    await expect(wrong).rejects.toThrow(InvalidCredentials);
    await expect(authenticating.authenticate({ username: "ari", password: "wrong pass" })).rejects.toThrow(
      "The username or password is incorrect.",
    );

    expect(await authenticating.authenticate({ username: "ari", password: "correct horse" })).toEqual({
      account: "ari",
    });
  });

  test("an unknown username gets the same refusal as a wrong password", async () => {
    await expect(authenticating.authenticate({ username: "nobody", password: "correct horse" })).rejects.toThrow(
      InvalidCredentials,
    );
  });

  test("malformed registration is refused without creating an account", async () => {
    await expect(authenticating.register({ username: "a!", password: "correct horse" })).rejects.toThrow(InvalidUsername);
    await expect(authenticating.register({ username: "ari", password: "short" })).rejects.toThrow(WeakPassword);
    expect(await authenticating._registered({ username: "ari" })).toEqual({ registered: false });
  });

  test("when two people register the same username at once, only one succeeds", async () => {
    const results = await Promise.allSettled([
      authenticating.register({ username: "ari", password: "first password" }),
      authenticating.register({ username: "ari", password: "second password" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(UsernameTaken);
  });

  test("the password itself is never stored", async () => {
    await authenticating.register({ username: "ari", password: "correct horse" });
    const stored = await testDb.db.collection("Authenticating.accounts").findOne({ _id: "ari" as never });

    expect(JSON.stringify(stored)).not.toContain("correct horse");
  });
});
