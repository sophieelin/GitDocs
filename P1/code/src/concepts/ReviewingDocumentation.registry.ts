import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import {
  NotReviewer,
  ReviewExists,
  ReviewNotFound,
  ReviewNotPending,
  ReviewingDocumentationConcept,
} from "./ReviewingDocumentation.ts";
import spec from "@design/concepts/ReviewingDocumentation.md" with { type: "text" };

export const reviewingDocumentation = registerConcept({
  class: ReviewingDocumentationConcept,
  spec,
  refusals: {
    REVIEW_EXISTS: ReviewExists,
    REVIEW_NOT_FOUND: ReviewNotFound,
    NOT_REVIEWER: NotReviewer,
    REVIEW_NOT_PENDING: ReviewNotPending,
  },
  floors: {
    mongo: ({ db }: { db: Db }) => new ReviewingDocumentationConcept(db),
  },
});
