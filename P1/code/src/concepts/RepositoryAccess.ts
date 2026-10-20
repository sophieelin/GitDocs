import type { Collection, Db } from "mongodb";

export class InvalidRepository extends Error {}
export class NoPushAccess extends Error {}

/** One grant per user and repository; the id joins the two, so a new answer replaces the old one. */
type GrantDoc = { _id: string; user: string; repository: string; canPush: boolean; expiresAt: Date };

const GRANT_LIFETIME_MS = 30 * 60 * 1000;

/** GitHub matches owners and names without regard to case. */
function grantId(user: string, owner: string, name: string): string {
  return `${user}\n${owner}/${name}`.toLowerCase();
}

/** Remembers for a short time whether a user can push to a repository on GitHub. */
export class RepositoryAccessConcept {
  private readonly grants: Collection<GrantDoc>;

  constructor(db: Db) {
    this.grants = db.collection<GrantDoc>("RepositoryAccess.grants");
  }

  async record({ user, owner, name, canPush, at }: { user: string; owner: string; name: string; canPush: boolean; at: Date }) {
    if (typeof owner !== "string" || typeof name !== "string" || owner.trim() === "" || name.trim() === "") {
      throw new InvalidRepository("A repository needs an owner and a name.");
    }
    await this.grants.replaceOne(
      { _id: grantId(user, owner, name) },
      {
        user,
        repository: `${owner}/${name}`.toLowerCase(),
        canPush: canPush === true,
        expiresAt: new Date(at.getTime() + GRANT_LIFETIME_MS),
      },
      { upsert: true },
    );
    return {};
  }

  async authorize({ user, owner, name, at }: { user: string; owner: string; name: string; at: Date }) {
    if (!(await this._canPush({ user, owner, name, at })).canPush) {
      throw new NoPushAccess("Only people who can push to this repository on GitHub can change its proposals.");
    }
    return {};
  }

  async _canPush({ user, owner, name, at }: { user: string; owner: string; name: string; at: Date }): Promise<{ canPush: boolean }> {
    if (typeof owner !== "string" || typeof name !== "string") return { canPush: false };
    const found = await this.grants.countDocuments(
      { _id: grantId(user, owner, name), canPush: true, expiresAt: { $gt: at } },
      { limit: 1 },
    );
    return { canPush: found > 0 };
  }
}
