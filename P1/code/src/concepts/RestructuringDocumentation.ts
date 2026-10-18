import type { Collection, Db } from "mongodb";
import type { DocumentationFolder } from "../github/documentationTree.ts";

export class InvalidProposalSource extends Error {}
export class InvalidProposalTitle extends Error {}
export class InvalidStructure extends Error {}
export class ProposalNotFound extends Error {}
export class NotProposalAuthor extends Error {}
export class NotDraft extends Error {}
export class RationaleMissing extends Error {}
export class ProposalNotPending extends Error {}
export class InvalidComment extends Error {}
export class CommentNotFound extends Error {}

export type Status = "DRAFT" | "PENDING_APPROVAL" | "APPROVED";

/**
 * The author's comment on text in one file at the proposal's commit: from
 * character `start` of line `from` up to, not including, character `end` of
 * line `to`. Lines count from 1, characters from 0.
 */
export interface Comment {
  comment: string;
  path: string;
  from: number;
  to: number;
  start: number;
  end: number;
  text: string;
}

type RestructuringDoc = {
  _id: string;
  author: string;
  investigation: string;
  owner: string;
  name: string;
  /** `owner/name` in lowercase, so lookups ignore letter case as GitHub does. */
  repository: string;
  commit: string;
  title: string;
  currentStructure: DocumentationFolder;
  proposedStructure: DocumentationFolder;
  rationale: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  /** In the order added. Proposals saved before comments existed have none. */
  comments?: Comment[];
};

const SHA = /^[0-9a-f]{40}$/i;
const MAX_TITLE = 120;
const MAX_COMMENT = 2000;
const MAX_COMMENTS = 200;
const MAX_LINE = 1_000_000;

function isLine(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LINE;
}

function isColumn(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_LINE;
}
/** The most folders and files a structure may hold, so one proposal stays well under Mongo's document limit. */
const MAX_ENTRIES = 10_000;

function repositoryKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

/**
 * The structure with only its known fields, or undefined when it is not a
 * documentation tree: every folder needs a name, a path, and lists of folders and
 * files, and every file a name and a path.
 */
function documentationTree(value: unknown): DocumentationFolder | undefined {
  let entries = 0;
  function folder(candidate: unknown): DocumentationFolder | undefined {
    if (++entries > MAX_ENTRIES || typeof candidate !== "object" || candidate === null) return undefined;
    const { name, path, folders, files } = candidate as Record<string, unknown>;
    if (typeof name !== "string" || typeof path !== "string" || !Array.isArray(folders) || !Array.isArray(files)) return undefined;
    const children: DocumentationFolder[] = [];
    for (const child of folders) {
      const checked = folder(child);
      if (!checked) return undefined;
      children.push(checked);
    }
    const leaves: DocumentationFolder["files"] = [];
    for (const file of files) {
      if (++entries > MAX_ENTRIES || typeof file !== "object" || file === null) return undefined;
      const { name: fileName, path: filePath } = file as Record<string, unknown>;
      if (!isText(fileName, 500) || !isText(filePath, 1000)) return undefined;
      leaves.push({ name: fileName, path: filePath });
    }
    return { name, path, folders: children, files: leaves };
  }
  return folder(value);
}

/**
 * Proposals for a different documentation structure, each started from an
 * investigation of one commit. The author edits a draft, then submits it with a
 * rationale; a submitted proposal is pending approval and can no longer change,
 * until it is approved.
 */
export class RestructuringDocumentationConcept {
  private readonly restructurings: Collection<RestructuringDoc>;

