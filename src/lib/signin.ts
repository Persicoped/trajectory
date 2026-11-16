import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { apiTokens, credentials, people, spaces } from "../db/schema";
import { hashToken } from "./authz/hash";
import { hashPassword, verifyPassword } from "./passwords";
import { createToken } from "./tokens";

// A small limit on wrong tries, kept in memory: 10 tries in 15 minutes for one
// email in one space.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 10;
const tries = new Map<string, { count: number; start: number }>();

function tooMany(key: string): boolean {
  const now = Date.now();
  const entry = tries.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    tries.set(key, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_TRIES;
}

// Check an email and a password in one space. The reply is a session token, or
// null. It does not say which part was wrong.
export function signIn(slug: string, email: string, plain: string): string | null {
  const key = [slug.toLowerCase(), email.toLowerCase()].join("|");
  if (tooMany(key)) return null;
  const db = getDb();
  const space = db.select().from(spaces).where(eq(spaces.slug, slug.toLowerCase())).get();
  const person = space
    ? db.select().from(people).where(and(eq(people.spaceId, space.id), eq(people.email, email))).get()
    : undefined;
  const stored = person ? db.select().from(credentials).where(eq(credentials.personId, person.id)).get() : undefined;
  const ok = verifyPassword(plain, stored?.passwordHash);
  if (!ok || !person || !person.active) return null;
  tries.delete(key);
  return createToken(person.id, "web session");
}

// End a web session. The token stops working at once.
export function signOut(token: string): void {
  getDb().update(apiTokens).set({ revokedAt: new Date().toISOString() }).where(eq(apiTokens.tokenHash, hashToken(token))).run();
}

export function setPassword(personId: string, plain: string): void {
  const passwordHash = hashPassword(plain);
  getDb()
    .insert(credentials)
    .values({ personId, passwordHash })
    .onConflictDoUpdate({ target: credentials.personId, set: { passwordHash, updatedAt: new Date().toISOString() } })
    .run();
}
