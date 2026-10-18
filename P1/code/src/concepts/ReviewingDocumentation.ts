import { MongoServerError, type Collection, type Db } from "mongodb";

export class ReviewExists extends Error {}
export class ReviewNotFound extends Error {}
export class NotReviewer extends Error {}
export class ReviewNotPending extends Error {}

export type Decision = "PENDING" | "APPROVED";

/** One review per proposal; a unique index on `proposal` makes MongoDB reject a second one. */
type ReviewDoc = {
  _id: string;
  proposal: string;
  reviewer: string;
  decision: Decision;
  openedAt: Date;
  updatedAt: Date;
};

/**
 * One review per restructuring proposal, opened by a developer other than its
 * author. The reviewer records a decision; a review is pending until approved.
 */
export class ReviewingDocumentationConcept {
  private readonly reviews: Collection<ReviewDoc>;
  #indexed?: Promise<string>;

  constructor(
    db: Db,
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {
    this.reviews = db.collection<ReviewDoc>("ReviewingDocumentation.reviews");
  }

  async open({ proposal, reviewer, at }: { proposal: string; reviewer: string; at: Date }): Promise<{ review: string }> {
    this.#indexed ??= this.reviews.createIndex({ proposal: 1 }, { unique: true });
    try {
      await this.#indexed;
    } catch (error) {
      // Try again on the next open rather than keep a failed index forever.
      this.#indexed = undefined;
      throw error;
    }

    const review = this.freshID();
    try {
      await this.reviews.insertOne({ _id: review, proposal, reviewer, decision: "PENDING", openedAt: at, updatedAt: at });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ReviewExists("This proposal already has a review.");
      }
      throw error;
    }
    return { review };
  }

  async approve({ review, reviewer, at }: { review: string; reviewer: string; at: Date }): Promise<Record<string, never>> {
    // One conditional update, so a review is approved at most once.
    const { matchedCount } = await this.reviews.updateOne(
      { _id: review, reviewer, decision: "PENDING" },
      { $set: { decision: "APPROVED", updatedAt: at } },
    );
    if (matchedCount === 0) {
      const found = await this.reviews.findOne({ _id: review });
      if (!found) throw new ReviewNotFound("There is no such review.");
      if (found.reviewer !== reviewer) throw new NotReviewer("Only the review's reviewer can decide it.");
      throw new ReviewNotPending("This review has already been decided.");
    }
    return {};
  }

  async _get({ review }: { review: string }): Promise<
    Array<{
      review: string;
      proposal: string;
      reviewer: string;
      decision: Decision;
      openedAt: Date;
      updatedAt: Date;
    }>
  > {
    const found = await this.reviews.findOne({ _id: review });
    if (!found) return [];
    const { _id, ...fields } = found;
    return [{ review: _id, ...fields }];
  }

  async _forProposal({ proposal }: { proposal: string }): Promise<
    Array<{
      review: string;
      reviewer: string;
      decision: Decision;
      openedAt: Date;
      updatedAt: Date;
    }>
  > {
    const found = await this.reviews.findOne({ proposal });
    if (!found) return [];
    const { _id, proposal: _proposal, ...fields } = found;
    return [{ review: _id, ...fields }];
  }
}
