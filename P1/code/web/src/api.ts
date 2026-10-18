import type { Client } from "@mit-sdg/sync-engine/client";
import { createHttpClient, type HttpClientError } from "@mit-sdg/sync-engine-http/client";
import type { ApplicationWireHttp } from "../../generated/wire.ts";

export type ApiClient = Client<ApplicationWireHttp, HttpClientError>;

/**
 * Typed client for the backend, generated from its endpoints. Vite proxies `/api`
 * to the backend. Calls never throw for an API error: each returns the endpoint's
 * output, or `{ error }` with a category such as "UNAUTHORIZED".
 */
export const api: ApiClient = createHttpClient<ApplicationWireHttp>({ baseUrl: "/api" });
