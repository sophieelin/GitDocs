import type { Collection, Db } from "mongodb";

export class InvalidRepository extends Error {}
export class InvalidCommit extends Error {}
export class InvalidTitle extends Error {}
export class InvalidAffectedDocumentation extends Error {}
export class InvalidEvidence extends Error {}

export interface AffectedDocument {
  path: string;
  reason: string;
}

type InvestigationDoc = {
  _id: string;
  owner: string;
  name: string;
  /** `owner/name` in lowercase, so lookups ignore letter case as GitHub does. */
  repository: string;
  commit: string;
  investigator: string;
  title: string;
  submittedAt: Date;
  affected: AffectedDocument[];
  evidence: string[];
};

const SHA = /^[0-9a-f]{40}$/i;
const MAX_TITLE = 120;
const MAX_TEXT = 2000;
const MAX_ITEMS = 100;

function repositoryKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

function isText(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

/**
 * Investigations written and submitted by developers: for one commit, which
 * documentation needs to change and why, and the evidence. A commit can have
 * many; each is read-only once submitted.
 */
export class InvestigatingChangesConcept {
  private readonly investigations: Collection<InvestigationDoc>;

  constructor(
    db: Db,
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {
    this.investigations = db.collection<InvestigationDoc>("InvestigatingChanges.investigations");
  }

  async submit({
    investigator,
    owner,
    name,
    commit,
    title,
    affected,
    evidence,
    at,
  }: {
    investigator: string;
    owner: string;
    name: string;
    commit: string;
    title: string;
    affected: AffectedDocument[];
    evidence: string[];
    at: Date;
  }) {
    if (!isText(owner, 100) || !isText(name, 100)) throw new InvalidRepository("A repository needs an owner and a name.");
    if (!SHA.test(commit)) throw new InvalidCommit("An investigation needs a full commit SHA.");
    if (!isText(title, MAX_TITLE)) throw new InvalidTitle("An investigation needs a title of at most 120 characters.");

    const paths = new Set<string>();
    const affectedValid =
      Array.isArray(affected) &&
      affected.length > 0 &&
      affected.length <= MAX_ITEMS &&
      affected.every((item) => {
        if (!isText(item?.path, 500) || !isText(item?.reason) || paths.has(item.path)) return false;
        paths.add(item.path);
        return true;
      });
    if (!affectedValid) {
      throw new InvalidAffectedDocumentation("Name at least one affected documentation file, each once, with a reason.");
    }
    if (!Array.isArray(evidence) || evidence.length === 0 || evidence.length > MAX_ITEMS || !evidence.every((text) => isText(text))) {
      throw new InvalidEvidence("Give at least one piece of evidence.");
    }

    const investigation = this.freshID();
    // One document holds the investigation with its affected documentation and
    // evidence, so a submission is recorded completely or not at all.
    await this.investigations.insertOne({
      _id: investigation,
      owner,
      name,
      repository: repositoryKey(owner, name),
      commit: commit.toLowerCase(),
      investigator,
      title: title.trim(),
      submittedAt: at,
      affected: affected.map(({ path, reason }) => ({ path, reason: reason.trim() })),
      evidence: evidence.map((text) => text.trim()),
    });
    return { investigation };
  }

  async _get({ investigation }: { investigation: string }): Promise<
    Array<{
      investigation: string;
      owner: string;
      name: string;
      commit: string;
      investigator: string;
      title: string;
      submittedAt: Date;
    }>
  > {
    const found = await this.investigations.findOne({ _id: investigation });
    return found ? [this.#summary(found)] : [];
  }

  async _affected({ investigation }: { investigation: string }): Promise<AffectedDocument[]> {
    const found = await this.investigations.findOne({ _id: investigation });
    return (found?.affected ?? []).map(({ path, reason }) => ({ path, reason }));
  }

  async _evidence({ investigation }: { investigation: string }): Promise<Array<{ text: string }>> {
    const found = await this.investigations.findOne({ _id: investigation });
    return (found?.evidence ?? []).map((text) => ({ text }));
  }

  async _forRepository({ owner, name }: { owner: string; name: string }): Promise<
    Array<{ investigation: string; commit: string; investigator: string; title: string; submittedAt: Date }>
  > {
    const found = await this.#newestFirst({ repository: repositoryKey(owner, name) });
    return found.map((doc) => {
      const { investigation, commit, investigator, title, submittedAt } = this.#summary(doc);
      return { investigation, commit, investigator, title, submittedAt };
    });
  }

  async _forCommit({ owner, name, commit }: { owner: string; name: string; commit: string }): Promise<
    Array<{ investigation: string; investigator: string; title: string; submittedAt: Date }>
  > {
    const found = await this.#newestFirst({ repository: repositoryKey(owner, name), commit: commit.toLowerCase() });
    return found.map((doc) => {
      const { investigation, investigator, title, submittedAt } = this.#summary(doc);
      return { investigation, investigator, title, submittedAt };
    });
  }

  #newestFirst(filter: Partial<InvestigationDoc>): Promise<InvestigationDoc[]> {
    return this.investigations.find(filter).sort({ submittedAt: -1, _id: 1 }).toArray();
  }

  /**
   * An investigation's fields. Investigations saved by the earlier `open` action
   * have no title and an `openedAt` instead of `submittedAt`; they read as untitled.
   */
  #summary(doc: InvestigationDoc & { openedAt?: Date }) {
    return {
      investigation: doc._id,
      owner: doc.owner,
      name: doc.name,
      commit: doc.commit,
      investigator: doc.investigator,
      title: doc.title ?? "Untitled investigation",
      submittedAt: doc.submittedAt ?? doc.openedAt ?? new Date(0),
    };
  }
}
