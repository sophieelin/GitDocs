import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidIdentity extends Error {}
export class UsernameTaken extends Error {}

/**
 * One account per GitHub account: the GitHub id is the document id, and the
 * username has a unique index, so MongoDB rejects duplicates of either.
 */
type AccountDoc = { _id: string; username: string; token: string };

const GITHUB_ID = /^\d{1,20}$/;
/** GitHub logins are letters, digits, and hyphens, at most 39 characters. */
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

/** Establishes an account from a GitHub identity that the OAuth flow proved. */
export class AuthenticatingConcept {
  private readonly accounts: Collection<AccountDoc>;
  #indexed: Promise<unknown> | undefined;

  constructor(db: Db) {
    this.accounts = db.collection<AccountDoc>("Authenticating.accounts");
  }

  /**
   * The unique username index, made once before the first write. Accounts from
   * before GitHub sign-in have no username field and are left out of it.
   */
  #index(): Promise<unknown> {
    this.#indexed ??= this.accounts.createIndex(
      { username: 1 },
      { unique: true, partialFilterExpression: { username: { $type: "string" } } },
    );
    return this.#indexed;
  }

  async authenticate({ githubId, login, token }: { githubId: string; login: string; token: string }) {
    if (typeof githubId !== "string" || !GITHUB_ID.test(githubId) || typeof login !== "string" || !LOGIN.test(login)) {
      throw new InvalidIdentity("GitHub did not give a usable identity.");
    }
    if (typeof token !== "string" || token === "") throw new InvalidIdentity("GitHub did not give a usable identity.");
    await this.#index();

    // The username stays the login of the first sign-in, so a rename on GitHub keeps the account's work together.
    const known = await this.accounts.findOneAndUpdate({ _id: githubId }, { $set: { token } });
    if (known !== null) return { account: known.username };
    try {
      await this.accounts.insertOne({ _id: githubId, username: login, token });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        // Signed in twice at once for the first time: the other one added the account.
        const added = await this.accounts.findOneAndUpdate({ _id: githubId }, { $set: { token } });
        if (added !== null) return { account: added.username };
        throw new UsernameTaken("That GitHub name belongs to another account here.");
      }
      throw error;
    }
    return { account: login };
  }

  async _registered({ username }: { username: string }): Promise<{ registered: boolean }> {
    return { registered: (await this.accounts.countDocuments({ username }, { limit: 1 })) > 0 };
  }

  async _token({ username }: { username: string }): Promise<Array<{ token: string }>> {
    const account = await this.accounts.findOne({ username });
    return account === null ? [] : [{ token: account.token }];
  }
}
