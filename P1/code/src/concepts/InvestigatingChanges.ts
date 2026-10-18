import type { Collection, Db } from "mongodb";

export class InvalidRepository extends Error {}
export class InvalidCommit extends Error {}
export class InvalidTitle extends Error {}
export class InvalidHighlights extends Error {}

/** Lines `from` to `to` (1-based, inclusive) of one documentation file, and why they do not work. */
export interface Highlight {
  path: string;
  from: number;
  to: number;
  comment: string;
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
  highlights: Highlight[];
};

const SHA = /^[0-9a-f]{40}$/i;
const MAX_TITLE = 120;
const MAX_TEXT = 2000;
const MAX_HIGHLIGHTS = 200;
const MAX_LINE = 1_000_000;

function repositoryKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

function isText(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

function isLine(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LINE;
}

function isHighlight(item: Partial<Highlight> | undefined): item is Highlight {
  return isText(item?.path, 500) && isLine(item?.from) && isLine(item?.to) && item.from <= item.to && isText(item?.comment);
}

/**
 * Investigations written and submitted by developers: for one commit, the
 * passages of the documentation that no longer hold, each with a comment on
 * why. A commit can have many; each is read-only once submitted.
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
    highlights,
    at,
  }: {
    investigator: string;
    owner: string;
    name: string;
    commit: string;
    title: string;
    highlights: Highlight[];
    at: Date;
  }) {
    if (!isText(owner, 100) || !isText(name, 100)) throw new InvalidRepository("A repository needs an owner and a name.");
    if (!SHA.test(commit)) throw new InvalidCommit("An investigation needs a full commit SHA.");
    if (!isText(title, MAX_TITLE)) throw new InvalidTitle("An investigation needs a title of at most 120 characters.");
    if (
      !Array.isArray(highlights) ||
      highlights.length === 0 ||
      highlights.length > MAX_HIGHLIGHTS ||
      !highlights.every((item) => isHighlight(item))
    ) {
      throw new InvalidHighlights("Highlight at least one passage, each with its lines and a comment.");
    }

    const investigation = this.freshID();
    // One document holds the investigation with its highlights, so a
    // submission is recorded completely or not at all.
    await this.investigations.insertOne({
      _id: investigation,
      owner,
      name,
      repository: repositoryKey(owner, name),
      commit: commit.toLowerCase(),
      investigator,
      title: title.trim(),
      submittedAt: at,
      highlights: highlights.map(({ path, from, to, comment }) => ({ path, from, to, comment: comment.trim() })),
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

  /** Investigations saved before highlights existed have none. */
  async _highlights({ investigation }: { investigation: string }): Promise<Highlight[]> {
    const found = await this.investigations.findOne({ _id: investigation });
    return (found?.highlights ?? []).map(({ path, from, to, comment }) => ({ path, from, to, comment }));
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
