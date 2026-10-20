import type { Collection, Db } from "mongodb";
import type { DocumentationFolder } from "../github/documentationTree.ts";
import { applyOperations, gitCommands, parseOperations, type Operation } from "../github/structureOperations.ts";

export class InvalidRepository extends Error {}
export class InvalidCommit extends Error {}
export class InvalidTitle extends Error {}
export class InvalidStructure extends Error {}
export class InvestigationNotFound extends Error {}
export class NotInvestigator extends Error {}
export class NotDraft extends Error {}
export class InvalidOperations extends Error {}
export class InvalidHighlight extends Error {}
export class HighlightNotFound extends Error {}
export class NoChanges extends Error {}
export class RationaleMissing extends Error {}
export class InvestigationNotPending extends Error {}
export class NotApproved extends Error {}

export type Status = "DRAFT" | "SUBMITTED" | "APPROVED" | "APPLIED";

/**
 * The investigator's comment on text in one file at the investigation's commit:
 * from character `start` of line `from` up to, not including, character `end`
 * of line `to`. Lines count from 1, characters from 0.
 */
export interface Highlight {
  highlight: string;
  path: string;
  from: number;
  to: number;
  start: number;
  end: number;
  text: string;
}

type InvestigationDoc = {
  _id: string;
  investigator: string;
  owner: string;
  name: string;
  /** `owner/name` in lowercase, so lookups ignore letter case as GitHub does. */
  repository: string;
  commit: string;
  title: string;
  currentStructure: DocumentationFolder;
  operations: Operation[];
  proposedStructure: DocumentationFolder;
  rationale: string;
  status: Status;
  /** Empty until the investigation is applied. */
  appliedCommit: string;
  createdAt: Date;
  updatedAt: Date;
  /** In the order added. */
  highlights: Highlight[];
};

const SHA = /^[0-9a-f]{40}$/i;
const MAX_TITLE = 120;
const MAX_HIGHLIGHT = 2000;
const MAX_HIGHLIGHTS = 200;
const MAX_LINE = 1_000_000;
/** The most folders and files a structure may hold, so one investigation stays well under Mongo's document limit. */
const MAX_ENTRIES = 10_000;

function repositoryKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

function isLine(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LINE;
}

