import type { Collection, Db } from "mongodb";
import type { DocumentationFolder } from "../github/documentationTree.ts";

export class InvalidProposalSource extends Error {}
export class InvalidProposalTitle extends Error {}
export class InvalidStructure extends Error {}
export class ProposalNotFound extends Error {}
export class NotProposalAuthor extends Error {}
export class NotDraft extends Error {}
export class RationaleMissing extends Error {}

export type Status = "DRAFT" | "PENDING_APPROVAL";

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
};

const SHA = /^[0-9a-f]{40}$/i;
const MAX_TITLE = 120;
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
 * rationale; a submitted proposal is pending approval and can no longer change.
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
    const { _id, repository: _key, ...fields } = found;
    return [{ restructuring: _id, ...fields }];
  }

  async _forRepository(_input: { owner: string; name: string }): Promise<
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
    throw new Error("TODO: RestructuringDocumentation._forRepository (plan step 5.8)");
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
