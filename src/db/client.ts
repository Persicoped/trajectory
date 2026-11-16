import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const file = process.env.TRAJECTORY_DB ?? "./data/trajectory.db";
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    sqlite = new Database(file);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function runMigrations(): void {
  migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

export function closeDb(): void {
  sqlite?.close();
  sqlite = undefined;
  db = undefined;
}
