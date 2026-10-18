import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy, type HttpPublicErrorCategory } from "@mit-sdg/sync-engine-http/policy";
import type { assembleApplication } from "./assembly.ts";

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
} as const satisfies Record<string, HttpPublicErrorCategory>;

/** Every endpoint is served under `/api`, e.g. `/api/auth/register`. */
export const policy = httpPolicy({ basePath: "/api", publicErrors });

/** A Fetch handler that answers JSON POST requests for the application's endpoints. */
export function createHandler(application: Application): (request: Request) => Promise<Response> {
  const gateway = createGateway({ application });
  return createHttpHandler({ application, gateway, policy });
}
