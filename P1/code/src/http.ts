import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy, type HttpPublicErrorCategory } from "@mit-sdg/sync-engine-http/policy";
import type { assembleApplication } from "./assembly.ts";
import { gitHubApiFromEnv } from "./github/GitHubApi.ts";
import type { GitHubFetcher } from "./github/GitHubFetcher.ts";
import { createGitHubRoutes } from "./github/routes.ts";
import { gitHubSignInFromEnv, type GitHubSignIn } from "./github/GitHubSignIn.ts";
import { createSignInRoutes } from "./github/signInRoutes.ts";
import { tokenBoxFromEnv, type TokenBox } from "./github/tokenBox.ts";

type Application = ReturnType<typeof assembleApplication>;

/**
 * Each concept refusal code and the HTTP category it is sent as. The response body
 * carries only the category, such as `{ "error": "CONFLICT" }` with status 409.
 * A refusal missing from this list is sent as `INTERNAL_ERROR` (500), so add every
 * new concept's codes here.
 */
export const publicErrors = {
  // Authenticating
  INVALID_IDENTITY: "INVALID_REQUEST",
  USERNAME_TAKEN: "CONFLICT",
  // Sessioning
  UNKNOWN_SESSION: "UNAUTHORIZED",
  // RepositoryAccess (INVALID_REPOSITORY is shared with InvestigatingChanges, below)
  NO_PUSH_ACCESS: "FORBIDDEN",
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
  // The request is well formed; it clashes with a suggestion already saved.
  SUGGESTIONS_OVERLAP: "CONFLICT",
  // The request is well formed; the saved draft just has no changes or no rationale yet.
  NO_CHANGES: "CONFLICT",
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

export interface SignInOptions {
  github?: GitHubSignIn;
  tokens?: TokenBox | undefined;
  callbackUrl?: string;
  secureCookies?: boolean;
}

/**
 * A Fetch handler for the whole API: the plain sign-in and GitHub routes first,
 * then the application's sync-engine endpoints. Tests pass stubs for GitHub.
 */
export function createHandler(
  application: Application,
  github: GitHubFetcher = gitHubApiFromEnv(),
  {
    github: signIn = gitHubSignInFromEnv(),
    tokens = tokenBoxFromEnv(),
    callbackUrl = process.env.GITHUB_CALLBACK_URL || undefined,
    secureCookies = process.env.NODE_ENV === "production",
  }: SignInOptions = {},
): (request: Request) => Promise<Response> {
  const gateway = createGateway({ application });
  const endpoints = createHttpHandler({ application, gateway, policy });
  const { Authenticating, RepositoryAccess, Sessioning } = application.concepts;
  const currentUser = async (session: string) => {
    const result = await Sessioning.current({ session });
    return "error" in result ? undefined : result.subject;
  };
  const gitHubRoutes = createGitHubRoutes({ github, basePath, currentUser });
  const signInRoutes = createSignInRoutes({
    github: signIn,
    tokens,
    basePath,
    callbackUrl,
    secureCookies,
    concepts: {
      authenticate: (input) => Authenticating.authenticate(input),
      startSession: (input) => Sessioning.start(input),
      currentUser,
      token: async (username) => (await Authenticating._token({ username }))[0]?.token,
      recordAccess: (input) => RepositoryAccess.record(input),
    },
  });
  return async (request) => (await signInRoutes(request)) ?? (await gitHubRoutes(request)) ?? endpoints(request);
}
