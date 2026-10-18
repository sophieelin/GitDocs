/**
 * Views about reviews that several endpoints share. The author names a
 * proposal's reviewer when submitting it, so no view decides who may review;
 * approving needs none either, because ReviewingDocumentation refuses anyone
 * but the review's reviewer.
 */
import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { ReviewingDocumentation } = concepts;

const TheReviewOf = view(
  "the review of (proposal)",
  ({ proposal }, { review, reviewer, decision }, _bindings) =>
    where(ReviewingDocumentation._forProposal({ proposal }).is({ review, reviewer, decision })),
).optional();

export { TheReviewOf };

export const composition = { TheReviewOf };
