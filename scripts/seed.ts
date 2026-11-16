// Make a company space, its Owner and a small sample ladder.
// Usage: pnpm db:seed "Owner Name" owner@example.com "Company Name" company-slug
import { closeDb, getDb, runMigrations } from "../src/db/client";
import * as t from "../src/db/schema";
import { createSpace, signUp, SlugTaken } from "../src/lib/spaces";

const [ownerName, ownerEmail, name, slug] = process.argv.slice(2);
const input = signUp.safeParse({ ownerName, ownerEmail, name, slug });
if (!input.success) {
  console.error('Usage: pnpm db:seed "Owner Name" owner@example.com "Company Name" company-slug');
  for (const issue of input.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

runMigrations();
const db = getDb();
let made;
try {
  made = createSpace(input.data);
} catch (error) {
  if (!(error instanceof SlugTaken)) throw error;
  console.error("This space name is taken. Nothing was changed.");
  process.exit(1);
}
const { space, owner, token } = made;

// A sample ladder with example numbers. Change them for your company.
const ladder = db
  .insert(t.ladders)
  .values({ spaceId: space.id, name: "AI Developer", description: "Sample ladder. All numbers are examples." })
  .returning()
  .get();
const bands = [
  { name: "Trainee", min: 1200, max: 1200, levels: [["Trainee", 1200]] },
  { name: "Apprentice", min: 1500, max: 1700, levels: [["Apprentice 1", 1500], ["Apprentice 2", 1600], ["Apprentice 3", 1700]] },
] as const;
bands.forEach((band, i) => {
  const row = db
    .insert(t.payBands)
    .values({ ladderId: ladder.id, name: band.name, position: i + 1, minRateCents: band.min, maxRateCents: band.max, minDurationDays: 30 })
    .returning()
    .get();
  band.levels.forEach(([title, rate], j) => {
    db.insert(t.levels).values({ payBandId: row.id, title, position: j + 1, recommendedRateCents: rate, minDurationDays: 30 }).run();
  });
});
closeDb();

console.log(`Space: ${space.name} (${space.slug})`);
console.log(`Owner: ${owner.email}`);
console.log("Token (shown one time, keep it safe):");
console.log(token);
