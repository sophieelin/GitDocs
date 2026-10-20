import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy, type HttpPublicErrorCategory } from "@mit-sdg/sync-engine-http/policy";
import type { assembleApplication } from "./assembly.ts";
import { gitHubApiFromEnv } from "./github/GitHubApi.ts";
import type { GitHubFetcher } from "./github/GitHubFetcher.ts";
import { createGitHubRoutes } from "./github/routes.ts";

type Application = ReturnType<typeof assembleApplication>;

/**
 * Each concept refusal code and the HTTP category it is sent as. The response body
 * carries only the category, such as `{ "error": "CONFLICT" }` with status 409.
 * A refusal missing from this list is sent as `INTERNAL_ERROR` (500), so add every
 * new concept's codes here.
 */
export const publicErrors = {
  // Authenticating
  INVALID_USERNAME: "INVALID_REQUEST",
  WEAK_PASSWORD: "INVALID_REQUEST",
  USERNAME_TAKEN: "CONFLICT",
  INVALID_CREDENTIALS: "UNAUTHORIZED",
  // Sessioning
  UNKNOWN_SESSION: "UNAUTHORIZED",
  // InvestigatingChanges
  INVALID_REPOSITORY: "INVALID_REQUEST",
  INVALID_COMMIT: "INVALID_REQUEST",
  INVALID_TITLE: "INVALID_REQUEST",
  INVALID_STRUCTURE: "INVALID_REQUEST",
  INVESTIGATION_NOT_FOUND: "NOT_FOUND",
  NOT_INVESTIGATOR: "FORBIDDEN",
  NOT_DRAFT: "CONFLICT",
  INVALID_OPERATIONS: "INVALID_REQUEST",
  INVALID_HIGHLIGHT: "INVALID_REQUEST",
  HIGHLIGHT_NOT_FOUND: "NOT_FOUND",
  // The request is well formed; the saved draft just has no rationale yet.
  RATIONALE_MISSING: "CONFLICT",
  INVESTIGATION_NOT_PENDING: "CONFLICT",
  NOT_APPROVED: "CONFLICT",
  // ReviewingDocumentation
  REVIEW_EXISTS: "CONFLICT",
  REVIEW_NOT_FOUND: "NOT_FOUND",
  NOT_REVIEWER: "FORBIDDEN",
  REVIEW_NOT_PENDING: "CONFLICT",
  // Proposals composition: the named reviewer is not registered, or is the author.
  INVALID_REVIEWER: "INVALID_REQUEST",
} as const satisfies Record<string, HttpPublicErrorCategory>;

/** Every endpoint and route is served under this path, e.g. `/api/auth/register`. */
export const basePath = "/api";

export const policy = httpPolicy({ basePath, publicErrors });

/**
 * A Fetch handler for the whole API: the plain GitHub routes first, then the
 * application's sync-engine endpoints. Tests pass a stub GitHub fetcher.
 */
export function createHandler(
  application: Application,
  github: GitHubFetcher = gitHubApiFromEnv(),
): (request: Request) => Promise<Response> {
  const gateway = createGateway({ application });
  const endpoints = createHttpHandler({ application, gateway, policy });
  const gitHubRoutes = createGitHubRoutes({
    github,
    basePath,
    currentUser: async (session) => {
      const result = await application.concepts.Sessioning.current({ session });
      return "error" in result ? undefined : result.subject;
    },
  });
  return async (request) => (await gitHubRoutes(request)) ?? endpoints(request);
}
