import { closeDb, runMigrations } from "../src/db/client";

runMigrations();
closeDb();
console.log("Database is up to date.");
