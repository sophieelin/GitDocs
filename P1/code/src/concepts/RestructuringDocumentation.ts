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

  async create(_input: {
    author: string;
    investigation: string;
    owner: string;
    name: string;
    commit: string;
    title: string;
    currentStructure: DocumentationFolder;
    at: Date;
  }): Promise<{ restructuring: string }> {
    throw new Error("TODO: RestructuringDocumentation.create (plan step 5.3)");
  }

  async modify(_input: {
    restructuring: string;
    author: string;
    title: string;
    proposedStructure: DocumentationFolder;
    rationale: string;
    at: Date;
  }): Promise<Record<string, never>> {
    throw new Error("TODO: RestructuringDocumentation.modify (plan step 5.3)");
  }

  async submit(_input: { restructuring: string; author: string; at: Date }): Promise<Record<string, never>> {
    throw new Error("TODO: RestructuringDocumentation.submit (plan step 5.4)");
  }

  async discard(_input: { restructuring: string; author: string }): Promise<Record<string, never>> {
    throw new Error("TODO: RestructuringDocumentation.discard (plan step 5.4)");
  }

  async _get(_input: { restructuring: string }): Promise<
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
    throw new Error("TODO: RestructuringDocumentation._get (plan step 5.3)");
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
}
