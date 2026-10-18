import type { Db } from "mongodb";
import { assembleApplication } from "../../src/assembly.ts";
import { createHandler } from "../../src/http.ts";

export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

/** Calls the HTTP handler in-process with `Request` objects. No server and no port are needed. */
export function testApi(db: Db) {
  const handler = createHandler(assembleApplication({ db }));

  async function post(path: string, body: unknown = {}): Promise<ApiResponse> {
    const response = await handler(
      new Request(`http://localhost/api${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  /** Registers `username` with a fixed password and returns its session. */
  async function register(username: string): Promise<string> {
    const { status, body } = await post("/auth/register", { username, password: `${username}-password` });
    if (status !== 200) throw new Error(`register ${username} failed: ${status} ${JSON.stringify(body)}`);
    return body.session as string;
  }

  /** Signs in a user created with `register` and returns a new session. */
  async function signIn(username: string): Promise<string> {
    const { status, body } = await post("/auth/sign-in", { username, password: `${username}-password` });
    if (status !== 200) throw new Error(`sign-in ${username} failed: ${status} ${JSON.stringify(body)}`);
    return body.session as string;
  }

  return { post, register, signIn };
}