function isColumn(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_LINE;
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
 * Proposals for a different documentation structure, each an investigation of
 * one commit. The investigator highlights passages that no longer hold and
 * plans changes to the structure, then submits the draft with a rationale. A
 * submitted investigation no longer changes; once approved, it gives the git
 * commands that make its changes, and its author records the commit that
 * applied them.
 */
export class InvestigatingChangesConcept {
  private readonly investigations: Collection<InvestigationDoc>;

  constructor(
    db: Db,
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {
    this.investigations = db.collection<InvestigationDoc>("InvestigatingChanges.investigations");
  }

  async start({
    investigator,
    owner,
    name,
    commit,
    title,
    currentStructure,
    at,
  }: {
    investigator: string;
    owner: string;
    name: string;
    commit: string;
    title: string;
    currentStructure: DocumentationFolder;
    at: Date;
  }): Promise<{ investigation: string }> {
    if (!isText(owner, 100) || !isText(name, 100)) throw new InvalidRepository("A repository needs an owner and a name.");
    if (typeof commit !== "string" || !SHA.test(commit)) throw new InvalidCommit("An investigation needs a full commit SHA.");
    if (!isText(title, MAX_TITLE)) throw new InvalidTitle("An investigation needs a title of at most 120 characters.");
    const structure = documentationTree(currentStructure);
    if (!structure) throw new InvalidStructure("That is not a documentation structure.");

    const investigation = this.freshID();
    await this.investigations.insertOne({
      _id: investigation,
      investigator,
      owner,
      name,
      repository: repositoryKey(owner, name),
      commit: commit.toLowerCase(),
      title: title.trim(),
      currentStructure: structure,
      operations: [],
      proposedStructure: structure,
      rationale: "",
      status: "DRAFT",
      appliedCommit: "",
      createdAt: at,
      updatedAt: at,
      highlights: [],
    });
    return { investigation };
  }

  async modify({
    investigation,
    investigator,
    title,
    operations,
    rationale,
    at,
  }: {
    investigation: string;
    investigator: string;
    title: string;
    operations: Operation[];
    rationale: string;
    at: Date;
  }): Promise<Record<string, never>> {
    const draft = await this.#investigatorsDraft(investigation, investigator);
    if (!isText(title, MAX_TITLE)) throw new InvalidTitle("An investigation needs a title of at most 120 characters.");
    const changes = parseOperations(operations);
    const applied = changes && applyOperations(draft.currentStructure, changes);
    if (!changes || !applied || "error" in applied) {
      throw new InvalidOperations("Those changes do not fit the documentation structure.");
    }

    // Matching on the status too means an investigation submitted since the check above is left alone.
    const { matchedCount } = await this.investigations.updateOne(
      { _id: investigation, investigator, status: "DRAFT" },
      {
        $set: {
          title: title.trim(),
          operations: changes,
          proposedStructure: applied.tree,
          rationale: (rationale ?? "").trim(),
          updatedAt: at,
        },
      },
    );
    if (matchedCount === 0) await this.#investigatorsDraft(investigation, investigator);
    return {};
  }

  async highlight({
    investigation,
    investigator,
    path,
    from,
    to,
    start,
    end,
    text,
    at,
  }: {
    investigation: string;
    investigator: string;
    path: string;
    from: number;
    to: number;
    start: number;
    end: number;
    text: string;
    at: Date;
  }): Promise<{ highlight: string }> {
    const draft = await this.#investigatorsDraft(investigation, investigator);
    if (
      !isText(path, 1000) ||
      !isText(text, MAX_HIGHLIGHT) ||
      !isLine(from) ||
      !isLine(to) ||
      from > to ||
      !isColumn(start) ||
      !isColumn(end) ||
      (from === to && start >= end) ||
      draft.highlights.length >= MAX_HIGHLIGHTS
    ) {
      throw new InvalidHighlight("A highlight needs a file, the text it is on, and a comment.");
    }
    const highlight = this.freshID();
    const { matchedCount } = await this.investigations.updateOne(
      { _id: investigation, investigator, status: "DRAFT" },
      { $push: { highlights: { highlight, path, from, to, start, end, text: text.trim() } }, $set: { updatedAt: at } },
    );
    if (matchedCount === 0) await this.#investigatorsDraft(investigation, investigator);
    return { highlight };
  }

  async unhighlight({
    investigation,
    investigator,
    highlight,
    at,
  }: {
    investigation: string;
    investigator: string;
    highlight: string;
    at: Date;
  }): Promise<Record<string, never>> {
    // Matching on the highlight too means a missing one changes nothing, not even updatedAt.
    const { matchedCount } = await this.investigations.updateOne(
      { _id: investigation, investigator, status: "DRAFT", "highlights.highlight": highlight },
      { $pull: { highlights: { highlight } }, $set: { updatedAt: at } },
    );
    if (matchedCount === 0) {
      await this.#investigatorsDraft(investigation, investigator);
      throw new HighlightNotFound("There is no such highlight on this investigation.");
    }
    return {};
  }

  async submit({
    investigation,
    investigator,
    at,
  }: {
    investigation: string;
    investigator: string;
    at: Date;
  }): Promise<Record<string, never>> {
    // One conditional update, so only one of two simultaneous submits can succeed.
    const { matchedCount } = await this.investigations.updateOne(
      { _id: investigation, investigator, status: "DRAFT", "operations.0": { $exists: true }, rationale: { $ne: "" } },
      { $set: { status: "SUBMITTED", updatedAt: at } },
    );
    if (matchedCount === 0) {
      const draft = await this.#investigatorsDraft(investigation, investigator);
      if (draft.operations.length === 0) throw new NoChanges("Change the documentation structure before submitting.");
      if (draft.rationale === "") throw new RationaleMissing("Explain the proposed structure before submitting it.");
    }
    return {};
  }

  async discard({ investigation, investigator }: { investigation: string; investigator: string }): Promise<Record<string, never>> {
    const { deletedCount } = await this.investigations.deleteOne({ _id: investigation, investigator, status: "DRAFT" });
    if (deletedCount === 0) await this.#investigatorsDraft(investigation, investigator);
    return {};
  }

  async approve({ investigation, at }: { investigation: string; at: Date }): Promise<Record<string, never>> {
    // One conditional update, so an investigation is approved at most once.
    const { matchedCount } = await this.investigations.updateOne(
      { _id: investigation, status: "SUBMITTED" },
      { $set: { status: "APPROVED", updatedAt: at } },
    );
    if (matchedCount === 0) {
      const found = await this.investigations.findOne({ _id: investigation }, { projection: { _id: 1 } });
      if (!found) throw new InvestigationNotFound("There is no such investigation.");
      throw new InvestigationNotPending("Only a submitted investigation can be approved.");
    }
    return {};
  }

  async apply({
    investigation,
    investigator,
    commit,
    at,
  }: {
    investigation: string;
    investigator: string;
    commit: string;
    at: Date;
  }): Promise<Record<string, never>> {
    const found = await this.investigations.findOne({ _id: investigation }, { projection: { investigator: 1, status: 1 } });
    if (!found) throw new InvestigationNotFound("There is no such investigation.");
    if (found.investigator !== investigator) throw new NotInvestigator("Only the investigation's author can change it.");
    if (found.status !== "APPROVED") throw new NotApproved("Only an approved investigation can be applied, and only once.");
    if (typeof commit !== "string" || !SHA.test(commit)) {
      throw new InvalidCommit("Give the full SHA of the commit that applied the changes.");
    }
    // Matching on the status too means only one of two simultaneous applies records its commit.
    const { matchedCount } = await this.investigations.updateOne(
      { _id: investigation, investigator, status: "APPROVED" },
      { $set: { status: "APPLIED", appliedCommit: commit.toLowerCase(), updatedAt: at } },
    );
    if (matchedCount === 0) throw new NotApproved("Only an approved investigation can be applied, and only once.");
    return {};
  }

  async _get({ investigation }: { investigation: string }): Promise<
    Array<{
      investigation: string;
      investigator: string;
      owner: string;
      name: string;
      commit: string;
      title: string;
      rationale: string;
      status: Status;
      appliedCommit: string;
      currentStructure: DocumentationFolder;
      operations: Operation[];
      proposedStructure: DocumentationFolder;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const found = await this.investigations.findOne({ _id: investigation });
    if (!found) return [];
    const { _id, repository: _key, highlights: _highlights, ...fields } = found;
    return [{ investigation: _id, ...fields }];
  }

  async _highlights({ investigation }: { investigation: string }): Promise<Highlight[]> {
    const found = await this.investigations.findOne({ _id: investigation }, { projection: { highlights: 1 } });
    return (found?.highlights ?? []).map(({ highlight, path, from, to, start, end, text }) => ({
      highlight,
      path,
      from,
      to,
      start,
      end,
      text,
    }));
  }

  async _forRepository({ owner, name }: { owner: string; name: string }): Promise<
    Array<{ investigation: string; investigator: string; commit: string; title: string; status: Status; updatedAt: Date }>
  > {
    const found = await this.investigations
      .find(
        { repository: repositoryKey(owner, name) },
        { projection: { investigator: 1, commit: 1, title: 1, status: 1, updatedAt: 1 } },
      )
      .sort({ updatedAt: -1, _id: 1 })
      .toArray();
    return found.map(({ _id, investigator, commit, title, status, updatedAt }) => ({
      investigation: _id,
      investigator,
      commit,
      title,
      status,
      updatedAt,
    }));
  }

  async _forCommit({ owner, name, commit }: { owner: string; name: string; commit: string }): Promise<
    Array<{ investigation: string; investigator: string; title: string; status: Status; updatedAt: Date }>
  > {
    if (typeof commit !== "string") return [];
    const found = await this.investigations
      .find(
        { repository: repositoryKey(owner, name), commit: commit.toLowerCase() },
        { projection: { investigator: 1, title: 1, status: 1, updatedAt: 1 } },
      )
      .sort({ updatedAt: -1, _id: 1 })
      .toArray();
    return found.map(({ _id, investigator, title, status, updatedAt }) => ({
      investigation: _id,
      investigator,
      title,
      status,
      updatedAt,
    }));
  }

  async _commands({ investigation }: { investigation: string }): Promise<Array<{ command: string }>> {
    const found = await this.investigations.findOne({ _id: investigation }, { projection: { currentStructure: 1, operations: 1 } });
    if (!found) return [];
    return gitCommands(found.currentStructure, found.operations).map((command) => ({ command }));
  }

  /** The investigation, once it is known to exist, to belong to the investigator, and to be a draft. */
  async #investigatorsDraft(investigation: string, investigator: string): Promise<InvestigationDoc> {
    const found = await this.investigations.findOne({ _id: investigation });
    if (!found) throw new InvestigationNotFound("There is no such investigation.");
    if (found.investigator !== investigator) throw new NotInvestigator("Only the investigation's author can change it.");
    if (found.status !== "DRAFT") throw new NotDraft("Only a draft investigation can be changed.");
    return found;
  }
}
