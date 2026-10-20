import { client, db } from "../src/db.ts";
import { Reserving } from "../src/reserving.ts";

const reserving = new Reserving(db);

try {
  const id = await reserving.reserve("barish", "friday-7pm-table-4");
  console.log("barish reserved friday-7pm-table-4");
  await reserving.claim(id);
  console.log("barish claimed the reservation");
} catch (error) {
  console.log(`barish: ${(error as Error).message}`);
}

try {
  await reserving.reserve("eagon", "friday-7pm-table-4");
  console.log("eagon reserved friday-7pm-table-4");
} catch (error) {
  console.log(`eagon: ${(error as Error).message}`);
}

try {
  await reserving.reserve("carmel", "friday-8pm-table-4");
  console.log("carmel reserved friday-8pm-table-4");
} catch (error) {
  console.log(`carmel: ${(error as Error).message}`);
}

console.log(await reserving.forUser("barish"));
await client.close();
