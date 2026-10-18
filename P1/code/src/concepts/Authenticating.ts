import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { Binary, MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidUsername extends Error {}
export class WeakPassword extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}

/** One account per username. The username is the document id, so MongoDB rejects duplicates. */
type AccountDoc = { _id: string; salt: string; verifier: Binary };

const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

function verifier(password: string, salt: string): Buffer {
  return pbkdf2Sync(password, salt, 10_000, 32, "sha256");
}

/** Establishes a username from a password. Ported from the sync-engine message-board example to MongoDB. */
export class AuthenticatingConcept {
  private readonly accounts: Collection<AccountDoc>;

  constructor(
    db: Db,
    private readonly freshSalt: () => string = () => crypto.randomUUID(),
  ) {
    this.accounts = db.collection<AccountDoc>("Authenticating.accounts");
  }

  async register({ username, password }: { username: string; password: string }) {
    if (!USERNAME.test(username)) {
      throw new InvalidUsername("A username must contain 3 to 32 letters, numbers, underscores, or hyphens.");
    }
    if (password.length < 8 || password.length > 128) {
      throw new WeakPassword("A password must contain 8 to 128 characters.");
    }
    const salt = this.freshSalt();
    try {
      await this.accounts.insertOne({ _id: username, salt, verifier: new Binary(verifier(password, salt)) });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new UsernameTaken("That username is already registered.");
      }
      throw error;
    }
    return { account: username };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    const account = await this.accounts.findOne({ _id: username });
    const supplied = account === null ? undefined : verifier(password, account.salt);
    if (account === null || supplied === undefined || !timingSafeEqual(Buffer.from(account.verifier.buffer), supplied)) {
      throw new InvalidCredentials("The username or password is incorrect.");
    }
    return { account: username };
  }

  async _registered({ username }: { username: string }): Promise<{ registered: boolean }> {
    return { registered: (await this.accounts.countDocuments({ _id: username }, { limit: 1 })) > 0 };
  }
}
