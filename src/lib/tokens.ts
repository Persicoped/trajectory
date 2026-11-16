import { randomBytes } from "node:crypto";
import { getDb } from "../db/client";
import { apiTokens } from "../db/schema";
import { hashToken } from "./authz/hash";

// Make a personal access token. The database keeps only a hash, so the token
// is shown one time.
export function createToken(personId: string, name: string): string {
  const token = `trj_${randomBytes(24).toString("hex")}`;
  getDb().insert(apiTokens).values({ personId, name, tokenHash: hashToken(token) }).run();
  return token;
}
