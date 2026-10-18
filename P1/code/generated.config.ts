import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleApplication } from "./src/assembly.ts";
import { db } from "./src/db.ts";
import { policy } from "./src/http.ts";

export default {
  // The checker calls this with no arguments. The client connects only on the
  // first query, so checking never needs a running MongoDB.
  assemble: () => assembleApplication({ db }),
  title: "Application",
  wireName: "ApplicationWire",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Sessions.md", import.meta.url),
      new URL("./design/compositions/Investigations.md", import.meta.url),
      new URL("./design/compositions/Proposals.md", import.meta.url),
    ],
  },
  // The wire as the browser sees it: refusals become their public error categories.
  // Uses the same policy as the HTTP handler.
  projections: [httpWire({ policy, name: "ApplicationWireHttp" })],
};
