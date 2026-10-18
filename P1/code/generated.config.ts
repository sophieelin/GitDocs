import { assembleApplication } from "./src/assembly.ts";
import { db } from "./src/db.ts";

export default {
  // The checker calls this with no arguments. The client connects only on the
  // first query, so checking never needs a running MongoDB.
  assemble: () => assembleApplication({ db }),
  title: "Application",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Sessions.md", import.meta.url),
    ],
  },
};