  constructor(
    db: Db,
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {
    this.restructurings = db.collection<RestructuringDoc>("RestructuringDocumentation.restructurings");
  }

  async create({
    author,
    investigation,
    owner,
    name,
    commit,
    title,
    currentStructure,
    at,
  }: {
    author: string;
    investigation: string;
    owner: string;
    name: string;
    commit: string;
    title: string;
    currentStructure: DocumentationFolder;
    at: Date;
  }): Promise<{ restructuring: string }> {
    if (!isText(owner, 100) || !isText(name, 100) || typeof commit !== "string" || !SHA.test(commit)) {
      throw new InvalidProposalSource("A proposal needs a repository and a full commit SHA.");
    }
    if (!isText(title, MAX_TITLE)) throw new InvalidProposalTitle("A proposal needs a title of at most 120 characters.");
    const structure = documentationTree(currentStructure);
    if (!structure) throw new InvalidStructure("That is not a documentation structure.");

    const restructuring = this.freshID();
    await this.restructurings.insertOne({
      _id: restructuring,
      author,
      investigation,
      owner,
      name,
      repository: repositoryKey(owner, name),
      commit: commit.toLowerCase(),
      title: title.trim(),
      currentStructure: structure,
      proposedStructure: structure,
      rationale: "",
      status: "DRAFT",
      createdAt: at,
      updatedAt: at,
    });
    return { restructuring };
  }

  async modify({
    restructuring,
    author,
    title,
    proposedStructure,
    rationale,
    at,
  }: {
    restructuring: string;
    author: string;
    title: string;
    proposedStructure: DocumentationFolder;
    rationale: string;
    at: Date;
  }): Promise<Record<string, never>> {
    await this.#authorsDraft(restructuring, author);
    if (!isText(title, MAX_TITLE)) throw new InvalidProposalTitle("A proposal needs a title of at most 120 characters.");
    const structure = documentationTree(proposedStructure);
    if (!structure) throw new InvalidStructure("That is not a documentation structure.");

    // Matching on the status too means a proposal submitted since the check above is left alone.
    const { matchedCount } = await this.restructurings.updateOne(
      { _id: restructuring, author, status: "DRAFT" },
      { $set: { title: title.trim(), proposedStructure: structure, rationale: (rationale ?? "").trim(), updatedAt: at } },
    );
    if (matchedCount === 0) await this.#authorsDraft(restructuring, author);
    return {};
  }

  async comment({
    restructuring,
    author,
    path,
    from,
    to,
    start,
    end,
    text,
    at,
  }: {
    restructuring: string;
    author: string;
    path: string;
    from: number;
    to: number;
    start: number;
    end: number;
    text: string;
    at: Date;
  }): Promise<{ comment: string }> {
    const draft = await this.#authorsDraft(restructuring, author);
    if (
      !isText(path, 1000) ||
      !isText(text, MAX_COMMENT) ||
      !isLine(from) ||
      !isLine(to) ||
      from > to ||
      !isColumn(start) ||
      !isColumn(end) ||
      (from === to && start >= end) ||
      (draft.comments?.length ?? 0) >= MAX_COMMENTS
    ) {
      throw new InvalidComment("A comment needs a file, the text it is on, and some text.");
    }
    const comment = this.freshID();
    const { matchedCount } = await this.restructurings.updateOne(
      { _id: restructuring, author, status: "DRAFT" },
      { $push: { comments: { comment, path, from, to, start, end, text: text.trim() } }, $set: { updatedAt: at } },
    );
    if (matchedCount === 0) await this.#authorsDraft(restructuring, author);
    return { comment };
  }

  async uncomment({
    restructuring,
    author,
    comment,
    at,
  }: {
    restructuring: string;
    author: string;
    comment: string;
    at: Date;
  }): Promise<Record<string, never>> {
    // Matching on the comment too means a missing one changes nothing, not even updatedAt.
    const { matchedCount } = await this.restructurings.updateOne(
      { _id: restructuring, author, status: "DRAFT", "comments.comment": comment },
      { $pull: { comments: { comment } }, $set: { updatedAt: at } },
    );
    if (matchedCount === 0) {
      await this.#authorsDraft(restructuring, author);
      throw new CommentNotFound("There is no such comment on this proposal.");
    }
    return {};
  }

  async submit({ restructuring, author, at }: { restructuring: string; author: string; at: Date }): Promise<Record<string, never>> {
    // One conditional update, so only one of two simultaneous submits can succeed.
    const { matchedCount } = await this.restructurings.updateOne(
      { _id: restructuring, author, status: "DRAFT", rationale: { $ne: "" } },
      { $set: { status: "PENDING_APPROVAL", updatedAt: at } },
    );
    if (matchedCount === 0) {
      const draft = await this.#authorsDraft(restructuring, author);
      if (draft.rationale === "") throw new RationaleMissing("Explain the proposed structure before submitting it.");
    }
    return {};
  }

  async discard({ restructuring, author }: { restructuring: string; author: string }): Promise<Record<string, never>> {
    const { deletedCount } = await this.restructurings.deleteOne({ _id: restructuring, author, status: "DRAFT" });
    if (deletedCount === 0) await this.#authorsDraft(restructuring, author);
    return {};
  }

  async approve({ restructuring, at }: { restructuring: string; at: Date }): Promise<Record<string, never>> {
    // One conditional update, so a proposal is approved at most once.
    const { matchedCount } = await this.restructurings.updateOne(
      { _id: restructuring, status: "PENDING_APPROVAL" },
      { $set: { status: "APPROVED", updatedAt: at } },
    );
    if (matchedCount === 0) {
      const found = await this.restructurings.findOne({ _id: restructuring }, { projection: { _id: 1 } });
      if (!found) throw new ProposalNotFound("There is no such proposal.");
      throw new ProposalNotPending("Only a proposal pending approval can be approved.");
    }
    return {};
  }

  async _get({ restructuring }: { restructuring: string }): Promise<
    Array<{
      restructuring: string;
      author: string;
      investigation: string;
      owner: string;
      name: string;
      commit: string;
      title: string;
      rationale: string;
      status: Status;
      currentStructure: DocumentationFolder;
      proposedStructure: DocumentationFolder;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const found = await this.restructurings.findOne({ _id: restructuring });
    if (!found) return [];
    const { _id, repository: _key, comments: _comments, ...fields } = found;
    return [{ restructuring: _id, ...fields }];
  }

  async _comments({ restructuring }: { restructuring: string }): Promise<Comment[]> {
    const found = await this.restructurings.findOne({ _id: restructuring }, { projection: { comments: 1 } });
    return (found?.comments ?? []).map(({ comment, path, from, to, start, end, text }) => ({ comment, path, from, to, start, end, text }));
  }

  async _forRepository({ owner, name }: { owner: string; name: string }): Promise<
    Array<{
      restructuring: string;
      author: string;
      investigation: string;
      commit: string;
      title: string;
      status: Status;
      updatedAt: Date;
    }>
  > {
    const found = await this.restructurings
      .find(
        { repository: repositoryKey(owner, name) },
        { projection: { author: 1, investigation: 1, commit: 1, title: 1, status: 1, updatedAt: 1 } },
      )
      .sort({ updatedAt: -1, _id: 1 })
      .toArray();
    return found.map(({ _id, author, investigation, commit, title, status, updatedAt }) => ({
      restructuring: _id,
      author,
      investigation,
      commit,
      title,
      status,
      updatedAt,
    }));
  }

  async _pendingApproval({ owner, name }: { owner: string; name: string }): Promise<
    Array<{
      restructuring: string;
      author: string;
      investigation: string;
      commit: string;
      title: string;
      updatedAt: Date;
    }>
  > {
    const found = await this.restructurings
      .find(
        { repository: repositoryKey(owner, name), status: "PENDING_APPROVAL" },
        { projection: { author: 1, investigation: 1, commit: 1, title: 1, updatedAt: 1 } },
      )
      .sort({ updatedAt: 1, _id: 1 })
      .toArray();
    return found.map(({ _id, author, investigation, commit, title, updatedAt }) => ({
      restructuring: _id,
      author,
      investigation,
      commit,
      title,
      updatedAt,
    }));
  }

  /** The proposal, once it is known to exist, to belong to the author, and to be a draft. */
  async #authorsDraft(restructuring: string, author: string): Promise<RestructuringDoc> {
    const found = await this.restructurings.findOne({ _id: restructuring });
    if (!found) throw new ProposalNotFound("There is no such proposal.");
    if (found.author !== author) throw new NotProposalAuthor("Only the proposal's author can change it.");
    if (found.status !== "DRAFT") throw new NotDraft("Only a draft proposal can be changed.");
    return found;
  }
}
