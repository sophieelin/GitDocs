import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import type { assembleApplication } from "./assembly.ts";

type Application = ReturnType<typeof assembleApplication>;

/** Every endpoint is served under `/api`, e.g. `/api/auth/register`. */
export const policy = httpPolicy({ basePath: "/api" });

/** A Fetch handler that answers JSON POST requests for the application's endpoints. */
export function createHandler(application: Application): (request: Request) => Promise<Response> {
  const gateway = createGateway({ application });
  return createHttpHandler({ application, gateway, policy });
}
