/**
 * Sessions: resolving the current user and signing out. Signing in is GitHub's
 * OAuth flow, in plain routes (`src/github/signInRoutes.ts`), because it
 * redirects and calls GitHub; it starts the session there.
 *
 * Authenticating proves an account, represented by its username. Sessioning
 * holds an opaque session for an external subject. Neither names the other;
 * the connection lives here and in the sign-in routes.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts } from "../concepts.ts";
import { sessionOnlyInput, signedOutOutput, usernameOutput } from "./validators.ts";

const { Sessioning } = concepts;

const CurrentUser = endpoint(
  "/auth/current",
  ({ session, username }) =>
    receive({ session })
      .then(Sessioning.current({ session }).responds({ subject: username }))
      .then(respond({ username })),
  {
    input: { required: ["session"] },
    validators: { input: sessionOnlyInput, output: usernameOutput },
  },
);

const SignOut = endpoint(
  "/auth/sign-out",
  ({ session, signedOut }) =>
    receive({ session })
      .then(Sessioning.end({ session }).responds({ ended: signedOut }))
      .then(respond({ signedOut })),
  {
    input: { required: ["session"] },
    validators: { input: sessionOnlyInput, output: signedOutOutput },
  },
);

export const composition = {
  CurrentAccount: { CurrentUser },
  LeavingApplication: { SignOut },
};
