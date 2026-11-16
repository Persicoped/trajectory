// Make a personal access token for a person. The token shows one time.
// Usage: pnpm db:token company-slug person@example.com "token name"
import { and, eq } from "drizzle-orm";
import { closeDb, getDb, runMigrations } from "../src/db/client";
import { people, spaces } from "../src/db/schema";
import { createToken } from "../src/lib/tokens";

const [slug, email, name = "token"] = process.argv.slice(2);
if (!slug || !email) {
  console.error('Usage: pnpm db:token company-slug person@example.com "token name"');
  process.exit(1);
}

runMigrations();
const space = getDb().select().from(spaces).where(eq(spaces.slug, slug)).get();
const person = space && getDb().select().from(people).where(and(eq(people.spaceId, space.id), eq(people.email, email))).get();
if (!person) {
  console.error("No person has this email in this space.");
  process.exit(1);
}
console.log(createToken(person.id, name));
closeDb();
