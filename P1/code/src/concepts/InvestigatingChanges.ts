import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidRepository extends Error {}
export class InvalidCommit extends Error {}

type InvestigationDoc = {
  _id: string;
  owner: string;
  name: string;
  /** `owner/name` in lowercase, so lookups ignore letter case as GitHub does. */
  repository: string;
  commit: string;
  investigator: string;
  openedAt: Date;
};

const SHA = /^[0-9a-f]{40}$/i;

function repositoryKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

/**
 * One shared investigation per commit in a repository (the MVP version of the
 * concept). Opening a commit again, by anyone, returns the same investigation.
 */
export class InvestigatingChangesConcept {
  private readonly investigations: Collection<InvestigationDoc>;
  private ready: Promise<string> | undefined;

  constructor(
    db: Db,
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {
    this.investigations = db.collection<InvestigationDoc>("InvestigatingChanges.investigations");
  }

  /**
   * Created on first use, so assembling the app never needs a running database.
   * A `#` method, because sync-engine treats every ordinary method as an action.
   */
  #index(): Promise<string> {
    this.ready ??= this.investigations.createIndex({ repository: 1, commit: 1 }, { unique: true });
    return this.ready;
  }

  async open({
    investigator,
    owner,
    name,
    commit,
    at,
  }: {
    investigator: string;
    owner: string;
    name: string;
    commit: string;
    at: Date;
  }) {
    if (owner.trim() === "" || name.trim() === "") {
      throw new InvalidRepository("A repository needs an owner and a name.");
    }
    if (!SHA.test(commit)) throw new InvalidCommit("An investigation needs a full commit SHA.");
    await this.#index();

    const repository = repositoryKey(owner, name);
    const sha = commit.toLowerCase();
    const existing = await this.investigations.findOne({ repository, commit: sha });
    if (existing) return { investigation: existing._id };

    const investigation = this.freshID();
    try {
      await this.investigations.insertOne({
        _id: investigation,
        owner,
        name,
        repository,
        commit: sha,
        investigator,
        openedAt: at,
      });
      return { investigation };
    } catch (error) {
      // Someone opened the same commit at the same moment: use theirs.
      if (error instanceof MongoServerError && error.code === 11000) {
        const winner = await this.investigations.findOne({ repository, commit: sha });
        if (winner) return { investigation: winner._id };
      }
      throw error;
    }
  }

  async _get({ investigation }: { investigation: string }): Promise<
    Array<{ investigation: string; owner: string; name: string; commit: string; investigator: string; openedAt: Date }>
  > {
    const found = await this.investigations.findOne({ _id: investigation });
    if (!found) return [];
    const { owner, name, commit, investigator, openedAt } = found;
    return [{ investigation: found._id, owner, name, commit, investigator, openedAt }];
  }

  async _forRepository({
    owner,
    name,
  }: {
    owner: string;
    name: string;
  }): Promise<Array<{ investigation: string; commit: string; investigator: string; openedAt: Date }>> {
    const found = await this.investigations
      .find({ repository: repositoryKey(owner, name) })
      .sort({ openedAt: -1, _id: 1 })
      .toArray();
    return found.map(({ _id, commit, investigator, openedAt }) => ({ investigation: _id, commit, investigator, openedAt }));
  }
}
