import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { passwordLinks, people } from "../db/schema";
import { hashToken } from "./authz/hash";
import { setPassword } from "./signin";
import { createToken } from "./tokens";

// A set-password link works one time and ends after 3 days.
const LIFE_MS = 3 * 24 * 60 * 60 * 1000;

export function createPasswordLink(personId: string, origin: string): { url: string; expiresAt: string } {
  const secret = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + LIFE_MS).toISOString();
  getDb().insert(passwordLinks).values({ personId, tokenHash: hashToken(secret), expiresAt }).run();
  return { url: origin + "/set-password?token=" + secret, expiresAt };
}

function liveLink(secret: string) {
  const db = getDb();
  const row = db
    .select()
    .from(passwordLinks)
    .where(and(eq(passwordLinks.tokenHash, hashToken(secret)), isNull(passwordLinks.usedAt)))
    .get();
  if (!row || row.expiresAt <= new Date().toISOString()) return undefined;
  const person = db.select().from(people).where(eq(people.id, row.personId)).get();
  return person && person.active ? { row, person } : undefined;
}

// Who is the link for? This does not use the link.
export function passwordLinkOwner(secret: string): { name: string; email: string } | null {
  const found = liveLink(secret);
  return found ? { name: found.person.name, email: found.person.email } : null;
}

// Use the link: save the password and start a web session.
export function redeemPasswordLink(secret: string, plain: string): string | null {
  const found = liveLink(secret);
  if (!found) return null;
  getDb().update(passwordLinks).set({ usedAt: new Date().toISOString() }).where(eq(passwordLinks.id, found.row.id)).run();
  setPassword(found.person.id, plain);
  return createToken(found.person.id, "web session");
}
